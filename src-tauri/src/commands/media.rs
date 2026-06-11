use crate::db::media::{
    db_count_references, db_get_references, db_insert_media, db_list_media, db_rename_media,
    db_soft_delete_media, unique_display_name, ListMediaParams, SectionRef as DbSectionRef,
};
use crate::domain::error::ErrorPayload;
use crate::domain::media::{Media, MediaKind};
use crate::protocol::asset;
use crate::services::{libreoffice, media_probe, thumbnail};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SongRef {
    pub id: String,
    pub title: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetItemRef {
    pub set_id: String,
    pub set_name: String,
    pub item_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSectionRef {
    pub song_id: String,
    pub song_title: String,
    pub section_id: String,
    pub section_label: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaReferences {
    pub songs: Vec<SongRef>,
    pub set_items: Vec<SetItemRef>,
    pub sections: Vec<MediaSectionRef>,
}

// ── Params ────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListMediaParamsInput {
    pub kind: Option<MediaKind>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Import a media file into the library.
///
/// Validates extension, copies the file to the media directory under a UUID
/// filename, probes metadata, generates a video thumbnail if applicable, then
/// inserts a row into the `media` table.  On DB insert failure the copied
/// file(s) are deleted so no orphans accumulate on disk.
#[tauri::command]
pub async fn import_media(
    app: AppHandle,
    state: State<'_, AppState>,
    source_path: String,
) -> Result<Media, ErrorPayload> {
    let src = Path::new(&source_path);

    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or_else(|| ErrorPayload::new("media.no_extension"))?;

    let kind = match ext.as_str() {
        "png" | "jpg" | "jpeg" | "webp" | "gif" => MediaKind::Image,
        "mp4" | "webm" => MediaKind::Video,
        _ => {
            return Err(ErrorPayload::new("media.unsupported_container").with_param("ext", &ext))
        }
    };

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    let resource_dir = app.path().resource_dir().ok();
    let media_dir = asset::media_dir(&data_dir);
    let pool = state.db.get().expect("db must be initialized");

    let uuid = Uuid::new_v4().to_string();
    let file_name = format!("{uuid}.{ext}");
    let dest = media_dir.join(&file_name);

    // Copy file before opening the transaction window
    std::fs::copy(&source_path, &dest)
        .map_err(|e| ErrorPayload::new("media.copy_error").with_param("detail", e.to_string()))?;

    // Probe — non-fatal; fall back to sensible defaults
    let meta = match media_probe::probe(&dest, kind.clone(), resource_dir.as_deref()) {
        Ok(m) => m,
        Err(e) => {
            eprintln!("[trinity] media probe failed ({file_name}): {e}");
            media_probe::MediaMetadata {
                width: if kind == MediaKind::Video {
                    Some(1920)
                } else {
                    None
                },
                height: if kind == MediaKind::Video {
                    Some(1080)
                } else {
                    None
                },
                duration_ms: None,
                mime_type: media_probe::mime_for_ext(&ext).to_string(),
                byte_size: std::fs::metadata(&dest).map(|m| m.len() as i64).unwrap_or(0),
            }
        }
    };

    // Thumbnail — non-fatal; videos get thumbnail_file = None when ffmpeg missing
    let thumbnail_file = if kind == MediaKind::Video {
        let thumb_name = format!("{uuid}.thumb.jpg");
        let thumb_path = media_dir.join(&thumb_name);
        match thumbnail::generate(&dest, &thumb_path, resource_dir.as_deref()).await {
            Ok(_) => Some(thumb_name),
            Err(e) => {
                eprintln!("[trinity] thumbnail failed ({file_name}): {e}");
                None
            }
        }
    } else {
        None
    };

    let original_name = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&file_name)
        .to_string();

    let display_name = unique_display_name(pool, &original_name)
        .await
        .map_err(|e| ErrorPayload::new("media.db_error").with_param("detail", e.to_string()))?;

    let now = now_ms();
    let media = Media {
        id: uuid,
        file_name: file_name.clone(),
        display_name,
        kind,
        mime_type: meta.mime_type,
        width: meta.width.map(|w| w as i64),
        height: meta.height.map(|h| h as i64),
        duration_ms: meta.duration_ms,
        thumbnail_file: thumbnail_file.clone(),
        byte_size: meta.byte_size,
        created_at: now,
        updated_at: now,
        deleted_at: None,
        slide_count: None,
    };

    if let Err(e) = db_insert_media(pool, &media).await {
        let _ = std::fs::remove_file(&dest);
        if let Some(thumb) = &thumbnail_file {
            let _ = std::fs::remove_file(media_dir.join(thumb));
        }
        return Err(
            ErrorPayload::new("media.db_error").with_param("detail", e.to_string())
        );
    }

    app.emit("media_library_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;

    Ok(media)
}

#[tauri::command]
pub async fn list_media(
    state: State<'_, AppState>,
    params: Option<ListMediaParamsInput>,
) -> Result<Vec<Media>, ErrorPayload> {
    let pool = state.db.get().expect("db must be initialized");
    let p = params.unwrap_or(ListMediaParamsInput {
        kind: None,
        search: None,
        limit: None,
        offset: None,
    });
    db_list_media(
        pool,
        &ListMediaParams {
            kind: p.kind,
            search: p.search,
            limit: p.limit,
            offset: p.offset,
        },
    )
    .await
    .map_err(|e| ErrorPayload::new("media.db_error").with_param("detail", e.to_string()))
}

#[tauri::command]
pub async fn rename_media(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    display_name: String,
) -> Result<Media, ErrorPayload> {
    if display_name.trim().is_empty() {
        return Err(ErrorPayload::new("media.validation.name_required"));
    }
    let pool = state.db.get().expect("db must be initialized");
    let updated = db_rename_media(pool, &id, &display_name, now_ms())
        .await
        .map_err(|e| ErrorPayload::new("media.db_error").with_param("detail", e.to_string()))?
        .ok_or_else(|| ErrorPayload::new("media.not_found").with_param("id", &id))?;

    app.emit("media_library_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;

    Ok(updated)
}

#[tauri::command]
pub async fn delete_media(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), ErrorPayload> {
    let pool = state.db.get().expect("db must be initialized");

    let (song_count, set_item_count, section_count) = db_count_references(pool, &id)
        .await
        .map_err(|e| ErrorPayload::new("media.db_error").with_param("detail", e.to_string()))?;

    if song_count > 0 || set_item_count > 0 || section_count > 0 {
        return Err(ErrorPayload::new("media.in_use")
            .with_param("songCount", song_count.to_string())
            .with_param("setItemCount", set_item_count.to_string())
            .with_param("sectionCount", section_count.to_string()));
    }

    db_soft_delete_media(pool, &id, now_ms())
        .await
        .map_err(|e| ErrorPayload::new("media.db_error").with_param("detail", e.to_string()))?;

    app.emit("media_library_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub fn check_ffprobe(app: AppHandle) -> bool {
    let resource_dir = app.path().resource_dir().ok();
    crate::services::ffmpeg::ffprobe_path(resource_dir.as_deref()).is_some()
}

#[tauri::command]
pub fn check_libreoffice(app: AppHandle) -> bool {
    let resource_dir = app.path().resource_dir().ok();
    libreoffice::soffice_path(resource_dir.as_deref()).is_some()
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConversionProgress {
    pub media_id: String,
    pub status: String,
    pub message: Option<String>,
}

/// Import a PPTX, PDF, PPT, or ODP file into the media library.
///
/// Copies the source, runs LibreOffice headless conversion to PNG slides,
/// normalises filenames to slide_000.png…, inserts a Presentation media record.
#[tauri::command]
pub async fn import_presentation(
    app: AppHandle,
    state: State<'_, AppState>,
    source_path: String,
) -> Result<Media, ErrorPayload> {
    let src = Path::new(&source_path);

    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or_else(|| ErrorPayload::new("media.no_extension"))?;

    match ext.as_str() {
        "pptx" | "ppt" | "pdf" | "odp" => {}
        _ => {
            return Err(
                ErrorPayload::new("media.unsupported_container").with_param("ext", &ext),
            )
        }
    }

    let resource_dir = app.path().resource_dir().ok();
    let soffice = libreoffice::soffice_path(resource_dir.as_deref())
        .ok_or_else(|| ErrorPayload::new("media.libreoffice_not_found"))?;

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    let media_dir = asset::media_dir(&data_dir);
    let pool = state.db.get().expect("db must be initialized");

    let uuid = Uuid::new_v4().to_string();
    let file_name = format!("{uuid}.{ext}");
    let dest = media_dir.join(&file_name);
    let out_dir = media_dir.join(&uuid);

    // Copy source file
    std::fs::copy(&source_path, &dest)
        .map_err(|e| ErrorPayload::new("media.copy_error").with_param("detail", e.to_string()))?;

    // Create output directory for PNG slides
    if let Err(e) = std::fs::create_dir_all(&out_dir) {
        let _ = std::fs::remove_file(&dest);
        return Err(
            ErrorPayload::new("media.conversion_failed").with_param("detail", e.to_string()),
        );
    }

    // Signal conversion in progress
    let _ = app.emit(
        "conversion_progress",
        ConversionProgress {
            media_id: uuid.clone(),
            status: "converting".to_string(),
            message: None,
        },
    );

    // Convert to per-slide PNGs (LibreOffice → PDF → pdfium rasterization).
    let slides = match libreoffice::convert_to_slides(&soffice, resource_dir.clone(), &dest, &out_dir).await {
        Ok(s) => s,
        Err(e) => {
            let _ = std::fs::remove_file(&dest);
            let _ = std::fs::remove_dir_all(&out_dir);
            let _ = app.emit(
                "conversion_progress",
                ConversionProgress {
                    media_id: uuid.clone(),
                    status: "error".to_string(),
                    message: Some(e.clone()),
                },
            );
            return Err(
                ErrorPayload::new("media.conversion_failed").with_param("detail", e),
            );
        }
    };

    let slide_count = slides.len() as i64;
    if slide_count == 0 {
        let _ = std::fs::remove_file(&dest);
        let _ = std::fs::remove_dir_all(&out_dir);
        return Err(ErrorPayload::new("media.conversion_failed")
            .with_param("detail", "no slides produced"));
    }

    let original_name = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&file_name)
        .to_string();
    let display_name = unique_display_name(pool, &original_name)
        .await
        .map_err(|e| ErrorPayload::new("media.db_error").with_param("detail", e.to_string()))?;

    let byte_size = std::fs::metadata(&dest).map(|m| m.len() as i64).unwrap_or(0);
    let now = now_ms();
    let thumbnail_file = format!("{uuid}/slide_000.png");
    let mime_type = match ext.as_str() {
        "pdf" => "application/pdf",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "ppt" => "application/vnd.ms-powerpoint",
        "odp" => "application/vnd.oasis.opendocument.presentation",
        _ => "application/octet-stream",
    };

    let media = Media {
        id: uuid.clone(),
        file_name: file_name.clone(),
        display_name,
        kind: MediaKind::Presentation,
        mime_type: mime_type.to_string(),
        width: None,
        height: None,
        duration_ms: None,
        thumbnail_file: Some(thumbnail_file),
        byte_size,
        created_at: now,
        updated_at: now,
        deleted_at: None,
        slide_count: Some(slide_count),
    };

    if let Err(e) = db_insert_media(pool, &media).await {
        let _ = std::fs::remove_file(&dest);
        let _ = std::fs::remove_dir_all(&out_dir);
        return Err(
            ErrorPayload::new("media.db_error").with_param("detail", e.to_string()),
        );
    }

    let _ = app.emit("media_library_changed", ());
    let _ = app.emit(
        "conversion_progress",
        ConversionProgress {
            media_id: uuid,
            status: "done".to_string(),
            message: None,
        },
    );

    Ok(media)
}

#[tauri::command]
pub async fn get_media_references(
    state: State<'_, AppState>,
    id: String,
) -> Result<MediaReferences, ErrorPayload> {
    let pool = state.db.get().expect("db must be initialized");
    let refs = db_get_references(pool, &id)
        .await
        .map_err(|e| ErrorPayload::new("media.db_error").with_param("detail", e.to_string()))?;

    Ok(MediaReferences {
        songs: refs
            .songs
            .into_iter()
            .map(|s| SongRef {
                id: s.id,
                title: s.title,
            })
            .collect(),
        set_items: refs
            .set_items
            .into_iter()
            .map(|si| SetItemRef {
                set_id: si.set_id,
                set_name: si.set_name,
                item_id: si.item_id,
            })
            .collect(),
        sections: refs
            .sections
            .into_iter()
            .map(|sec: DbSectionRef| MediaSectionRef {
                song_id: sec.song_id,
                song_title: sec.song_title,
                section_id: sec.section_id,
                section_label: sec.section_label,
            })
            .collect(),
    })
}
