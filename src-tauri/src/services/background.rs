use crate::domain::background::BackgroundInfo;
use crate::domain::media::MediaKind;
use sqlx::{Row, SqlitePool};

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
            "SELECT ss.background_id, m.file_name, m.kind, s.scrim_opacity \
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
            let bg_id: Option<String> = row.get("background_id");
            let file_name: Option<String> = row.get("file_name");
            let scrim: i32 = row.get::<Option<i32>, _>("scrim_opacity").unwrap_or(35);

            if bg_id.is_some() {
                if let Some(fname) = file_name {
                    let kind_str: String = row.get("kind");
                    return Ok(Some(BackgroundInfo {
                        media_kind: kind_from_str(&kind_str),
                        asset_url: format!("asset://localhost/media/{fname}"),
                        scrim_opacity: scrim.clamp(0, 100) as u8,
                        restart_on_section_boundary: true,
                    }));
                }
                // background_id set but media is soft-deleted — fall through
                eprintln!("[trinity] section {section_id} background_id points at deleted media, falling through to song level");
            }
        }
    }

    // 2. Song-level fallback
    let song_row = sqlx::query(
        "SELECT s.background_id, s.scrim_opacity, m.file_name, m.kind \
         FROM songs s \
         LEFT JOIN media m ON m.id = s.background_id AND m.deleted_at IS NULL \
         WHERE s.id = ? AND s.deleted_at IS NULL",
    )
    .bind(song_id)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = song_row {
        let file_name: Option<String> = row.get("file_name");
        let scrim: i32 = row.get::<Option<i32>, _>("scrim_opacity").unwrap_or(35);

        if let Some(fname) = file_name {
            let kind_str: String = row.get("kind");
            return Ok(Some(BackgroundInfo {
                media_kind: kind_from_str(&kind_str),
                asset_url: format!("asset://localhost/media/{fname}"),
                scrim_opacity: scrim.clamp(0, 100) as u8,
                restart_on_section_boundary: false,
            }));
        }
    }

    Ok(None)
}

fn kind_from_str(s: &str) -> MediaKind {
    if s == "video" {
        MediaKind::Video
    } else {
        MediaKind::Image
    }
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
        assert!(bg.asset_url.contains("sec-bg.mp4"));
        assert_eq!(bg.scrim_opacity, 40);
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
        assert!(bg.asset_url.contains("song-bg.mp4"));
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
        assert_eq!(bg.media_kind, MediaKind::Video);
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
}
