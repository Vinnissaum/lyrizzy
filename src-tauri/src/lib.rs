mod commands;
mod db;
mod domain;
mod protocol;
mod services;
mod state;

use commands::counter::increment_counter;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match db::init_db(&app_handle).await {
                    Ok(pool) => {
                        app_handle.manage(pool);
                        eprintln!("[trinity] Database initialized successfully");
                    }
                    Err(e) => {
                        eprintln!("[trinity] Failed to initialize database: {}", e);
                    }
                }
            });
            Ok(())
        })
        .register_uri_scheme_protocol("asset", {
            // Resolve media directory once at startup using the path resolver
            // We use a placeholder here; the real path is resolved inside the handler
            // by checking APPDATA at request time (avoids capturing app handle in closure)
            let app_data = std::env::var("APPDATA")
                .map(|p| std::path::PathBuf::from(p).join("TrinityLyrics"))
                .unwrap_or_else(|_| std::path::PathBuf::from("TrinityLyrics"));
            let media_dir = protocol::asset::media_dir(&app_data);
            protocol::asset::build_handler(media_dir)
        })
        .invoke_handler(tauri::generate_handler![increment_counter])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
