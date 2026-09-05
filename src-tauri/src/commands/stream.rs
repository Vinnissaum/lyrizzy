//! Camera-stream → WebRTC bridge commands.
//!
//! WebView2 can't play RTMP, SRT, or raw MPEG-TS, so we run MediaMTX as a local
//! proxy that ingests the camera stream and re-serves it over WebRTC (WHEP). The
//! frontend plays the returned WHEP URL in a plain `<video>` via a small WHEP
//! client.

use crate::domain::error::ErrorPayload;
use crate::services::mediamtx::{self, RtspSource};
use crate::state::{AppState, StreamProxy};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

/// Discriminated stream source sent from the frontend.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum StreamSourceInput {
    Rtsp { url: String, transport: String },
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StreamProxyInfo {
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

/// Translate the frontend source into the MediaMTX [`RtspSource`] to render,
/// after validating it.
fn to_source(input: &StreamSourceInput) -> Result<RtspSource, ErrorPayload> {
    match input {
        StreamSourceInput::Rtsp { url, transport } => {
            let url = url.trim().to_string();
            if !(url.starts_with("rtsp://") || url.starts_with("rtsps://")) {
                return Err(ErrorPayload::new("stream.invalid_url"));
            }
            // "automatic" → let MediaMTX choose (omit the option).
            let transport = match transport.as_str() {
                "udp" | "tcp" | "multicast" => Some(transport.clone()),
                _ => None,
            };
            Ok(RtspSource { url, transport })
        }
    }
}

/// Start (or reuse) the MediaMTX proxy for `source` and return its WHEP URL.
///
/// If a proxy is already running for an identical config and is still alive, it
/// is reused; otherwise any existing proxy is killed and a fresh one is spawned.
/// MediaMTX is spawned with `kill_on_drop` so it never outlives the app.
#[tauri::command]
pub async fn start_stream_proxy(
    app: AppHandle,
    state: State<'_, AppState>,
    source: StreamSourceInput,
) -> Result<StreamProxyInfo, ErrorPayload> {
    let mtx_source = to_source(&source)?;
    let config = mediamtx::render_config(&mtx_source);

    let resource_dir = app.path().resource_dir().ok();
    let bin = mediamtx::mediamtx_path(resource_dir.as_deref())
        .ok_or_else(|| ErrorPayload::new("stream.mediamtx_not_found"))?;

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| ErrorPayload::new("stream.no_data_dir").with_param("detail", e.to_string()))?;

    let mut guard = state.stream_proxy.lock().await;

    // Reuse a live proxy already serving this exact config.
    if let Some(existing) = guard.as_mut() {
        let still_running = matches!(existing.child.try_wait(), Ok(None));
        if existing.config == config && still_running {
            return Ok(StreamProxyInfo {
                whep_url: mediamtx::whep_url(),
            });
        }
        // Config changed or process died — tear it down before respawning.
        let _ = existing.child.kill().await;
    }
    *guard = None;

    let config_path = mediamtx::write_config(&data_dir, &mtx_source).map_err(|e| {
        ErrorPayload::new("stream.config_write_failed").with_param("detail", e.to_string())
    })?;

    let child = tokio::process::Command::new(&bin)
        .arg(&config_path)
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| ErrorPayload::new("stream.spawn_failed").with_param("detail", e.to_string()))?;

    *guard = Some(StreamProxy { config, child });

    Ok(StreamProxyInfo {
        whep_url: mediamtx::whep_url(),
    })
}

/// Stop the running MediaMTX proxy, if any. Idempotent.
#[tauri::command]
pub async fn stop_stream_proxy(state: State<'_, AppState>) -> Result<(), ErrorPayload> {
    let mut guard = state.stream_proxy.lock().await;
    if let Some(mut proxy) = guard.take() {
        let _ = proxy.child.kill().await;
    }
    Ok(())
}
