use sqlx::{sqlite::SqliteConnectOptions, Row, SqlitePool};
use std::str::FromStr;
use tempfile::tempdir;

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
