# Phase 0: Skeleton Tasks

**Spec:** `.specs/features/phase0-skeleton/spec.md`
**Status:** T1–T6 done (work shipped in commits `3628385..8103663`). T7–T12 polish in flight.
**Last updated:** 2026-05-18

---

## Execution Plan

### Phase A: Foundation (Sequential) — DONE

```
T1 → T2 → T3
```

### Phase B: Core (Parallel) — DONE

```
T3 complete, then:
  ├── T4 [P]   (frontend wiring)
  └── T5 [P]   (vitest config + baseline tests)
```

### Phase C: Integration — DONE

```
T4 + T5 → T6 (cleanup)
```

### Phase D: Polish (Parallel-safe) — IN FLIGHT

```
T7 [P] (serde rename)
T8 [P] (canonicalize once)
T9 [P] (pre-create media dir)
  ↓
T10 (DB fail-fast + pool in AppState)  — touches lib.rs setup; do after T9
  ↓
T11 (open_presentation_window + UI)    — touches lib.rs, commands, capabilities, OperatorApp
  ↓
T12 [P] (OperatorApp component test)   — optional; can run after T11
```

T7/T8/T9 are independent file edits (counter.rs / asset.rs / lib.rs setup). T10 and T11 both edit `lib.rs`, so run sequentially to avoid trivial conflicts.

---

## Task Breakdown

---

### T1: AppState + increment_counter command — DONE

Shipped in commit `873f495` (and refined later). `state.rs`, `commands/counter.rs`, and `lib.rs` wired. Two Rust unit tests pass.

**Commit:** `feat(ipc): add AppState counter and increment_counter command`

---

### T2: sqlx pool + migrations at startup — DONE

Shipped. `db/mod.rs::init_db` opens the pool at `app_data_dir/database.db` and runs `sqlx::migrate!("./migrations")`. Pool currently `manage()`d separately from `AppState` — **see T10 for refactor**.

**Commit:** `feat(db): initialize sqlx SqlitePool and run migrations at startup`

---

### T3: asset:// protocol handler + CSP — DONE

Shipped in `873f495`. `protocol/asset.rs` plus CSP in `tauri.conf.json`. Path traversal tests green.

**Commit:** `feat(protocol): register asset:// handler with path traversal protection`

---

### T4: Frontend wiring (operator counter + presentation video) — DONE

Shipped in `3628385`. Counter button + presentation video player + state_changed listener in both windows.

**Commit:** `feat(frontend): wire operator counter button and presentation video player`

---

### T5: vitest config + baseline tests — DONE

Shipped in `2ec2fd4`. 3 Vitest tests + 9 Rust tests green.

**Commit:** `test(phase0): add vitest config and green baseline tests for Rust and frontend`

---

### T6: Cleanup (dead App.tsx removed, phase gate green) — DONE

Shipped in `80f3954` / `8103663`.

**Commit:** `chore(phase0): remove dead App.tsx, mark phase 0 complete`

---

### T7: Stamp `#[serde(rename_all = "camelCase")]` on StateChangedPayload [P]

**What:** Add `#[serde(rename_all = "camelCase")]` to `StateChangedPayload`. Single-field today; the rule must be in place before Phase 1 adds multi-word fields (e.g., `current_slide_index`).
**Where:**
- `src-tauri/src/commands/counter.rs` (modify)
**Depends on:** None
**Requirement:** P0-01

