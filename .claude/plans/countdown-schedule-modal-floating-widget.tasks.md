# Tasks — Countdown scheduling v2: config-in-modal + floating widget + soft takeover

**Spec**: `countdown-schedule-modal-floating-widget.md`
**Status**: Proposed — not started. 7 tasks. Backend untouched (arm/fire/emit already correct).

**Gate commands** (no `TESTING.md`; from CLAUDE.md conventions):
- Frontend: `npx vitest run` — co-located `*.test.tsx` unit tests.
- Rust: `cargo test --manifest-path src-tauri/Cargo.toml` — in-module unit tests (regression only here).
- `npx tsc --noEmit` — type check.
- i18n parity is enforced by the existing key-completeness test (part of `vitest run`).

---

## Execution Plan

### Phase 1 — Foundation (parallel)
Disjoint files; everything downstream builds on them.

```
T1 (i18n: add new + remove dead keys)        [P]  locales/*
T2 (store: armedItem on arm/reset)           [P]  stores/countdown.ts
T7 (soft-takeover render precedence)         [P]  PresentationApp + LivePreview
```

### Phase 2 — Units (parallel; deps met after Phase 1)
Each owns a distinct file set.

```
T1 ─────────→ T3 (remove old arming model)        [P]  del CountdownLaunchPrompt; OverlayActionBar; OperatorPresentationLayout; OperatorApp(removal)
T1,T2 ──────→ T4 (config+schedule modal)          [P]  CountdownScheduleModal(new); SetBuilder; CountdownSetItemEditor
T1,T2 ──────→ T5 (floating widget component)       [P]  ScheduledCountdownWidget(new)
```

### Phase 3 — Integration (sequential)
Single-owner OperatorApp wiring; needs everything above.

```
T2,T3,T4,T5,T7 ──→ T6 (OperatorApp wiring: mount widget + onEdit→modal + silent re-arm + trigger handler)
```

---

## Task Breakdown

### T1: i18n — add new schedule/modal/widget keys, remove dead launch/arm keys [P]

**What**: Add the strings the new modal/widget/button need to every locale; remove the now-dead launch-prompt / arm / badge / inline-schedule strings.
**Where**: `src/i18n/locales/*.json`
**Depends on**: None
**Reuses**: existing `countdown.*` namespace; keep `countdown.scheduled.*` (renderer labels still used)
**Requirement**: CS-01, CS-02, CS-05

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Added in **all** locales: `countdown.schedule.button`, `countdown.schedule.toggle`, `countdown.schedule.triggerLabel`, `countdown.modal.{title,save,cancel}`, `countdown.widget.{remaining,edit,cancel}` (`remaining` takes `{{remaining}}`).
- [ ] Removed in **all** locales: `countdown.launch.*`, `countdown.arm.cancel`, `countdown.schedule.badge`, `countdown.editor.scheduledStart`, `countdown.editor.scheduledStartHint`.
- [ ] Gate passes: `npx vitest run` (i18n parity test green for the new key set).
- [ ] Test count: no net loss in passing tests.

**Verify**: `npx vitest run` parity test green; `grep -rn "countdown.launch\.\|countdown.arm.cancel\|countdown.schedule.badge" src/i18n` returns nothing.

> Note: code refs to the removed keys are deleted in T3/T4. Between this commit and those, a removed key renders as its key string — harmless to the parity gate (parity ≠ ref-usage). Land T1 adjacent to T3/T4 to keep the transient short.

**Tests**: unit (i18n parity) · **Gate**: full (frontend) · **Commit**: `chore(i18n): countdown v2 schedule/modal/widget strings`

---

### T2: Track `armedItem {setId,itemIndex}` in the countdown store [P]

