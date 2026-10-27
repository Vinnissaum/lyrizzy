use crate::commands::countdown::reset_countdown_of_removed_item;
use crate::commands::presentation::{
    compute_item_slides, emit_state, insert_item_into_outputs, load_slide_gen_settings,
    remove_item_locked,
};
use crate::commands::song::new_id;
use crate::domain::countdown::CountdownState;
use crate::domain::error::ErrorPayload;
use crate::domain::events::CountdownTickPayload;
use crate::domain::media::{MediaItemOptions, MediaKind};
use crate::domain::presentation::{on_screen_item_ids, PresentationMode, PresentationState};
use crate::domain::set::{ServiceSet, SetItem, SetItemType, WebViewConfig};
use crate::domain::slide::SlideConfig;
use crate::domain::output::OutputId;
use crate::services::play_counter;
use crate::state::AppState;
use serde::Deserialize;
use serde_json;
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
        "slide_show" => SetItemType::SlideShow,
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
        SetItemType::SlideShow => "slide_show",
    }
}

fn media_kind_from_db(s: &str) -> Option<MediaKind> {
    match s {
        "image" => Some(MediaKind::Image),
        "video" => Some(MediaKind::Video),
        "presentation" => Some(MediaKind::Presentation),
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
    pub media_id: Option<String>,
    pub media_options: Option<serde_json::Value>,
    pub countdown_config: Option<serde_json::Value>,
    pub webview_config: Option<serde_json::Value>,
    /// Insert right after this item of the same set; `None` appends.
    pub after_item_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSetItemPayload {
    pub id: String,
    pub countdown_config: Option<serde_json::Value>,
    pub webview_config: Option<serde_json::Value>,
    pub media_options: Option<serde_json::Value>,
    pub notes: Option<String>,
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

/// Delete a set and the `song_plays` rows that reference it, in one transaction.
///
/// `song_plays.set_id` carries no `ON DELETE` clause (NO ACTION) and sqlx turns
/// `PRAGMA foreign_keys` on, so a bare `DELETE FROM sets` fails for any set that
/// has ever been presented. The ledger rows are provenance for that set only, so
/// they are removed with it rather than blocking the delete.
pub async fn db_delete_set(pool: &SqlitePool, id: &str) -> Result<(), ErrorPayload> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    sqlx::query("DELETE FROM song_plays WHERE set_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    // set_items cascade via their ON DELETE CASCADE foreign key.
    let result = sqlx::query("DELETE FROM sets WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ErrorPayload::new("set.not_found"));
    }

    tx.commit()
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;
    Ok(())
}

/// Number of presentation records (`song_plays` rows) attached to a set.
/// Read-only — used to tell the operator what a deletion would discard.
pub async fn db_get_set_play_count(pool: &SqlitePool, id: &str) -> Result<i64, ErrorPayload> {
    sqlx::query_scalar("SELECT COUNT(*) FROM song_plays WHERE set_id = ?")
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))
}

#[tauri::command]
pub async fn delete_set(
    state: State<'_, AppState>,
    app: AppHandle,
    id: String,
) -> Result<(), ErrorPayload> {
    let pool = state.db.get().expect("db initialized");

    db_delete_set(pool, &id).await?;

    app.emit("set_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn get_set_play_count(
    state: State<'_, AppState>,
    id: String,
) -> Result<i64, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    db_get_set_play_count(pool, &id).await
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

pub async fn db_load_set_item(pool: &SqlitePool, id: &str) -> Result<SetItem, ErrorPayload> {
    let row = sqlx::query(
        "SELECT si.id, si.set_id, si.item_type, si.song_id, si.media_id,
                m.kind AS media_kind,
                si.media_options, si.countdown_config, si.webview_config,
                si.sort_order, si.notes
         FROM set_items si
         LEFT JOIN media m ON si.media_id = m.id AND m.deleted_at IS NULL
         WHERE si.id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?
    .ok_or_else(|| ErrorPayload::new("set.item_not_found"))?;

    let type_str: String = row.get("item_type");
    Ok(SetItem {
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
    })
}

#[tauri::command]
pub async fn add_set_item(
    state: State<'_, AppState>,
    app: AppHandle,
    payload: AddSetItemPayload,
) -> Result<SetItem, ErrorPayload> {
    let (item, snapshots) = add_set_item_core(state.inner(), payload).await?;
    app.emit("set_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    for (output, snapshot) in snapshots {
        emit_state(&app, output, &snapshot).await?;
    }
    Ok(item)
}

/// Insert a set item - right after `after_item_id` when given, else at the
/// end - and splice it into every output that has its set loaded, each keeping
/// what it shows (D-88). A song added while its set is presenting gets today's
/// CCLI play (D-90). Nothing is written when the anchor is not in this set or
/// the item's slides cannot be built. Returns the stored item and the
/// snapshots to emit.
pub(crate) async fn add_set_item_core(
    state: &AppState,
    payload: AddSetItemPayload,
) -> Result<(SetItem, Vec<(OutputId, PresentationState)>), ErrorPayload> {
    let pool = state.db.get().expect("db initialized");

    let sort_order: i32 = match payload.after_item_id.as_deref() {
        Some(anchor_id) => {
            let anchor: Option<i32> = sqlx::query_scalar(
                "SELECT sort_order FROM set_items WHERE id = ? AND set_id = ?",
            )
            .bind(anchor_id)
            .bind(&payload.set_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;
            anchor.ok_or_else(|| ErrorPayload::new("set.item_not_found"))? + 1
        }
        None => {
            let max_order: i32 = sqlx::query_scalar(
                "SELECT COALESCE(MAX(sort_order), -1) FROM set_items WHERE set_id = ?",
            )
            .bind(&payload.set_id)
            .fetch_one(pool)
            .await
            .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;
            max_order + 1
        }
    };

    let item_id = new_id();
    let item_type = item_type_from_db(&payload.item_type);
    let item_type_str = item_type_to_db(&item_type);

    // Slides depend only on the type, song and media, so build them before
    // writing anything: a failure here leaves the set as it was.
    let provisional = SetItem {
        id: item_id.clone(),
        set_id: payload.set_id.clone(),
        item_type: item_type.clone(),
        song_id: payload.song_id.clone(),
        media_id: payload.media_id.clone(),
        media_kind: None,
        media_options: None,
        countdown_config: None,
        webview_config: None,
        sort_order,
        notes: None,
    };
    let settings = load_slide_gen_settings(pool).await;
    let slides = compute_item_slides(pool, &provisional, &SlideConfig::default(), &settings).await?;

    let countdown_config_str = payload
        .countdown_config
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());
    let media_options_str = payload
        .media_options
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());
    let webview_config_str = payload
        .webview_config
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());

    // Making room after the anchor and inserting commit together or not at all.
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;
    if payload.after_item_id.is_some() {
        sqlx::query(
            "UPDATE set_items SET sort_order = sort_order + 1 WHERE set_id = ? AND sort_order >= ?",
        )
        .bind(&payload.set_id)
        .bind(sort_order)
        .execute(&mut *tx)
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;
    }
    sqlx::query(
        "INSERT INTO set_items (id, set_id, item_type, song_id, media_id, media_options, countdown_config, webview_config, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&item_id)
    .bind(&payload.set_id)
    .bind(item_type_str)
    .bind(&payload.song_id)
    .bind(&payload.media_id)
    .bind(&media_options_str)
    .bind(&countdown_config_str)
    .bind(&webview_config_str)
    .bind(sort_order)
    .execute(&mut *tx)
    .await
    .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;
    tx.commit()
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    let item = db_load_set_item(pool, &item_id).await?;
    let snapshots =
        insert_item_into_outputs(state, &item, payload.after_item_id.as_deref(), &slides).await;

    if let (SetItemType::Song, Some(song_id)) = (&item.item_type, item.song_id.as_deref()) {
        let presenting = snapshots
            .iter()
            .any(|(_, s)| s.mode != PresentationMode::Idle);
        if presenting {
            if let Err(e) = play_counter::record_song_play(pool, &item.set_id, song_id).await {
                tracing::warn!(error = %e, "record_song_play failed for a song added live");
            }
        }
    }
    Ok((item, snapshots))
}

#[tauri::command]
pub async fn update_set_item(
    state: State<'_, AppState>,
    app: AppHandle,
    payload: UpdateSetItemPayload,
) -> Result<SetItem, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");

    let countdown_config_str = payload
        .countdown_config
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());
    let webview_config_str = payload
        .webview_config
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());
    let media_options_str = payload
        .media_options
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());

    // Use COALESCE so callers can update one config field without nulling the others.
    let result = sqlx::query(
        "UPDATE set_items SET
           countdown_config = COALESCE(?, countdown_config),
           webview_config   = COALESCE(?, webview_config),
           media_options    = COALESCE(?, media_options),
           notes            = ?
         WHERE id = ?",
    )
    .bind(&countdown_config_str)
    .bind(&webview_config_str)
    .bind(&media_options_str)
    .bind(&payload.notes)
    .bind(&payload.id)
    .execute(pool)
    .await
    .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ErrorPayload::new("set.item_not_found"));
    }

    let item = db_load_set_item(pool, &payload.id).await?;

    // Keep the loaded-for-presentation snapshot in sync: if the edited item is
    // part of the set currently loaded for presentation on any output, patch it
    // in place and re-emit state so a live presentation picks up the new config
    // (e.g. a countdown's position/background) without a disruptive full reload.
    let mut snapshots = Vec::new();
    for output_id in OutputId::ALL {
        let mut pres = state.output(output_id).presentation.write().await;
        if let Some(set) = pres.set.as_mut() {
            if patch_item_in_set(set, &item) {
                snapshots.push((output_id, pres.clone()));
            }
        }
    }
    for (output_id, snapshot) in snapshots {
        app.emit(
            "state_changed",
            crate::domain::events::StateChangedPayload::new(output_id, snapshot),
        )
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    }

    app.emit("set_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(item)
}

