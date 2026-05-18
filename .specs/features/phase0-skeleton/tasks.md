# Phase 0: Skeleton Tasks

**Spec:** `.specs/features/phase0-skeleton/spec.md`
**Status:** Done

---

## Execution Plan

### Phase A: Foundation (Sequential)

```
T1 → T2 → T3
```

T1 (AppState + counter command) must exist before T2 (DB pool in state) can extend AppState.
T2 (DB setup) must exist before T3 (asset:// protocol) since T3 also uses the app handle setup.

### Phase B: Core (Parallel OK)

```
T3 complete, then:
  ├── T4 [P]   (asset:// protocol handler)
  └── T5 [P]   (tests: Rust unit test + Vitest setup)
```

T4 and T5 are independent once T3 (lib.rs wiring) is stable.

### Phase C: Integration (Sequential)

```
T4 + T5 complete, then:
  T6  (OperatorApp + PresentationApp wired to state_changed event)
```

---

## Task Breakdown

---

### T1: Add AppState with Arc<RwLock<i32>> counter + increment_counter command

**What:** Create `src-tauri/src/state.rs` with `AppState { counter: Arc<RwLock<i32>> }`. Wire it into `lib.rs` via `.manage(AppState::default())`. Add `increment_counter` Tauri command in `src-tauri/src/commands/counter.rs`. Register command in `lib.rs` invoke_handler![].
**Where:**
- `src-tauri/src/state.rs` (create)
- `src-tauri/src/commands/counter.rs` (create)
- `src-tauri/src/commands/mod.rs` (modify — uncomment/add pub mod counter)
- `src-tauri/src/lib.rs` (modify — add mod state, .manage(), register command)
**Depends on:** None
**Reuses:** Existing `lib.rs` Tauri builder skeleton
**Requirement:** P0-01

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] `state.rs` defines `AppState { counter: Arc<RwLock<i32>> }` with `Default` impl (starts at 0)
- [ ] `commands/counter.rs` has `#[tauri::command] async fn increment_counter(state: tauri::State<'_, AppState>, app: tauri::AppHandle) -> Result<i32, String>` that increments, drops lock, emits `"state_changed"` with `{ counter: N }`, returns new value
- [ ] Write guard dropped BEFORE `app.emit()` (invariant: no deadlock)
- [ ] `lib.rs` wires `.manage(AppState::default())` and `invoke_handler![increment_counter]`
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: at least 1 Rust test passes (the `counter_starts_at_zero` test in state.rs)

**Tests:** unit (Rust — `#[cfg(test)]` in state.rs)
**Gate:** quick

**Commit:** `feat(ipc): add AppState counter and increment_counter command`

---

### T2: Initialize sqlx SqlitePool and run migrations at startup

**What:** Add `init_db()` async function in `src-tauri/src/db/mod.rs` that creates the app data directory, opens the SQLite pool at `%APPDATA%\TrinityLyrics\database.db`, and runs `sqlx::migrate!("../migrations")`. Store the pool in `AppState`. Wire `init_db()` into `lib.rs` `setup()`.
**Where:**
- `src-tauri/src/db/mod.rs` (modify — add init_db function)
- `src-tauri/src/state.rs` (modify — add `db: sqlx::SqlitePool` field)
- `src-tauri/src/lib.rs` (modify — call init_db in setup, manage updated AppState)
**Depends on:** T1 (AppState exists)
**Reuses:** `src-tauri/migrations/001_initial.sql` (already complete)
**Requirement:** P0-02

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] `db/mod.rs` has `pub async fn init_db() -> Result<sqlx::SqlitePool, sqlx::Error>` that creates the data dir and opens the pool with `SqliteConnectOptions`
- [ ] `sqlx::migrate!("../migrations")` runs against the pool without error
- [ ] `AppState` holds `db: sqlx::SqlitePool`
- [ ] `lib.rs` setup() calls `init_db().await` and `.manage()` the pool
- [ ] App compiles and starts without panic (verified by `cargo test --manifest-path src-tauri/Cargo.toml`)
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: existing tests still pass + 0 new failures

**Tests:** unit (Rust — compile + existing test still green)
**Gate:** quick