**What**: Give the frontend a handle on *which* set item is currently armed, so the widget (Edit) and the trigger handler (jump) can act without a Rust schema change.
**Where**: `src/stores/countdown.ts` (+ `countdown.test.ts` if one exists, else a new focused test)
**Depends on**: None
**Reuses**: existing `arm` / `reset` actions; `ArmCountdownParams` already carries `setId`/`itemIndex`
**Requirement**: CS-04, CS-05

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Store gains `armedItem: { setId: string; itemIndex: number } | null` (default `null`).
- [ ] `arm(params)` sets `armedItem` from `params.setId`/`params.itemIndex` (null if absent) on success.
- [ ] `reset()` clears `armedItem` to `null`.
- [ ] Test: after `arm` with setId/itemIndex, `armedItem` is set; after `reset`, it's `null`.
- [ ] Gate passes: `npx vitest run`, `npx tsc --noEmit`.
- [ ] Test count: + new assertions.

**Verify**: `npx vitest run` green; `armedItem` typed and exported in the store interface.

**Tests**: unit · **Gate**: full (frontend) · **Commit**: `feat(countdown): track armed set item in store`

---

### T7: Soft takeover — yield render precedence to a clean live song [P]

**What**: Make the countdown takeover overlay blackout / media overlay / aviso, but **not** a clean live song (`mode ∈ {live,frozen}` with no `overlay`).
**Where**: `src/windows/presentation/PresentationApp.tsx` (`:195-257`), `src/components/presentation/LivePreview.tsx` (`:67-`) (+ their `.test.tsx`)
**Depends on**: None
**Reuses**: existing takeover branch + `CountdownRenderer` synthetic-config block; existing overlay/blank/idle branches
**Requirement**: CS-07, CS-08

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] In `PresentationApp`, the takeover branch is moved **below** a clean-live-content guard: when `(mode === "live" || mode === "frozen") && !overlay`, normal set content renders and the countdown does **not** take over.
- [ ] When `takeover && countdown.mode !== "idle"` and the screen is **not** clean live content (blank, any overlay, or idle) → `CountdownRenderer` renders (above announcement/blank/media/idle).
- [ ] `LivePreview` mirrors the identical reorder.
- [ ] Tests (both files): `takeover` + clean live song → renders song, not countdown; `takeover` + `mode==="blank"` → countdown; `takeover` + announcement/media overlay → countdown; idle + takeover → countdown. Existing finish/auto-clear precedence tests stay green.
- [ ] Gate passes: `npx vitest run`, `npx tsc --noEmit`.
- [ ] Test count: existing PresentationApp/LivePreview tests green + new assertions.

**Verify**: `npx vitest run src/windows/presentation/PresentationApp.test.tsx src/components/presentation/LivePreview.test.tsx` green.

**Tests**: unit · **Gate**: full (frontend) · **Commit**: `feat(countdown): soft takeover yields to a clean live song`

---

### T3: Remove the old launch-prompt arming model [P]

**What**: Delete the launch-warning modal, its OperatorApp scan/keep wiring, and the header "pending" badge.
**Where**: `src/components/system/CountdownLaunchPrompt.tsx` (+ test) **delete**; `src/components/presentation/OverlayActionBar.tsx`; `src/components/presentation/OperatorPresentationLayout.tsx`; `src/windows/operator/OperatorApp.tsx` (+ affected `.test.tsx`)
**Depends on**: T1 (dead keys gone)
**Reuses**: nothing (pure removal); keep `findUpcomingScheduledCountdown` (reused by T6)
**Requirement**: CS-01

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] `CountdownLaunchPrompt.tsx` + `.test.tsx` deleted.
- [ ] `OperatorApp`: removed `launchPrompt` state (`:63-65`), prompt render (`:273-280`), `handleKeepCountdown` (`:232-247`), the `getOrCreateDefaultSet()` prompt-scan block (`:126-138`), and now-unused imports (`CountdownLaunchPrompt`; `findUpcomingScheduledCountdown` only if T6 not yet landed — keep the import path otherwise).
- [ ] `OperatorPresentationLayout`: removed badge derivation (`:77-92`) and `armedCountdownLabel`/`onCancelArmedCountdown` props on `OverlayActionBar` (`:225-226`).
- [ ] `OverlayActionBar`: removed the `armedCountdownLabel` badge block (`:46-55`) and its two props (`:18-24,39-40`).
- [ ] Updated tests: no `countdown-armed-badge` / `countdown-launch-prompt` in DOM; existing assertions for those replaced, not silently dropped.
- [ ] Gate passes: `npx vitest run`, `npx tsc --noEmit`.
- [ ] Test count: suites green; removed-feature assertions replaced.

