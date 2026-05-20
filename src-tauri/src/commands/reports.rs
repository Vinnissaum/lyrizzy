use crate::domain::error::ErrorPayload;
use crate::state::AppState;
use serde::Serialize;
use tauri::State;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CcliRow {
    pub played_on: String,
    pub title: String,
    pub author: Option<String>,
    pub ccli_number: Option<String>,
    pub copyright: Option<String>,
}

fn csv_field(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn build_csv(rows: &[CcliRow]) -> String {
    // UTF-8 BOM + Portuguese headers (TD-10)
    let mut out = String::from("\u{FEFF}Data,Título,Autor,CCLI #,Direitos\n");
    for row in rows {
        let fields = [
            row.played_on.as_str(),
            row.title.as_str(),
            row.author.as_deref().unwrap_or(""),
            row.ccli_number.as_deref().unwrap_or(""),
            row.copyright.as_deref().unwrap_or(""),
        ];
        let line = fields.map(csv_field).join(",");
        out.push_str(&line);
        out.push('\n');
    }
    out
}

async fn query_rows(
    pool: &sqlx::SqlitePool,
    from: &str,
    to: &str,
) -> Result<Vec<CcliRow>, sqlx::Error> {
    #[allow(clippy::type_complexity)]
    let raw: Vec<(String, String, Option<String>, Option<String>, Option<String>)> =
        sqlx::query_as(
            "SELECT sp.played_on, s.title, s.author, s.ccli_number, s.copyright \
             FROM song_plays sp \
             JOIN songs s ON s.id = sp.song_id \
             WHERE sp.played_on BETWEEN ? AND ? \
             ORDER BY sp.played_on, s.title",
        )
        .bind(from)
        .bind(to)
        .fetch_all(pool)
        .await?;

    Ok(raw
        .into_iter()
        .map(|(played_on, title, author, ccli_number, copyright)| CcliRow {
            played_on,
            title,
            author,
            ccli_number,
            copyright,
        })
        .collect())
}

#[tauri::command]
pub async fn preview_ccli_export(
    state: State<'_, AppState>,
    from: String,
    to: String,
) -> Result<Vec<CcliRow>, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    query_rows(pool, &from, &to)
        .await
        .map_err(|e| ErrorPayload::new("reports.db_error").with_param("detail", e.to_string()))
}

#[tauri::command]
pub async fn export_ccli_csv(
    state: State<'_, AppState>,
    from: String,
    to: String,
    out_path: String,
) -> Result<usize, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    let rows = query_rows(pool, &from, &to)
        .await
        .map_err(|e| ErrorPayload::new("reports.db_error").with_param("detail", e.to_string()))?;

    let csv = build_csv(&rows);
    std::fs::write(&out_path, csv.as_bytes())
        .map_err(|e| ErrorPayload::new("reports.io_error").with_param("detail", e.to_string()))?;

    Ok(rows.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqliteConnectOptions;
    use std::str::FromStr;
    use tempfile::tempdir;

    async fn open_db() -> (sqlx::SqlitePool, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let path = dir.path().join("reports_test.db");
        let url = format!("sqlite://{}?mode=rwc", path.to_string_lossy());
        let opts = SqliteConnectOptions::from_str(&url)
            .unwrap()
            .create_if_missing(true);
        let pool = sqlx::SqlitePool::connect_with(opts).await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        (pool, dir)
    }

    async fn seed(pool: &sqlx::SqlitePool) {
        sqlx::query(
            "INSERT INTO sets (id, name, created_at, updated_at) VALUES ('set-x', 'Test Set', 1, 1)",
        )
        .execute(pool)
        .await
        .unwrap();

        // Song with full metadata
        sqlx::query(
            "INSERT INTO songs (id, title, author, ccli_number, copyright, language, created_at, updated_at) \
             VALUES ('song-1', 'Blessed Be', 'Matt Redman', '3798438', '2002 Thankyou Music', 'en', 1, 1)"
        )
        .execute(pool).await.unwrap();

        // Song with no metadata
        sqlx::query(
            "INSERT INTO songs (id, title, language, created_at, updated_at) \
             VALUES ('song-2', 'Hosanna', 'en', 1, 1)",
        )
        .execute(pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO song_plays (id, song_id, set_id, played_on, created_at) \
             VALUES ('p1', 'song-1', 'set-x', '2026-01-05', 1), \
                    ('p2', 'song-2', 'set-x', '2026-01-05', 1), \
                    ('p3', 'song-1', 'set-x', '2026-01-12', 1)",
        )
        .execute(pool)
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn query_rows_filters_by_date_range() {
        let (pool, _dir) = open_db().await;
        seed(&pool).await;

        let rows = query_rows(&pool, "2026-01-05", "2026-01-05").await.unwrap();
        assert_eq!(rows.len(), 2, "only 2026-01-05 rows");

        let all = query_rows(&pool, "2026-01-01", "2026-12-31").await.unwrap();
        assert_eq!(all.len(), 3);
    }

    #[tokio::test]
    async fn zero_range_returns_empty() {
        let (pool, _dir) = open_db().await;
        let rows = query_rows(&pool, "1900-01-01", "1900-01-02")
            .await
            .unwrap();
        assert!(rows.is_empty());
    }

    #[tokio::test]
    async fn csv_output_has_bom_and_headers() {
        let (pool, _dir) = open_db().await;
        seed(&pool).await;

        let rows = query_rows(&pool, "2026-01-01", "2026-12-31")
            .await
            .unwrap();
        let csv = build_csv(&rows);

        assert!(csv.starts_with('\u{FEFF}'), "must start with UTF-8 BOM");
        assert!(
            csv.contains("Data,Título,Autor,CCLI #,Direitos"),
            "must have Portuguese headers"
        );
        assert!(csv.contains("Blessed Be"), "row data present");
        assert!(csv.contains("3798438"), "CCLI number present");
    }

    #[tokio::test]
    async fn csv_rfc4180_quoting() {
        let row = CcliRow {
            played_on: "2026-01-01".into(),
            title: "Song, With Comma".into(),
            author: Some("Author \"Quoted\"".into()),
            ccli_number: None,
            copyright: None,
        };
        let csv = build_csv(&[row]);
        assert!(csv.contains("\"Song, With Comma\""), "commas must be quoted");
        assert!(
            csv.contains("\"Author \"\"Quoted\"\"\""),
            "quotes must be doubled: {csv}"
        );
    }

    #[tokio::test]
    async fn export_writes_file() {
        let (pool, _dir) = open_db().await;
        seed(&pool).await;

        let out_dir = tempdir().unwrap();
        let out_path = out_dir.path().join("report.csv");

        let rows = query_rows(&pool, "2026-01-01", "2026-12-31")
            .await
            .unwrap();
        let csv = build_csv(&rows);
        std::fs::write(&out_path, csv.as_bytes()).unwrap();

        let content = std::fs::read_to_string(&out_path).unwrap();
        assert!(content.starts_with('\u{FEFF}'));
        assert!(content.contains("Blessed Be"));
    }
}
