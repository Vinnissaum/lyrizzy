# Tasks — Scheduled-countdown: launch warning + auto-present

**Spec**: `scheduled-countdown-launch-warning-autopresent.md`
**Status**: Implemented (uncommitted) — all 6 tasks done; `npx vitest run` 307✓, `cargo test` countdown 20✓, `tsc --noEmit` clean. Pre-existing clippy errors in `artifact.rs` are unrelated.

**Gate commands** (no `TESTING.md`; from CLAUDE.md conventions):
- Frontend: `npx vitest run` — co-located `*.test.tsx` unit tests.
- Rust: `cargo test --manifest-path src-tauri/Cargo.toml` — in-module unit tests.
- i18n parity is enforced by the existing key-completeness test (part of `vitest run`).

---

## Execution Plan

### Phase 1 — Foundation (parallel)
Independent of each other; everything downstream builds on them.

```
T1 (Rust: defer takeover)   [P]
T6 (i18n: keys add/remove)  [P]
```

### Phase 2 — Frontend units (parallel)
Each touches a distinct file; deps met after Phase 1.

```
T6 ──→ T2 (CountdownLaunchPrompt component)     [P]
T1 ──→ T5 (set-enter effect rule)               [P]
T1,T6 ─→ T4 (remove Arm button + badge)         [P]
```

### Phase 3 — Integration (sequential)

```
T2 ──→ T3 (OperatorApp launch scan + wire modal)
```

---

## Task Breakdown

### T1: Defer `takeover` to the Scheduled→Running fire moment [P]

