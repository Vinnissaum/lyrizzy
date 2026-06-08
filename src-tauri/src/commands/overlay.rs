use crate::domain::error::ErrorPayload;
use crate::domain::output::OutputId;
use crate::domain::presentation::OverlayState;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State};

/// Read back the full presentation state (lock dropped before emit) and broadcast
/// it as `state_changed`. Overlay commands previously emitted an empty `()` payload,
/// which set the presentation window's store to `null` and blanked the screen.
async fn emit_state_changed(app: &AppHandle, state: &AppState, output: OutputId) -> Result<(), ErrorPayload> {
    let snapshot = state.output(output).presentation.read().await.clone();
    app.emit("state_changed", &snapshot)
        .map_err(|e| ErrorPayload::from(e.to_string()))
}

#[tauri::command]
pub async fn set_announcement_overlay(
    state: State<'_, AppState>,
    app: AppHandle,
    text: String,
    output: Option<OutputId>,
) -> Result<(), ErrorPayload> {
    let output = output.unwrap_or_default();
    {
        let mut p = state.output(output).presentation.write().await;
        p.overlay = Some(OverlayState::Announcement { text });
    }
    emit_state_changed(&app, &state, output).await
}

#[tauri::command]
pub async fn set_media_overlay(
    state: State<'_, AppState>,
    app: AppHandle,
    media_id: String,
    output: Option<OutputId>,
) -> Result<(), ErrorPayload> {
    let output = output.unwrap_or_default();
    {
        let mut p = state.output(output).presentation.write().await;
        p.overlay = Some(OverlayState::Media { media_id });
    }
    emit_state_changed(&app, &state, output).await
}

#[tauri::command]
pub async fn set_webview_overlay(
    state: State<'_, AppState>,
    app: AppHandle,
    url: String,
    output: Option<OutputId>,
) -> Result<(), ErrorPayload> {
    let output = output.unwrap_or_default();
    {
        let mut p = state.output(output).presentation.write().await;
        p.overlay = Some(OverlayState::WebView { url });
    }
    emit_state_changed(&app, &state, output).await
}

#[tauri::command]
pub async fn clear_overlay(
    state: State<'_, AppState>,
    app: AppHandle,
    output: Option<OutputId>,
) -> Result<(), ErrorPayload> {
    let output = output.unwrap_or_default();
    {
        let mut p = state.output(output).presentation.write().await;
        p.overlay = None;
    }
    emit_state_changed(&app, &state, output).await
}

#[cfg(test)]
mod tests {
    use crate::domain::output::OutputId;
    use crate::domain::presentation::OverlayState;
    use crate::state::AppState;

    #[tokio::test]
    async fn set_announcement_writes_overlay() {
        let state = AppState::default();
        {
            let mut p = state.output(OutputId::One).presentation.write().await;
            p.overlay = Some(OverlayState::Announcement { text: "Oferta".to_string() });
        }
        let p = state.output(OutputId::One).presentation.read().await;
        assert!(matches!(p.overlay, Some(OverlayState::Announcement { .. })));
    }

    #[tokio::test]
    async fn set_media_writes_overlay() {
        let state = AppState::default();
        {
            let mut p = state.output(OutputId::One).presentation.write().await;
            p.overlay = Some(OverlayState::Media { media_id: "m-1".to_string() });
        }
        let p = state.output(OutputId::One).presentation.read().await;
        assert!(matches!(p.overlay, Some(OverlayState::Media { .. })));
    }

    #[tokio::test]
    async fn clear_overlay_sets_none() {
        let state = AppState::default();
        {
            let mut p = state.output(OutputId::One).presentation.write().await;
            p.overlay = Some(OverlayState::Announcement { text: "Test".to_string() });
        }
        {
            let mut p = state.output(OutputId::One).presentation.write().await;
            p.overlay = None;
        }
        let p = state.output(OutputId::One).presentation.read().await;
        assert!(p.overlay.is_none());
    }
}