**Commit:** `feat(db): initialize sqlx SqlitePool and run migrations at startup`

---

### T3: Register asset:// protocol handler in lib.rs and tauri.conf.json CSP

**What:** Create `src-tauri/src/protocol/asset.rs` with the `asset_protocol_handler` function. Register it in `lib.rs` via `.register_uri_scheme_protocol("asset", ...)`. Update `tauri.conf.json` security.csp to allow `asset:` sources.
**Where:**
- `src-tauri/src/protocol/asset.rs` (create)
- `src-tauri/src/protocol/mod.rs` (modify — add pub mod asset)
- `src-tauri/src/lib.rs` (modify — register protocol + add mod protocol)
- `src-tauri/tauri.conf.json` (modify — set security.csp)
**Depends on:** T2 (lib.rs setup complete — avoids merge conflicts)
**Reuses:** Tauri 2 `register_uri_scheme_protocol` API
**Requirement:** P0-03, P0-04

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] `protocol/asset.rs` handles `asset://media/{filename}` requests
- [ ] Handler resolves path relative to `%APPDATA%\TrinityLyrics\media\`
- [ ] Path traversal protection: canonical path is verified to start with media_dir; returns HTTP 403 if not
- [ ] Correct Content-Type headers set (video/mp4 for .mp4, image/* for images)
- [ ] `tauri.conf.json` CSP set to: `"default-src 'self'; img-src 'self' asset: https:; media-src asset:; script-src 'self'; style-src 'self' 'unsafe-inline'"`
- [ ] Rust unit test for path traversal rejection passes
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: path traversal test + all prior tests green

**Tests:** unit (Rust — `#[cfg(test)]` in protocol/asset.rs)
**Gate:** quick

**Commit:** `feat(protocol): register asset:// handler with path traversal protection`

---

### T4: Wire PresentationApp to show video via asset:// [P]

**What:** Update `src/windows/presentation/PresentationApp.tsx` to render a `<video>` element pointing to `asset://media/test.mp4`. Also update `OperatorApp.tsx` to show the counter value and a button that calls `incrementCounter()` from commands.ts. Add `incrementCounter` to `src/api/commands.ts`.
**Where:**
- `src/api/commands.ts` (modify — add incrementCounter, add CounterState type)
- `src/windows/operator/OperatorApp.tsx` (modify — add counter display + increment button)
- `src/windows/presentation/PresentationApp.tsx` (modify — add video element + counter display)
**Depends on:** T3 (protocol registered; lib.rs stable)
**Reuses:** `src/api/commands.ts` existing pattern
**Requirement:** P0-01, P0-04

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] `commands.ts` exports `incrementCounter(): Promise<number>` using `invoke<number>("increment_counter")`
- [ ] `commands.ts` exports `onStateChanged` typed with `{ counter: number }` payload
- [ ] `OperatorApp.tsx` uses `onStateChanged` to display counter; has button calling `incrementCounter()`
- [ ] `PresentationApp.tsx` uses `onStateChanged` to display counter; renders `<video src="asset://media/test.mp4" controls autoPlay loop muted>`
- [ ] All `invoke()` calls are in commands.ts only — no raw `invoke()` in component files
- [ ] Gate check passes: `npx vitest run` (component renders without crash)
- [ ] Test count: frontend test for OperatorApp renders correctly

**Tests:** component (Vitest + Testing Library)
**Gate:** quick

**Commit:** `feat(frontend): wire operator counter button and presentation video player`

---

### T5: Add vitest config and first unit tests (Rust + frontend) [P]