**What**: Move the takeover flag so it is set only when a scheduled countdown fires, not when it is armed.
**Where**: `src-tauri/src/commands/countdown.rs` (modify), `src-tauri/src/domain/countdown.rs` (test)
**Depends on**: None
**Reuses**: existing `tick_scheduled` transition block (`:204-211`), `tick_countdown` finish-clear (`:125-130`)
**Requirement**: CD-04

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] `tick_scheduled` sets `s.takeover = true` in the same write that flips `mode = Running` (inside the existing `write().await` block, before the emit — CLAUDE.md invariant).
- [ ] `arm_countdown` no longer arms a takeover: arming always lands `Scheduled` with `takeover = false` (param kept in signature for IPC compat but does not set true).
- [ ] A focused unit test asserts: armed scheduled state has `takeover == false`; the fire-transition rule yields `takeover == true`.
- [ ] Gate passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: all existing countdown tests still pass + ≥1 new assertion (no silent deletions).

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml` green; grep shows no `s.takeover = t` write in `arm_countdown`.

**Tests**: unit · **Gate**: full (Rust) · **Commit**: `fix(countdown): defer takeover to scheduled→running fire time`

---

### T6: i18n keys — add launch/schedule, remove dead arm keys [P]

**What**: Add the new launch-modal and schedule-badge strings to every locale and remove the now-dead arm strings.
**Where**: `src/i18n/locales/*.json`
**Depends on**: None
**Reuses**: existing `countdown.*` namespace; `countdown.arm.cancel` (repurpose as badge title)
**Requirement**: CD-02, CD-03, CD-01

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Added in **all** locales: `countdown.launch.title`, `countdown.launch.body` (`{{time}}`,`{{remaining}}`), `countdown.launch.keep`, `countdown.launch.disable`, `countdown.schedule.badge` (`{{remaining}}`).
- [ ] Removed in all locales: `countdown.arm.button`, `countdown.arm.toast`, and the orphaned `countdown.schedule.{heading,startAt,armButton,hint}` block (zero code refs — confirm via grep before deleting).
- [ ] Gate passes: `npx vitest run` (the i18n key-completeness test stays green / updated for new keys).
- [ ] Test count: no net loss in passing tests.

**Verify**: `grep -rn "countdown.arm.button\|countdown.schedule.heading" src/` returns nothing; `vitest run` parity test green.

**Tests**: unit (i18n parity) · **Gate**: full (frontend) · **Commit**: folded into T2/T4 commits, or `chore(i18n): countdown launch/schedule strings`

---

### T2: `CountdownLaunchPrompt` component [P]

**What**: A one-shot launch modal warning of a scheduled countdown with Keep / Disable actions.
**Where**: `src/components/system/CountdownLaunchPrompt.tsx` (new) + `CountdownLaunchPrompt.test.tsx`
**Depends on**: T6
**Reuses**: dialog markup idiom in `OperatorPresentationLayout.tsx:319-359` (`fixed inset-0 z-50 … bg-surface` card), button classes
**Requirement**: CD-02

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Props `{ scheduledHHMM: string; remainingMs: number; onKeep(): void; onDisable(): void }`; renders title/body with `time` + formatted `remaining` (hh:mm:ss for >1h).
- [ ] **Manter ativo** (primary) calls `onKeep`; **Desativar** calls `onDisable`.
- [ ] No internal timers (pure decision dialog); accessible (role/dialog, focusable buttons).
- [ ] Test: renders time/remaining; clicking each button fires the right callback.
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: + new test file passing.

**Verify**: `npx vitest run src/components/system/CountdownLaunchPrompt.test.tsx` green.

**Tests**: unit · **Gate**: full (frontend) · **Commit**: `feat(countdown): launch warning modal for scheduled countdowns`

---

### T4: Remove manual Arm button; repurpose badge to "pending" countdown [P]

**What**: Delete the opaque Arm affordance and make the header badge show time-remaining while `mode === "scheduled"`.
**Where**: `src/components/presentation/OverlayActionBar.tsx`, `src/components/presentation/OperatorPresentationLayout.tsx` (+ their `.test.tsx`)
**Depends on**: T1, T6
**Reuses**: existing badge block (`OverlayActionBar.tsx:48-56`), `msToClock` / `epochToHHMM` helpers in `OperatorPresentationLayout.tsx:27-36`
**Requirement**: CD-01, CD-03

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] `arm-countdown-button` block + `showArmCountdown`/`onArmCountdown` props deleted from `OverlayActionBar`.
- [ ] `handleArmCountdown`, `canArmCountdown`, `activeCountdownConfig`, `scheduledDurationMs` and the arm-toast plumbing removed from `OperatorPresentationLayout` (drop the toast if it becomes unused).
- [ ] Badge renders when `countdown.mode === "scheduled"` (label = `countdown.schedule.badge` with `msToClock(remainingMs)`) **or** `mode === "running" && takeover`; click still calls `reset()`.
- [ ] Updated tests: no `arm-countdown-button` in DOM; badge shows for `scheduled` state with a remaining label; cancel calls reset.
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: existing `OperatorPresentationLayout`/`OverlayActionBar` tests green (arm-button assertions replaced, not silently deleted).

**Verify**: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx` green; grep for `arm-countdown-button` returns nothing.

**Tests**: unit · **Gate**: full (frontend) · **Commit**: `feat(countdown): header time-remaining badge while pending; remove Arm button`

---

### T5: Set-enter effect — never arm; immediate-start = manual present [P]

**What**: Replace the set-enter scheduled auto-arm with a guard: leave an already-armed schedule alone, otherwise start the countdown immediately.
**Where**: `src/windows/presentation/PresentationApp.tsx` (`:161-181`) + `PresentationApp.test.tsx`
**Depends on**: T1
**Reuses**: existing `startCountdown` call; countdown store `mode`
**Requirement**: CD-05, CD-07

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Scheduled branch (`if (scheduledStart) { armCountdown… }`) removed.
- [ ] On landing on a countdown item: if store `mode` is `scheduled`/`running` → no-op (don't disturb the pending schedule); else → `startCountdown({ target, message, endBehavior })` immediately.
- [ ] Test: landing on a scheduled countdown item while store is `scheduled` does NOT call `start`/`arm`; landing while idle calls `startCountdown`.
- [ ] Existing takeover-precedence tests stay green; add: `scheduled` + `takeover:false` does not overlay.
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: existing PresentationApp tests green + new assertions.

**Verify**: `npx vitest run src/windows/presentation/PresentationApp.test.tsx` green.

**Tests**: unit · **Gate**: full (frontend) · **Commit**: `refactor(countdown): set-enter never arms; manual present starts immediately`

---

### T3: OperatorApp launch scan + wire the modal

**What**: On launch, scan the fixed set for a later-today scheduled countdown and drive `CountdownLaunchPrompt` (Keep → arm without takeover; Disable → no-op).
**Where**: `src/windows/operator/OperatorApp.tsx` + `OperatorApp.smoke.test.tsx` (or a focused launch test)
**Depends on**: T2
**Reuses**: `getOrCreateDefaultSet()` (`api/commands.ts:244`), `useCountdownStore().arm`, `showSplash` gating idiom (`OperatorApp.tsx:56,229`), `resolve…` logic mirrored client-side
**Requirement**: CD-02, CD-05, CD-07

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] After `loadFixedSet()`, fetch the fixed set, scan `items` for countdown items with `scheduledStart`; resolve to **today** local; pick the **earliest still-upcoming today** (exclude tomorrow-rolled and past).
- [ ] If one exists and **not presenting** → render `CountdownLaunchPrompt` once per process (state like `showSplash`).
- [ ] **Manter** → `arm({ scheduledStart, durationMs, message, endBehavior, setId, itemIndex })` with **no** `takeover`; close modal.
- [ ] **Desativar** → close modal, do not arm (session-only; config untouched).
- [ ] If already presenting at detection → skip modal (header badge from T4 covers it).
- [ ] Test: fixed set with later-today schedule → prompt shown; Keep calls `arm` without `takeover`; tomorrow-rolled/absent → no prompt. (Mock `getOrCreateDefaultSet` + countdown store.)
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: existing OperatorApp tests green + new launch test.

**Verify**: `npx vitest run src/windows/operator/` green; manual: launch with a later-today schedule shows the modal.

**Tests**: unit · **Gate**: full (frontend) · **Commit**: `feat(countdown): launch-time scan arms scheduled countdown on operator keep`

---

## Parallel Execution Map

```
Phase 1 (parallel):
  ├── T1 [P]  (Rust)
  └── T6 [P]  (i18n)

Phase 2 (parallel, after Phase 1):
  ├── T2 [P]  needs T6
  ├── T4 [P]  needs T1, T6
  └── T5 [P]  needs T1

Phase 3 (sequential):
  T3  needs T2
```

`[P]` constraints met: parallel tasks in each phase touch disjoint files (T1=Rust, T6=locales; T2=new component, T4=OverlayActionBar+OperatorPresentationLayout, T5=PresentationApp) and have no shared mutable state. Vitest/cargo runs are isolated → parallel-safe.

---

## Validation tables

### Task Granularity Check
| Task | Scope | Status |
|---|---|---|
| T1 | 1 cohesive Rust rule + test | ✅ |
| T2 | 1 component + test | ✅ |
| T3 | 1 wiring concern in 1 file + test | ✅ |
| T4 | 2 cohesive files (button removal + badge) | ✅ (cohesive) |
| T5 | 1 effect in 1 file + test | ✅ |
| T6 | locale strings (1 concern) | ✅ |

### Diagram-Definition Cross-Check
| Task | Depends on (body) | Diagram arrows | Status |
|---|---|---|---|
| T1 | none | none | ✅ |
| T6 | none | none | ✅ |
| T2 | T6 | T6→T2 | ✅ |
| T4 | T1, T6 | T1→T4, T6→T4 | ✅ |
| T5 | T1 | T1→T5 | ✅ |
| T3 | T2 | T2→T3 | ✅ |

### Test Co-location Validation
No `TESTING.md`; project convention = co-located unit tests (vitest) + in-module Rust tests. Every task that creates/modifies a tested layer includes its tests in the same task (`Tests: unit`, gate = full suite). No `Tests: none`, no deferred tests. ✅

---

## Notes
- Open question from the spec (re-prompt on **mid-session** schedule edits) is **out of these tasks** — recommended follow-up (`onSetChanged` re-scan). Confirm before adding.
- Tools: all tasks use standard file/edit tools only — no project MCP or Skill required. Tell me if you'd prefer otherwise.
