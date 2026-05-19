use crate::commands::song::{new_id, section_type_to_db};
use crate::domain::error::ErrorPayload;
use crate::domain::song::SectionType;
use crate::services::holyrics_parser;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HolyricsSongPayload {
    pub title: String,
    pub artist: String,
    pub sections: Vec<HolyricsSectionPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HolyricsSectionPayload {
    pub number: u32,
    pub description: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedFileResult {
    pub songs: Vec<HolyricsSongPayload>,
    pub duplicate_indices: Vec<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub imported: u32,
    pub skipped: u32,
    pub failed: Vec<FailedImport>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FailedImport {
    pub title: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
struct SongsChangedEvent;

fn normalize(s: &str) -> String {
    s.trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

async fn is_duplicate(
    pool: &sqlx::SqlitePool,
    title: &str,
    artist: &str,
) -> Result<bool, ErrorPayload> {
    let norm_title = normalize(title);
    let norm_artist = normalize(artist);
    let rows = sqlx::query(
        "SELECT id FROM songs WHERE deleted_at IS NULL
         AND lower(trim(title)) = ? AND lower(trim(COALESCE(artist,''))) = ?
         LIMIT 1",
    )
    .bind(&norm_title)
    .bind(&norm_artist)
    .fetch_all(pool)
    .await
    .map_err(|e| ErrorPayload::new("import.parse_error").with_param("detail", e.to_string()))?;
    Ok(!rows.is_empty())
}

/// Read a JSON file and parse it as a Holyrics export.
/// Returns the parsed songs with flags for which are duplicates.
#[tauri::command]
pub async fn parse_holyrics_file(
    state: State<'_, AppState>,
    path: String,
) -> Result<ParsedFileResult, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");

    let content = std::fs::read_to_string(&path)
        .map_err(|e| ErrorPayload::new("import.io_error").with_param("detail", e.to_string()))?;

    let parsed = holyrics_parser::parse(&content)
        .map_err(|e| ErrorPayload::new("import.parse_error").with_param("detail", e.to_string()))?;

    let mut songs: Vec<HolyricsSongPayload> = Vec::new();
    let mut duplicate_indices: Vec<usize> = Vec::new();

    for (i, song) in parsed.iter().enumerate() {
        let payload = HolyricsSongPayload {
            title: song.title.clone(),
            artist: song.artist.clone(),
            sections: song
                .sections
                .iter()
                .map(|s| HolyricsSectionPayload {
                    number: s.number,
                    description: s.description.clone(),
                    text: s.text.clone(),
                })
                .collect(),
        };

        if is_duplicate(pool, &song.title, &song.artist).await? {
            duplicate_indices.push(i);
        }

        songs.push(payload);
    }

    Ok(ParsedFileResult {
        songs,
        duplicate_indices,
    })
}

/// Import a batch of Holyrics songs into the DB.
/// Each song is inserted in its own transaction. Per-song failures accumulate
/// in the report rather than aborting the batch.
#[tauri::command]
pub async fn import_holyrics_batch(
    state: State<'_, AppState>,
    app: AppHandle,
    payload: Vec<HolyricsSongPayload>,
) -> Result<ImportReport, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    let mut imported = 0u32;
    let mut skipped = 0u32;
    let mut failed: Vec<FailedImport> = Vec::new();

    for song in &payload {
        let title = song.title.trim();
        if title.is_empty() {
            skipped += 1;
            failed.push(FailedImport {
                title: song.title.clone(),
                reason: "título vazio".to_string(),
            });
            continue;
        }

        // Duplicate check at import time (user may have forced a duplicate through)
        if is_duplicate(pool, title, &song.artist)
            .await
            .unwrap_or(false)
        {
            skipped += 1;
            continue;
        }

        match insert_song(pool, song).await {
            Ok(_) => imported += 1,
            Err(e) => failed.push(FailedImport {
                title: title.to_string(),
                reason: format!("Falha ao inserir: {}", e.params.get("detail").map(String::as_str).unwrap_or(&e.code)),
            }),
        }
    }

    if imported > 0 {
        let _ = app.emit("songs_changed", SongsChangedEvent);
    }

    Ok(ImportReport {
        imported,
        skipped,
        failed,
    })
}

async fn insert_song(pool: &sqlx::SqlitePool, song: &HolyricsSongPayload) -> Result<(), ErrorPayload> {
    let song_id = new_id();
    let now = now_ms();

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| ErrorPayload::new("import.parse_error").with_param("detail", e.to_string()))?;

    sqlx::query(
        "INSERT INTO songs (id, title, artist, language, source, created_at, updated_at)
         VALUES (?, ?, ?, 'pt', 'holyrics', ?, ?)",
    )
    .bind(&song_id)
    .bind(song.title.trim())
    .bind(if song.artist.is_empty() {
        None
    } else {
        Some(song.artist.trim())
    })
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| ErrorPayload::new("import.parse_error").with_param("detail", e.to_string()))?;

    for (idx, sec) in song.sections.iter().enumerate() {
        let sec_id = new_id();
        let label = if sec.description.trim().is_empty() {
            format!("Estrofe {}", sec.number)
        } else {
            sec.description.trim().to_string()
        };
        let sort_order = (sec.number as i32) - 1;

        sqlx::query(
            "INSERT INTO song_sections (id, song_id, label, type, body, sort_order, repeat_count)
             VALUES (?, ?, ?, ?, ?, ?, 1)",
        )
        .bind(&sec_id)
        .bind(&song_id)
        .bind(&label)
        .bind(section_type_to_db(&SectionType::Verse))
        .bind(sec.text.trim())
        .bind(sort_order)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            ErrorPayload::new("import.parse_error")
                .with_param("detail", format!("seção {idx}: {e}"))
        })?;
    }

    tx.commit()
        .await
        .map_err(|e| ErrorPayload::new("import.parse_error").with_param("detail", e.to_string()))?;

    Ok(())
}
