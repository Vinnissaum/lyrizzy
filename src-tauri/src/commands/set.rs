use crate::commands::song::new_id;
use crate::domain::error::ErrorPayload;
use crate::domain::media::{MediaItemOptions, MediaKind};
use crate::domain::set::{ServiceSet, SetItem, SetItemType, WebViewConfig};
use crate::state::AppState;
use serde::Deserialize;
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Emitter, State};

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn item_type_from_db(s: &str) -> SetItemType {
    match s {
        "media" => SetItemType::Media,
        "countdown" => SetItemType::Countdown,
        "web_view" | "webview" => SetItemType::WebView,
        "blank" => SetItemType::Blank,
        _ => SetItemType::Song,
    }
}

fn item_type_to_db(t: &SetItemType) -> &'static str {
    match t {
        SetItemType::Song => "song",
        SetItemType::Media => "media",
        SetItemType::Countdown => "countdown",
        SetItemType::WebView => "web_view",
        SetItemType::Blank => "blank",
    }
}

fn media_kind_from_db(s: &str) -> Option<MediaKind> {
    match s {
        "image" => Some(MediaKind::Image),
        "video" => Some(MediaKind::Video),
        _ => None,
    }
}

pub async fn load_set_items(pool: &SqlitePool, set_id: &str) -> Result<Vec<SetItem>, ErrorPayload> {
    let rows = sqlx::query(
        "SELECT si.id, si.set_id, si.item_type, si.song_id, si.media_id,
                m.kind AS media_kind,
                si.media_options, si.countdown_config, si.webview_config,
                si.sort_order, si.notes
         FROM set_items si
         LEFT JOIN media m ON si.media_id = m.id AND m.deleted_at IS NULL
         WHERE si.set_id = ? ORDER BY si.sort_order ASC",
    )
    .bind(set_id)
    .fetch_all(pool)
    .await
    .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    Ok(rows
        .iter()
        .map(|row| {
            let type_str: String = row.get("item_type");
            SetItem {
                id: row.get("id"),
                set_id: row.get("set_id"),
                item_type: item_type_from_db(&type_str),
                song_id: row.get("song_id"),
                media_id: row.get("media_id"),
                media_kind: row
                    .get::<Option<String>, _>("media_kind")
                    .as_deref()
                    .and_then(media_kind_from_db),
                media_options: row
                    .get::<Option<String>, _>("media_options")
                    .as_deref()
                    .and_then(|s| serde_json::from_str::<MediaItemOptions>(s).ok()),
                countdown_config: row
                    .get::<Option<String>, _>("countdown_config")
                    .as_deref()
                    .and_then(|s| serde_json::from_str(s).ok()),
                webview_config: row
                    .get::<Option<String>, _>("webview_config")
                    .as_deref()
                    .and_then(|s| serde_json::from_str::<WebViewConfig>(s).ok()),
                sort_order: row.get("sort_order"),
                notes: row.get("notes"),
            }
        })
        .collect())
}

