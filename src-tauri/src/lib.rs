pub mod commands;
pub mod db;
pub mod domain;
mod protocol;
pub mod services;
mod state;

use commands::artifact::{
    export_set, export_settings_profile, export_songs, import_artifact, plan_artifact_import,
};
use commands::backup::{
    abort_restore, check_restore_in_progress, export_library, inspect_archive, restore_library,
};
use commands::countdown::{
    arm_countdown, get_countdown_state, pause_countdown, reset_countdown, set_countdown_duration,
    start_countdown,
};
use commands::import::{import_holyrics_batch, parse_holyrics_file};
use commands::media::{check_ffprobe, check_libreoffice, delete_media, get_media_references, import_media, import_presentation, list_media, rename_media};
use commands::presentation::{
    get_presentation_state, go_to_item, load_set_for_presentation, next_slide, prev_slide,
    set_presentation_mode,
};
use commands::overlay::{
    clear_overlay, set_announcement_overlay, set_media_overlay, set_webview_overlay,
};
use commands::set::{
    add_set_item, create_set, delete_set, duplicate_set_item, get_or_create_default_set, get_set,
    list_sets, remove_set_item, reorder_set_items, update_set, update_set_item,
};
use commands::song::{create_song, delete_song, get_song, list_songs, parse_plain_text_import, update_song};
use commands::key_bindings::{get_key_bindings, set_key_bindings, reset_key_bindings};
use commands::reports::{export_ccli_csv, preview_ccli_export};
use commands::rtmp::{check_mediamtx, start_rtmp_proxy, stop_rtmp_proxy};
use commands::settings::{get_setting, set_setting};
use commands::updates::{apply_update_and_restart, check_for_updates};
use commands::window::{
    enter_presentation, exit_presentation, list_monitors, should_close_presentation_on_destroy,
};
use state::AppState;
use tauri::{Manager, WindowEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // P10-05: install a panic hook BEFORE building the app so a process-wide
    // crash (panic → all windows gone) is logged distinctly from a single-window
    // close. Chain the default hook so existing backtrace behavior is preserved.
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let payload = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "<non-string panic payload>".to_string());
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "<unknown location>".to_string());
        tracing::error!(panic.payload = %payload, panic.location = %location, "process panic");
        default_hook(info);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::default())
        .register_uri_scheme_protocol("asset", protocol::asset::build_handler())
        .on_window_event(|window, event| {
            // P10-05: structured window-lifecycle observability. The tracing
            // subscriber timestamps each line, so we log the label + event kind
            // (and, where the event carries it, whether the close was honored).
            let label = window.label().to_string();
            match event {
                WindowEvent::CloseRequested { .. } => {
                    // A CloseRequested we do not prevent: the OS/user (or our own
                    // exit path) asked to close this window. We let it proceed
                    // (default behavior) and rely on Destroyed for the lifecycle
                    // side-effects. Tauri does not expose user-vs-programmatic
                    // origin here, so we log the request and the focus context.
                    tracing::warn!(
                        window.label = %label,
                        event = "close_requested",
                        "window event"
                    );
                }
                WindowEvent::Destroyed => {
                    tracing::warn!(window.label = %label, event = "destroyed", "window event");

                    // P10-06: when the operator window is destroyed, also close
                    // the presentation window so we never leave an orphaned
                    // always-on-top fullscreen window the user cannot reach. The
                    // app then exits naturally once all windows are gone.
                    if should_close_presentation_on_destroy(&label) {
                        if let Some(pres) = window.app_handle().get_webview_window("presentation") {
                            if let Err(e) = pres.close() {
                                // Already gone / tearing down — not fatal.
                                tracing::warn!(
                                    error = %e,
                                    "failed to close presentation window after operator destroyed (ignored)"
                                );
                            } else {
                                tracing::info!("closed presentation window after operator destroyed");
                            }
                        }
                    }
                }
                WindowEvent::Focused(false) => {
                    tracing::info!(window.label = %label, event = "focus_lost", "window event");
                }
                _ => {}
            }
        })
        .setup(|app| {
            // Initialize tracing for structured log output (dev builds).
            #[cfg(debug_assertions)]
            let _ = tracing_subscriber::fmt().try_init();

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
            export_songs,
            export_set,
            export_settings_profile,
            plan_artifact_import,
            import_artifact,
            enter_presentation,
            exit_presentation,
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
            check_libreoffice,
            check_mediamtx,
            start_rtmp_proxy,
            stop_rtmp_proxy,
            import_media,
            import_presentation,
            list_media,
            rename_media,
            delete_media,
            get_media_references,
            set_countdown_duration,
            start_countdown,
            arm_countdown,
            pause_countdown,
            reset_countdown,
            get_countdown_state,
            get_key_bindings,
            set_key_bindings,
            reset_key_bindings,
            preview_ccli_export,
            export_ccli_csv,
            get_or_create_default_set,
            set_announcement_overlay,
            set_media_overlay,
            set_webview_overlay,
            clear_overlay,
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
        .title("Lyrizzy — Startup Error")
        .kind(MessageDialogKind::Error)
        .blocking_show();
    std::process::exit(1);
}
