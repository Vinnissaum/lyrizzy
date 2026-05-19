use crate::domain::media::{Media, MediaKind};
use sqlx::{Row, SqlitePool};

pub struct ListMediaParams {
    pub kind: Option<MediaKind>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub struct SongRef {
    pub id: String,
    pub title: String,
}

pub struct SetItemRef {
    pub set_id: String,
    pub set_name: String,
    pub item_id: String,
}

pub struct MediaReferences {
    pub songs: Vec<SongRef>,
    pub set_items: Vec<SetItemRef>,
}

fn kind_to_str(kind: &MediaKind) -> &'static str {
    match kind {
        MediaKind::Image => "image",
        MediaKind::Video => "video",
    }
}

fn kind_from_str(s: &str) -> MediaKind {
    match s {
        "video" => MediaKind::Video,
        _ => MediaKind::Image,
    }
}

fn row_to_media(row: &sqlx::sqlite::SqliteRow) -> Media {
    let kind_str: String = row.get("kind");
    Media {
        id: row.get("id"),
        file_name: row.get("file_name"),
        display_name: row.get("display_name"),
        kind: kind_from_str(&kind_str),
        mime_type: row
            .get::<Option<String>, _>("mime_type")
            .unwrap_or_default(),
        width: row.get("width"),
        height: row.get("height"),
        duration_ms: row.get("duration_ms"),
        thumbnail_file: row.get("thumbnail_file"),
        byte_size: row.get("byte_size"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        deleted_at: row.get("deleted_at"),
    }
}

pub async fn db_insert_media(pool: &SqlitePool, media: &Media) -> Result<(), sqlx::Error> {
    let kind_str = kind_to_str(&media.kind);
    sqlx::query(
        "INSERT INTO media \
         (id, file_path, file_name, kind, mime_type, width, height, duration_ms, \
          thumbnail_file, display_name, byte_size, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&media.id)
    .bind(&media.file_name) // file_path reuses file_name (uuid-based, no separate path needed)
    .bind(&media.file_name)
    .bind(kind_str)
    .bind(&media.mime_type)
    .bind(media.width)
    .bind(media.height)
    .bind(media.duration_ms)
    .bind(&media.thumbnail_file)
    .bind(&media.display_name)
    .bind(media.byte_size)
    .bind(media.created_at)
    .bind(media.updated_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn db_list_media(
    pool: &SqlitePool,
    params: &ListMediaParams,
) -> Result<Vec<Media>, sqlx::Error> {
    let mut builder: sqlx::QueryBuilder<sqlx::Sqlite> = sqlx::QueryBuilder::new(
        "SELECT id, file_name, display_name, kind, mime_type, width, height, \
         duration_ms, thumbnail_file, byte_size, created_at, updated_at, deleted_at \
         FROM media WHERE deleted_at IS NULL",
    );

    if let Some(kind) = &params.kind {
        builder.push(" AND kind = ");
        builder.push_bind(kind_to_str(kind));
    }

    if let Some(search) = &params.search {
        builder.push(" AND display_name LIKE ");
        builder.push_bind(format!("{search}%"));
    }

    builder.push(" ORDER BY created_at DESC LIMIT ");
    builder.push_bind(params.limit.unwrap_or(200));
    builder.push(" OFFSET ");
    builder.push_bind(params.offset.unwrap_or(0));

    let rows = builder.build().fetch_all(pool).await?;
    Ok(rows.iter().map(row_to_media).collect())
}

pub async fn db_rename_media(
    pool: &SqlitePool,
    id: &str,
    display_name: &str,
    updated_at: i64,
) -> Result<Option<Media>, sqlx::Error> {
    sqlx::query(
        "UPDATE media SET display_name = ?, updated_at = ? \
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(display_name)
    .bind(updated_at)
    .bind(id)
    .execute(pool)
    .await?;

    let row = sqlx::query(
        "SELECT id, file_name, display_name, kind, mime_type, width, height, \
         duration_ms, thumbnail_file, byte_size, created_at, updated_at, deleted_at \
         FROM media WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    Ok(row.as_ref().map(row_to_media))
}

pub async fn db_soft_delete_media(
    pool: &SqlitePool,
    id: &str,
    deleted_at: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE media SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL")
        .bind(deleted_at)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Returns (song_count, set_item_count) referencing this media id.
pub async fn db_count_references(
    pool: &SqlitePool,
    id: &str,
) -> Result<(i64, i64), sqlx::Error> {
    let song_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM songs WHERE background_id = ? AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;

    let set_item_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM set_items WHERE media_id = ?")
            .bind(id)
            .fetch_one(pool)
            .await?;

    Ok((song_count, set_item_count))
}

pub async fn db_get_references(
    pool: &SqlitePool,
    id: &str,
) -> Result<MediaReferences, sqlx::Error> {
    let song_rows = sqlx::query(
        "SELECT id, title FROM songs WHERE background_id = ? AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let songs = song_rows
        .iter()
        .map(|r| SongRef {
            id: r.get("id"),
            title: r.get("title"),
        })
        .collect();

    let item_rows = sqlx::query(
        "SELECT si.id AS item_id, si.set_id, s.name AS set_name \
         FROM set_items si JOIN sets s ON s.id = si.set_id \
         WHERE si.media_id = ?",
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let set_items = item_rows
        .iter()
        .map(|r| SetItemRef {
            set_id: r.get("set_id"),
            set_name: r.get("set_name"),
            item_id: r.get("item_id"),
        })
        .collect();

    Ok(MediaReferences { songs, set_items })
}

pub async fn db_get_media_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<Media>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT id, file_name, display_name, kind, mime_type, width, height, \
         duration_ms, thumbnail_file, byte_size, created_at, updated_at, deleted_at \
         FROM media WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row.as_ref().map(row_to_media))
}

/// Returns a display name that is unique among non-deleted media rows.
/// Appends " (2)", " (3)", etc. to resolve collisions.
pub async fn unique_display_name(
    pool: &SqlitePool,
    base_name: &str,
) -> Result<String, sqlx::Error> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM media WHERE display_name = ? AND deleted_at IS NULL",
    )
    .bind(base_name)
    .fetch_one(pool)
    .await?;

    if count == 0 {
        return Ok(base_name.to_string());
    }

    let (stem, ext) = match base_name.rfind('.') {
        Some(pos) => (&base_name[..pos], &base_name[pos..]),
        None => (base_name, ""),
    };

    for i in 2u32.. {
        let candidate = format!("{stem} ({i}){ext}");
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM media WHERE display_name = ? AND deleted_at IS NULL",
        )
        .bind(&candidate)
        .fetch_one(pool)
        .await?;
        if count == 0 {
            return Ok(candidate);
        }
    }

    unreachable!()
}