**What:** Add `vitest.config.ts` with jsdom environment. Add a Vitest test for a `formatCounter` utility in `src/utils/counter.ts`. The Rust `state.rs` `#[cfg(test)]` block (counter_starts_at_zero) was added in T1 — this task confirms it passes and adds a second test for the increment behavior tested independently.
**Where:**
- `vitest.config.ts` (create)
- `src/utils/counter.ts` (create — `formatCounter(n: number): string`)
- `src/utils/counter.test.ts` (create — 2 Vitest tests)
- `src-tauri/src/state.rs` (modify — add second unit test for default value)
**Depends on:** T3 (lib.rs compiles without errors)
**Reuses:** Existing Vitest + @testing-library/react devDependencies
**Requirement:** P0-05

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] `vitest.config.ts` exists with `environment: 'jsdom'`, `globals: true`, `setupFiles` pointing to `@testing-library/jest-dom`
- [ ] `src/utils/counter.ts` exports `formatCounter(n: number): string` (returns `"Counter: N"`)
- [ ] `src/utils/counter.test.ts` has 2 passing tests: `formatCounter(0)` and `formatCounter(5)`
- [ ] `npx vitest run` exits with code 0; 2+ tests pass
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` exits with code 0; 1+ Rust tests pass
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`
- [ ] Test count: Rust ≥ 1 test, Frontend ≥ 2 tests

**Tests:** unit (both Rust + Vitest)
**Gate:** full

**Commit:** `test(phase0): add vitest config and green baseline tests for Rust and frontend`

---

### T6: Final integration — cleanup and phase gate

**What:** Remove dead file `src/App.tsx`. Verify both windows compile and render without errors. Run the full gate check. Update tasks.md and STATE.md.
**Where:**
- `src/App.tsx` (delete)
- `.specs/features/phase0-skeleton/tasks.md` (update status)
- `.specs/project/STATE.md` (update Phase 0 status, add lessons learned)
**Depends on:** T4 (frontend wired), T5 (tests green)
**Reuses:** All prior work
**Requirement:** P0-01 through P0-05

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] `src/App.tsx` deleted (dead scaffold file)
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` — all Rust tests pass
- [ ] `npx vitest run` — all frontend tests pass (≥ 2)
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] STATE.md updated: Phase 0 marked Done, lessons learned recorded
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`

**Tests:** none (cleanup + verification only)
**Gate:** build

**Commit:** `chore(phase0): remove dead App.tsx, mark phase 0 complete`

---

## Parallel Execution Map

```
Phase A (Sequential):
  T1 ──→ T2 ──→ T3

Phase B (Parallel — after T3):
  T3 complete, then:
    ├── T4 [P]  (frontend wiring)
    └── T5 [P]  (vitest config + tests)

Phase C (Sequential — after T4 + T5):
  T4 + T5 complete, then:
    T6 (cleanup + gate)
```

---

## Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T1: AppState + counter command | 2 files + lib.rs mod | OK — cohesive single feature |
| T2: DB pool + migrations | db/mod.rs + state.rs + lib.rs | OK — single integration point |
| T3: asset:// protocol | protocol/asset.rs + mod + lib.rs + conf | OK — single feature |
| T4: Frontend wiring | commands.ts + 2 window components | OK — one IPC connection |
| T5: Test config + baseline tests | vitest.config + utils + test file | OK — single testing concern |
| T6: Cleanup + phase gate | 1 delete + spec updates | OK — single cleanup |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
|------|------------------------|---------------|--------|
| T1 | None | Start of chain | OK |
| T2 | T1 | T1 → T2 | OK |
| T3 | T2 | T2 → T3 | OK |
| T4 [P] | T3 | T3 → T4 parallel | OK |
| T5 [P] | T3 | T3 → T5 parallel | OK |
| T6 | T4, T5 | T4 + T5 → T6 | OK |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|------|----------------------------|-----------------|-----------|--------|
| T1 | `src-tauri/src/state.rs` (domain-ish) | unit | unit | OK |
| T1 | `src-tauri/src/commands/counter.rs` | none (commands layer) | — (included in T1 unit test) | OK |
| T2 | `src-tauri/src/db/mod.rs` | integration (sqlx::test) | unit (compile gate) | NOTE: full sqlx::test integration added in Phase 1 when DB queries exist; Phase 0 gate is compile |
| T3 | `src-tauri/src/protocol/asset.rs` | unit | unit | OK |
| T4 | `src/windows/operator/OperatorApp.tsx` | component | component | OK |
| T4 | `src/windows/presentation/PresentationApp.tsx` | component | component | OK |
| T5 | `src/utils/counter.ts` | unit | unit | OK |
| T6 | Cleanup only | none | none | OK |
