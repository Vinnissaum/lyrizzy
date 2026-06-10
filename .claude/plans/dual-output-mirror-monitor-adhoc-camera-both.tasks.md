# Tasks — Dual-output follow-ups (mirror / monitor / ad-hoc / camera-both / fix Screen-2)

Spec: `dual-output-mirror-monitor-adhoc-camera-both.md`. Tasks are atomic and ordered by
dependency. `[P]` = parallelizable with siblings in the same slice. Each task lists **Done
when** + **Tests** + **Gate**.

**Gate (run per slice before commit):**
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `npx tsc --noEmit` (or `npm run build` typecheck)
- `npx vitest run`

Baseline at start: 235 Rust + 357 vitest + clippy + tsc green (per project memory).

---

## Slice 1 — FIX: Screen 2 actually presents  ⭐ P1 · do first (everything presents through it)

### T1.1 — Grant the `presentation-2` window its capability
- **What:** add `"presentation-2"` to the capability window list so the second window gets
  IPC commands, the `asset://` scheme, and events.
- **Where:** `src-tauri/capabilities/default.json:5` →
  `"windows": ["operator", "presentation", "presentation-2"]`.
- **Depends on:** —
- **Reuses:** existing capability/permission set (no new permissions).
- **Done when:** opening `presentation-2` can `invoke` commands and load `asset://` media;
  the window renders the set instead of black.
- **Tests:** manual rig (T1.4) — capability JSON isn't unit-testable. Add a comment noting
  why `presentation-2` is listed (regression guard against accidental removal).
- **Gate:** build compiles; no test delta expected.

### T1.2 — Visible-window fallback when no free monitor (FIX-03)
- **What:** ensure `enter_presentation` opens a **visible, focusable** `presentation-2`
  even when `resolve_output_monitor` returns `None` (single reachable display) — don't let
  it land hidden behind the primary.
- **Where:** `src-tauri/src/commands/window.rs` (the `target_idx == None` path, ~`:300-369`);
  add `window.set_focus()` after build/show when not pinned; confirm output Two never
  inherits output One's `always_on_top` slot.
- **Depends on:** T1.1
- **Reuses:** `resolve_output_monitor`, `should_pin_on_top`, existing placement helpers.
- **Done when:** with one physical display + `multiScreenEnabled`, presenting Tela 2 shows
  a visible window (not buried), focusable, without stealing Tela 1's screen.
- **Tests:** extend `window.rs` unit tests for a "no free monitor still yields a window we
  show+focus" decision helper (extract a pure predicate if needed for testability).
- **Gate:** Rust tests + clippy green.

### T1.3 — Confirm multi-screen entry point exists with the flag ON (FIX-01/02)
- **What:** verify the operator can load a set onto Tela 2 and Present once the capability
  is fixed; confirm navigation advances Tela 2 only.
- **Where:** `OperatorPresentationLayout.tsx:65-75` (`handlePickSet` → `loadSetForPresentation`
  + `enterPresentation("two")`); no change expected — verification + regression test.
- **Depends on:** T1.1
- **Reuses:** existing per-output load/present path.
- **Done when:** a vitest covers "pick set while Tela 2 focused → loadSetForPresentation
  called with `two` and enterPresentation('two')".
- **Tests:** vitest on `OperatorPresentationLayout` (mock commands, assert output arg).
- **Gate:** vitest green.

### T1.4 — Rig smoke test (manual, needs hardware)
- **What:** on the real 3-display rig, present a set to Tela 2 and navigate it.
- **Depends on:** T1.1, T1.2
- **Done when:** Tela 2 shows slides and advances; recorded in STATE/plan.
- **Gate:** manual; note result in the plan's status line.

---

## Slice 2 — MON: per-screen monitor picker  · P2

### T2.1 — Parameterize `MonitorPicker`
- **What:** add props `{ settingKey: string; label: string }` (default `settingKey =
  PRESENTATION_MONITOR_KEY`) so one component can drive either output's monitor.
