# Plan & Design — Countdown present/config fixes

Status: implemented (uncommitted) · Date: 2026-06-04 · Branch target: feature branch off `main`

Gates green: `cargo test` 210✓, `npx vitest run` 332✓, `tsc --noEmit` clean,
`cargo clippy --all-targets -- -D warnings` clean.

Follow-up bug-fix pass on the countdown scheduling v2 work (`72fc71f`). Four
defects observed in real use, all in the countdown present / config path.

## Summary of the requested changes

1. **Operator doesn't follow a counter-driven presentation.** When a countdown
   presents (takeover/auto-present), the operator window stays on its current
   view. `Esc` closes the projector, but there is no **Stop** button and no
   switch to the presentation layout.
2. **Modal config edits don't reach the running/loaded presentation.** Saving
   the modal must update both the set-item state and the database, and be
   honoured immediately.
3. **None of the config options take effect** in a counter-driven present —
   on-screen position, background media, etc. are ignored.
4. **Countdown set-item row should always show its config button** — drop the
   expand/collapse ("close tag") gate for countdown items.

---

## Root-cause findings

### Issue 1 — operator state doesn't update on counter-present

- The operator gates its whole presentation UI on the **presentation mode**:
  `isPresenting = mode ∈ {live, blank, frozen}` (`OperatorApp.tsx:290-293`).
  `OperatorPresentationLayout` (which hosts **Stop** → `handleStop`,
  `OperatorPresentationLayout.tsx:141-145`) only renders when `isPresenting`.
- A counter takeover **never drives presentation mode to `Live`**:
  - The fire transition in `tick_scheduled` (`commands/countdown.rs:200-238`)
    only mutates the **countdown** state (`takeover = true`, mode → Running) and
    emits `countdown_triggered` / `countdown_tick`. It never touches
    `PresentationState.mode`.
  - The operator's `onCountdownTriggered` handler (`OperatorApp.tsx:95-118`)
    either returns early (soft takeover while already presenting) or, when not
    presenting, calls `enterPresentation()` + `jumpToItem()`. `go_to_item`'s
    `wake_to_live` only wakes from **Blank**, not **Idle**
    (`presentation.rs:178-183, 514`) — so if the projector was Idle it stays
    Idle. `enter_presentation` also refuses an empty loaded set
    (`window.rs:220-225`), so the jump can no-op entirely.
  - The presentation window still shows the countdown because its takeover
    branch keys off the **countdown** store, not the presentation mode
    (`PresentationApp.tsx:202-214`).
- Net: projector shows the countdown, but `presState.mode` stays `idle`, so the
  operator never flips to `OperatorPresentationLayout` → no Stop button, no
  state. `Esc` still works because the keyboard dispatcher's
  `onEscape → handleExit → exitPresentation` is independent of mode
  (`OperatorApp.tsx:179-185, 225`).
- Secondary: `exit_presentation` (`window.rs:336-354`) resets presentation state
  but **does not reset the countdown** — `takeover`/Running survive a Stop, so
  the floating widget lingers and a reopen takes over again.

### Issue 2 — config edits don't reach the running/loaded presentation

- The DB write itself is correct: `handleSave` calls
  `updateSetItem({ id, countdownConfig })` (`CountdownScheduleModal.tsx:128-149`),
  and `update_set_item` overwrites `countdown_config` via COALESCE
  (`set.rs:411-426`). Config **does** persist to SQLite.
- The gap is propagation: the **in-memory loaded presentation set**
  (`state.presentation.set`, snapshotted at `load_set_for_presentation`,
  `presentation.rs:406`) is not refreshed on edit, and the **runtime countdown
  store** never receives `position` / `backgroundMediaId` at all (see Issue 3).
  So a countdown already loaded/presenting keeps stale config, which reads as
  "my change didn't save."

### Issue 3 — config options ignored on counter-present

- The takeover renderer builds a **synthetic, hardcoded** config
  (`PresentationApp.tsx:202-214`): `position: "center"`, **no background**,
  only `message`/`endBehavior`/`durationMs` from the countdown store.
- The countdown store can't supply position/background because
  `CountdownState` (`domain/countdown.rs:137-156`) has no `position` or
  `background_media_id` fields, and `start_countdown` / `arm_countdown`
  (`commands/countdown.rs:276-354, 410-483`) never accept or store them.
- The **manual** present branch (`itemType === "countdown"`,
  `PresentationApp.tsx:293-318`) *does* honour `config.position` and
  `backgroundMediaId` — so config "works" there but not via takeover, matching
  the report that counter-present ignores everything.

### Issue 4 — countdown row hidden behind expand/collapse

- Countdown items are `isExpandable` (`SetBuilder.tsx:115-123`) and the config
  button only renders inside the `expanded &&` block
  (`SetBuilder.tsx:649-667`), behind the chevron toggle
  (`SetBuilder.tsx:597-605`). The button should be always visible for countdown
  rows, with no collapse control.

---

