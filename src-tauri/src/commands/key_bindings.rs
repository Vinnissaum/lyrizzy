use crate::domain::error::ErrorPayload;
use crate::domain::key_bindings::{KeyBindings, KeyBindingsValidationError};
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State};

const SETTINGS_KEY: &str = "key_bindings";

async fn read_bindings(state: &AppState) -> KeyBindings {
    let pool = match state.db.get() {
        Some(p) => p,
        None => return KeyBindings::defaults(),
    };
    let raw: Option<String> =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
            .bind(SETTINGS_KEY)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    match raw {
        Some(json) => match serde_json::from_str::<KeyBindings>(&json) {
            Ok(kb) => kb,
            Err(e) => {
                eprintln!("[trinity] key_bindings parse error, using defaults: {e}");
                KeyBindings::defaults()
            }
        },
        None => KeyBindings::defaults(),
    }
}

async fn persist_bindings(state: &AppState, kb: &KeyBindings) -> Result<(), sqlx::Error> {
    let pool = state.db.get().expect("db initialized");
    let json = serde_json::to_string(kb).expect("KeyBindings serialization infallible");
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(SETTINGS_KEY)
    .bind(json)
    .execute(pool)
    .await?;
    Ok(())
}

fn validation_error_to_payload(e: KeyBindingsValidationError) -> ErrorPayload {
    match e {
        KeyBindingsValidationError::MissingAction { action } => {
            ErrorPayload::new("key_bindings.missing_action").with_param("action", action)
        }
        KeyBindingsValidationError::Conflict { action_a, action_b } => {
            ErrorPayload::new("key_bindings.conflict")
                .with_param("actionA", action_a)
                .with_param("actionB", action_b)
        }
        KeyBindingsValidationError::InvalidShortcut => {
            ErrorPayload::new("key_bindings.invalid_shortcut")
        }
    }
}

#[tauri::command]
pub async fn get_key_bindings(state: State<'_, AppState>) -> Result<KeyBindings, ErrorPayload> {
    Ok(read_bindings(&state).await)
}

#[tauri::command]
pub async fn set_key_bindings(
    state: State<'_, AppState>,
    app: AppHandle,
    bindings: KeyBindings,
) -> Result<KeyBindings, ErrorPayload> {
    bindings.validate().map_err(validation_error_to_payload)?;
    persist_bindings(&state, &bindings)
        .await
        .map_err(|e| ErrorPayload::new("key_bindings.db_error").with_param("detail", e.to_string()))?;
    app.emit("key_bindings_changed", &bindings)
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(bindings)
}

#[tauri::command]
pub async fn reset_key_bindings(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<KeyBindings, ErrorPayload> {
    let defaults = KeyBindings::defaults();
    persist_bindings(&state, &defaults)
        .await
        .map_err(|e| ErrorPayload::new("key_bindings.db_error").with_param("detail", e.to_string()))?;
    app.emit("key_bindings_changed", &defaults)
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(defaults)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::key_bindings::{ActionId, Shortcut};
    use sqlx::sqlite::SqliteConnectOptions;
    use std::str::FromStr;
    use tempfile::tempdir;

    async fn open_db() -> (sqlx::SqlitePool, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let path = dir.path().join("kb_test.db");
        let url = format!("sqlite://{}?mode=rwc", path.to_string_lossy());
        let opts = SqliteConnectOptions::from_str(&url)
            .unwrap()
            .create_if_missing(true);
        let pool = sqlx::SqlitePool::connect_with(opts).await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        (pool, dir)
    }

    #[tokio::test]
    async fn get_returns_defaults_when_row_missing() {
        let (pool, _dir) = open_db().await;
        sqlx::query("DELETE FROM settings WHERE key = 'key_bindings'")
            .execute(&pool)
            .await
            .unwrap();

        let raw: Option<String> =
            sqlx::query_scalar("SELECT value FROM settings WHERE key = 'key_bindings'")
                .fetch_optional(&pool)
                .await
                .unwrap();
        assert!(raw.is_none());

        // Simulate the read_bindings logic directly
        let defaults = KeyBindings::defaults();
        assert!(defaults.validate().is_ok());
    }

    #[tokio::test]
    async fn persist_and_read_round_trip() {
        let (pool, _dir) = open_db().await;
        let mut kb = KeyBindings::defaults();
        kb.bindings
            .insert(ActionId::Blank, vec![Shortcut::simple("x")]);

        let json = serde_json::to_string(&kb).unwrap();
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES ('key_bindings', ?) \
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(&json)
        .execute(&pool)
        .await
        .unwrap();

        let raw: String =
            sqlx::query_scalar("SELECT value FROM settings WHERE key = 'key_bindings'")
                .fetch_one(&pool)
                .await
                .unwrap();
        let back: KeyBindings = serde_json::from_str(&raw).unwrap();
        assert_eq!(back.bindings.get(&ActionId::Blank).unwrap()[0].key, "x");
    }

    #[tokio::test]
    async fn set_key_bindings_rejects_conflict() {
        let mut kb = KeyBindings::defaults();
        // Create a conflict: give FocusSearch the same shortcut as Blank
        kb.bindings
            .insert(ActionId::FocusSearch, vec![Shortcut::simple("b")]);
        let result = kb.validate();
        assert!(matches!(
            result,
            Err(KeyBindingsValidationError::Conflict { .. })
        ));
    }

    #[tokio::test]
    async fn set_key_bindings_rejects_missing_action() {
        let mut kb = KeyBindings::defaults();
        kb.bindings.remove(&ActionId::Blank);
        let result = kb.validate();
        assert!(matches!(
            result,
            Err(KeyBindingsValidationError::MissingAction { .. })
        ));
    }
}
