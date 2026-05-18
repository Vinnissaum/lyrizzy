# Phase 0: Skeleton Spec

**Status:** Approved
**Feature:** phase0-skeleton

---

## Requirements

### P0-01: Two-Window IPC Demo

Implement a Rust `AppState` holding `Arc<RwLock<i32>>` counter. Expose a `increment_counter` Tauri command that increments the counter and emits a `"state_changed"` event with the new value to all windows. Both the operator window and the presentation window must display the current counter value by listening to the event.

**Acceptance criteria:**
- `increment_counter` command increments the counter in Rust state
- `"state_changed"` event is emitted with `{ counter: N }` payload after every increment
- Operator window shows current counter and has a button to call `incrementCounter()`
- Presentation window shows current counter (read-only)
- The write guard is dropped before emit (no deadlock)

### P0-02: sqlx + SQLite Working

Initialize a `sqlx::SqlitePool` at Tauri startup. Store the pool in managed state. Run `sqlx::migrate!()` against the migrations folder (`src-tauri/migrations/`). The app must start without panics; the `001_initial.sql` migration must be applied.

**Acceptance criteria:**
- `SqlitePool` created and stored in Tauri managed state
- `sqlx::migrate!()` runs successfully at startup (no panic, no error logged)
- Pool path: `%APPDATA%\TrinityLyrics\database.db`
- Data directory created if it does not exist

### P0-03: asset:// Protocol Handler

Register a custom `asset://` protocol handler in both `lib.rs` (Tauri builder) and `tauri.conf.json` (CSP). The handler serves files from `%APPDATA%\TrinityLyrics\media\`. Path traversal must be prevented (canonical path must start with the media directory).

**Acceptance criteria:**
- `asset://media/` requests are served from `%APPDATA%\TrinityLyrics\media\`
- Path traversal (e.g., `asset://../../Windows/System32/...`) is rejected with 403
- `tauri.conf.json` CSP allows `asset:` sources
- Protocol registered in `lib.rs` via `register_uri_scheme_protocol`

### P0-04: MP4 Video via asset://

Presentation window renders a `<video>` element with `src="asset://media/test.mp4"`. The asset:// handler serves the file. (A test.mp4 file must exist in the media folder for manual verification; the automated test just confirms the `<video>` element renders.)

**Acceptance criteria:**
- `PresentationApp.tsx` renders `<video src="asset://media/test.mp4" controls autoPlay loop>`
- The asset:// protocol handler correctly sets Content-Type to `video/mp4`
- No CSP errors in WebView2 DevTools

### P0-05: Tests Green

At least 1 Rust unit test passes (`cargo test`). At least 1 Vitest test passes (`npx vitest run`).

**Acceptance criteria:**
- Rust: `#[test] fn counter_state_starts_at_zero()` in `state.rs` passes
- Frontend: vitest test for a utility function (e.g., `formatCounter`) passes
- Both test commands exit with code 0
