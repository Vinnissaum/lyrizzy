use crate::domain::error::ErrorPayload;
use crate::domain::presentation::OverlayState;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub async fn set_announcement_overlay(
    state: State<'_, AppState>,
    app: AppHandle,
    text: String,
) -> Result<(), ErrorPayload> {
    {
        let mut p = state.presentation.write().await;
        p.overlay = Some(OverlayState::Announcement { text });
    }
    app.emit("state_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn set_media_overlay(
    state: State<'_, AppState>,
    app: AppHandle,
    media_id: String,
) -> Result<(), ErrorPayload> {
    {
        let mut p = state.presentation.write().await;
        p.overlay = Some(OverlayState::Media { media_id });
    }
    app.emit("state_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn set_webview_overlay(
    state: State<'_, AppState>,
    app: AppHandle,
    url: String,
) -> Result<(), ErrorPayload> {
    {
        let mut p = state.presentation.write().await;
        p.overlay = Some(OverlayState::WebView { url });
    }
    app.emit("state_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn clear_overlay(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), ErrorPayload> {
    {
        let mut p = state.presentation.write().await;
        p.overlay = None;
    }
    app.emit("state_changed", ())
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::domain::presentation::OverlayState;
    use crate::state::AppState;

    #[tokio::test]
    async fn set_announcement_writes_overlay() {
        let state = AppState::default();
        {
            let mut p = state.presentation.write().await;
            p.overlay = Some(OverlayState::Announcement { text: "Oferta".to_string() });
        }
        let p = state.presentation.read().await;
        assert!(matches!(p.overlay, Some(OverlayState::Announcement { .. })));
    }

    #[tokio::test]
    async fn set_media_writes_overlay() {
        let state = AppState::default();
        {
            let mut p = state.presentation.write().await;
            p.overlay = Some(OverlayState::Media { media_id: "m-1".to_string() });
        }
        let p = state.presentation.read().await;
        assert!(matches!(p.overlay, Some(OverlayState::Media { .. })));
    }

    #[tokio::test]
    async fn clear_overlay_sets_none() {
        let state = AppState::default();
        {
            let mut p = state.presentation.write().await;
            p.overlay = Some(OverlayState::Announcement { text: "Test".to_string() });
        }
        {
            let mut p = state.presentation.write().await;
            p.overlay = None;
        }
        let p = state.presentation.read().await;
        assert!(p.overlay.is_none());
    }
}