**Verify**: `grep -rn "CountdownLaunchPrompt\|countdown-armed-badge\|armedCountdownLabel\|handleKeepCountdown" src/` returns nothing; `npx vitest run` green.

**Tests**: unit · **Gate**: full (frontend) · **Commit**: `refactor(countdown): remove launch-prompt arming model`

---

### T4: Config + schedule modal on the set item [P]

**What**: Replace the inline countdown editor with a Schedule/Configure button that opens a modal holding the full config + trigger time; Save persists and arms.
**Where**: `src/components/set/CountdownScheduleModal.tsx` (new) + test; `src/components/set/SetBuilder.tsx` (`:646-650`); `src/components/set/CountdownSetItemEditor.tsx` (repurpose/replace inline editor); `CountdownSetItemEditor.test.tsx`
**Depends on**: T1, T2
**Reuses**: existing config controls + `msToDuration`/`durationToMs`/`buildConfig` from `CountdownSetItemEditor`; `updateSetItem` (`api/commands.ts:259`); `useCountdownStore().arm` / `.reset`; modal markup idiom from `OperatorPresentationLayout` dialogs; `MediaPicker`, position grid
**Requirement**: CS-02, CS-03, CS-04 (save→persist+arm)

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] `CountdownScheduleModal` (`{ item; onClose }`) hosts the full config (duration/fixedTime target, message, end behaviour, background, position) **plus** an "Agendar este cronômetro" toggle + a trigger-time input. Schedule toggle disabled in fixedTime mode (Edge case).
- [ ] **Salvar**: `await updateSetItem({ id, countdownConfig })` (incl. `scheduledStart` when toggled on); then if scheduled → `arm({ scheduledStart, durationMs, message, endBehavior, setId, itemIndex })` (no `takeover`); if toggled off → `reset()` to disarm. Validate duration > 0; refuse a past trigger time today with an inline hint.
- [ ] `SetBuilder` countdown row renders a `countdown.schedule.button` that opens the modal, plus a "⏰ HH:MM" chip when `scheduledStart` is set; the old inline `<CountdownSetItemEditor>` panel is removed from the row.
- [ ] Inline `scheduledStart` checkbox/state removed from `CountdownSetItemEditor`; its config controls live in the modal (component repurposed or superseded — no dead inline editor left).
- [ ] Tests: Save with schedule on calls `updateSetItem` **and** `arm` (duration + scheduledStart); schedule off calls `updateSetItem` + `reset`; fixedTime disables the toggle; SetBuilder shows the button (modal mocked) + chip when scheduled.
- [ ] Gate passes: `npx vitest run`, `npx tsc --noEmit`.
- [ ] Test count: new modal test + updated SetBuilder/editor tests green.

**Verify**: `npx vitest run src/components/set/` green; opening the modal from a countdown row, saving a schedule arms the store (mocked) and persists.

**Tests**: unit · **Gate**: full (frontend) · **Commit**: `feat(countdown): config+schedule modal on set item (persist + arm)`

---

### T5: Global floating scheduled-countdown widget [P]

