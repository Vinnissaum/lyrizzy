use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::state::AppState;

/// Payload emitted on every state mutation.
/// Phase 0: carries only the counter value.
/// Phase 1+: will carry the full PresentationState.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StateChangedPayload {
    pub counter: i32,
}

/// Increment the shared counter and broadcast the new value to all windows.
///
/// INVARIANT: The write guard MUST be dropped before calling app.emit()
/// to prevent deadlock (if an event listener tries to acquire the same lock).
#[tauri::command]
pub async fn increment_counter(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
) -> Result<i32, String> {
    let new_value = {
        let mut counter = state.counter.write().await;
        *counter += 1;
        *counter
        // write guard dropped here — end of inner scope
    };

    app.emit("state_changed", StateChangedPayload { counter: new_value })
        .map_err(|e| e.to_string())?;

    Ok(new_value)
}
