//! RTMP → WebRTC bridge commands.
//!
//! WebView2 cannot play RTMP, so we run MediaMTX as a local proxy that pulls the
//! camera's RTMP stream and re-serves it over WebRTC (WHEP). The frontend plays
//! the returned WHEP URL in a plain `<video>` via a small WHEP client.

use crate::domain::error::ErrorPayload;
use crate::services::mediamtx;
use crate::state::{AppState, RtmpProxy};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RtmpProxyInfo {
    /// WHEP endpoint the frontend WebRTC reader connects to.
    pub whep_url: String,
}

/// Whether a usable MediaMTX binary is available (bundled, `MEDIAMTX_PATH`, or
/// on PATH). Drives a frontend banner, mirroring `check_libreoffice`.
#[tauri::command]
pub fn check_mediamtx(app: AppHandle) -> bool {
    let resource_dir = app.path().resource_dir().ok();
    mediamtx::mediamtx_path(resource_dir.as_deref()).is_some()
}

/// Start (or reuse) the MediaMTX proxy for `rtmp_url` and return its WHEP URL.
///
/// If a proxy is already running for the same URL and is still alive, it is
/// reused; otherwise any existing proxy is killed and a fresh one is spawned
/// against the new URL. MediaMTX is spawned with `kill_on_drop` so it never
/// outlives the app.
#[tauri::command]
pub async fn start_rtmp_proxy(
    app: AppHandle,
    state: State<'_, AppState>,
    rtmp_url: String,
) -> Result<RtmpProxyInfo, ErrorPayload> {
    let url = rtmp_url.trim().to_string();
    if !(url.starts_with("rtmp://") || url.starts_with("rtmps://")) {
        return Err(ErrorPayload::new("rtmp.invalid_url"));
    }

    let resource_dir = app.path().resource_dir().ok();
    let bin = mediamtx::mediamtx_path(resource_dir.as_deref())
        .ok_or_else(|| ErrorPayload::new("rtmp.mediamtx_not_found"))?;

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| ErrorPayload::new("rtmp.no_data_dir").with_param("detail", e.to_string()))?;

    let mut guard = state.rtmp_proxy.lock().await;

    // Reuse a live proxy already serving this exact URL.
    if let Some(existing) = guard.as_mut() {
        let still_running = matches!(existing.child.try_wait(), Ok(None));
        if existing.rtmp_url == url && still_running {
            return Ok(RtmpProxyInfo {
                whep_url: mediamtx::whep_url(),
            });
        }
        // URL changed or process died — tear it down before respawning.
        let _ = existing.child.kill().await;
    }
    *guard = None;

    let config_path = mediamtx::write_config(&data_dir, &url)
        .map_err(|e| ErrorPayload::new("rtmp.config_write_failed").with_param("detail", e.to_string()))?;

    let child = tokio::process::Command::new(&bin)
        .arg(&config_path)
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| ErrorPayload::new("rtmp.spawn_failed").with_param("detail", e.to_string()))?;

    *guard = Some(RtmpProxy {
        rtmp_url: url,
        child,
    });

    Ok(RtmpProxyInfo {
        whep_url: mediamtx::whep_url(),
    })
}

/// Stop the running MediaMTX proxy, if any. Idempotent.
#[tauri::command]
pub async fn stop_rtmp_proxy(state: State<'_, AppState>) -> Result<(), ErrorPayload> {
    let mut guard = state.rtmp_proxy.lock().await;
    if let Some(mut proxy) = guard.take() {
        let _ = proxy.child.kill().await;
    }
    Ok(())
}