**What**: A draggable floating widget showing trigger time + live remaining, with Editar / Cancelar.
**Where**: `src/components/system/ScheduledCountdownWidget.tsx` (new) + test
**Depends on**: T1, T2
**Reuses**: `useCountdownStore` (`mode`, `remainingMs`, `takeover`, `armedItem`, `reset`); `msToClock`/HH:MM formatting (lift from `OperatorPresentationLayout:27-34`); `updateSetItem` for the Cancel-clears-schedule path; `AlarmClock` icon
**Requirement**: CS-05

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Renders only when `mode === "scheduled"` **or** (`mode === "running" && takeover`); nothing when idle.
- [ ] Shows ⏰ + trigger `HH:MM` (from `scheduled_start_epoch_ms` or `armedItem`) + `countdown.widget.remaining` from `msToClock(remainingMs)`.
- [ ] **Editar** calls an `onEdit(armedItem)` prop (modal mounting owned by OperatorApp in T6 — widget does not import the modal). **Cancelar** calls `reset()` and clears the item's `scheduledStart` via `updateSetItem` (won't re-arm next launch).
- [ ] Draggable, corner-anchored (default bottom-right), `position: fixed`, z-index below true modals; drag offset in local state.
- [ ] Tests: hidden when idle; visible + shows remaining when scheduled; Editar fires `onEdit`; Cancelar calls `reset` + `updateSetItem` (schedule removed).
- [ ] Gate passes: `npx vitest run`, `npx tsc --noEmit`.
- [ ] Test count: + new test file.

**Verify**: `npx vitest run src/components/system/ScheduledCountdownWidget.test.tsx` green.

**Tests**: unit · **Gate**: full (frontend) · **Commit**: `feat(countdown): floating scheduled-countdown widget`

---

### T6: OperatorApp wiring — mount widget, edit modal, silent re-arm, soft trigger

**What**: Wire the new pieces into the operator window: mount the floating widget globally, host the modal for the widget's Edit, silently re-arm a later-today schedule at launch, and present-on-fire per the soft-takeover model.
**Where**: `src/windows/operator/OperatorApp.tsx` + `OperatorApp` test
**Depends on**: T2, T3, T4, T5, T7
**Reuses**: `findUpcomingScheduledCountdown` (`runtime/scheduledCountdown.ts`); `getOrCreateDefaultSet`; `useCountdownStore().arm`; `enterPresentation`/`jumpToItem`; `onCountdownTriggered` (`:91-105`)
**Requirement**: CS-04 (silent re-arm), CS-05 (mount + edit), CS-06 (present if not presenting)

**Tools**: standard file/edit tools. MCP: NONE. Skill: NONE.

**Done when**:
- [ ] `<ScheduledCountdownWidget onEdit={…}/>` mounted at the `OperatorApp` root, **outside** the `isPresenting` branch, so it shows in every view and over the presentation layout.
- [ ] Widget `onEdit` opens a `CountdownScheduleModal` instance (resolve the `SetItem` from the fixed set by `armedItem.itemIndex`); closing it returns to the prior view.
- [ ] **Silent re-arm at launch**: after `loadFixedSet()`, fetch the fixed set, run `findUpcomingScheduledCountdown(items, Date.now())`, and if a hit exists **arm directly** (no modal) and set `armedItem`. Excludes past-today (resolver-rolls-to-tomorrow) hits.
- [ ] **Trigger handler** (`onCountdownTriggered`): if **not presenting** → `enterPresentation()` then `jumpToItem(armedItem.itemIndex)` (countdown becomes live content); if **presenting** → no jump (T7 precedence overlays filler, yields to a live song).
- [ ] Tests: launch with a later-today schedule arms silently (no prompt rendered); past-today/absent → no arm; widget mounted when `armedItem`/scheduled; trigger when not presenting calls `enterPresentation` + `jumpToItem`. (Mock `getOrCreateDefaultSet` + countdown/presentation stores.)
- [ ] Gate passes: `npx vitest run`, `npx tsc --noEmit`.
- [ ] Test count: existing OperatorApp tests green + new launch/trigger/widget assertions.

