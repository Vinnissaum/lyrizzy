// Database module — sqlx SQLite pool and migration runner
pub mod media;

use sqlx::migrate::{Migration, Migrator};
use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::borrow::Cow;
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

    let migrator = sqlx::migrate!("./migrations");
    let repaired = repair_line_ending_checksums(&pool, &migrator).await?;
    if repaired > 0 {
        eprintln!(
            "[trinity] Repaired {repaired} migration checksum(s) recorded by a build with different line endings."
        );
    }
    migrator.run(&pool).await?;

    eprintln!("[trinity] Migrations applied. DB at: {}", db_path.display());

    Ok(pool)
}

/// The same SQL under both line-ending conventions, LF first.
fn eol_variants(sql: &str) -> [String; 2] {
    let lf = sql.replace("\r\n", "\n");
    let crlf = lf.replace('\n', "\r\n");
    [lf, crlf]
}

/// True when `stored` is the checksum of `m`'s SQL under a different
/// line-ending convention — i.e. the same migration, recorded by a build whose
/// checkout used the other convention.
fn is_line_ending_variant(m: &Migration, stored: &[u8]) -> bool {
    eol_variants(&m.sql).into_iter().any(|variant| {
        // `Migration::new` computes the same SHA-384 sqlx validates against.
        Migration::new(
            m.version,
            m.description.clone(),
            m.migration_type,
            Cow::Owned(variant),
            m.no_tx,
        )
        .checksum
        .as_ref()
            == stored
    })
}