/// Replace the matching item in `set` in place. Returns `true` if a slot was
/// replaced (i.e. `set` contained an item with the same id), `false` (and no
/// mutation) otherwise.
fn patch_item_in_set(set: &mut ServiceSet, item: &SetItem) -> bool {
    if let Some(slot) = set.items.iter_mut().find(|i| i.id == item.id) {
        *slot = item.clone();
        true
    } else {
        false
    }
}

#[tauri::command]
pub async fn remove_set_item(
    state: State<'_, AppState>,
    app: AppHandle,
    item_id: String,
) -> Result<(), ErrorPayload> {
    let removal = remove_set_item_core(state.inner(), &item_id).await?;
    app.emit("set_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    for (output, snapshot) in removal.presentations {
        emit_state(&app, output, &snapshot).await?;
    }
    for (output, countdown) in removal.countdowns {
        let _ = app.emit("countdown_tick", CountdownTickPayload::new(output, countdown));
    }
    Ok(())
}

/// What a removal changed, for the caller to emit once every lock is gone.
pub(crate) struct Removal {
    pub presentations: Vec<(OutputId, PresentationState)>,
    pub countdowns: Vec<(OutputId, CountdownState)>,
}

/// Delete a set item and splice it out of every output that has its set
/// loaded, each keeping what it shows. Refused with `set.item_on_screen` while
/// a presenting output shows it (D-88). The check and the delete run with
/// every output's slides and presentation locks held (outputs in
/// `OutputId::ALL` order, slides before presentation, as navigation takes
/// them), so nothing can land on the item in between. A countdown the item
/// started, still counting off-screen, goes back to idle.
pub(crate) async fn remove_set_item_core(
    state: &AppState,
    item_id: &str,
) -> Result<Removal, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");

    let set_id: Option<String> = sqlx::query_scalar("SELECT set_id FROM set_items WHERE id = ?")
        .bind(item_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;
    let set_id = set_id.ok_or_else(|| ErrorPayload::new("set.item_not_found"))?;

    let mut locked = Vec::new();
    for output in OutputId::ALL {
        let out = state.output(output);
        let all = out.presentation_slides.write().await;
        let pres = out.presentation.write().await;
        locked.push((output, all, pres));
    }
    let on_screen = locked.iter().any(|(_, _, pres)| {
        pres.set.as_ref().is_some_and(|s| s.id == set_id)
            && on_screen_item_ids(pres).contains(&item_id)
    });
    if on_screen {
        return Err(ErrorPayload::new("set.item_on_screen"));
    }

    let result = sqlx::query("DELETE FROM set_items WHERE id = ?")
        .bind(item_id)
        .execute(pool)
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(ErrorPayload::new("set.item_not_found"));
    }

    let mut presentations = Vec::new();
    for (output, mut all, mut pres) in locked {
        let index = pres
            .set
            .as_ref()
            .filter(|s| s.id == set_id)
            .and_then(|s| s.items.iter().position(|i| i.id == item_id));
        if let Some(index) = index {
            presentations.push((output, remove_item_locked(&mut pres, &mut all, index)));
        }
    }

    let mut countdowns = Vec::new();
    for output in OutputId::ALL {
        if let Some(countdown) = reset_countdown_of_removed_item(state, output, item_id).await {
            countdowns.push((output, countdown));
        }
    }
    Ok(Removal { presentations, countdowns })
}

