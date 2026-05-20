use sqlx::{sqlite::SqliteConnectOptions, Row, SqlitePool};
use std::str::FromStr;
use tempfile::tempdir;

async fn open_test_db() -> SqlitePool {
    let dir = tempdir().expect("temp dir");
    let db_path = dir.path().join("test.db");
    let url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());
    let options = SqliteConnectOptions::from_str(&url)
        .unwrap()
        .create_if_missing(true);
    let pool = SqlitePool::connect_with(options).await.unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    std::mem::forget(dir);
    pool
}

// Import the testable DB functions from the library crate.
use tauri_app_lib::commands::song::{
    db_create_song, db_delete_song, db_get_song, db_list_songs, CreateSongPayload,
    ListSongsParams, SectionPayload, UpdateSongPayload, db_update_song,
};
use tauri_app_lib::domain::song::SectionType;

fn verse_section(label: &str, body: &str) -> SectionPayload {
    SectionPayload {
        label: label.to_string(),
        section_type: SectionType::Verse,
        body: body.to_string(),
        sort_order: 0,
        repeat_count: None,
        notes: None,
        background_id: None,
    }
}

#[tokio::test]
async fn create_song_inserts_song_and_sections() {
    let pool = open_test_db().await;

    let payload = CreateSongPayload {
        title: "Amazing Grace".to_string(),
        artist: Some("John Newton".to_string()),
        author: None,
        copyright: None,
        ccli_number: None,
        key_signature: None,
        language: Some("en".to_string()),
        notes: None,
        background_id: None,
        scrim_opacity: None,
        slide_config: None,
        source: None,
        sections: vec![
            SectionPayload {
                label: "Estrofe 1".to_string(),
                section_type: SectionType::Verse,
                body: "Amazing grace how sweet the sound".to_string(),
                sort_order: 0,
                repeat_count: Some(1),
                notes: None,
                background_id: None,
            },
            SectionPayload {
                label: "Refrão".to_string(),
                section_type: SectionType::Chorus,
                body: "Praise the Lord".to_string(),
                sort_order: 1,
                repeat_count: None,
                notes: None,
                background_id: None,
            },
        ],
    };

    let song = db_create_song(&pool, payload).await.unwrap();

    assert_eq!(song.title, "Amazing Grace");
    assert_eq!(song.artist.as_deref(), Some("John Newton"));
    assert_eq!(song.language, "en");
    assert_eq!(song.sections.len(), 2);
    assert_eq!(song.sections[0].label, "Estrofe 1");
    assert_eq!(song.sections[1].label, "Refrão");
    assert!(song.deleted_at.is_none());

    // Verify DB persistence
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM song_sections WHERE song_id = ?")
        .bind(&song.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 2);
}

#[tokio::test]
async fn update_song_replaces_sections_in_transaction() {
    let pool = open_test_db().await;

    let created = db_create_song(
        &pool,
        CreateSongPayload {
            title: "Old Title".to_string(),
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
            sections: vec![verse_section("Estrofe 1", "Old body")],
        },
    )
    .await
    .unwrap();

    let updated = db_update_song(
        &pool,
        UpdateSongPayload {
            id: created.id.clone(),
            title: "New Title".to_string(),
            artist: Some("New Artist".to_string()),
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
            sections: vec![
                verse_section("Estrofe 1", "New body 1"),
                verse_section("Estrofe 2", "New body 2"),
            ],
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.title, "New Title");
    assert_eq!(updated.artist.as_deref(), Some("New Artist"));
    assert_eq!(updated.sections.len(), 2);
    assert_eq!(updated.created_at, created.created_at);
    assert!(updated.updated_at >= created.updated_at);

    // Old section is gone
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM song_sections WHERE song_id = ?")
        .bind(&created.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 2);
}

#[tokio::test]
async fn update_song_returns_error_for_nonexistent_id() {
    let pool = open_test_db().await;

    let result = db_update_song(
        &pool,
        UpdateSongPayload {
            id: "nonexistent-id".to_string(),
            title: "x".to_string(),
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
            sections: vec![],
        },
    )
    .await;

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().code, "song.not_found");
}