- **Where:** `src/components/settings/MonitorPicker.tsx` (replace hardcoded
  `PRESENTATION_MONITOR_KEY` reads/writes with the prop).
- **Depends on:** — (independent of Slice 1)
- **Reuses:** `listMonitors`, `getSetting`/`setSetting`, existing select UI.
- **Done when:** `<MonitorPicker settingKey={OUTPUT2_MONITOR_KEY} />` reads/writes
  `output2.monitor_index`; default instance unchanged.
- **Tests:** vitest — renders, persists to the passed key on change.
- **Gate:** vitest + tsc green.

### T2.2 — Render two pickers in Settings (Screen 1 / Screen 2)
- **What:** show a Tela 1 picker (always) and a Tela 2 picker (when `multiScreenEnabled`).
- **Where:** `src/components/settings/SettingsScreen.tsx:216` (existing `<MonitorPicker/>`)
  → Screen 1 instance; add Screen 2 instance gated by `s.multiScreenEnabled`. i18n labels.
- **Depends on:** T2.1
- **Reuses:** `OUTPUT2_MONITOR_KEY` (`commands.ts:48`), `multiScreenEnabled` store.
- **Done when:** Settings shows both pickers in multi-screen mode; choosing Tela 2's monitor
  persists and `enterPresentation("two")` opens there.
- **Tests:** vitest — Tela 2 picker hidden when multi-screen off, visible when on.
- **Gate:** vitest + tsc green. i18n keys added for both locales.

---

## Slice 3 — MIR: mirror / Simultânea mode  · P1

### T3.1 — `mirrorEnabled` state + persistence
- **What:** add `mirrorEnabled` flag with a persisted setting (`presentation.mirror_enabled`).
- **Where:** `src/stores/settings.ts` (flag + setter + load); mirror is only meaningful
  under `multiScreenEnabled`.
- **Depends on:** —
- **Reuses:** existing `setSetting`/`getSetting` persistence pattern in the store.
- **Done when:** toggling persists and reloads; default OFF.
- **Tests:** vitest — setter persists; default false.
- **Gate:** vitest green.

### T3.2 — `targetsForFocused` dispatch helper + central command wrapper
- **What:** pure helper `targetsForFocused(focused, mirror): OutputId[]` (`mirror ?
  ["one","two"] : [focused]`) and a thin wrapper that routes operator mutations
  (next/prev/goToItem, overlays, blackout, exit) to all returned outputs.
- **Where:** new `src/components/presentation/outputDispatch.ts` (helper) + call sites in
  `OperatorPresentationLayout.tsx` / `StrophesGrid.tsx` / keyboard handlers.
- **Depends on:** T3.1
- **Reuses:** existing per-output commands (`next_slide`, `set*Overlay`, `exit_presentation`,
  …) — fan-out only, no new Rust commands.
- **Done when:** with mirror ON, one navigation call invokes the command for both outputs;
  with mirror OFF, only the focused output.
- **Tests:** vitest — `targetsForFocused` truth table; wrapper fans out to both when mirror on.
- **Gate:** vitest + tsc green.

### T3.3 — Engage/disengage semantics (MIR-01, MIR-04, Esc)
- **What:** on toggle ON, copy Screen 1's set+position to Screen 2 once
  (`loadSetForPresentation(set1, "two")` + `enterPresentation("two")`), then lockstep via
  T3.2; Esc/Stop fans out to both. On toggle OFF, both keep current content, control
  decouples.
- **Where:** mirror toggle handler (operator) + `handleStop` in `OperatorPresentationLayout.tsx`.
- **Depends on:** T3.2, Slice 1 (Tela 2 must actually present)
- **Reuses:** `loadSetForPresentation`, `enterPresentation`, `exitPresentation`.
- **Done when:** toggling ON makes both show Screen 1's current slide; advancing moves both;
  Esc exits both; toggling OFF leaves both showing their last frame independently.
- **Tests:** vitest — toggle ON triggers set copy to `two`; Esc under mirror exits both.
- **Gate:** vitest + tsc green.