#[tauri::command]
pub async fn duplicate_set_item(
    state: State<'_, AppState>,
    app: AppHandle,
    item_id: String,
) -> Result<SetItem, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");

    let original = db_load_set_item(pool, &item_id).await?;
    let all_items = load_set_items(pool, &original.set_id).await?;

    let pos = all_items
        .iter()
        .position(|i| i.id == item_id)
        .ok_or_else(|| ErrorPayload::new("set.item_not_found"))?;

    // Shift sort_order of all items after `pos` up by one to make room.
    for item in all_items.iter().skip(pos + 1) {
        sqlx::query("UPDATE set_items SET sort_order = sort_order + 1 WHERE id = ?")
            .bind(&item.id)
            .execute(pool)
            .await
            .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;
    }

    let new_id = new_id();
    let new_sort = original.sort_order + 1;
    let item_type_str = item_type_to_db(&original.item_type);
    let countdown_json = original
        .countdown_config
        .as_ref()
        .map(|c| serde_json::to_string(c).unwrap_or_default());
    let webview_json = original
        .webview_config
        .as_ref()
        .map(|c| serde_json::to_string(c).unwrap_or_default());
    let media_opts_json = original
        .media_options
        .as_ref()
        .map(|c| serde_json::to_string(c).unwrap_or_default());

    sqlx::query(
        "INSERT INTO set_items
           (id, set_id, item_type, song_id, media_id, media_options, countdown_config, webview_config, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&new_id)
    .bind(&original.set_id)
    .bind(item_type_str)
    .bind(&original.song_id)
    .bind(&original.media_id)
    .bind(&media_opts_json)
    .bind(&countdown_json)
    .bind(&webview_json)
    .bind(new_sort)
    .execute(pool)
    .await
    .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    let item = db_load_set_item(pool, &new_id).await?;
    app.emit("set_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(item)
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

/// Return the most-recently-updated set, creating a default "Culto Dominical"
/// set when the table is empty. Idempotent: calling twice with an empty table
/// produces exactly one row.
pub async fn db_get_or_create_default_set(pool: &SqlitePool) -> Result<ServiceSet, ErrorPayload> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sets")
        .fetch_one(pool)
        .await
        .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    if count > 0 {
        let row = sqlx::query("SELECT id FROM sets ORDER BY updated_at DESC LIMIT 1")
            .fetch_one(pool)
            .await
            .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;
        let id: String = row.get("id");
        return db_load_set(pool, &id).await;
    }

    let id = new_id();
    let now = now_ms();
    sqlx::query(
        "INSERT INTO sets (id, name, service_date, notes, created_at, updated_at)
         VALUES (?, ?, NULL, NULL, ?, ?)",
    )
    .bind(&id)
    .bind("Culto Dominical")
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| ErrorPayload::new("set.db_error").with_param("detail", e.to_string()))?;

    db_load_set(pool, &id).await
}