/// Reconcile `_sqlx_migrations` checksums that differ only by line endings.
///
/// `sqlx::migrate!()` embeds each migration's bytes at compile time and
/// validates their SHA-384 against the checksum recorded when the migration was
/// applied. Those bytes depend on the line endings of the *build* checkout, so
/// a release built before `.gitattributes` pinned `eol=lf` embedded CRLF on
/// Windows. An install that applied its migrations from such a build rejects
/// every later LF build at startup with "migration 1 was previously applied but
/// has been modified", even though the SQL is identical.
///
/// Rewriting the stored checksum is safe only when the stored value is provably
/// the same SQL under the other convention. A checksum matching neither variant
/// is a genuinely edited migration and is left alone, so sqlx still fails loudly.
async fn repair_line_ending_checksums(
    pool: &SqlitePool,
    migrator: &Migrator,
) -> Result<usize, sqlx::Error> {
    let table: Option<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_sqlx_migrations'",
    )
    .fetch_optional(pool)
    .await?;
    if table.is_none() {
        return Ok(0); // fresh install — nothing has been applied yet
    }

    let mut repaired = 0;
    for m in migrator.iter() {
        let stored: Option<Vec<u8>> =
            sqlx::query_scalar("SELECT checksum FROM _sqlx_migrations WHERE version = ?")
                .bind(m.version)
                .fetch_optional(pool)
                .await?;
        let Some(stored) = stored else { continue };
        if stored == m.checksum.as_ref() || !is_line_ending_variant(m, &stored) {
            continue;
        }
        sqlx::query("UPDATE _sqlx_migrations SET checksum = ? WHERE version = ?")
            .bind(m.checksum.to_vec())
            .bind(m.version)
            .execute(pool)
            .await?;
        repaired += 1;
    }
    Ok(repaired)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn migrated_pool() -> (SqlitePool, Migrator, TempDir) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("checksums.db");
        let opts = SqliteConnectOptions::from_str(&format!(
            "sqlite://{}?mode=rwc",
            path.to_string_lossy()
        ))
        .unwrap()
        .create_if_missing(true);
        let pool = SqlitePool::connect_with(opts).await.unwrap();
        let migrator = sqlx::migrate!("./migrations");
        migrator.run(&pool).await.unwrap();
        (pool, migrator, dir)
    }

    async fn set_stored_checksum(pool: &SqlitePool, version: i64, checksum: Vec<u8>) {
        sqlx::query("UPDATE _sqlx_migrations SET checksum = ? WHERE version = ?")
            .bind(checksum)
            .bind(version)
            .execute(pool)
            .await
            .unwrap();
    }

    async fn stored_checksum(pool: &SqlitePool, version: i64) -> Vec<u8> {
        sqlx::query_scalar("SELECT checksum FROM _sqlx_migrations WHERE version = ?")
            .bind(version)
            .fetch_one(pool)
            .await
            .unwrap()
    }

    /// The checksum the same migration would have under the opposite convention.
    fn other_eol_checksum(m: &Migration) -> Vec<u8> {
        let [lf, crlf] = eol_variants(&m.sql);
        let other = if m.sql.contains("\r\n") { lf } else { crlf };
        Migration::new(
            m.version,
            m.description.clone(),
            m.migration_type,
            Cow::Owned(other),
            m.no_tx,
        )
        .checksum
        .to_vec()
    }

    /// Reproduces the v1.3.1 startup failure: an install whose migrations were
    /// applied by a build with CRLF line endings, opened by an LF build.
    #[tokio::test]
    async fn repairs_a_checksum_recorded_with_other_line_endings() {
        let (pool, migrator, _dir) = migrated_pool().await;
        let first = migrator.iter().next().unwrap();
        set_stored_checksum(&pool, first.version, other_eol_checksum(first)).await;

        // Precondition: sqlx rejects the database in this state.
        assert!(
            migrator.run(&pool).await.is_err(),
            "a line-ending-shifted checksum must fail validation before the repair"
        );

        let repaired = repair_line_ending_checksums(&pool, &migrator).await.unwrap();

        assert_eq!(repaired, 1);
        assert_eq!(stored_checksum(&pool, first.version).await, first.checksum.as_ref());
        migrator
            .run(&pool)
            .await
            .expect("migrations must validate once the checksum is reconciled");
    }

    /// A genuinely edited migration must still fail loudly — the repair only
    /// reconciles checksums it can prove are the same SQL.
    #[tokio::test]
    async fn leaves_a_genuinely_modified_migration_alone() {
        let (pool, migrator, _dir) = migrated_pool().await;
        let first = migrator.iter().next().unwrap();
        let tampered = vec![0u8; 48];
        set_stored_checksum(&pool, first.version, tampered.clone()).await;

        let repaired = repair_line_ending_checksums(&pool, &migrator).await.unwrap();

        assert_eq!(repaired, 0, "an unrecognised checksum must not be rewritten");
        assert_eq!(stored_checksum(&pool, first.version).await, tampered);
        assert!(migrator.run(&pool).await.is_err(), "sqlx must still refuse to run");
    }

    /// A fresh install has no `_sqlx_migrations` table yet.
    #[tokio::test]
    async fn no_op_on_a_database_with_no_applied_migrations() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("fresh.db");
        let opts = SqliteConnectOptions::from_str(&format!(
            "sqlite://{}?mode=rwc",
            path.to_string_lossy()
        ))
        .unwrap()
        .create_if_missing(true);
        let pool = SqlitePool::connect_with(opts).await.unwrap();
        let migrator = sqlx::migrate!("./migrations");

        assert_eq!(repair_line_ending_checksums(&pool, &migrator).await.unwrap(), 0);
        migrator.run(&pool).await.expect("a fresh database still migrates");
    }

    /// Every migration is reconciled, not just the first one reported.
    #[tokio::test]
    async fn repairs_every_shifted_migration() {
        let (pool, migrator, _dir) = migrated_pool().await;
        let total = migrator.iter().count();
        for m in migrator.iter() {
            set_stored_checksum(&pool, m.version, other_eol_checksum(m)).await;
        }

        let repaired = repair_line_ending_checksums(&pool, &migrator).await.unwrap();

        assert_eq!(repaired, total, "all {total} migrations should be reconciled");
        migrator.run(&pool).await.expect("migrations must validate");
    }
}
