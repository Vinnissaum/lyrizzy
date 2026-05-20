use sqlx::{sqlite::SqliteConnectOptions, Row, SqlitePool};
use std::str::FromStr;
use tempfile::tempdir;

async fn open_fresh_db() -> (SqlitePool, tempfile::TempDir) {
    let dir = tempdir().expect("temp dir");
    let db_path = dir.path().join("test.db");
    let url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());
    let options = SqliteConnectOptions::from_str(&url)
        .unwrap()
        .create_if_missing(true);
    let pool = SqlitePool::connect_with(options).await.unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    (pool, dir)
}

async fn open_test_db() -> (SqlitePool, tempfile::TempDir) {
    let dir = tempdir().expect("temp dir");
    let db_path = dir.path().join("test.db");
    let url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());
    let options = SqliteConnectOptions::from_str(&url)
        .unwrap()
        .create_if_missing(true);
    let pool = SqlitePool::connect_with(options).await.unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    (pool, dir)
}

#[tokio::test]
async fn migration_003_media_columns_exist() {
    let (pool, _dir) = open_test_db().await;

    // Confirm new columns are present by selecting them (returns empty, not an error)
    let result = sqlx::query(
        "SELECT kind, display_name, byte_size, updated_at, deleted_at, thumbnail_file
         FROM media LIMIT 0",
    )
    .fetch_optional(&pool)
    .await;
    assert!(
        result.is_ok(),
        "media columns added by migration 003 should exist: {:?}",
        result.err()
    );
}

#[tokio::test]
async fn migration_003_set_items_columns_exist() {
    let (pool, _dir) = open_test_db().await;

    let result = sqlx::query(
        "SELECT webview_config, media_options FROM set_items LIMIT 0",
    )
    .fetch_optional(&pool)
    .await;
    assert!(
        result.is_ok(),
        "set_items columns added by migration 003 should exist: {:?}",
        result.err()
    );
}

#[tokio::test]
async fn migration_003_scrim_opacity_defaults_to_35() {
    let (pool, _dir) = open_test_db().await;

    let now = 1_000_000_i64;
    sqlx::query(
        "INSERT INTO songs (id, title, language, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind("test-song-003")
    .bind("Test Song")
    .bind("pt")
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    let scrim: i64 =
        sqlx::query_scalar("SELECT scrim_opacity FROM songs WHERE id = ?")
            .bind("test-song-003")
            .fetch_one(&pool)
            .await
            .unwrap();

    assert_eq!(scrim, 35, "scrim_opacity should default to 35");
}

#[tokio::test]
async fn migration_004_settings_seeded() {
    let (pool, _dir) = open_test_db().await;

    let locale: String =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = 'app.locale'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(locale, "pt-BR");

    let transition: String =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = 'presentation.transition_ms'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(transition, "200");

    let reduce_motion: String =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = 'presentation.reduce_motion'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(reduce_motion, "false");
}

#[tokio::test]
async fn migration_004_settings_idempotent() {
    let (pool, _dir) = open_test_db().await;

    // INSERT OR IGNORE on an existing key must not overwrite or duplicate
    sqlx::query("INSERT OR IGNORE INTO settings (key, value) VALUES ('app.locale', 'en-US')")
        .execute(&pool)
        .await
        .unwrap();

    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM settings WHERE key = 'app.locale'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count, 1, "INSERT OR IGNORE must not create duplicate rows");

    let locale: String =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = 'app.locale'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(locale, "pt-BR", "existing value must be preserved");
}

// ── Migration 005 tests ───────────────────────────────────────────────────────

#[tokio::test]
async fn migration_005_song_sections_new_columns_exist() {
    let (pool, _dir) = open_fresh_db().await;

    let result = sqlx::query("SELECT notes, background_id FROM song_sections LIMIT 0")
        .fetch_optional(&pool)
        .await;
    assert!(
        result.is_ok(),
        "song_sections.notes and .background_id should exist: {:?}",
        result.err()
    );
}

#[tokio::test]
async fn migration_005_songs_new_columns_exist() {
    let (pool, _dir) = open_fresh_db().await;

    let result = sqlx::query("SELECT author, copyright FROM songs LIMIT 0")
        .fetch_optional(&pool)
        .await;
    assert!(
        result.is_ok(),
        "songs.author and .copyright should exist: {:?}",
        result.err()
    );
}

