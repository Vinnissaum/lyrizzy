mod commands;
mod db;
mod domain;
mod protocol;
mod services;
mod state;

use commands::counter::increment_counter;
use commands::window::open_presentation_window;
use state::AppState;
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
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
            increment_counter,
            open_presentation_window,
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
