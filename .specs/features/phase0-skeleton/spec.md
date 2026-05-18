# Phase 0: Skeleton Spec

**Status:** Approved (T1–T6 shipped; T7–T11 polish in flight)
**Feature:** phase0-skeleton
**Last updated:** 2026-05-18

---

## Requirements

### P0-01: Two-Window IPC Demo

Implement a Rust `AppState` holding `Arc<RwLock<i32>>` counter. Expose an `increment_counter` Tauri command that increments the counter and emits a `"state_changed"` event with the new value to all windows. Both the operator window and the presentation window must display the current counter value by listening to the event.

**Acceptance criteria:**
- `increment_counter` command increments the counter in Rust state.
- `"state_changed"` event is emitted with `{ counter: N }` payload after every increment.
- Operator window shows current counter and has a button to call `incrementCounter()`.
- Presentation window shows current counter (read-only — never invokes mutating commands).
- The write guard is dropped before emit (no deadlock).
- `StateChangedPayload` carries `#[serde(rename_all = "camelCase")]` so future field additions stay aligned with TS-side types.

---

### P0-02: sqlx + SQLite Working

Initialize a `sqlx::SqlitePool` at Tauri startup. Store the pool inside `AppState` (single managed object, not a second `manage()`d value). Run `sqlx::migrate!("./migrations")` at setup. The app must fail loudly if init fails — no silent `eprintln!` and continue.

**Acceptance criteria:**
- `SqlitePool` created and stored in `AppState` (e.g., behind `tokio::sync::OnceCell`).
- Setup uses `tauri::async_runtime::block_on` so the pool is ready before the first invoke handler can fire (no spawn-race).
- `sqlx::migrate!("./migrations")` runs successfully at startup; `001_initial.sql` is applied.
- DB path: `app_handle.path().app_data_dir()?.join("database.db")` (resolves to `%APPDATA%\TrinityLyrics\database.db` on Windows).
- App data directory is created if it does not exist.
- On init failure: a `tauri-plugin-dialog` error message is shown and the process exits non-zero (do not continue with a missing pool).

---

### P0-03: asset:// Protocol Handler

Register a custom `asset://` protocol handler in `lib.rs` (Tauri builder) and align the CSP in `tauri.conf.json`. The handler serves files from `%APPDATA%\TrinityLyrics\media\`. Path traversal must be prevented (canonical path must start with the canonical media directory).

**Acceptance criteria:**
- `asset://media/{filename}` requests are served from `%APPDATA%\TrinityLyrics\media\`.
- Path traversal (`..` literals in the URL path, or symlinks pointing outside) is rejected with HTTP 403.
- The media directory is canonicalized **once** at handler construction; per-request work is limited to the file lookup.
- `tauri.conf.json` CSP allows `asset:` for `img-src` and `media-src`, allows `data:`/`blob:` where needed, and includes `connect-src ipc: http://ipc.localhost` for Tauri IPC.
- Protocol registered in `lib.rs` via `register_uri_scheme_protocol`.
- Correct `Content-Type` set per extension (mp4, webm, png, jpg/jpeg, gif, webp, svg; `application/octet-stream` fallback).

---

### P0-04: MP4 Video via asset://

Presentation window renders a `<video>` element with `src="asset://media/test.mp4"`. The asset:// handler serves the file. (A `test.mp4` file must exist in the media folder for manual verification; the automated test confirms the `<video>` element renders.)

**Acceptance criteria:**
- `PresentationApp.tsx` renders `<video src="asset://media/test.mp4" controls autoPlay loop muted>`.
- The asset:// protocol handler sets `Content-Type: video/mp4`.
- No CSP errors in WebView2 DevTools when the file is present.

---

### P0-05: Tests Green

At least 1 Rust unit test passes (`cargo test`). At least 1 Vitest test passes (`npx vitest run`).

**Acceptance criteria:**
- Rust: `#[test] fn counter_starts_at_zero()` in `state.rs` passes; additional tests in `protocol/asset.rs` cover MIME mapping and path-traversal stoppage.
- Frontend: at least one Vitest test passes (currently `src/utils/counter.test.ts` for `formatCounter`).
- Both test commands exit with code 0.
- `tsc --noEmit` exits clean.

---

### P0-06: open_presentation_window command  *(added 2026-05-18)*

The presentation window is opened **on demand** from the operator window. There is one `index.html` entry; `presentation.html` is loaded only when the operator requests it. This matches `CLAUDE.md`: "Presentation window: label 'presentation', opened on demand via open_presentation_window command."

**Acceptance criteria:**
- New Tauri command `open_presentation_window` in `src-tauri/src/commands/window.rs`.
- The command uses `WebviewWindowBuilder::new(&handle, "presentation", WebviewUrl::App("presentation.html".into()))` and is idempotent — if a window with label `presentation` already exists, it is focused/shown rather than re-created.
- `capabilities/default.json` grants `core:webview:allow-create-webview-window` (in addition to existing core/opener permissions) so the command can succeed.
- `src/api/commands.ts` exports `openPresentationWindow(): Promise<void>`.
- `OperatorApp.tsx` has an "Open Presentation Window" button that calls `openPresentationWindow()`.
- Manual verification: clicking the button opens a second window; incrementing the counter in operator updates the counter in presentation.

---

### P0-07: DB init fail-fast  *(added 2026-05-18)*

Silent failure on database initialization is a latent landmine for every Phase 1 command. Init must succeed or the app must refuse to run.

**Acceptance criteria:**
- `db::init_db` returns `Result<SqlitePool, sqlx::Error>` (unchanged) but the call site no longer spawns + logs + continues.
- `lib.rs` setup block synchronously waits on `init_db` via `tauri::async_runtime::block_on`.
- On `Err`: show a `tauri-plugin-dialog` message box with the error and exit the process (`std::process::exit(1)`).
- The pool lives inside `AppState` (e.g., `db: tokio::sync::OnceCell<SqlitePool>`), so command handlers see one consistent managed object.

---

### P0-08: Media directory pre-created at startup  *(added 2026-05-18)*

If `%APPDATA%\TrinityLyrics\media\` does not exist, `media_dir.canonicalize()` fails and the asset:// handler responds 404 to every request — an opaque failure mode. Create the directory at startup.

**Acceptance criteria:**
- During setup (after the app data dir is created for the DB), `std::fs::create_dir_all(media_dir)` is called.
- The handler can canonicalize `media_dir` immediately and store the canonical path in its closure.
- A request for a non-existent file still returns 404 (unchanged), but the dir itself always resolves.

---

## Tauri plugin inventory (informational)

The Tauri builder wires three plugins; document them here so future tasks can rely on them:

| Plugin | Purpose | Phase 0 usage |
|---|---|---|
| `tauri-plugin-opener` | Open external URLs / files in the OS default app | Not used yet (placeholder for media file reveal) |
| `tauri-plugin-dialog` | Native message/confirm/open/save dialogs | Used by P0-07 fail-fast error message |
| `tauri-plugin-shell` | Run shell commands | Not used yet (placeholder for HandBrake guidance in Phase 1) |