#[tauri::command]
pub async fn get_or_create_default_set(
    state: State<'_, AppState>,
) -> Result<ServiceSet, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    db_get_or_create_default_set(pool).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqliteConnectOptions;
    use std::str::FromStr;
    use tempfile::tempdir;

    async fn open_db() -> (SqlitePool, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let path = dir.path().join("set_test.db");
        let url = format!("sqlite://{}?mode=rwc", path.to_string_lossy());
        let opts = SqliteConnectOptions::from_str(&url)
            .unwrap()
            .create_if_missing(true);
        let pool = sqlx::SqlitePool::connect_with(opts).await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        (pool, dir)
    }

    #[tokio::test]
    async fn get_or_create_default_creates_when_empty() {
        let (pool, _dir) = open_db().await;
        let set = db_get_or_create_default_set(&pool).await.unwrap();
        assert_eq!(set.name, "Culto Dominical");
        assert!(set.items.is_empty());
    }

    #[tokio::test]
    async fn get_or_create_default_returns_existing_when_populated() {
        let (pool, _dir) = open_db().await;
        let first = db_get_or_create_default_set(&pool).await.unwrap();
        let second = db_get_or_create_default_set(&pool).await.unwrap();
        assert_eq!(first.id, second.id, "should return same set on second call");
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sets")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count, 1, "should not create a second set");
    }

    fn make_item(id: &str, notes: Option<&str>) -> SetItem {
        SetItem {
            id: id.to_string(),
            set_id: "set-1".to_string(),
            item_type: SetItemType::Blank,
            song_id: None,
            media_id: None,
            media_kind: None,
            media_options: None,
            countdown_config: None,
            webview_config: None,
            sort_order: 0,
            notes: notes.map(|s| s.to_string()),
        }
    }

    fn make_set(items: Vec<SetItem>) -> ServiceSet {
        ServiceSet {
            id: "set-1".to_string(),
            name: "Test Set".to_string(),
            service_date: None,
            notes: None,
            created_at: 0,
            updated_at: 0,
            items,
        }
    }

    #[test]
    fn patch_item_in_set_replaces_matching_item() {
        let mut set = make_set(vec![make_item("a", Some("old")), make_item("b", None)]);
        let updated = make_item("a", Some("new"));

        let patched = patch_item_in_set(&mut set, &updated);

        assert!(patched);
        assert_eq!(set.items[0].notes.as_deref(), Some("new"));
        assert_eq!(set.items[1].id, "b");
    }

    #[test]
    fn patch_item_in_set_returns_false_when_no_match() {
        let mut set = make_set(vec![make_item("a", Some("old"))]);
        let unrelated = make_item("z", Some("new"));

        let patched = patch_item_in_set(&mut set, &unrelated);

        assert!(!patched);
        assert_eq!(set.items[0].notes.as_deref(), Some("old"));
    }

    /// Seeds `song_plays` the way `record_set_start` does at every presentation
    /// start: one row per song, per set, per calendar day.
    async fn seed_play(pool: &SqlitePool, id: &str, song_id: &str, set_id: &str) {
        let now = now_ms();
        sqlx::query("INSERT OR IGNORE INTO songs (id, title, language, created_at, updated_at) VALUES (?, 'Song', 'pt', ?, ?)")
            .bind(song_id).bind(now).bind(now).execute(pool).await.unwrap();
        sqlx::query("INSERT INTO song_plays (id, song_id, set_id, played_on, created_at) VALUES (?, ?, ?, '2026-09-04', ?)")
            .bind(id).bind(song_id).bind(set_id).bind(now).execute(pool).await.unwrap();
    }

    async fn insert_set(pool: &SqlitePool, id: &str) {
        let now = now_ms();
        sqlx::query("INSERT INTO sets (id, name, created_at, updated_at) VALUES (?, 'Culto', ?, ?)")
            .bind(id).bind(now).bind(now).execute(pool).await.unwrap();
    }

    /// RC-7: `song_plays.set_id` is a NO ACTION foreign key, so deleting a set
    /// that has ever been presented fails unless its ledger rows go with it.
    #[tokio::test]
    async fn delete_set_takes_its_play_ledger_with_it() {
        let (pool, _dir) = open_db().await;
        insert_set(&pool, "set-a").await;
        insert_set(&pool, "set-b").await;
        seed_play(&pool, "play-a", "song-1", "set-a").await;
        seed_play(&pool, "play-b", "song-1", "set-b").await;

        db_delete_set(&pool, "set-a")
            .await
            .expect("deleting a presented set must not be blocked by its ledger");

        let remaining: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sets")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(remaining, 1, "only the requested set is deleted");
        let orphaned: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM song_plays WHERE set_id = 'set-a'")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(orphaned, 0, "the deleted set's ledger rows go with it");
        let kept: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM song_plays WHERE set_id = 'set-b'")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(kept, 1, "another set's ledger rows are untouched");
    }

    #[tokio::test]
    async fn delete_set_rejects_an_unknown_id() {
        let (pool, _dir) = open_db().await;
        let err = db_delete_set(&pool, "nope").await.unwrap_err();
        assert_eq!(err.code, "set.not_found");
    }

    #[tokio::test]
    async fn play_count_reports_the_ledger_size_per_set() {
        let (pool, _dir) = open_db().await;
        insert_set(&pool, "set-a").await;
        insert_set(&pool, "set-b").await;
        seed_play(&pool, "play-1", "song-1", "set-a").await;
        seed_play(&pool, "play-2", "song-2", "set-a").await;

        assert_eq!(db_get_set_play_count(&pool, "set-a").await.unwrap(), 2);
        assert_eq!(db_get_set_play_count(&pool, "set-b").await.unwrap(), 0);
    }

    // ─── Live set edits (P21) ────────────────────────────────────────────────

    use crate::commands::presentation::{BLACKOUT_SLIDE_LABEL, TITLE_SLIDE_LABEL};
    use crate::domain::countdown::CountdownMode;
    use crate::domain::slide::Slide;
    use crate::domain::presentation::PresentationMode::{Frozen, Idle, Live};
    use crate::domain::output::OutputId::{One, Two};

    async fn live_state() -> (AppState, tempfile::TempDir) {
        let (pool, dir) = open_db().await;
        let state = AppState::default();
        state.db.set(pool).expect("fresh state has no pool");
        (state, dir)
    }

    fn db(state: &AppState) -> &SqlitePool {
        state.db.get().unwrap()
    }

    /// A song whose strophes are one line each, so each strophe is one slide.
    async fn seed_song(pool: &SqlitePool, song_id: &str, strophes: &[String]) {
        let now = now_ms();
        sqlx::query("INSERT INTO songs (id, title, language, created_at, updated_at) VALUES (?, ?, 'pt', ?, ?)")
            .bind(song_id).bind(format!("Title {song_id}")).bind(now).bind(now)
            .execute(pool).await.unwrap();
        for (k, body) in strophes.iter().enumerate() {
            sqlx::query("INSERT INTO song_sections (id, song_id, label, type, body, sort_order) VALUES (?, ?, '', 'verse', ?, ?)")
                .bind(format!("{song_id}-s{k}")).bind(song_id).bind(body).bind(k as i32)
                .execute(pool).await.unwrap();
        }
    }

    async fn seed_two_strophe_song(pool: &SqlitePool, name: &str) {
        seed_song(pool, &format!("song-{name}"), &[format!("{name} verso 1"), format!("{name} verso 2")]).await;
    }

    /// A set whose items are songs, item id = `name`, song id = `song-<name>`.
    /// With default settings each song has 4 slides: title, 2 strophes, blackout.
    async fn seed_song_set(pool: &SqlitePool, set_id: &str, names: &[&str]) {
        insert_set(pool, set_id).await;
        for (k, name) in names.iter().enumerate() {
            seed_two_strophe_song(pool, name).await;
            sqlx::query("INSERT INTO set_items (id, set_id, item_type, song_id, sort_order) VALUES (?, ?, 'song', ?, ?)")
                .bind(name).bind(set_id).bind(format!("song-{name}")).bind(k as i32)
                .execute(pool).await.unwrap();
        }
    }

    async fn seed_countdown_item(pool: &SqlitePool, set_id: &str, id: &str, sort_order: i32) {
        sqlx::query("INSERT INTO set_items (id, set_id, item_type, countdown_config, sort_order) VALUES (?, ?, 'countdown', ?, ?)")
            .bind(id).bind(set_id)
            .bind(r#"{"target":{"kind":"duration","durationMs":600000},"endBehavior":"advanceSet"}"#)
            .bind(sort_order)
            .execute(pool).await.unwrap();
    }

    /// Load `set_id` onto `output` as `load_set_for_presentation` does, with the
    /// operator at `at` (item, slide) in `mode`, frozen on `frozen_at` if given.
    async fn present(
        state: &AppState,
        output: OutputId,
        set_id: &str,
        at: (usize, usize),
        mode: PresentationMode,
        frozen_at: Option<(usize, usize)>,
    ) {
        let pool = db(state);
        let set = db_load_set(pool, set_id).await.unwrap();
        let settings = load_slide_gen_settings(pool).await;
        let mut all: Vec<Vec<Slide>> = Vec::new();
        for item in &set.items {
            all.push(compute_item_slides(pool, item, &SlideConfig::default(), &settings).await.unwrap());
        }
        let slide_at = |(i, s): (usize, usize)| all.get(i).and_then(|v| v.get(s)).cloned();
        let current_slide = match mode {
            Live => slide_at(at),
            Frozen => slide_at(frozen_at.unwrap_or(at)),
            _ => None,
        };
        let next_slide = if at.1 + 1 < all.get(at.0).map_or(0, Vec::len) {
            slide_at((at.0, at.1 + 1))
        } else {
            slide_at((at.0 + 1, 0))
        };
        let pres = PresentationState {
            set: Some(set),
            current_item_index: at.0,
            current_slide_index: at.1,
            mode,
            frozen_at,
            current_slide,
            next_slide,
            item_slide_counts: all.iter().map(Vec::len).collect(),
            ..Default::default()
        };
        *state.output(output).presentation_slides.write().await = all;
        *state.output(output).presentation.write().await = pres;
    }

    async fn stored_order(pool: &SqlitePool, set_id: &str) -> Vec<String> {
        load_set_items(pool, set_id).await.unwrap().into_iter().map(|i| i.id).collect()
    }

    async fn live(state: &AppState, output: OutputId) -> PresentationState {
        state.output(output).presentation.read().await.clone()
    }

    async fn live_order(state: &AppState, output: OutputId) -> Vec<String> {
        live(state, output).await.set.map(|s| s.items.into_iter().map(|i| i.id).collect()).unwrap_or_default()
    }

    async fn live_slides(state: &AppState, output: OutputId) -> Vec<Vec<Slide>> {
        state.output(output).presentation_slides.read().await.clone()
    }

    fn add_song(set_id: &str, name: &str, after: Option<&str>) -> AddSetItemPayload {
        AddSetItemPayload {
            set_id: set_id.into(),
            item_type: "song".into(),
            song_id: Some(format!("song-{name}")),
            media_id: None,
            media_options: None,
            countdown_config: None,
            webview_config: None,
            after_item_id: after.map(str::to_string),
        }
    }

    async fn plays(pool: &SqlitePool, song_id: &str, set_id: &str) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM song_plays WHERE song_id = ? AND set_id = ?")
            .bind(song_id).bind(set_id).fetch_one(pool).await.unwrap()
    }

    #[tokio::test]
    async fn live_add_after_current_keeps_the_wall() {
        let (state, _dir) = live_state().await;
        seed_song_set(db(&state), "set-1", &["A", "B", "C"]).await;
        seed_two_strophe_song(db(&state), "D").await;
        // On B's last slide (its blackout, index 3).
        present(&state, One, "set-1", (1, 3), Live, None).await;
        let shown_before = live(&state, One).await.current_slide;

        let (item, snapshots) =
            add_set_item_core(&state, add_song("set-1", "D", Some("B"))).await.unwrap();
        let d = item.id.as_str();

        assert_eq!(stored_order(db(&state), "set-1").await, ["A", "B", d, "C"]);
        assert_eq!(live_order(&state, One).await, ["A", "B", d, "C"]);
        let after = live(&state, One).await;
        assert_eq!(after.current_item_index, 1);
        assert_eq!(after.current_slide_index, 3);
        assert_eq!(after.current_slide, shown_before);
        let d_first = live_slides(&state, One).await[2][0].clone();
        assert_eq!(d_first.section_id, "song-D__title");
        assert_eq!(after.next_slide, Some(d_first), "advancing from B's last slide lands on D");
        assert_eq!(snapshots.len(), 1);
        assert_eq!(snapshots[0].0, One);
    }

    #[tokio::test]
    async fn live_add_after_last_item_updates_lookahead() {
        let (state, _dir) = live_state().await;
        seed_song_set(db(&state), "set-1", &["A", "B", "C"]).await;
        seed_two_strophe_song(db(&state), "D").await;
        present(&state, One, "set-1", (2, 3), Live, None).await;
        assert_eq!(live(&state, One).await.next_slide, None);

        let (item, _) = add_set_item_core(&state, add_song("set-1", "D", Some("C"))).await.unwrap();

        assert_eq!(stored_order(db(&state), "set-1").await, ["A", "B", "C", item.id.as_str()]);
        let d_first = live_slides(&state, One).await[3][0].clone();
        assert_eq!(live(&state, One).await.next_slide, Some(d_first));
        assert_eq!(live(&state, One).await.current_item_index, 2);
    }

    #[tokio::test]
    async fn live_add_keeps_pick_order() {
        let (state, _dir) = live_state().await;
        seed_song_set(db(&state), "set-1", &["A", "B", "C"]).await;
        seed_two_strophe_song(db(&state), "D").await;
        seed_two_strophe_song(db(&state), "E").await;
        present(&state, One, "set-1", (1, 0), Live, None).await;

        let (d, _) = add_set_item_core(&state, add_song("set-1", "D", Some("B"))).await.unwrap();
        let (e, _) = add_set_item_core(&state, add_song("set-1", "E", Some(&d.id))).await.unwrap();

        let expected = ["A", "B", d.id.as_str(), e.id.as_str(), "C"];
        assert_eq!(stored_order(db(&state), "set-1").await, expected);
        assert_eq!(live_order(&state, One).await, expected);
    }

    #[tokio::test]
    async fn live_add_generates_slides_like_apresentar() {
        let (state, _dir) = live_state().await;
        seed_song_set(db(&state), "set-1", &["A", "B", "C"]).await;
        seed_two_strophe_song(db(&state), "D").await;
        present(&state, One, "set-1", (1, 0), Live, None).await;

        let (_, snapshots) =
            add_set_item_core(&state, add_song("set-1", "D", Some("B"))).await.unwrap();

        let emitted = &snapshots[0].1;
        assert_eq!(emitted.all_slides_per_item.len(), 4);
        let d = &emitted.all_slides_per_item[2];
        assert_eq!(d.len(), 4);
        assert_eq!(d[0].section_label, TITLE_SLIDE_LABEL);
        assert_eq!(d[1].lines, ["D verso 1"]);
        assert_eq!(d[2].lines, ["D verso 2"]);
        assert_eq!(d[3].section_label, BLACKOUT_SLIDE_LABEL);
        assert_eq!(emitted.item_slide_counts, vec![4, 4, 4, 4]);
        // The stored state stays slim; only the emitted copy carries slides.
        assert!(live(&state, One).await.all_slides_per_item.is_empty());
    }

    #[tokio::test]
    async fn live_add_records_a_play_only_while_presenting() {
        let (state, _dir) = live_state().await;
        let pool = db(&state);
        seed_song_set(pool, "set-1", &["A", "B"]).await;
        seed_two_strophe_song(pool, "D").await;
        present(&state, One, "set-1", (0, 0), Live, None).await;

        add_set_item_core(&state, add_song("set-1", "D", Some("A"))).await.unwrap();
        assert_eq!(plays(pool, "song-D", "set-1").await, 1);
        add_set_item_core(&state, add_song("set-1", "D", Some("A"))).await.unwrap();
        assert_eq!(plays(pool, "song-D", "set-1").await, 1, "one play per song, set and day");

        // A set loaded nowhere: no play until Apresentar.
        insert_set(pool, "set-2").await;
        add_set_item_core(&state, add_song("set-2", "D", None)).await.unwrap();
        assert_eq!(plays(pool, "song-D", "set-2").await, 0);

        // A set loaded on an output that is not presenting: no play either.
        insert_set(pool, "set-3").await;
        present(&state, Two, "set-3", (0, 0), Idle, None).await;
        add_set_item_core(&state, add_song("set-3", "D", None)).await.unwrap();
        assert_eq!(plays(pool, "song-D", "set-3").await, 0);
    }

    #[tokio::test]
    async fn live_add_refuses_a_foreign_anchor() {
        let (state, _dir) = live_state().await;
        let pool = db(&state);
        seed_song_set(pool, "set-1", &["A", "B", "C"]).await;
        seed_song_set(pool, "set-2", &["X1"]).await;
        seed_two_strophe_song(pool, "D").await;
        present(&state, One, "set-1", (1, 0), Live, None).await;

        for anchor in ["X1", "nope"] {
            let err = add_set_item_core(&state, add_song("set-1", "D", Some(anchor)))
                .await
                .unwrap_err();
            assert_eq!(err.code, "set.item_not_found", "{anchor}");
        }
        assert_eq!(stored_order(pool, "set-1").await, ["A", "B", "C"]);
        assert_eq!(stored_order(pool, "set-2").await, ["X1"]);
        assert_eq!(live_order(&state, One).await, ["A", "B", "C"]);
        assert_eq!(live_slides(&state, One).await.len(), 3);
    }

    #[tokio::test]
    async fn live_add_reaches_every_output_with_the_set() {
        let (state, _dir) = live_state().await;
        let pool = db(&state);
        seed_song_set(pool, "set-1", &["A", "B", "C"]).await;
        seed_song_set(pool, "set-2", &["X1"]).await;
        seed_two_strophe_song(pool, "D").await;
        present(&state, One, "set-1", (0, 0), Live, None).await;
        // Tela 2 frozen on C's slide 1 while its operator navigates on A.
        present(&state, Two, "set-1", (0, 0), Frozen, Some((2, 1))).await;
        let two_shows = live(&state, Two).await.current_slide;

        let (d, snapshots) =
            add_set_item_core(&state, add_song("set-1", "D", Some("A"))).await.unwrap();

        let expected = ["A", d.id.as_str(), "B", "C"];
        assert_eq!(live_order(&state, One).await, expected);
        assert_eq!(live_order(&state, Two).await, expected);
        let two = live(&state, Two).await;
        assert_eq!(two.frozen_at, Some((3, 1)));
        assert_eq!(two.current_slide, two_shows);
        assert_eq!(two.current_item_index, 0);
        assert_eq!(snapshots.len(), 2);

        // Tela 2 on another set is untouched.
        present(&state, Two, "set-2", (0, 0), Live, None).await;
        let (_, snapshots) =
            add_set_item_core(&state, add_song("set-1", "D", Some("A"))).await.unwrap();
        assert_eq!(live_order(&state, Two).await, ["X1"]);
        assert_eq!(snapshots.iter().map(|(o, _)| *o).collect::<Vec<_>>(), [One]);
    }

    #[tokio::test]
    async fn live_add_reaches_every_output_with_the_set_when_frozen_right_after_the_anchor() {
        let (state, _dir) = live_state().await;
        let pool = db(&state);
        seed_song_set(pool, "set-1", &["A", "B", "C"]).await;
        seed_two_strophe_song(pool, "D").await;
        present(&state, One, "set-1", (1, 0), Live, None).await;
        // Tela 2 frozen on C's slide 1 while its operator navigates on B.
        present(&state, Two, "set-1", (1, 0), Frozen, Some((2, 1))).await;
        let two_shows = live(&state, Two).await.current_slide;

        let (d, _) = add_set_item_core(&state, add_song("set-1", "D", Some("B"))).await.unwrap();

        assert_eq!(live_order(&state, Two).await, ["A", "B", d.id.as_str(), "C"]);
        let two = live(&state, Two).await;
        assert_eq!(two.frozen_at, Some((3, 1)), "still frozen on C, not on the new song");
        assert_eq!(two.current_slide, two_shows);
        assert_eq!(two.current_item_index, 1);
    }

    #[tokio::test]
    async fn live_add_appends_on_every_output() {
        let (state, _dir) = live_state().await;
        seed_song_set(db(&state), "set-1", &["A", "B"]).await;
        present(&state, One, "set-1", (0, 0), Live, None).await;
        present(&state, Two, "set-1", (1, 0), Live, None).await;

        let slideshow = AddSetItemPayload {
            set_id: "set-1".into(),
            item_type: "slide_show".into(),
            song_id: None,
            media_id: None,
            media_options: None,
            countdown_config: None,
            webview_config: None,
            after_item_id: None,
        };
        let (item, snapshots) = add_set_item_core(&state, slideshow).await.unwrap();

        let expected = ["A", "B", item.id.as_str()];
        assert_eq!(stored_order(db(&state), "set-1").await, expected);
        assert_eq!(live_order(&state, One).await, expected);
        assert_eq!(live_order(&state, Two).await, expected);
        assert_eq!(live(&state, Two).await.current_item_index, 1);
        assert_eq!(snapshots.len(), 2);
    }

    #[tokio::test]
    async fn live_remove_keeps_the_wall() {
        let (state, _dir) = live_state().await;
        seed_song_set(db(&state), "set-1", &["A", "B", "C", "D"]).await;
        present(&state, One, "set-1", (2, 1), Live, None).await;
        let shown_before = live(&state, One).await.current_slide;

        let removal = remove_set_item_core(&state, "A").await.unwrap();

        assert_eq!(stored_order(db(&state), "set-1").await, ["B", "C", "D"]);
        assert_eq!(live_order(&state, One).await, ["B", "C", "D"]);
        let after = live(&state, One).await;
        assert_eq!(after.current_item_index, 1);
        assert_eq!(after.current_slide_index, 1);
        assert_eq!(after.current_slide, shown_before);
        assert_eq!(removal.presentations.len(), 1);
        assert_eq!(removal.presentations[0].1.all_slides_per_item.len(), 3);

        // On C's last slide, D is the lookahead; removing D leaves none.
        present(&state, One, "set-1", (1, 3), Live, None).await;
        assert!(live(&state, One).await.next_slide.is_some());
        remove_set_item_core(&state, "D").await.unwrap();
        assert_eq!(live(&state, One).await.next_slide, None);
    }

    #[tokio::test]
    async fn live_remove_refuses_on_screen() {
        let (state, _dir) = live_state().await;
        let pool = db(&state);
        seed_song_set(pool, "set-1", &["A", "B", "C"]).await;

        // The focused output's current item.
        present(&state, One, "set-1", (1, 0), Live, None).await;
        let err = remove_set_item_core(&state, "B").await.err().expect("refused");
        assert_eq!(err.code, "set.item_on_screen");

        // The frozen item, while the operator navigates elsewhere.
        present(&state, One, "set-1", (0, 0), Frozen, Some((2, 0))).await;
        let err = remove_set_item_core(&state, "C").await.err().expect("refused");
        assert_eq!(err.code, "set.item_on_screen");

        // Tela 2's current item, when Tela 2 presents the same set.
        present(&state, One, "set-1", (0, 0), Live, None).await;
        present(&state, Two, "set-1", (1, 0), Live, None).await;
        let err = remove_set_item_core(&state, "B").await.err().expect("refused");
        assert_eq!(err.code, "set.item_on_screen");

        assert_eq!(stored_order(pool, "set-1").await, ["A", "B", "C"]);
        assert_eq!(live_order(&state, One).await, ["A", "B", "C"]);
        assert_eq!(live_order(&state, Two).await, ["A", "B", "C"]);

        // An output with the set loaded but idle blocks nothing.
        present(&state, Two, "set-1", (1, 0), Idle, None).await;
        remove_set_item_core(&state, "B").await.unwrap();
        assert_eq!(stored_order(pool, "set-1").await, ["A", "C"]);
    }

    #[tokio::test]
    async fn live_remove_refuses_an_unknown_item() {
        let (state, _dir) = live_state().await;
        let err = remove_set_item_core(&state, "nope").await.err().expect("refused");
        assert_eq!(err.code, "set.item_not_found");
    }

    #[tokio::test]
    async fn live_remove_checks_under_the_presentation_lock() {
        let (state, _dir) = live_state().await;
        seed_song_set(db(&state), "set-1", &["A", "B", "C"]).await;
        present(&state, One, "set-1", (0, 0), Live, None).await;

        let mut held = state.output(One).presentation.write().await;
        let mut removal = std::pin::pin!(remove_set_item_core(&state, "B"));
        let waited =
            tokio::time::timeout(std::time::Duration::from_millis(100), &mut removal).await;
        assert!(waited.is_err(), "the removal must wait for the presentation lock");

        // The holder moves the output onto B before releasing.
        held.current_item_index = 1;
        drop(held);

        let err = removal.await.err().expect("refused once B is on screen");
        assert_eq!(err.code, "set.item_on_screen");
        assert_eq!(stored_order(db(&state), "set-1").await, ["A", "B", "C"]);
    }

    #[tokio::test]
    async fn live_remove_checks_under_the_presentation_lock_through_the_delete() {
        let (state, _dir) = live_state().await;
        seed_song_set(db(&state), "set-1", &["A", "B", "C"]).await;
        present(&state, One, "set-1", (0, 0), Live, None).await;

        // Another connection holds the write lock, so the DELETE has to wait.
        let mut blocker = db(&state).acquire().await.unwrap();
        sqlx::query("BEGIN IMMEDIATE").execute(&mut *blocker).await.unwrap();

        let mut removal = std::pin::pin!(remove_set_item_core(&state, "C"));
        let waited =
            tokio::time::timeout(std::time::Duration::from_millis(300), &mut removal).await;
        assert!(waited.is_err(), "the DELETE waits for the database lock");

        // While the delete waits, nothing can navigate: the removal still holds
        // the presentation lock it checked under.
        let probe = tokio::time::timeout(
            std::time::Duration::from_millis(100),
            state.output(One).presentation.read(),
        )
        .await;
        assert!(probe.is_err(), "the presentation lock is held across the delete");

        sqlx::query("ROLLBACK").execute(&mut *blocker).await.unwrap();
        drop(blocker);
        assert!(removal.await.is_ok(), "the removal completes once the database frees up");
        assert_eq!(stored_order(db(&state), "set-1").await, ["A", "B"]);
        assert_eq!(live_order(&state, One).await, ["A", "B"]);
    }

    #[tokio::test]
    async fn live_remove_keeps_the_play_row() {
        let (state, _dir) = live_state().await;
        let pool = db(&state);
        seed_song_set(pool, "set-1", &["A", "B", "C"]).await;
        play_counter::record_set_start(pool, "set-1").await.unwrap();
        present(&state, One, "set-1", (0, 0), Live, None).await;

        remove_set_item_core(&state, "B").await.unwrap();

        assert_eq!(plays(pool, "song-B", "set-1").await, 1);
    }

    #[tokio::test]
    async fn live_remove_resets_its_countdown() {
        let (state, _dir) = live_state().await;
        let pool = db(&state);
        seed_song_set(pool, "set-1", &["A", "B"]).await;
        seed_countdown_item(pool, "set-1", "CD", 5).await;
        // The operator left the countdown item for song B; it still counts.
        present(&state, One, "set-1", (1, 0), Live, None).await;
        *state.output(One).countdown.write().await = CountdownState {
            mode: CountdownMode::Running,
            duration_ms: 600_000,
            remaining_ms: 360_000,
            target_epoch_ms: Some(9_999_999),
            source_item_id: Some("CD".into()),
            ..CountdownState::default()
        };
        // Tela 2 has a schedule armed (no source item).
        *state.output(Two).countdown.write().await = CountdownState {
            mode: CountdownMode::Scheduled,
            scheduled_start_epoch_ms: Some(9_999_999),
            ..CountdownState::default()
        };

        let removal = remove_set_item_core(&state, "CD").await.unwrap();

        assert_eq!(state.output(One).countdown.read().await.mode, CountdownMode::Idle);
        assert_eq!(state.output(Two).countdown.read().await.mode, CountdownMode::Scheduled);
        assert_eq!(removal.countdowns.len(), 1);
        assert_eq!(removal.countdowns[0].0, One);
        assert_eq!(removal.countdowns[0].1.mode, CountdownMode::Idle);
    }

    #[tokio::test]
    async fn live_remove_resets_its_countdown_when_paused_or_finished() {
        for mode in [CountdownMode::Paused, CountdownMode::Finished] {
            let (state, _dir) = live_state().await;
            let pool = db(&state);
            seed_song_set(pool, "set-1", &["A", "B"]).await;
            seed_countdown_item(pool, "set-1", "CD", 5).await;
            present(&state, One, "set-1", (1, 0), Live, None).await;
            *state.output(One).countdown.write().await = CountdownState {
                mode: mode.clone(),
                duration_ms: 600_000,
                remaining_ms: 120_000,
                source_item_id: Some("CD".into()),
                ..CountdownState::default()
            };

            let removal = remove_set_item_core(&state, "CD").await.unwrap();

            assert_eq!(
                state.output(One).countdown.read().await.mode,
                CountdownMode::Idle,
                "{mode:?}"
            );
            assert_eq!(removal.countdowns.len(), 1, "{mode:?}");
        }
    }

    #[tokio::test]
    async fn live_remove_leaves_a_running_countdown_alone() {
        let (state, _dir) = live_state().await;
        let pool = db(&state);
        seed_song_set(pool, "set-1", &["A", "B"]).await;
        seed_countdown_item(pool, "set-1", "CD", 5).await;
        present(&state, One, "set-1", (2, 0), Live, None).await;
        let running = CountdownState {
            mode: CountdownMode::Running,
            duration_ms: 600_000,
            remaining_ms: 432_000, // 07:12
            target_epoch_ms: Some(9_999_999),
            source_item_id: Some("CD".into()),
            ..CountdownState::default()
        };
        *state.output(One).countdown.write().await = running.clone();

        let removal = remove_set_item_core(&state, "A").await.unwrap();

        let after = state.output(One).countdown.read().await.clone();
        assert_eq!(after.mode, CountdownMode::Running);
        assert_eq!(after.target_epoch_ms, running.target_epoch_ms);
        assert_eq!(after.remaining_ms, running.remaining_ms);
        assert_eq!(after.source_item_id, running.source_item_id);
        assert!(removal.countdowns.is_empty());
        assert_eq!(live(&state, One).await.current_item_index, 1);
        assert_eq!(live_order(&state, One).await[1], "CD");
    }
}
