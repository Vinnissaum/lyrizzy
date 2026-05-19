use crate::domain::error::ErrorPayload;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub async fn get_setting(
    key: String,
    state: State<'_, AppState>,
) -> Result<String, ErrorPayload> {
    let pool = state
        .db
        .get()
        .ok_or_else(|| ErrorPayload::new("db.not_ready"))?;

    let value: Option<String> =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
            .bind(&key)
            .fetch_optional(pool)
            .await
            .map_err(|e| ErrorPayload::new("settings.db_error").with_param("detail", e.to_string()))?;

    value.ok_or_else(|| ErrorPayload::new("settings.not_found").with_param("key", key))
}

#[tauri::command]
pub async fn set_setting(
    key: String,
    value: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), ErrorPayload> {
    let pool = state
        .db
        .get()
        .ok_or_else(|| ErrorPayload::new("db.not_ready"))?;

    sqlx::query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(&key)
        .bind(&value)
        .execute(pool)
        .await
        .map_err(|e| ErrorPayload::new("settings.db_error").with_param("detail", e.to_string()))?;

    if key == "app.locale" {
        let _ = app.emit("locale_changed", value);
    }

    Ok(())
}
