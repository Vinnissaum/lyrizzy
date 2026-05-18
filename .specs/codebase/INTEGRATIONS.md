# External Integrations

## Tauri Plugins

**tauri-plugin-opener 2**
**Purpose:** Open files and URLs with the OS default app (e.g., open logs folder in Explorer)
**Configuration:** Registered in `lib.rs` `.plugin(tauri_plugin_opener::init())`

**tauri-plugin-dialog 2**
**Purpose:** Native file picker dialogs for media import and file selection
**Configuration:** Registered in `lib.rs` `.plugin(tauri_plugin_dialog::init())`

**tauri-plugin-shell 2**
**Purpose:** Spawn shell commands (planned for LibreOffice CLI in Phase 3)
**Configuration:** Registered in `lib.rs` `.plugin(tauri_plugin_shell::init())`

## Custom Protocol

**asset://**
**Purpose:** Serve local media files (images, MP4) from `%APPDATA%\TrinityLyrics\media\` to the WebView without a local HTTP server
**Implementation:** `src-tauri/src/protocol/asset.rs` (to be implemented in Phase 0)
**Configuration:** Must be registered in BOTH `lib.rs` AND `tauri.conf.json` security.csp

## Database

**SQLite via sqlx 0.8.x**
**Purpose:** Local persistence for songs, sets, media metadata, settings
**Location:** `%APPDATA%\TrinityLyrics\database.db`
**Authentication:** None (local file)
**Migrations:** Automatic via `sqlx::migrate!()` at startup

## WebView2

**Purpose:** OS-provided web rendering engine (Chromium/Edge engine)
**Availability:** Pre-installed on all Windows 10 1803+ and Windows 11
**Relevance:** Natively plays MP4 (H.264+AAC) and WebM; no VLC needed for standard church videos

## No External API Integrations

This is a fully offline desktop app. No network calls, no API keys, no external services in Phase 0–2.
