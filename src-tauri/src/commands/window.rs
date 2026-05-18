use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Open (or focus) the presentation window.
///
/// Idempotent: if a window with label `"presentation"` already exists, this
/// command focuses it instead of creating a new one. The window loads
/// `presentation.html`, which mounts the same React entry (`main.tsx`) and
/// branches to `PresentationApp` based on `getCurrentWindow().label`.
#[tauri::command]
pub async fn open_presentation_window(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("presentation") {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "presentation",
        WebviewUrl::App("presentation.html".into()),
    )
    .title("Trinity Lyrics — Presentation")
    .inner_size(1280.0, 720.0)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}
