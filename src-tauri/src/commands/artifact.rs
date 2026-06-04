//! Tauri command layer for selective artifact export/import (Phase 12).
//! Thin wrappers over `services::artifact`; export commands forward
//! `backup_progress` events exactly like `export_library` (SHARE-13).

use crate::commands::backup::media_dir;
use crate::domain::error::ErrorPayload;
use crate::services::archive::{ExportProgress, ExportSummary, ImportSummary};
use crate::services::artifact::{self, ImportPlan, Resolution};
use crate::state::AppState;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};

fn pool(state: &State<'_, AppState>) -> Result<sqlx::SqlitePool, ErrorPayload> {
    state
        .db
        .get()
        .ok_or_else(|| ErrorPayload::new("backup.db_not_ready"))
        .map(|p| p.clone())
}

/// Spawn a forwarder that re-emits `ExportProgress` as `backup_progress` events.
/// Returns the sender to hand to the service and a join handle to await after.
fn progress_forwarder(
    app: &AppHandle,
) -> (
    tokio::sync::mpsc::UnboundedSender<ExportProgress>,
    tokio::task::JoinHandle<()>,
) {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<ExportProgress>();
    let app_fwd = app.clone();
    let handle = tokio::spawn(async move {
        while let Some(p) = rx.recv().await {
            let _ = app_fwd.emit("backup_progress", &p);
        }
    });
    (tx, handle)
}

#[tauri::command]
pub async fn export_songs(
    song_ids: Vec<String>,
    out_path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ExportSummary, ErrorPayload> {
    let pool = pool(&state)?;
    let mdir = media_dir(&app)?;
    let (tx, fwd) = progress_forwarder(&app);

    let summary = artifact::export_songs(&pool, &mdir, &song_ids, &PathBuf::from(&out_path), move |p| {
        let _ = tx.send(p);
    })
    .await
    .map_err(|e| ErrorPayload::new("artifact.export_failed").with_param("detail", e.to_string()));

    let _ = fwd.await;
    summary
}

#[tauri::command]
pub async fn export_set(
    set_id: String,
    out_path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ExportSummary, ErrorPayload> {
    let pool = pool(&state)?;
    let mdir = media_dir(&app)?;
    let (tx, fwd) = progress_forwarder(&app);

    let summary = artifact::export_set(&pool, &mdir, &set_id, &PathBuf::from(&out_path), move |p| {
        let _ = tx.send(p);
    })
    .await
    .map_err(|e| ErrorPayload::new("artifact.export_failed").with_param("detail", e.to_string()));

    let _ = fwd.await;
    summary
}

#[tauri::command]
pub async fn export_settings_profile(
    out_path: String,
    state: State<'_, AppState>,
) -> Result<ExportSummary, ErrorPayload> {
    let pool = pool(&state)?;
    artifact::export_settings(&pool, &PathBuf::from(&out_path))
        .await
        .map_err(|e| ErrorPayload::new("artifact.export_failed").with_param("detail", e.to_string()))
}

#[tauri::command]
pub async fn plan_artifact_import(
    path: String,
    state: State<'_, AppState>,
) -> Result<ImportPlan, ErrorPayload> {
    let pool = pool(&state)?;
    artifact::plan_import(&pool, &PathBuf::from(&path))
        .await
        .map_err(|e| ErrorPayload::new("artifact.plan_failed").with_param("detail", e.to_string()))
}

#[tauri::command]
pub async fn import_artifact(
    path: String,
    resolutions: Vec<Resolution>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ImportSummary, ErrorPayload> {
    let pool = pool(&state)?;
    let mdir = media_dir(&app)?;

    let summary = artifact::apply_import(&pool, &mdir, &PathBuf::from(&path), &resolutions)
        .await
        .map_err(|e| ErrorPayload::new("artifact.import_failed").with_param("detail", e.to_string()))?;

    // Both windows refresh their projections after a selective import.
    let _ = app.emit("media_library_changed", ());
    let _ = app.emit("songs_changed", ());
    Ok(summary)
}
