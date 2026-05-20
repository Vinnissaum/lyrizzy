use chrono::Local;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn record_set_start(pool: &SqlitePool, set_id: &str) -> Result<usize, sqlx::Error> {
    let played_on = Local::now().format("%Y-%m-%d").to_string();
    let created_at = chrono::Utc::now().timestamp_millis();

    let song_ids: Vec<String> = sqlx::query_scalar(
        "SELECT song_id FROM set_items \
         WHERE set_id = ? AND item_type = 'song' AND song_id IS NOT NULL",
    )
    .bind(set_id)
    .fetch_all(pool)
    .await?;

    let mut inserted = 0usize;
    for song_id in &song_ids {
        let result = sqlx::query(
            "INSERT OR IGNORE INTO song_plays (id, song_id, set_id, played_on, created_at) \
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(Uuid::new_v4().to_string())
        .bind(song_id)
        .bind(set_id)
        .bind(&played_on)
        .bind(created_at)
        .execute(pool)
        .await?;

        inserted += result.rows_affected() as usize;
    }

    Ok(inserted)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqliteConnectOptions;
    use std::str::FromStr;
    use tempfile::tempdir;

    async fn open_db() -> (SqlitePool, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let path = dir.path().join("pc_test.db");
        let url = format!("sqlite://{}?mode=rwc", path.to_string_lossy());
        let opts = SqliteConnectOptions::from_str(&url)
            .unwrap()
            .create_if_missing(true);
        let pool = SqlitePool::connect_with(opts).await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        (pool, dir)
    }

    async fn seed(pool: &SqlitePool, set_id: &str, song_ids: &[&str]) {
        sqlx::query(
            "INSERT INTO sets (id, name, created_at, updated_at) VALUES (?, 'Test', 1, 1)",
        )
        .bind(set_id)
        .execute(pool)
        .await
        .unwrap();

        for (i, song_id) in song_ids.iter().enumerate() {
            sqlx::query(
                "INSERT INTO songs (id, title, language, created_at, updated_at) \
                 VALUES (?, 'Song', 'pt', 1, 1)",
            )
            .bind(song_id)
            .execute(pool)
            .await
            .unwrap();

            sqlx::query(
                "INSERT INTO set_items (id, set_id, item_type, song_id, sort_order) \
                 VALUES (?, ?, 'song', ?, ?)",
            )
            .bind(format!("item-{i}"))
            .bind(set_id)
            .bind(song_id)
            .bind(i as i64)
            .execute(pool)
            .await
            .unwrap();
        }
    }

    #[tokio::test]
    async fn inserts_one_row_per_song() {
        let (pool, _dir) = open_db().await;
        seed(&pool, "set-1", &["s1", "s2"]).await;

        let n = record_set_start(&pool, "set-1").await.unwrap();
        assert_eq!(n, 2);

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM song_plays")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 2);
    }

    #[tokio::test]
    async fn idempotent_same_day() {
        let (pool, _dir) = open_db().await;
        seed(&pool, "set-2", &["s3"]).await;

        record_set_start(&pool, "set-2").await.unwrap();
        let second = record_set_start(&pool, "set-2").await.unwrap();
        assert_eq!(second, 0, "second start same day should insert 0 rows");

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM song_plays")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 1, "only one row should exist");
    }

    #[tokio::test]
    async fn different_dates_inserts_two_rows() {
        let (pool, _dir) = open_db().await;
        seed(&pool, "set-3", &["s4"]).await;

        // Manually insert a row with a different date
        sqlx::query(
            "INSERT OR IGNORE INTO song_plays (id, song_id, set_id, played_on, created_at) \
             VALUES ('p1', 's4', 'set-3', '2000-01-01', 1)",
        )
        .execute(&pool)
        .await
        .unwrap();

        // Today's date is different from 2000-01-01
        let n = record_set_start(&pool, "set-3").await.unwrap();
        assert_eq!(n, 1, "should insert one new row for today");

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM song_plays")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 2, "two rows: one historical, one today");
    }

    #[tokio::test]
    async fn empty_set_returns_zero() {
        let (pool, _dir) = open_db().await;
        sqlx::query(
            "INSERT INTO sets (id, name, created_at, updated_at) VALUES ('empty-set', 'Empty', 1, 1)",
        )
        .execute(&pool)
        .await
        .unwrap();

        let n = record_set_start(&pool, "empty-set").await.unwrap();
        assert_eq!(n, 0);
    }
}
