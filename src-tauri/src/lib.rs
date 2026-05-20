pub mod commands;
pub mod db;
pub mod domain;
mod protocol;
pub mod services;
mod state;

use commands::backup::{
    abort_restore, check_restore_in_progress, export_library, inspect_archive, restore_library,
};
use commands::countdown::{
    get_countdown_state, pause_countdown, reset_countdown, set_countdown_duration, start_countdown,
};
use commands::import::{import_holyrics_batch, parse_holyrics_file};
use commands::media::{check_ffprobe, delete_media, get_media_references, import_media, list_media, rename_media};
use commands::presentation::{
    get_presentation_state, go_to_item, load_set_for_presentation, next_slide, prev_slide,
    set_presentation_mode,
};
use commands::set::{
    add_set_item, create_set, delete_set, duplicate_set_item, get_set, list_sets, remove_set_item,
    reorder_set_items, update_set, update_set_item,
};
use commands::song::{create_song, delete_song, get_song, list_songs, parse_plain_text_import, update_song};
use commands::key_bindings::{get_key_bindings, set_key_bindings, reset_key_bindings};
use commands::reports::{export_ccli_csv, preview_ccli_export};
use commands::settings::{get_setting, set_setting};
use commands::updates::{apply_update_and_restart, check_for_updates};
use commands::window::{list_monitors, open_presentation_window, open_stage_window};
use state::AppState;
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::default())
        .register_uri_scheme_protocol("asset", protocol::asset::build_handler())
        .setup(|app| {
            let handle = app.handle().clone();

            // Resolve storage layout up front so we can fail loudly if anything goes wrong.
            let data_dir = handle
                .path()
                .app_data_dir()
                .expect("could not resolve app data directory");

            if let Err(e) = std::fs::create_dir_all(&data_dir) {
                fail_fast(&handle, "Failed to create app data directory", &e.to_string());
            }

            // P0-08: pre-create the media dir and align asset:// with app_data_dir.
            let media_dir = protocol::asset::media_dir(&data_dir);
            if let Err(e) = std::fs::create_dir_all(&media_dir) {
                fail_fast(&handle, "Failed to create media directory", &e.to_string());
            }
            let canonical_media = match media_dir.canonicalize() {
                Ok(p) => p,
                Err(e) => {
                    fail_fast(
                        &handle,
                        "Failed to canonicalize media directory",
                        &e.to_string(),
                    );
                }
            };
            if let Err(_existing) = protocol::asset::set_media_dir(canonical_media.clone()) {
                // OnceLock already set — this can only happen if setup runs twice, which
                // Tauri doesn't do, but we accept it silently rather than crash.
                eprintln!("[trinity] WARN: media dir was already set");
            }
            eprintln!("[trinity] Media directory ready: {}", canonical_media.display());

            // P0-07: DB init is blocking and fail-fast — no spawn+continue.
            let pool = match tauri::async_runtime::block_on(db::init_db(&handle)) {
                Ok(pool) => pool,
                Err(e) => {
                    fail_fast(&handle, "Database initialization failed", &e.to_string());
                }
            };

            let state = handle.state::<AppState>();
            state
                .db
                .set(pool)
                .map_err(|_| "AppState.db already set")
                .expect("AppState.db must be unset at setup time");

            eprintln!("[trinity] Database initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_setting,
            set_setting,
            export_library,
            inspect_archive,
            restore_library,
            check_restore_in_progress,
            abort_restore,
            open_presentation_window,
            open_stage_window,
            list_monitors,
            create_song,
            update_song,
            delete_song,
            list_songs,
            get_song,
            parse_plain_text_import,
            parse_holyrics_file,
            import_holyrics_batch,
            create_set,
            update_set,
            delete_set,
            list_sets,
            get_set,
            add_set_item,
            update_set_item,
            remove_set_item,
            reorder_set_items,
            duplicate_set_item,
            load_set_for_presentation,
            next_slide,
            prev_slide,
            go_to_item,
            set_presentation_mode,
            get_presentation_state,
            check_ffprobe,
            import_media,
            list_media,
            rename_media,
            delete_media,
            get_media_references,
            set_countdown_duration,
            start_countdown,
            pause_countdown,
            reset_countdown,
            get_countdown_state,
            get_key_bindings,
            set_key_bindings,
            reset_key_bindings,
            preview_ccli_export,
            export_ccli_csv,
            check_for_updates,
            apply_update_and_restart,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Show a blocking error dialog and exit the process with status 1.
/// Used by setup() to surface init failures to the user instead of silently
/// continuing with a half-initialized app.
fn fail_fast(handle: &tauri::AppHandle, title: &str, detail: &str) -> ! {
    let message = format!("{title}\n\n{detail}");
    eprintln!("[trinity] FATAL: {message}");
    handle
        .dialog()
        .message(&message)
        .title("Trinity Lyrics — Startup Error")
        .kind(MessageDialogKind::Error)
        .blocking_show();
    std::process::exit(1);
}