**Verify**: `npx vitest run src/windows/operator/` green; manual: relaunch with a saved schedule → widget returns, no prompt; at HH:MM while blacked-out → countdown overlays.

**Tests**: unit · **Gate**: full (frontend) · **Commit**: `feat(countdown): wire floating widget, silent re-arm, soft auto-present`

---

## Parallel Execution Map

```
Phase 1 (parallel):
  ├── T1 [P]  (locales/*)
  ├── T2 [P]  (stores/countdown.ts)
  └── T7 [P]  (PresentationApp + LivePreview)

Phase 2 (parallel, after Phase 1):
  ├── T3 [P]  needs T1   (del CountdownLaunchPrompt; OverlayActionBar; OperatorPresentationLayout; OperatorApp-removal)
  ├── T4 [P]  needs T1,T2 (CountdownScheduleModal; SetBuilder; CountdownSetItemEditor)
  └── T5 [P]  needs T1,T2 (ScheduledCountdownWidget)

Phase 3 (sequential):
  T6  needs T2,T3,T4,T5,T7   (OperatorApp wiring)
```

`[P]` constraints met: parallel tasks in each phase touch disjoint files — Phase 1: T1=locales, T2=store, T7=presentation renderers. Phase 2: T3=OperatorApp+overlay-bar+presentation-layout (+delete), T4=set/* (modal+SetBuilder+editor), T5=new widget file; none overlap (T3 owns OperatorApp; T4/T5 don't touch it). T6 is the sole Phase-3 task and the only one that re-edits OperatorApp after T3. Vitest/cargo runs are isolated → parallel-safe.

---

## Validation tables

### Task Granularity Check
| Task | Scope | Status |
|---|---|---|
| T1 | locale strings (1 concern) | ✅ |
| T2 | 1 store field + test | ✅ |
| T7 | 1 precedence rule mirrored in 2 renderers + tests | ✅ (cohesive) |
| T3 | removal across 4 cohesive files (one feature) | ✅ (cohesive) |
| T4 | modal + button + editor refactor (one feature) | ✅ (cohesive) |
| T5 | 1 component + test | ✅ |
| T6 | 1 wiring concern in 1 file + test | ✅ |

### Diagram-Definition Cross-Check
| Task | Depends on (body) | Diagram arrows | Status |
|---|---|---|---|
| T1 | none | none | ✅ |
| T2 | none | none | ✅ |
| T7 | none | none | ✅ |
| T3 | T1 | T1→T3 | ✅ |
| T4 | T1, T2 | T1→T4, T2→T4 | ✅ |
| T5 | T1, T2 | T1→T5, T2→T5 | ✅ |
| T6 | T2,T3,T4,T5,T7 | →T6 | ✅ |

### Test Co-location Validation
No `TESTING.md`; project convention = co-located unit tests (vitest) + in-module Rust tests. Every task that creates/modifies a tested layer includes its tests in the same task (`Tests: unit`, gate = full suite). No `Tests: none`, no deferred tests. Rust is regression-only (no backend change). ✅

---

## Notes
- **Backend untouched**: `arm_countdown` already lands `Scheduled`/`takeover=false`; `tick_scheduled` sets `takeover=true` at fire and emits `countdown_triggered`. Soft takeover is a frontend render decision (T7). Run `cargo test` once as a regression gate.
- **Open questions** carried from the spec — confirm before/while building: (a) widget **Cancelar** clears the persisted schedule (assumed); (b) past trigger-time on Save is refused with a hint (assumed); (c) a countdown firing under a clean live song runs unseen (assumed). These affect T4/T5/T6 done-when details.
- **Commit order**: T1 → T2/T7 → T3 → T4/T5 → T6. Keep T1 adjacent to T3/T4 to minimise the transient missing-translation window.
- Tools: all tasks use standard file/edit tools only — no project MCP or Skill required.