#[tokio::test]
async fn migration_005_song_plays_table_exists() {
    let (pool, _dir) = open_fresh_db().await;

    let result = sqlx::query(
        "SELECT id, song_id, set_id, played_on, created_at FROM song_plays LIMIT 0",
    )
    .fetch_optional(&pool)
    .await;
    assert!(
        result.is_ok(),
        "song_plays table with all columns should exist: {:?}",
        result.err()
    );
}

#[tokio::test]
async fn migration_005_song_plays_unique_index_enforces_idempotency() {
    let (pool, _dir) = open_fresh_db().await;

    // Insert a song and set so FK constraints are satisfied.
    let now = 1_000_000_i64;
    sqlx::query(
        "INSERT INTO songs (id, title, language, created_at, updated_at) VALUES (?,?,?,?,?)",
    )
    .bind("song-idx")
    .bind("Song")
    .bind("pt")
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO sets (id, name, created_at, updated_at) VALUES (?,?,?,?)",
    )
    .bind("set-idx")
    .bind("Set")
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    // First insert must succeed.
    sqlx::query(
        "INSERT INTO song_plays (id, song_id, set_id, played_on, created_at) VALUES (?,?,?,?,?)",
    )
    .bind("play-1")
    .bind("song-idx")
    .bind("set-idx")
    .bind("2026-05-20")
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    // Second insert with the same (song_id, set_id, played_on) must fail.
    let second = sqlx::query(
        "INSERT INTO song_plays (id, song_id, set_id, played_on, created_at) VALUES (?,?,?,?,?)",
    )
    .bind("play-2")
    .bind("song-idx")
    .bind("set-idx")
    .bind("2026-05-20")
    .bind(now)
    .execute(&pool)
    .await;
    assert!(second.is_err(), "unique index must reject duplicate (song_id, set_id, played_on)");
}

#[tokio::test]
async fn migration_005_settings_seeded() {
    let (pool, _dir) = open_fresh_db().await;

    for key in &[
        "theme",
        "key_bindings",
        "last_update_check",
        "ui.notes_panel_collapsed",
        "window.presentation.monitor",
        "window.stage.monitor",
    ] {
        let val: Option<String> =
            sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
                .bind(key)
                .fetch_optional(&pool)
                .await
                .unwrap();
        assert!(val.is_some(), "settings key '{key}' must be seeded by migration 005");
    }

    let theme: String =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = 'theme'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(theme, "light");

    let notes_collapsed: String =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = 'ui.notes_panel_collapsed'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(notes_collapsed, "false");
}

#[tokio::test]
async fn migration_005_key_bindings_seed_is_valid_json() {
    let (pool, _dir) = open_fresh_db().await;

    let raw: String =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = 'key_bindings'")
            .fetch_one(&pool)
            .await
            .unwrap();

    let parsed: serde_json::Value =
        serde_json::from_str(&raw).expect("key_bindings seed must be valid JSON");
    assert!(
        parsed.get("bindings").is_some(),
        "key_bindings JSON must have a 'bindings' key"
    );
}

#[tokio::test]
async fn migration_005_settings_idempotent() {
    let (pool, _dir) = open_fresh_db().await;

    // Running INSERT OR IGNORE again must not duplicate rows.
    sqlx::query("INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark')")
        .execute(&pool)
        .await
        .unwrap();

    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM settings WHERE key = 'theme'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count, 1, "must not duplicate theme row");

    let theme: String =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = 'theme'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(theme, "light", "original value must be preserved by INSERT OR IGNORE");
}

#[tokio::test]
async fn migration_005_fts_author_searchable() {
    let (pool, _dir) = open_fresh_db().await;

    let now = 1_000_000_i64;
    // Insert a song with a unique author name.
    sqlx::query(
        "INSERT INTO songs (id, title, author, language, created_at, updated_at)
         VALUES ('s-fts', 'Canção de Adoração', 'ZebaldiAutoUniqueXXX', 'pt', ?, ?)",
    )
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await
    .unwrap();

    // FTS is populated at INSERT time by the songs_ai trigger.
    // The trigger body now includes COALESCE(new.author, ''), so search for author works.
    // We trigger a songs_au to repopulate body since songs_ai only seeds empty body:
    sqlx::query("UPDATE songs SET updated_at = ? WHERE id = 's-fts'")
        .bind(now + 1)
        .execute(&pool)
        .await
        .unwrap();

    let rows: Vec<(i64,)> =
        sqlx::query_as("SELECT rowid FROM songs_fts WHERE songs_fts MATCH 'ZebaldiAutoUniqueXXX'")
            .fetch_all(&pool)
            .await
            .unwrap();

    assert_eq!(rows.len(), 1, "author should be indexed in FTS body after update trigger");
}