### T3.4 — Simultânea/Independente toggle UI
- **What:** the operator-mode switch button (only when `multiScreenEnabled`).
- **Where:** `src/components/presentation/OutputSwitcher.tsx` (or adjacent), i18n labels
  "Simultânea"/"Independente".
- **Depends on:** T3.1
- **Reuses:** `multiScreenEnabled` gate, existing button styles.
- **Done when:** button reflects + flips `mirrorEnabled`; hidden when multi-screen off.
- **Tests:** vitest — renders only under multi-screen; click toggles store.
- **Gate:** vitest + tsc green. i18n keys both locales.

---

## Slice 4 — SEL: ad-hoc per-screen presenting guard  · P1 (mostly verification)

### T4.1 — Hide per-screen focus/pickers under mirror (SEL-03)
- **What:** when `mirrorEnabled`, hide/disable the `OutputSwitcher` Tela tabs and the
  per-screen set picker (one control only).
- **Where:** `OutputSwitcher.tsx`, `OperatorPresentationLayout.tsx` (set-picker block
  `:193-217`).
- **Depends on:** T3.1
- **Reuses:** `mirrorEnabled` flag.
- **Done when:** with mirror ON the operator sees a single control surface; with mirror OFF
  the Tela 1/2 tabs + per-screen pickers return.
- **Tests:** vitest — tabs/pickers absent when mirror on, present when off.
- **Gate:** vitest + tsc green.

### T4.2 — Regression: per-screen selection isolation (SEL-01/02)
- **What:** verify selecting/presenting an item to the focused screen leaves the other
  untouched (Independente mode).
- **Where:** test only — `OperatorPresentationLayout`/`SetItemList` against mocked commands.
- **Depends on:** Slice 1
- **Reuses:** existing per-output load/navigation.
- **Done when:** vitest asserts Tela 1 action invokes commands with `one` only (Tela 2 not
  called), and vice versa.
- **Tests:** vitest.
- **Gate:** vitest green.

---

## Slice 5 — CAM: camera + mic on both screens  · P3 (verification)

### T5.1 — Verify Screen 1 camera + mic path (rig)
- **What:** confirm Screen 1 plays mic + camera audio out its configured HDMI device,
  independently of Screen 2 (both active = both audible, per L-3).
- **Where:** `MicAudioSettings.tsx` (both outputs), `WebViewRenderer.tsx:43,145-146`,
  `PresentationApp.tsx:85-89` — already per-output; verification, not new code.
- **Depends on:** Slice 1
- **Done when:** rig check passes for Tela 1 and both-at-once; recorded in plan.
- **Gate:** manual.

### T5.2 — Discoverability tweak (only if T5.1 finds a gap)
- **What:** clarify in global Settings that audio is configured per screen (labels/help),
  if the per-screen intent isn't obvious.
- **Where:** `MicAudioSettings.tsx` + i18n.
- **Depends on:** T5.1
- **Done when:** Settings makes "camera/mic per screen" clear; conditional on T5.1 outcome.
- **Tests:** vitest if UI changes; else none.
- **Gate:** vitest + tsc green (if changed).

---

## Execution order & dependencies

```
Slice 1 (T1.1 → T1.2, T1.3 → T1.4)   ← do first; unblocks everything
   │
   ├── Slice 2 (T2.1 → T2.2)         ← independent UI; can run in parallel after T1.1
   │
   ├── Slice 3 (T3.1 → T3.2 → T3.3, T3.4)   ← needs Slice 1 for T3.3
   │
   ├── Slice 4 (T4.1 needs T3.1; T4.2 needs Slice 1)
   │
   └── Slice 5 (T5.1 → T5.2)         ← verification, after Slice 1
```

Commit one slice per atomic commit (Conventional Commits, matching repo history:
`fix(camera): …`, `feat(operator): …`, `docs(dual-output): …`). Update the plan status line
and `STATE`/memory after each slice.
