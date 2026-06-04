use crate::domain::error::ErrorPayload;
use crate::protocol::asset;
use crate::services::archive::{
    self, ArchiveInspection, ExportProgress, ExportSummary, ImportMode, ImportSummary,
    RESTORE_IN_PROGRESS_FLAG,
};
use crate::state::AppState;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};

pub(crate) fn media_dir(app: &AppHandle) -> Result<PathBuf, ErrorPayload> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| ErrorPayload::new("backup.path_error").with_param("detail", e.to_string()))?;
    Ok(asset::media_dir(&data_dir))
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Export the full library to a `.tlz` archive at `out_path`.
/// Emits `backup_progress` events during the write.
#[tauri::command]
pub async fn export_library(
    out_path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ExportSummary, ErrorPayload> {
    let pool = state
        .db
        .get()
        .ok_or_else(|| ErrorPayload::new("backup.db_not_ready"))?
        .clone();
    let mdir = media_dir(&app)?;

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<ExportProgress>();
    let app_fwd = app.clone();
    let fwd = tokio::spawn(async move {
        while let Some(p) = rx.recv().await {
            let _ = app_fwd.emit("backup_progress", &p);
        }
    });

    let out = PathBuf::from(&out_path);
    let summary = archive::export(&pool, &mdir, &out, move |p| {
        let _ = tx.send(p);
    })
    .await
    .map_err(|e| ErrorPayload::new("backup.export_failed").with_param("detail", e.to_string()))?;

    let _ = fwd.await;
    Ok(summary)
}

/// Read only the manifest from a `.tlz` archive — no DB changes.
#[tauri::command]
pub async fn inspect_archive(path: String) -> Result<ArchiveInspection, ErrorPayload> {
    let p = PathBuf::from(path);
    tokio::task::spawn_blocking(move || archive::inspect_archive(&p))
        .await
        .map_err(|e| ErrorPayload::new("backup.inspect_failed").with_param("detail", e.to_string()))?
        .map_err(|e| ErrorPayload::new("backup.inspect_failed").with_param("detail", e.to_string()))
}

/// Restore a `.tlz` archive.
/// `mode` is either `"replace"` or `"merge"` (camelCase variants also accepted).
#[tauri::command]
pub async fn restore_library(
    path: String,
    mode: ImportMode,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ImportSummary, ErrorPayload> {
    let pool = state
        .db
        .get()
        .ok_or_else(|| ErrorPayload::new("backup.db_not_ready"))?
        .clone();
    let mdir = media_dir(&app)?;

    archive::import(&pool, &mdir, &PathBuf::from(path), mode)
        .await
        .map_err(|e| ErrorPayload::new("backup.restore_failed").with_param("detail", e.to_string()))
}

/// Check whether a partial restore was interrupted. Returns true if the
/// `.restore_in_progress` flag file is present in the media directory.
#[tauri::command]
pub fn check_restore_in_progress(app: AppHandle) -> bool {
    media_dir(&app)
        .map(|d| d.join(RESTORE_IN_PROGRESS_FLAG).exists())
        .unwrap_or(false)
}

/// Abort an interrupted restore: delete the flag file, wipe all media files,
/// and truncate all library tables — returning to a fresh-install state.
#[tauri::command]
pub async fn abort_restore(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), ErrorPayload> {
    let pool = state
        .db
        .get()
        .ok_or_else(|| ErrorPayload::new("backup.db_not_ready"))?
        .clone();
    let mdir = media_dir(&app)?;

    // Wipe DB first (so songs_fts rebuild works even with empty tables)
    archive::wipe_db(&pool)
        .await
        .map_err(|e| ErrorPayload::new("backup.abort_failed").with_param("detail", e.to_string()))?;

    // Delete all files in media_dir including the flag
    if let Ok(entries) = fs::read_dir(&mdir) {
        for entry in entries.flatten() {
            let _ = fs::remove_file(entry.path());
        }
    }

    Ok(())
}