**Done when:**
- [ ] `StateChangedPayload` has `#[serde(rename_all = "camelCase")]` attribute.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` still green.
- [ ] No TS-side change needed yet (field is already `counter` — same in camelCase).

**Tests:** unit (existing Rust tests still pass)
**Gate:** quick (cargo test)
**Commit:** `chore(ipc): apply camelCase serde rename to StateChangedPayload`

---

### T8: Canonicalize media_dir once at handler construction [P]

**What:** In `protocol/asset.rs::build_handler`, canonicalize `media_dir` **once** when the closure is built, capture the canonical `PathBuf`. Drop the per-request `media_dir.canonicalize()` call. Keep per-request canonicalize on the *file* (still needed for symlink resolution).
**Where:**
- `src-tauri/src/protocol/asset.rs` (modify `build_handler`)
**Depends on:** None
**Requirement:** P0-03

**Done when:**
- [ ] `build_handler` calls `media_dir.canonicalize()` once before constructing the closure; if it fails, the closure unconditionally returns 500 with a clear body (the dir should always exist after T9, but defense in depth).
- [ ] Closure no longer canonicalizes `media_dir` per request.
- [ ] All existing protocol unit tests still pass.

**Tests:** unit (existing `path_traversal_*` tests cover the behavior)
**Gate:** quick
**Commit:** `perf(protocol): canonicalize asset media_dir once at handler construction`

---

### T9: Pre-create media dir AND align asset:// path with app_data_dir [P]

**What:** Two coupled fixes:
1. **Pre-create**: in `lib.rs` setup, `std::fs::create_dir_all(app_data_dir/"media")` so the asset handler can canonicalize it immediately. (Currently a missing dir → every asset request silently 404s.)
2. **Path alignment**: today `register_uri_scheme_protocol` hardcodes `%APPDATA%\TrinityLyrics\` while `db::init_db` uses `app.path().app_data_dir()` (resolves to `%APPDATA%\com.igreja-trindade.trinity-lyrics\` per the bundle identifier). The two stores are split across different folders. Unify by:
   - Adding `static CANONICAL_MEDIA_DIR: OnceLock<PathBuf>` to `protocol/asset.rs` with `pub fn set_media_dir(dir: PathBuf)` and `pub fn build_handler()` (no args — reads from the static).
   - In `lib.rs` setup, compute `media_dir = app.path().app_data_dir()?.join("media")`, create it, canonicalize, then `protocol::asset::set_media_dir(canonical)`.
   - Remove the env-var-based path computation from the `register_uri_scheme_protocol` block.

**Where:**
- `src-tauri/src/protocol/asset.rs` (modify — add OnceLock + setter; change build_handler signature)
- `src-tauri/src/lib.rs` (modify setup — create media dir, set OnceLock; change protocol registration)

**Depends on:** None (independent of T7/T8)
**Requirement:** P0-08

**Done when:**
- [ ] `protocol::asset::CANONICAL_MEDIA_DIR` (OnceLock) replaces the closure-captured path.
- [ ] `setup` creates `app_data_dir/"media"`, canonicalizes it, and calls `set_media_dir`.
- [ ] No more `%APPDATA%\TrinityLyrics\` literal anywhere — single source of truth via `app.path().app_data_dir()`.
- [ ] If creation fails, the failure propagates to the dialog/exit path established in T10.
- [ ] Manual check: delete the media dir, start the app, observe it is recreated.
- [ ] All `protocol/asset.rs` unit tests still pass (mime tests + path traversal test; the static-based handler test may need a `set_media_dir` call in test setup, OR keep `build_handler(PathBuf)` as a test-friendly overload).

**Tests:** unit (existing); update tests if `build_handler` signature changes
**Gate:** quick (cargo test)
**Commit:** `feat(storage): pre-create media dir and align asset:// to app_data_dir`

---

### T10: DB init fail-fast + move pool into AppState

**What:** Two changes in one task because they touch the same setup block:
1. Move the pool into `AppState` behind `tokio::sync::OnceCell<SqlitePool>` (replacing the separate `app_handle.manage(pool)`).
2. Replace `tauri::async_runtime::spawn { eprintln! }` with `tauri::async_runtime::block_on(init_db(&handle))` so the pool is ready before invoke handlers register. On `Err`, show a `tauri-plugin-dialog` blocking error and `std::process::exit(1)`.

**Where:**
- `src-tauri/src/state.rs` (modify — add `db: OnceCell<SqlitePool>`)
- `src-tauri/src/lib.rs` (modify setup — block_on + dialog + exit)
- `src-tauri/src/db/mod.rs` (unchanged signature; verify it still compiles after AppState change)

**Depends on:** T9 (so the dialog-on-error path is the only failure mode left)
**Requirement:** P0-02, P0-07

**Done when:**
- [ ] `AppState` exposes `db: tokio::sync::OnceCell<SqlitePool>` (set once during setup).
- [ ] `lib.rs` setup calls `tauri::async_runtime::block_on(db::init_db(&handle))`; on `Ok`, sets the cell via `state.db.set(pool).ok()`.
- [ ] On `Err`: `tauri_plugin_dialog::DialogExt::dialog(&handle).message(format!("...")).blocking_show()` then `std::process::exit(1)`.
- [ ] No second `manage()` call for the pool — single managed object.
- [ ] `cargo test` green (the existing counter test does not depend on the pool).

**Tests:** none new; failure path is verified manually by pointing the app at a read-only DB path
**Gate:** quick
**Commit:** `feat(db): fail-fast on init error and move pool into AppState`

---

### T11: open_presentation_window command + Operator button

**What:** Add the missing command to actually open the presentation window. Wire it from the operator UI. Grant the webview-create capability.