#[tokio::test]
async fn delete_song_sets_deleted_at() {
    let pool = open_test_db().await;

    let song = db_create_song(
        &pool,
        CreateSongPayload {
            title: "Deletável".to_string(),
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
            sections: vec![verse_section("Estrofe 1", "corpo")],
        },
    )
    .await
    .unwrap();

    db_delete_song(&pool, &song.id).await.unwrap();

    let row = sqlx::query("SELECT deleted_at FROM songs WHERE id = ?")
        .bind(&song.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    let deleted_at: Option<i64> = row.get("deleted_at");
    assert!(deleted_at.is_some(), "deleted_at must be set after soft delete");
}

#[tokio::test]
async fn delete_song_returns_error_for_already_deleted() {
    let pool = open_test_db().await;

    let song = db_create_song(
        &pool,
        CreateSongPayload {
            title: "Já deletada".to_string(),
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
            sections: vec![],
        },
    )
    .await
    .unwrap();

    db_delete_song(&pool, &song.id).await.unwrap();
    let second = db_delete_song(&pool, &song.id).await;
    assert!(second.is_err());
}

#[tokio::test]
async fn list_songs_excludes_soft_deleted() {
    let pool = open_test_db().await;

    let s1 = db_create_song(
        &pool,
        CreateSongPayload {
            title: "Ativa".to_string(),
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
            sections: vec![],
        },
    )
    .await
    .unwrap();

    let s2 = db_create_song(
        &pool,
        CreateSongPayload {
            title: "Removida".to_string(),
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
            sections: vec![],
        },
    )
    .await
    .unwrap();

    db_delete_song(&pool, &s2.id).await.unwrap();

    let songs = db_list_songs(&pool, ListSongsParams::default()).await.unwrap();
    assert_eq!(songs.len(), 1);
    assert_eq!(songs[0].id, s1.id);
}

#[tokio::test]
async fn get_song_returns_sections_in_sort_order() {
    let pool = open_test_db().await;

    let created = db_create_song(
        &pool,
        CreateSongPayload {
            title: "Ordenada".to_string(),
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
            sections: vec![
                SectionPayload {
                    label: "Segundo".to_string(),
                    section_type: SectionType::Verse,
                    body: "corpo 2".to_string(),
                    sort_order: 1,
                    repeat_count: None,
                    notes: None,
                    background_id: None,
                },
                SectionPayload {
                    label: "Primeiro".to_string(),
                    section_type: SectionType::Verse,
                    body: "corpo 1".to_string(),
                    sort_order: 0,
                    repeat_count: None,
                    notes: None,
                    background_id: None,
                },
            ],
        },
    )
    .await
    .unwrap();

    let fetched = db_get_song(&pool, &created.id).await.unwrap();
    assert_eq!(fetched.sections.len(), 2);
    assert_eq!(fetched.sections[0].sort_order, 0);
    assert_eq!(fetched.sections[1].sort_order, 1);
}

#[tokio::test]
async fn round_trips_notes_background_author_copyright() {
    let pool = open_test_db().await;

    let created = db_create_song(
        &pool,
        CreateSongPayload {
            title: "Campos Cheios".to_string(),
            artist: None,
            author: Some("João Silva".to_string()),
            copyright: Some("© 2024 Igreja".to_string()),
            ccli_number: None,
            key_signature: None,
            language: None,
            notes: None,
            background_id: None,
            scrim_opacity: None,
            slide_config: None,
            source: None,
            sections: vec![SectionPayload {
                label: "Estrofe 1".to_string(),
                section_type: SectionType::Verse,
                body: "corpo da estrofe".to_string(),
                sort_order: 0,
                repeat_count: Some(1),
                notes: Some("Cantar devagar".to_string()),
                background_id: None,
            }],
        },
    )
    .await
    .unwrap();

    assert_eq!(created.author.as_deref(), Some("João Silva"));
    assert_eq!(created.copyright.as_deref(), Some("© 2024 Igreja"));
    assert_eq!(created.sections[0].notes.as_deref(), Some("Cantar devagar"));

    // Verify via a fetch from DB
    let fetched = db_get_song(&pool, &created.id).await.unwrap();
    assert_eq!(fetched.author.as_deref(), Some("João Silva"));
    assert_eq!(fetched.copyright.as_deref(), Some("© 2024 Igreja"));
    assert_eq!(fetched.sections[0].notes.as_deref(), Some("Cantar devagar"));

    // update_song persists new values and normalizes empty strings to NULL
    let updated = db_update_song(
        &pool,
        UpdateSongPayload {
            id: created.id.clone(),
            title: created.title.clone(),
            artist: None,
            author: Some("  ".to_string()),   // whitespace → None
            copyright: Some("Nova Letra".to_string()),
            ccli_number: None,
            key_signature: None,
            language: None,
            notes: None,
            background_id: None,
            scrim_opacity: None,
            slide_config: None,
            source: None,
            sections: vec![SectionPayload {
                label: "Estrofe 1".to_string(),
                section_type: SectionType::Verse,
                body: "novo corpo".to_string(),
                sort_order: 0,
                repeat_count: Some(1),
                notes: Some("".to_string()),   // empty → None
                background_id: None,
            }],
        },
    )
    .await
    .unwrap();

    assert!(updated.author.is_none(), "whitespace-only author must normalize to NULL");
    assert_eq!(updated.copyright.as_deref(), Some("Nova Letra"));
    assert!(updated.sections[0].notes.is_none(), "empty notes must normalize to NULL");
}
