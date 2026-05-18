// Database module — sqlx SQLite pool and migration runner
// Submodules will be added as features are implemented:
// pub mod songs;
// pub mod sets;
// pub mod media;
// pub mod settings;
// pub mod fts;

use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use tauri::AppHandle;
use tauri::Manager;

/// Initialize the SQLite database pool and run pending migrations.
///
/// Creates the data directory at `%APPDATA%\TrinityLyrics\` if it does not exist.
/// The database file is at `%APPDATA%\TrinityLyrics\database.db`.
pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, sqlx::Error> {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("could not resolve app data directory");

    std::fs::create_dir_all(&data_dir)
        .map_err(|e| sqlx::Error::Io(e))?;

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
