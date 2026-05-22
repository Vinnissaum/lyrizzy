use crate::domain::error::ErrorPayload;
use serde::Serialize;
use tauri::{AppHandle, Manager, Monitor, Runtime, WebviewUrl, WebviewWindowBuilder};

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

/// Convert physical monitor coordinates to logical (DPI-scaled) coordinates.
/// Returns `None` if the inputs are degenerate (zero size or zero scale factor).
/// Pure function so it can be unit-tested without a real `Monitor`.
pub fn logical_placement(
    phys_x: i32,
    phys_y: i32,
    phys_w: u32,
    phys_h: u32,
    scale_factor: f64,
) -> Option<(f64, f64, f64, f64)> {
    if scale_factor <= 0.0 || phys_w == 0 || phys_h == 0 {
        return None;
    }
    Some((
        phys_x as f64 / scale_factor,
        phys_y as f64 / scale_factor,
        phys_w as f64 / scale_factor,
        phys_h as f64 / scale_factor,
    ))
}

/// Pick the index of the first monitor that is not the primary monitor.
/// Returns `None` when there is only one monitor or when `primary_xy` is unknown.
/// Pure function for testability.
pub fn pick_secondary_index(
    primary_xy: Option<(i32, i32)>,
    all_xy: &[(i32, i32)],
) -> Option<usize> {
    let primary = primary_xy?;
    all_xy.iter().position(|&xy| xy != primary)
}

/// Apply monitor-based positioning to a window builder. If `monitor_index` is
/// `None` or out of range the builder is returned unchanged (OS picks position).
fn apply_monitor<'a, R: Runtime, M: Manager<R>>(
    mut builder: WebviewWindowBuilder<'a, R, M>,
    monitors: &[Monitor],
    monitor_index: Option<usize>,
) -> WebviewWindowBuilder<'a, R, M> {
    if let Some(idx) = monitor_index {
        if let Some(m) = monitors.get(idx) {
            let pos = m.position();
            let size = m.size();
            if let Some((lx, ly, lw, lh)) =
                logical_placement(pos.x, pos.y, size.width, size.height, m.scale_factor())
            {
                builder = builder.position(lx, ly).inner_size(lw, lh);
            }
        }
    }
    builder
}

/// Open (or focus) the presentation window, automatically choosing a secondary
/// monitor when one is available.
///
/// Idempotent: if a window with label `"presentation"` already exists, focuses
/// it and returns `Ok(())`. Builds `presentation.html`.
#[tauri::command]
pub async fn open_presentation_window(app: AppHandle) -> Result<(), ErrorPayload> {
    if let Some(existing) = app.get_webview_window("presentation") {
        existing.set_focus().map_err(|e| {
            ErrorPayload::new("window.build_error").with_param("detail", e.to_string())
        })?;
        return Ok(());
    }

    let monitors = app
        .available_monitors()
        .map_err(|e| ErrorPayload::from(e.to_string()))?;

    let primary_xy = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| { let p = m.position(); (p.x, p.y) });

    let all_xy: Vec<(i32, i32)> = monitors.iter().map(|m| {
        let p = m.position();
        (p.x, p.y)
    }).collect();

    let secondary_idx = pick_secondary_index(primary_xy, &all_xy);

    let base = WebviewWindowBuilder::new(
        &app,
        "presentation",
        WebviewUrl::App("presentation.html".into()),
    )
    .title("Trinity Lyrics — Presentation")
    .inner_size(1280.0, 720.0);

    let builder = apply_monitor(base, &monitors, secondary_idx);
    let builder = if secondary_idx.is_some() {
        builder.fullscreen(true)
    } else {
        builder
    };

    builder.build().map_err(|e| {
        ErrorPayload::new("window.build_error").with_param("detail", e.to_string())
    })?;
    Ok(())
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logical_placement_converts_hi_dpi() {
        let (x, y, w, h) = logical_placement(0, 0, 2560, 1440, 2.0).unwrap();
        assert_eq!(x, 0.0);
        assert_eq!(y, 0.0);
        assert_eq!(w, 1280.0);
        assert_eq!(h, 720.0);
    }

    #[test]
    fn logical_placement_with_offset() {
        let (x, y, w, h) = logical_placement(2560, 0, 1920, 1080, 1.0).unwrap();
        assert_eq!(x, 2560.0);
        assert_eq!(y, 0.0);
        assert_eq!(w, 1920.0);
        assert_eq!(h, 1080.0);
    }

    #[test]
    fn logical_placement_zero_size_returns_none() {
        assert!(logical_placement(0, 0, 0, 0, 1.0).is_none());
    }

    #[test]
    fn logical_placement_zero_scale_returns_none() {
        assert!(logical_placement(0, 0, 1920, 1080, 0.0).is_none());
    }

    #[test]
    fn pick_secondary_finds_non_primary() {
        let all = [(0_i32, 0_i32), (1920_i32, 0_i32)];
        assert_eq!(pick_secondary_index(Some((0, 0)), &all), Some(1));
    }

    #[test]
    fn pick_secondary_single_monitor_returns_none() {
        let all = [(0_i32, 0_i32)];
        assert_eq!(pick_secondary_index(Some((0, 0)), &all), None);
    }
}