**Where:**
- `src-tauri/src/commands/window.rs` (create) — `#[tauri::command] pub async fn open_presentation_window(app: AppHandle) -> Result<(), String>` using `WebviewWindowBuilder` + `WebviewUrl::App("presentation.html".into())`, idempotent (find existing by label first via `app.get_webview_window("presentation")`)
- `src-tauri/src/commands/mod.rs` (modify — `pub mod window;`)
- `src-tauri/src/lib.rs` (modify — register in `invoke_handler![]`)
- `src-tauri/capabilities/default.json` (modify — add `"core:webview:allow-create-webview-window"`)
- `src/api/commands.ts` (modify — export `openPresentationWindow`)
- `src/windows/operator/OperatorApp.tsx` (modify — add button below the counter)

**Depends on:** T10 (clean setup block to extend)
**Requirement:** P0-06

**Done when:**
- [ ] Command exists, registered, idempotent (calling twice does not error and focuses the existing window on the second call).
- [ ] Capability grants the new permission; `tauri info` (or `npm run tauri dev`) starts without permission errors.
- [ ] `openPresentationWindow` available via `commands.ts`; OperatorApp button calls it.
- [ ] Manual verification: click button → second window opens → both windows show the same counter on increment.
- [ ] `cargo test` and `npx vitest run` both green.

**Tests:** none directly (Tauri window APIs require a running runtime; covered by manual verification)
**Gate:** quick (cargo + vitest)
**Commit:** `feat(window): add open_presentation_window command and operator button`

---

### T12: OperatorApp component test (with Tauri API mocks) [P, OPTIONAL]

**What:** Add a Vitest + Testing Library test for `OperatorApp` that mocks `@tauri-apps/api/core` (`invoke`) and `@tauri-apps/api/event` (`listen`). Assert: counter renders, button calls `invoke("increment_counter")`, listener cleanup runs on unmount. This closes T4's stale "frontend test for OperatorApp renders correctly" criterion that was never delivered.

**Where:**
- `src/windows/operator/OperatorApp.test.tsx` (create)
- `src/test-setup.ts` (modify — add Tauri API mock helpers if needed)

**Depends on:** T11 (button + new command exist; test covers them)
**Requirement:** P0-05 (extends the baseline)

**Done when:**
- [ ] Test renders `<OperatorApp />`, asserts counter shows `0`, clicks the button, asserts mocked `invoke` was called with `"increment_counter"`.
- [ ] Test for "Open Presentation Window" button: clicks, asserts mocked `invoke("open_presentation_window")` was called.
- [ ] `npx vitest run` exits 0 with ≥ 5 frontend tests.

**Tests:** component (Vitest + Testing Library)
**Gate:** full (cargo + vitest)
**Commit:** `test(operator): add component test with Tauri API mocks`

---

## Parallel Execution Map

```
Phases A–C — DONE
  T1 → T2 → T3 → (T4 ∥ T5) → T6

Phase D — IN FLIGHT
  (T7 ∥ T8 ∥ T9) → T10 → T11 → T12 (optional)
```

---

## Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T1–T6 | (shipped — see commits) | Done |
| T7: serde rename | one attribute, one file | Single-line edit ✓ |
| T8: canonicalize once | one function, one file | Single concern ✓ |
| T9: pre-create media dir | one setup hook, one file | Single concern ✓ |
| T10: fail-fast + pool in AppState | setup block + state.rs | Two coupled changes; same setup block forces fusion ✓ |
| T11: open_presentation_window | command file + caps + UI button | Cross-layer but one feature ✓ |
| T12: component test | one test file | Single concern ✓ |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|------|-------------------|---------------|--------|
| T7 [P] | None | Start of Phase D parallel band | OK |
| T8 [P] | None | Start of Phase D parallel band | OK |
| T9 [P] | None | Start of Phase D parallel band | OK |
| T10 | T9 | T9 → T10 | OK |
| T11 | T10 | T10 → T11 | OK |
| T12 | T11 | T11 → T12 (optional) | OK |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|------|----------------------------|-----------------|-----------|--------|
| T7 | `commands/counter.rs` (commands layer) | none (tested via integration) | existing unit test still passes | OK |
| T8 | `protocol/asset.rs` | unit | existing unit tests cover | OK |
| T9 | `lib.rs` setup | none (app wiring) | manual | OK |
| T10 | `state.rs` + `lib.rs` setup | none / domain-ish | manual + existing | OK |
| T11 | `commands/window.rs` + `OperatorApp.tsx` | none / component | manual + T12 component test | OK |
| T12 | `OperatorApp.test.tsx` | component | component | OK |
