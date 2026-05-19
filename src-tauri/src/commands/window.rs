use crate::domain::error::ErrorPayload;
use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub name: Option<String>,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
}

#[tauri::command]
pub async fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, ErrorPayload> {
    let monitors = app
        .available_monitors()
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(monitors
        .into_iter()
        .map(|m| {
            let size = m.size();
            let pos = m.position();
            MonitorInfo {
                name: m.name().map(|s| s.to_string()),
                width: size.width,
                height: size.height,
                x: pos.x,
                y: pos.y,
                scale_factor: m.scale_factor(),
            }
        })
        .collect())
}

/// Open (or focus) the presentation window on the specified monitor.
///
/// Idempotent: if a window with label `"presentation"` already exists, this
/// command focuses it instead of creating a new one. The window loads
/// `presentation.html`, which mounts the same React entry (`main.tsx`) and
/// branches to `PresentationApp` based on `getCurrentWindow().label`.
#[tauri::command]
pub async fn open_presentation_window(
    app: AppHandle,
    monitor_index: Option<usize>,
) -> Result<(), ErrorPayload> {
    if let Some(existing) = app.get_webview_window("presentation") {
        existing
            .set_focus()
            .map_err(|e| ErrorPayload::new("window.build_error").with_param("detail", e.to_string()))?;
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(
        &app,
        "presentation",
        WebviewUrl::App("presentation.html".into()),
    )
    .title("Trinity Lyrics — Presentation")
    .inner_size(1280.0, 720.0);

    if let Some(idx) = monitor_index {
        let monitors = app
            .available_monitors()
            .map_err(|e| ErrorPayload::from(e.to_string()))?;
        if let Some(monitor) = monitors.get(idx) {
            let pos = monitor.position();
            let size = monitor.size();
            let sf = monitor.scale_factor();
            // Convert physical to logical coordinates for the window builder
            let lx = pos.x as f64 / sf;
            let ly = pos.y as f64 / sf;
            let lw = size.width as f64 / sf;
            let lh = size.height as f64 / sf;
            builder = builder.position(lx, ly).inner_size(lw, lh);
        }
    }

    builder
        .build()
        .map_err(|e| ErrorPayload::new("window.build_error").with_param("detail", e.to_string()))?;
    Ok(())
}
