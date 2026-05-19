use crate::domain::countdown::CountdownState;
use crate::domain::error::ErrorPayload;
use crate::state::AppState;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;
use tokio::time::Duration;

async fn tick_countdown(countdown: Arc<RwLock<CountdownState>>, app: AppHandle) {
    let tick = Duration::from_millis(1000);
    loop {
        tokio::time::sleep(tick).await;
        let done = {
            let mut s = countdown.write().await;
            if s.remaining_ms <= 1000 {
                s.remaining_ms = 0;
                s.is_running = false;
                true
            } else {
                s.remaining_ms -= 1000;
                false
            }
        };
        let snapshot = countdown.read().await.clone();
        let _ = app.emit("countdown_tick", &snapshot);
        if done {
            break;
        }
    }
}

#[tauri::command]
pub async fn set_countdown_duration(
    state: State<'_, AppState>,
    app: AppHandle,
    duration_ms: u64,
) -> Result<CountdownState, ErrorPayload> {
    {
        let mut task = state.countdown_task.lock().await;
        if let Some(handle) = task.take() {
            handle.abort();
        }
    }
    let snapshot = {
        let mut s = state.countdown.write().await;
        s.duration_ms = duration_ms;
        s.remaining_ms = duration_ms;
        s.is_running = false;
        s.clone()
    };
    let _ = app.emit("countdown_tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub async fn start_countdown(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<CountdownState, ErrorPayload> {
    {
        let mut task = state.countdown_task.lock().await;
        if let Some(handle) = task.take() {
            handle.abort();
        }
    }

    let snapshot = {
        let mut s = state.countdown.write().await;
        if s.remaining_ms == 0 {
            return Err(ErrorPayload::new("countdown.duration_not_set"));
        }
        s.is_running = true;
        s.clone()
    };

    let countdown_arc = Arc::clone(&state.countdown);
    let app_clone = app.clone();
    let join_handle = tokio::spawn(tick_countdown(countdown_arc, app_clone));

    {
        let mut task = state.countdown_task.lock().await;
        *task = Some(join_handle.abort_handle());
    }

    let _ = app.emit("countdown_tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub async fn pause_countdown(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<CountdownState, ErrorPayload> {
    {
        let mut task = state.countdown_task.lock().await;
        if let Some(handle) = task.take() {
            handle.abort();
        }
    }
    let snapshot = {
        let mut s = state.countdown.write().await;
        s.is_running = false;
        s.clone()
    };
    let _ = app.emit("countdown_tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub async fn reset_countdown(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<CountdownState, ErrorPayload> {
    {
        let mut task = state.countdown_task.lock().await;
        if let Some(handle) = task.take() {
            handle.abort();
        }
    }
    let snapshot = {
        let mut s = state.countdown.write().await;
        s.remaining_ms = s.duration_ms;
        s.is_running = false;
        s.clone()
    };
    let _ = app.emit("countdown_tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub async fn get_countdown_state(
    state: State<'_, AppState>,
) -> Result<CountdownState, ErrorPayload> {
    Ok(state.countdown.read().await.clone())
}
