// Database module — sqlx SQLite pool and migration runner
pub mod media;

use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use tauri::AppHandle;
use tauri::Manager;

/// Initialize the SQLite database pool and run pending migrations.
///
/// The data directory is resolved per-platform via `app_data_dir()`:
/// - Windows: `%APPDATA%\TrinityLyrics\`
/// - Linux:   `$XDG_DATA_HOME/TrinityLyrics/` (default `~/.local/share/TrinityLyrics/`)
/// - macOS:   `~/Library/Application Support/TrinityLyrics/`
///
/// It is created if missing; the database file is `database.db` inside it.
pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, sqlx::Error> {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("could not resolve app data directory");

    std::fs::create_dir_all(&data_dir)
        .map_err(sqlx::Error::Io)?;

    let db_path = data_dir.join("database.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

    let options = SqliteConnectOptions::from_str(&db_url)?
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(options).await?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await?;

    eprintln!("[trinity] Migrations applied. DB at: {}", db_path.display());

    Ok(pool)
}
