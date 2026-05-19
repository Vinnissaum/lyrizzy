use crate::domain::error::ErrorPayload;
use crate::domain::presentation::PresentationState;
use crate::protocol::asset;
use crate::state::AppState;
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

#[tauri::command]
pub async fn import_media_file(
    app: AppHandle,
    source_path: String,
) -> Result<String, ErrorPayload> {
    let src = Path::new(&source_path);
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or_else(|| ErrorPayload::new("media.no_extension"))?;

    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "webp" | "gif" | "svg" | "mp4" | "webm" => {}
        _ => {
            return Err(ErrorPayload::new("media.unsupported_type").with_param("ext", ext));
        }
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    let media_dir = asset::media_dir(&data_dir);

    let filename = format!("{}.{}", Uuid::new_v4(), ext);
    let dest = media_dir.join(&filename);

    std::fs::copy(&source_path, &dest)
        .map_err(|e| ErrorPayload::new("media.copy_error").with_param("detail", e.to_string()))?;

    Ok(format!("asset://localhost/media/{filename}"))
}

#[tauri::command]
pub async fn set_background(
    state: State<'_, AppState>,
    app: AppHandle,
    asset_url: Option<String>,
) -> Result<PresentationState, ErrorPayload> {
    let new_state = {
        let mut pres = state.presentation.write().await;
        pres.background_path = asset_url;
        pres.clone()
    };
    app.emit("state_changed", &new_state)
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    Ok(new_state)
}
