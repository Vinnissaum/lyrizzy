use crate::domain::background::{BackgroundInfo, BackgroundPreset, FontFamily, FontSize, Typography};
use crate::domain::media::MediaKind;
use sqlx::{Row, SqlitePool};

fn kind_from_str(s: &str) -> MediaKind {
    if s == "video" {
        MediaKind::Video
    } else {
        MediaKind::Image
    }
}

fn parse_preset(s: &str) -> BackgroundPreset {
    match s {
        "branco-preto" => BackgroundPreset::BrancoPreto,
        _ => BackgroundPreset::PretoBranco,
    }
}

fn parse_font_family(s: Option<&str>) -> FontFamily {
    match s {
        Some("serif") => FontFamily::Serif,
        Some("mono") => FontFamily::Mono,
        _ => FontFamily::Sans,
    }
}

fn parse_font_size(s: Option<&str>) -> FontSize {
    match s {
        Some("sm") => FontSize::Sm,
        Some("md") => FontSize::Md,
        Some("xl") => FontSize::Xl,
        _ => FontSize::Lg,
    }
}

fn typography_from(family_str: Option<&str>, size_str: Option<&str>) -> Option<Typography> {
    if family_str.is_some() || size_str.is_some() {
        Some(Typography {
            font_family: parse_font_family(family_str),
            font_size: parse_font_size(size_str),
        })
    } else {
        None
    }
}