## Design

### Fix 1 — operator follows counter-present; Stop resets countdown

- **Make the operator treat an active countdown takeover as "presenting."**
  In `OperatorApp.tsx`, compute presentation visibility as
  `isPresenting || countdownActive`, where
  `countdownActive = cd.state.takeover && cd.state.mode !== "idle"`. This flips
  the main pane to `OperatorPresentationLayout` (Stop + set/strophes/live panes)
  the instant the takeover fires, with no dependency on `presState.mode`.
- **Drive presentation mode to Live on fire (preferred, backend).** In
  `tick_scheduled`'s fire transition and in `start_countdown` (takeover path),
  if the presentation window is open and mode is `Idle`, set it to `Live` and
  emit `state_changed`, so the operator's existing gate also lights up and the
  set/strophes panes have a valid current item. (Frontend gate above is the
  belt-and-suspenders that covers the "no set loaded" case.)
- **Stop must clear the countdown.** Have `handleStop` /
  `exit_presentation` also reset the countdown (abort ticker, `takeover=false`,
  mode → Idle) so Stop fully tears down the takeover and the floating widget
  disappears. Cleanest: call `reset_countdown` from the unified exit path, or
  reset countdown state inside `exit_presentation`.

### Fix 2 — propagate edits to runtime + loaded set

- Keep the DB write (already correct).
- When the modal saves and the edited item is the one currently loaded for
  presentation, refresh the loaded snapshot — simplest is to re-run
  `load_set_for_presentation` for the active set (or update the single item in
  `state.presentation.set`) and emit `state_changed`.
- Carry the full config into the runtime countdown (Fix 3) so a re-armed or
  running countdown reflects the saved position/background/message.

### Fix 3 — config reaches the takeover renderer

- Extend `CountdownState` (`domain/countdown.rs`) with
  `position: CountdownPosition` and `background_media_id: Option<String>`
  (camelCase, `#[serde(default)]` for back-compat). Add to TS `CountdownState`
  (`types/index.ts:253`).
- Thread them through `start_countdown` and `arm_countdown` params (and the
  `ArmCountdownParams`/`StartCountdownParams` in `api/commands.ts`), and have the
  modal's `arm()` / the manual-present `startCountdown()` pass
  `config.position` and `config.backgroundMediaId`.
- In the takeover branch (`PresentationApp.tsx:202-214`) build the synthetic
  config from the **store** (`countdown.position`, `countdown.backgroundMediaId`)
  and resolve the background the same way the manual branch does
  (`PresentationApp.tsx:294-307`) instead of hardcoding center / no background.

### Fix 4 — always-open countdown row

- In `SetBuilder.tsx`, render the countdown config button (and the
  `scheduledStart` badge) **inline in the row** for `itemType === "countdown"`,
  not inside the `expanded &&` block. Remove the chevron/expand affordance for
  countdown rows (drop `countdown` from `isExpandable`, or special-case the row
  so it has no collapse toggle). Other expandable types (web_view, blank,
  media-video, slide_show) keep their current expand/collapse behaviour.

---

## Files touched

- `src-tauri/src/domain/countdown.rs` — add `position`, `background_media_id` to
  `CountdownState`.
- `src-tauri/src/commands/countdown.rs` — accept/store new fields in
  `start_countdown`/`arm_countdown`; drive presentation→Live on fire.
- `src-tauri/src/commands/window.rs` — `exit_presentation` resets countdown.
- `src/api/commands.ts` — extend `Start/ArmCountdownParams`.
- `src/types/index.ts` — extend `CountdownState`.
- `src/windows/operator/OperatorApp.tsx` — `countdownActive` gate; Stop/exit
  resets countdown.
- `src/windows/presentation/PresentationApp.tsx` — takeover config from store +
  resolved background.
- `src/components/set/CountdownScheduleModal.tsx` — pass position/background into
  arm/start; trigger loaded-set refresh.
- `src/components/set/SetBuilder.tsx` — always-open countdown row.

## Verification

- `npx vitest run` · `cargo test --manifest-path src-tauri/Cargo.toml` ·
  `tsc --noEmit`. i18n parity covered by the existing key-completeness test.
- Manual (two-monitor): arm a countdown with a non-center position + video
  background → at fire the projector shows it **with** that position/background;
  the operator switches to the presentation layout with a working **Stop**;
  Stop closes the projector AND clears the floating widget. Edit config mid-run
  → change is reflected. Countdown set-item row shows its config button without
  expanding.

## Resolution of the open question

Issue 2 ("not persisted to DB") was not a DB write bug — `update_set_item` writes
correctly via COALESCE. The observable symptom was **stale config at present
time**: the loaded-for-presentation snapshot and the runtime countdown store
never picked up edits. Fixed by (a) patching the loaded snapshot in
`update_set_item` and re-emitting `state_changed`, and (b) threading
`position`/`backgroundMediaId` through arm/start into `CountdownState` so the
takeover renderer honours them.