pub async fn db_load_set(pool: &SqlitePool, id: &str) -> Result<ServiceSet, ErrorPayload> {
    let row = sqlx::query(
        "SELECT id, name, service_date, notes, created_at, updated_at FROM sets WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?
    .ok_or_else(|| ErrorPayload::new("set.not_found"))?;

    let items = load_set_items(pool, id).await?;

    Ok(ServiceSet {
        id: row.get("id"),
        name: row.get("name"),
        service_date: row.get("service_date"),
        notes: row.get("notes"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        items,
    })
}

// ─── Payload types ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSetPayload {
    pub name: String,
    pub service_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSetPayload {
    pub id: String,
    pub name: String,
    pub service_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddSetItemPayload {
    pub set_id: String,
    pub item_type: String,
    pub song_id: Option<String>,
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_set(
    state: State<'_, AppState>,
    app: AppHandle,
    payload: CreateSetPayload,
) -> Result<ServiceSet, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    let id = new_id();
    let now = now_ms();

    sqlx::query(
        "INSERT INTO sets (id, name, service_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&payload.service_date)
    .bind(&payload.notes)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    let set = ServiceSet {
        id,
        name: payload.name,
        service_date: payload.service_date,
        notes: payload.notes,
        created_at: now,
        updated_at: now,
        items: vec![],
    };
    app.emit("set_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(set)
}

#[tauri::command]
pub async fn update_set(
    state: State<'_, AppState>,
    app: AppHandle,
    payload: UpdateSetPayload,
) -> Result<ServiceSet, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    let now = now_ms();

    let result =
        sqlx::query("UPDATE sets SET name=?, service_date=?, notes=?, updated_at=? WHERE id=?")
            .bind(&payload.name)
            .bind(&payload.service_date)
            .bind(&payload.notes)
            .bind(now)
            .bind(&payload.id)
            .execute(pool)
            .await
            .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ErrorPayload::new("set.not_found"));
    }

    let set = db_load_set(pool, &payload.id).await?;
    app.emit("set_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(set)
}

#[tauri::command]
pub async fn delete_set(
    state: State<'_, AppState>,
    app: AppHandle,
    id: String,
) -> Result<(), ErrorPayload> {
    let pool = state.db.get().expect("db initialized");

    let result = sqlx::query("DELETE FROM sets WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ErrorPayload::new("set.not_found"));
    }
    app.emit("set_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn list_sets(state: State<'_, AppState>) -> Result<Vec<ServiceSet>, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");

    let rows = sqlx::query(
        "SELECT id, name, service_date, notes, created_at, updated_at
         FROM sets ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    let mut sets = Vec::new();
    for row in &rows {
        let id: String = row.get("id");
        let items = load_set_items(pool, &id).await?;
        sets.push(ServiceSet {
            id,
            name: row.get("name"),
            service_date: row.get("service_date"),
            notes: row.get("notes"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            items,
        });
    }
    Ok(sets)
}

#[tauri::command]
pub async fn get_set(state: State<'_, AppState>, id: String) -> Result<ServiceSet, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    db_load_set(pool, &id).await
}

#[tauri::command]
pub async fn add_set_item(
    state: State<'_, AppState>,
    app: AppHandle,
    payload: AddSetItemPayload,
) -> Result<SetItem, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");

    let max_order: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sort_order), -1) FROM set_items WHERE set_id = ?",
    )
    .bind(&payload.set_id)
    .fetch_one(pool)
    .await
    .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    let item_id = new_id();
    let sort_order = max_order + 1;
    let item_type = item_type_from_db(&payload.item_type);
    let item_type_str = item_type_to_db(&item_type);

    sqlx::query(
        "INSERT INTO set_items (id, set_id, item_type, song_id, sort_order)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&item_id)
    .bind(&payload.set_id)
    .bind(item_type_str)
    .bind(&payload.song_id)
    .bind(sort_order)
    .execute(pool)
    .await
    .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    let item = SetItem {
        id: item_id,
        set_id: payload.set_id,
        item_type,
        song_id: payload.song_id,
        media_id: None,
        media_kind: None,
        media_options: None,
        countdown_config: None,
        webview_config: None,
        sort_order,
        notes: None,
    };
    app.emit("set_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(item)
}

#[tauri::command]
pub async fn remove_set_item(
    state: State<'_, AppState>,
    app: AppHandle,
    item_id: String,
) -> Result<(), ErrorPayload> {
    let pool = state.db.get().expect("db initialized");

    let result = sqlx::query("DELETE FROM set_items WHERE id = ?")
        .bind(&item_id)
        .execute(pool)
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ErrorPayload::new("set.item_not_found"));
    }
    app.emit("set_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn reorder_set_items(
    state: State<'_, AppState>,
    app: AppHandle,
    set_id: String,
    item_ids: Vec<String>,
) -> Result<ServiceSet, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    for (i, id) in item_ids.iter().enumerate() {
        sqlx::query("UPDATE set_items SET sort_order = ? WHERE id = ? AND set_id = ?")
            .bind(i as i32)
            .bind(id)
            .bind(&set_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;
    }

    tx.commit()
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    let set = db_load_set(pool, &set_id).await?;
    app.emit("set_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(set)
}