/// Resolves the effective background for a song slide via the
/// section → song → None fallback chain.
///
/// `restart_on_section_boundary` is `true` for section-level overrides
/// and `false` for song-level backgrounds.
pub async fn resolve_for_slide(
    pool: &SqlitePool,
    song_id: &str,
    section_id: &str,
) -> Result<Option<BackgroundInfo>, sqlx::Error> {
    // 1. Section-level override
    if !section_id.is_empty() {
        let row = sqlx::query(
            "SELECT ss.background_id, ss.background_mode, ss.background_preset, \
                    ss.font_family, ss.font_size, \
                    m.file_name, m.kind, s.scrim_opacity \
             FROM song_sections ss \
             JOIN songs s ON s.id = ss.song_id \
             LEFT JOIN media m ON m.id = ss.background_id AND m.deleted_at IS NULL \
             WHERE ss.id = ? AND ss.song_id = ?",
        )
        .bind(section_id)
        .bind(song_id)
        .fetch_optional(pool)
        .await?;

        if let Some(row) = row {
            let mode: Option<String> = row.get("background_mode");
            let family_str: Option<String> = row.get("font_family");
            let size_str: Option<String> = row.get("font_size");

            if mode.as_deref() == Some("preset") {
                let preset_str: Option<String> = row.get("background_preset");
                let preset = parse_preset(preset_str.as_deref().unwrap_or("preto-branco"));
                return Ok(Some(BackgroundInfo {
                    media_kind: None,
                    asset_url: None,
                    scrim_opacity: 0,
                    restart_on_section_boundary: true,
                    preset: Some(preset),
                    typography: typography_from(
                        family_str.as_deref(),
                        size_str.as_deref(),
                    ),
                }));
            }

            let bg_id: Option<String> = row.get("background_id");
            let file_name: Option<String> = row.get("file_name");
            let scrim: i32 = row.get::<Option<i32>, _>("scrim_opacity").unwrap_or(35);

            if bg_id.is_some() {
                if let Some(fname) = file_name {
                    let kind_str: String = row.get("kind");
                    return Ok(Some(BackgroundInfo {
                        media_kind: Some(kind_from_str(&kind_str)),
                        asset_url: Some(crate::protocol::asset::url_for(&fname)),
                        scrim_opacity: scrim.clamp(0, 100) as u8,
                        restart_on_section_boundary: true,
                        preset: None,
                        typography: typography_from(
                            family_str.as_deref(),
                            size_str.as_deref(),
                        ),
                    }));
                }
                // background_id set but media is soft-deleted — fall through
                eprintln!("[trinity] section {section_id} background_id points at deleted media, falling through to song level");
            }
        }
    }

    // 2. Song-level fallback
    let song_row = sqlx::query(
        "SELECT s.background_id, s.background_mode, s.background_preset, \
                s.font_family, s.font_size, \
                s.scrim_opacity, m.file_name, m.kind \
         FROM songs s \
         LEFT JOIN media m ON m.id = s.background_id AND m.deleted_at IS NULL \
         WHERE s.id = ? AND s.deleted_at IS NULL",
    )
    .bind(song_id)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = song_row {
        let mode: Option<String> = row.get("background_mode");
        let family_str: Option<String> = row.get("font_family");
        let size_str: Option<String> = row.get("font_size");

        if mode.as_deref() == Some("preset") {
            let preset_str: Option<String> = row.get("background_preset");
            let preset = parse_preset(preset_str.as_deref().unwrap_or("preto-branco"));
            return Ok(Some(BackgroundInfo {
                media_kind: None,
                asset_url: None,
                scrim_opacity: 0,
                restart_on_section_boundary: false,
                preset: Some(preset),
                typography: typography_from(
                    family_str.as_deref(),
                    size_str.as_deref(),
                ),
            }));
        }

        let file_name: Option<String> = row.get("file_name");
        let scrim: i32 = row.get::<Option<i32>, _>("scrim_opacity").unwrap_or(35);

        if let Some(fname) = file_name {
            let kind_str: String = row.get("kind");
            return Ok(Some(BackgroundInfo {
                media_kind: Some(kind_from_str(&kind_str)),
                asset_url: Some(crate::protocol::asset::url_for(&fname)),
                scrim_opacity: scrim.clamp(0, 100) as u8,
                restart_on_section_boundary: false,
                preset: None,
                typography: typography_from(
                    family_str.as_deref(),
                    size_str.as_deref(),
                ),
            }));
        }
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::song::{db_create_song, CreateSongPayload, SectionPayload};
    use crate::db::media::db_insert_media;
    use crate::domain::media::{Media, MediaKind as DomainKind};
    use crate::domain::song::SectionType;
    use sqlx::sqlite::SqliteConnectOptions;
    use std::str::FromStr;
    use tempfile::tempdir;

    async fn open_db() -> (SqlitePool, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let path = dir.path().join("bg_test.db");
        let url = format!("sqlite://{}?mode=rwc", path.to_string_lossy());
        let opts = SqliteConnectOptions::from_str(&url)
            .unwrap()
            .create_if_missing(true);
        let pool = SqlitePool::connect_with(opts).await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        (pool, dir)
    }

    fn make_media(id: &str, kind: DomainKind) -> Media {
        Media {
            id: id.to_string(),
            file_name: format!("{id}.mp4"),
            display_name: id.to_string(),
            kind,
            mime_type: "video/mp4".into(),
            width: None,
            height: None,
            duration_ms: None,
            thumbnail_file: None,
            byte_size: 0,
            created_at: 0,
            updated_at: 0,
            deleted_at: None,
            slide_count: None,
        }
    }

    fn sec(bg: Option<&str>) -> SectionPayload {
        SectionPayload {
            label: "V1".into(),
            section_type: SectionType::Verse,
            body: "line".into(),
            sort_order: 0,
            repeat_count: Some(1),
            notes: None,
            background_id: bg.map(|s| s.to_string()),
            background_mode: None,
            background_preset: None,
            font_family: None,
            font_size: None,
        }
    }

    fn sec_preset(preset: &str, family: &str, size: &str) -> SectionPayload {
        SectionPayload {
            label: "V1".into(),
            section_type: SectionType::Verse,
            body: "line".into(),
            sort_order: 0,
            repeat_count: Some(1),
            notes: None,
            background_id: None,
            background_mode: Some("preset".into()),
            background_preset: Some(preset.into()),
            font_family: Some(family.into()),
            font_size: Some(size.into()),
        }
    }

    fn song_payload(bg: Option<&str>, scrim: Option<i32>, section: SectionPayload) -> CreateSongPayload {
        CreateSongPayload {
            title: "Song".into(),
            artist: None,
            author: None,
            copyright: None,
            ccli_number: None,
            key_signature: None,
            language: None,
            notes: None,
            background_id: bg.map(|s| s.to_string()),
            scrim_opacity: scrim,
            slide_config: None,
            source: None,
            background_mode: None,
            background_preset: None,
            font_family: None,
            font_size: None,
            text_casing: None,
            sections: vec![section],
        }
    }

    fn song_preset_payload(preset: &str, family: &str, size: &str, section: SectionPayload) -> CreateSongPayload {
        CreateSongPayload {
            title: "Song".into(),
            artist: None,
            author: None,
            copyright: None,
            ccli_number: None,
            key_signature: None,
            language: None,
            notes: None,
            background_id: None,
            scrim_opacity: None,
            slide_config: None,
            source: None,
            background_mode: Some("preset".into()),
            background_preset: Some(preset.into()),
            font_family: Some(family.into()),
            font_size: Some(size.into()),
            text_casing: None,
            sections: vec![section],
        }
    }

    #[tokio::test]
    async fn returns_section_override_with_restart_true() {
        let (pool, _dir) = open_db().await;
        let media = make_media("sec-bg", DomainKind::Image);
        db_insert_media(&pool, &media).await.unwrap();

        let song = db_create_song(&pool, song_payload(None, Some(40), sec(Some("sec-bg"))))
            .await
            .unwrap();

        let section_id = &song.sections[0].id;
        let bg = resolve_for_slide(&pool, &song.id, section_id)
            .await
            .unwrap()
            .expect("should resolve section bg");

        assert!(bg.restart_on_section_boundary);
        assert!(bg.asset_url.as_deref().unwrap_or("").contains("sec-bg.mp4"));
        assert_eq!(bg.scrim_opacity, 40);
        assert!(bg.preset.is_none());
    }

    #[tokio::test]
    async fn falls_through_deleted_section_bg_to_song_level() {
        let (pool, _dir) = open_db().await;
        db_insert_media(&pool, &make_media("sec-deleted", DomainKind::Image)).await.unwrap();
        db_insert_media(&pool, &make_media("song-bg", DomainKind::Video)).await.unwrap();

        sqlx::query("UPDATE media SET deleted_at = 1 WHERE id = 'sec-deleted'")
            .execute(&pool)
            .await
            .unwrap();

        let song = db_create_song(
            &pool,
            song_payload(Some("song-bg"), Some(30), sec(Some("sec-deleted"))),
        )
        .await
        .unwrap();

        let section_id = &song.sections[0].id;
        let bg = resolve_for_slide(&pool, &song.id, section_id)
            .await
            .unwrap()
            .expect("should fall through to song bg");

        assert!(!bg.restart_on_section_boundary);
        assert!(bg.asset_url.as_deref().unwrap_or("").contains("song-bg.mp4"));
    }

    #[tokio::test]
    async fn returns_song_level_bg_with_restart_false() {
        let (pool, _dir) = open_db().await;
        db_insert_media(&pool, &make_media("song-only", DomainKind::Video)).await.unwrap();

        let song = db_create_song(&pool, song_payload(Some("song-only"), None, sec(None)))
            .await
            .unwrap();

        let section_id = &song.sections[0].id;
        let bg = resolve_for_slide(&pool, &song.id, section_id)
            .await
            .unwrap()
            .expect("should resolve song bg");

        assert!(!bg.restart_on_section_boundary);
        assert_eq!(bg.media_kind, Some(MediaKind::Video));
    }

    #[tokio::test]
    async fn returns_none_when_no_background() {
        let (pool, _dir) = open_db().await;
        let song = db_create_song(&pool, song_payload(None, None, sec(None)))
            .await
            .unwrap();

        let section_id = &song.sections[0].id;
        let result = resolve_for_slide(&pool, &song.id, section_id)
            .await
            .unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn section_preset_overrides_song_media() {
        let (pool, _dir) = open_db().await;
        db_insert_media(&pool, &make_media("song-media", DomainKind::Image)).await.unwrap();

        let song = db_create_song(
            &pool,
            song_payload(Some("song-media"), None, sec_preset("preto-branco", "serif", "lg")),
        )
        .await
        .unwrap();

        let section_id = &song.sections[0].id;
        let bg = resolve_for_slide(&pool, &song.id, section_id)
            .await
            .unwrap()
            .expect("should resolve section preset");

        assert_eq!(bg.preset, Some(BackgroundPreset::PretoBranco));
        assert!(bg.asset_url.is_none());
        assert!(bg.restart_on_section_boundary);
        let typo = bg.typography.expect("typography set");
        assert_eq!(typo.font_family, FontFamily::Serif);
        assert_eq!(typo.font_size, FontSize::Lg);
    }

    #[tokio::test]
    async fn song_level_preset_returned_when_section_has_nothing() {
        let (pool, _dir) = open_db().await;

        let song = db_create_song(
            &pool,
            song_preset_payload("branco-preto", "mono", "xl", sec(None)),
        )
        .await
        .unwrap();

        let section_id = &song.sections[0].id;
        let bg = resolve_for_slide(&pool, &song.id, section_id)
            .await
            .unwrap()
            .expect("should resolve song preset");

        assert_eq!(bg.preset, Some(BackgroundPreset::BrancoPreto));
        assert!(!bg.restart_on_section_boundary);
        let typo = bg.typography.expect("typography set");
        assert_eq!(typo.font_family, FontFamily::Mono);
        assert_eq!(typo.font_size, FontSize::Xl);
    }
}
