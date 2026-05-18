# Codebase Concerns

**Analyzed:** 2026-05-18

---

## CONCERN-1: React 19 vs TDD-specified React 18

**Severity:** Low
**Evidence:** `package.json` shows `"react": "^19.1.0"` and `"@types/react": "^19.1.8"` — TDD specifies React 18.x
**Risk:** Minor API compatibility differences; Testing Library 16 supports React 19
**Fix approach:** No action needed for Phase 0. Document in STATE.md. Reassess if Testing Library integration issues arise.
**Status:** Monitoring

---

## CONCERN-2: `App.tsx` is a dead file

**Severity:** Low
**Evidence:** `src/App.tsx` uses raw `invoke("greet")` (scaffold leftover). `src/main.tsx` never imports it — it imports `OperatorApp` or `PresentationApp` directly.
**Risk:** Dead code confusion; the `invoke("greet")` call violates the IPC invariant (raw invoke outside commands.ts)
**Fix approach:** Delete `src/App.tsx` once Phase 0 is stable.
**Status:** Deferred — non-blocking

---

## CONCERN-3: `tauri.conf.json` CSP is null

**Severity:** Medium (becomes High when asset:// is implemented)
**Evidence:** `"security": { "csp": null }` — disables Content Security Policy entirely
**Risk:** Without a CSP, the app is open to script injection if any user content is rendered. More importantly, asset:// requires explicit CSP configuration.
**Fix approach:** Set CSP as part of the asset:// task (T4): allow `asset:`, `http:`, `https:`, block `eval`.
**Status:** Will be fixed in Phase 0 Task T4

---

## CONCERN-4: No state.rs file yet

**Severity:** Medium (Phase 0 blocker)
**Evidence:** `lib.rs` has no `AppState` — `setup(|_app| Ok(()))` is a no-op. Phase 0 counter demo requires `Arc<RwLock<i32>>` in managed state.
**Fix approach:** Add `state.rs` with `AppState` struct in Phase 0 Task T1.
**Status:** Will be fixed in Phase 0

---

## CONCERN-5: All Rust submodules are empty stubs

**Severity:** Low (expected for Phase 0)
**Evidence:** `domain/mod.rs`, `db/mod.rs`, `commands/mod.rs`, `services/mod.rs`, `protocol/mod.rs` all have all submodule declarations commented out.
**Risk:** Compiler won't catch issues until modules are uncommented. No tests can run yet.
**Fix approach:** Uncomment as features are implemented. Phase 0 tasks will uncomment the relevant ones.
**Status:** Expected — by design

---

## CONCERN-6: No vitest.config.ts

**Severity:** Low
**Evidence:** No `vitest.config.ts` present. Vitest will use defaults (finds test files by pattern).
**Risk:** Without explicit config, tests may not find React globals or jsdom environment.
**Fix approach:** Add vitest config with `environment: 'jsdom'` and `globals: true` in Phase 0 Task T5.
**Status:** Will be fixed in Phase 0

---

## CONCERN-7: Deadlock risk in Tauri command handlers

**Severity:** High (architectural invariant)
**Evidence:** Documented in CLAUDE.md and TDD-v2.md. If `state.write().await` guard is held when `app.emit()` is called, and an event listener attempts to acquire the same lock, deadlock occurs.
**Fix approach:** Always drop the write guard before emitting. Use explicit `drop(guard)` or inner scope `{ let mut s = state.write().await; s.mutate(); }` before `app.emit()`.
**Status:** Must be respected in every command handler — enforced by code review / convention
