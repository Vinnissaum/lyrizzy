use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
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
    // Keep temp dir alive by leaking it — acceptable for tests.
    std::mem::forget(dir);
    pool
}

#[tokio::test]
async fn fts_finds_song_by_lyric_body_only() {
    let pool = open_test_db().await;

    // Insert a song whose title/artist do NOT contain the search term.
    sqlx::query(
        "INSERT INTO songs (id, title, artist, language, created_at, updated_at)
         VALUES ('s1', 'Louvor ao Senhor', 'Artista Desconhecido', 'pt', 1000, 1000)",
    )
    .execute(&pool)
    .await
    .unwrap();

    // Insert a section with a unique phrase not present in title/artist.
    sqlx::query(
        "INSERT INTO song_sections (id, song_id, label, type, body, sort_order, repeat_count)
         VALUES ('sec1', 's1', 'Estrofe 1', 'verse',
                 'o tronco mais alto da floresta canta ao criador', 0, 1)",
    )
    .execute(&pool)
    .await
    .unwrap();

    // FTS query on a body-only term.
    let rows: Vec<(i64,)> =
        sqlx::query_as("SELECT rowid FROM songs_fts WHERE songs_fts MATCH 'tronco'")
            .fetch_all(&pool)
            .await
            .unwrap();

    assert_eq!(rows.len(), 1, "expected exactly one FTS match");

    // Confirm the rowid maps back to our song.
    let (title,): (String,) =
        sqlx::query_as("SELECT title FROM songs WHERE rowid = ?")
            .bind(rows[0].0)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(title, "Louvor ao Senhor");
}

#[tokio::test]
async fn fts_excludes_soft_deleted_songs() {
    let pool = open_test_db().await;

    sqlx::query(
        "INSERT INTO songs (id, title, language, created_at, updated_at)
         VALUES ('s2', 'Música Removida', 'pt', 1000, 1000)",
    )
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO song_sections (id, song_id, label, type, body, sort_order, repeat_count)
         VALUES ('sec2', 's2', 'Estrofe 1', 'verse', 'palavra única exclusiva removida', 0, 1)",
    )
    .execute(&pool)
    .await
    .unwrap();

    // Soft-delete the song — songs_au trigger should remove it from FTS.
    sqlx::query("UPDATE songs SET deleted_at = 9999 WHERE id = 's2'")
        .execute(&pool)
        .await
        .unwrap();

    let rows: Vec<(i64,)> =
        sqlx::query_as("SELECT rowid FROM songs_fts WHERE songs_fts MATCH 'exclusiva'")
            .fetch_all(&pool)
            .await
            .unwrap();

    assert_eq!(rows.len(), 0, "soft-deleted song must not appear in FTS");
}

#[tokio::test]
async fn fts_body_updates_when_section_is_added() {
    let pool = open_test_db().await;

    sqlx::query(
        "INSERT INTO songs (id, title, language, created_at, updated_at)
         VALUES ('s3', 'Hino da Fé', 'pt', 1000, 1000)",
    )
    .execute(&pool)
    .await
    .unwrap();

    // At insert, body is empty — unique term not findable yet.
    let before: Vec<(i64,)> =
        sqlx::query_as("SELECT rowid FROM songs_fts WHERE songs_fts MATCH 'esperança'")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(before.len(), 0);

    // Add a section containing the unique term.
    sqlx::query(
        "INSERT INTO song_sections (id, song_id, label, type, body, sort_order, repeat_count)
         VALUES ('sec3', 's3', 'Estrofe 1', 'verse', 'canta com esperança ao eterno', 0, 1)",
    )
    .execute(&pool)
    .await
    .unwrap();

    let after: Vec<(i64,)> =
        sqlx::query_as("SELECT rowid FROM songs_fts WHERE songs_fts MATCH 'esperança'")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(after.len(), 1, "section insert trigger must refresh FTS body");
}

// ─── T8: FTS5 search via db_list_songs ───────────────────────────────────────

use tauri_app_lib::commands::song::{
    db_create_song, db_list_songs, CreateSongPayload, ListSongsParams, SectionPayload,
};
use tauri_app_lib::domain::song::SectionType;

fn make_song(title: &str, body: &str) -> CreateSongPayload {
    CreateSongPayload {
        title: title.to_string(),
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
        background_mode: None,
        background_preset: None,
        font_family: None,
        font_size: None,
        sections: vec![SectionPayload {
            label: "Estrofe 1".to_string(),
            section_type: SectionType::Verse,
            body: body.to_string(),
            sort_order: 0,
            repeat_count: None,
            notes: None,
            background_id: None,
            background_mode: None,
            background_preset: None,
            font_family: None,
            font_size: None,
        }],
    }
}

#[tokio::test]
async fn fts_search_finds_body_only_match_via_db_list_songs() {
    let pool = open_test_db().await;

    db_create_song(&pool, make_song("Título Genérico", "palavra_unica_xyzzy no corpo da música"))
        .await
        .unwrap();
    db_create_song(&pool, make_song("Outro Título", "corpo completamente diferente"))
        .await
        .unwrap();

    let results = db_list_songs(
        &pool,
        ListSongsParams {
            search: Some("palavra_unica_xyzzy".to_string()),
            limit: None,
            offset: None,
        },
    )
    .await
    .unwrap();

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title, "Título Genérico");
}

#[tokio::test]
async fn fts_invalid_query_falls_back_to_like_and_returns_no_error() {
    let pool = open_test_db().await;

    db_create_song(&pool, make_song("Graça de Deus", "corpo qualquer"))
        .await
        .unwrap();

    // Unbalanced quote — invalid FTS5 syntax, should fall back to LIKE.
    let results = db_list_songs(
        &pool,
        ListSongsParams {
            search: Some("\"unbalanced".to_string()),
            limit: None,
            offset: None,
        },
    )
    .await;

    assert!(results.is_ok(), "invalid FTS5 query must not return an error");
}

#[tokio::test]
async fn fts_search_finds_song_by_author() {
    let pool = open_test_db().await;

    db_create_song(
        &pool,
        CreateSongPayload {
            title: "Música sem Autor".to_string(),
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
            background_mode: None,
            background_preset: None,
            font_family: None,
            font_size: None,
            sections: vec![SectionPayload {
                label: "Estrofe 1".to_string(),
                section_type: SectionType::Verse,
                body: "corpo sem autor".to_string(),
                sort_order: 0,
                repeat_count: None,
                notes: None,
                background_id: None,
                background_mode: None,
                background_preset: None,
                font_family: None,
                font_size: None,
            }],
        },
    )
    .await
    .unwrap();

    db_create_song(
        &pool,
        CreateSongPayload {
            title: "Hino do Autor".to_string(),
            artist: None,
            author: Some("João Silva".to_string()),
            copyright: None,
            ccli_number: None,
            key_signature: None,
            language: None,
            notes: None,
            background_id: None,
            scrim_opacity: None,
            slide_config: None,
            source: None,
            background_mode: None,
            background_preset: None,
            font_family: None,
            font_size: None,
            sections: vec![SectionPayload {
                label: "Estrofe 1".to_string(),
                section_type: SectionType::Verse,
                body: "corpo qualquer".to_string(),
                sort_order: 0,
                repeat_count: None,
                notes: None,
                background_id: None,
                background_mode: None,
                background_preset: None,
                font_family: None,
                font_size: None,
            }],
        },
    )
    .await
    .unwrap();

    let results = db_list_songs(
        &pool,
        ListSongsParams {
            search: Some("silva".to_string()),
            limit: None,
            offset: None,
        },
    )
    .await
    .unwrap();

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title, "Hino do Autor");
}
