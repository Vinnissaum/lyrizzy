# Plan & Spec — Dual-output follow-ups: mirror mode, per-screen monitor picker, ad-hoc per-screen presenting, camera/mic on both, fix Screen-2

Status: **ALL CODE COMPLETE** (Slices 1–4 built; Slice 5 camera/mic was already per-output in
code) on `feat/dual-output-followups` — full gate green: **277 Rust** (236 lib + integration) +
clippy + tsc + **369 vitest**. Slice 1 (FIX Screen-2), Slice 2 (per-screen monitor picker), Slice 3
(mirror/Simultânea), Slice 4 (mirror-aware set pick + SEL isolation test). **Remaining = hardware
verification only** — see "Rig verification checklist" below (T1.4 + T5.1; needs operator + 2 TVs).
· Date: 2026-06-10 · Branch: feat/dual-output-followups
Baseline: builds on the implemented dual-output feature — see
`dual-output-presentation-camera-mic-audio.md` (Slices A–D + C2) for the output model
(`OutputId`, tagged events, per-output windows/state).

## Goal (what the user needs)

Four changes on top of the existing two-output system:

1. **A mode switch in operator mode** to choose between **Simultânea** (the same content on
   both screens, driven as one) and **Independente** (each screen its own content).
2. **Choose Screen 1 / Screen 2 and assign each to a specific monitor** from settings.
3. **Present a chosen subset of a set to one screen, then switch screen and present
   something else** ("sub-section" per screen, picked ad-hoc at present time) — **and fix
   that the second screen currently does not present**.
4. **The second screen must be a full presentation output like the first** (not just
   camera/audio); **camera and mic must be independently activatable on each screen**,
   configured in the global settings.

### Locked decisions (from discussion 2026-06-10)

| #   | Question                                            | Decision                                                                                                                                                                                                  |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-1 | What does "simultaneous" mean?                      | **Mirror — one control.** A toggle in operator mode. ON ⇒ the operator drives a single set and Screen 2 renders an identical copy of Screen 1 (slide, overlay, blackout). OFF ⇒ today's independent mode. |
| L-2 | What is a "sub-section"?                             | **Ad-hoc selection at present time.** No new saved schema on the set. At present time the operator picks which item(s) of the set go to the **focused** screen; then switches focus and picks for the other screen. |
| L-3 | Camera + mic on both screens — how does audio play? | **Independent per screen.** Each screen enables its own camera + mic; if both are on, the mic plays out **both** HDMI outputs at once. Enabled/configured in the **global Settings** screen, per screen.   |
| L-4 | Physical setup                                      | Unchanged from baseline: operator (primary) + TV-1 + TV-2, each TV on its own HDMI.                                                                                                                       |

### Open questions (need the user before/at design)

- **Q-A (Screen-2 bug) — RESOLVED 2026-06-10.** Root cause found by inspection:
  `src-tauri/capabilities/default.json:5` declares `"windows": ["operator",
  "presentation"]` — **`presentation-2` is not in the list.** Tauri 2 scopes capabilities
  per window label, so the `presentation-2` window opens with **no IPC commands, no
  `asset://` protocol, and no event permissions** → it renders dead/black and never
  presents. Fix is config: add `"presentation-2"` (see FIX design below). No repro needed.
- **Q-B (mode default & interaction):** when Simultânea is toggled ON while the two
  screens already have *different* sets loaded, which set wins — Screen 1's, or does the
  toggle prompt? Assumed: **Screen 1 becomes the master; Screen 2 starts mirroring it.**
- **Q-C (ad-hoc granularity):** is the per-screen "sub-section" a single item at a time
  (pick item → that screen shows it), or a multi-item range the screen then navigates
  within? Assumed: **single item/song picked to the focused screen, navigated normally**
  (matches the existing per-output set + `currentItemIndex` model).

---

## Current behaviour (findings)

### Output model already exists (baseline feature)

- `OutputId { One, Two }` with window labels `presentation` / `presentation-2`, `other()`,
  and `from_window_label()` (`src-tauri/src/domain/output.rs:11-48`). Commands take
  `Option<OutputId>` defaulting to `One`.
- Window routing is correct per output: `main.tsx:25-33` derives the output from the
  window label (`outputFromWindowLabel`) and mounts `<PresentationApp output={…}>`;
  `PresentationApp` subscribes per output — `subscribePresentation(output)` /
  `subscribeCountdown(output)` (`PresentationApp.tsx:54-55,106-107`) and wraps the tree in
  `OutputContext.Provider value={output}` (`:390`).
- Operator drives the **focused** output: `OutputSwitcher` (Tela 1/2 tabs, gated by
  `multiScreenEnabled`, `OutputSwitcher.tsx:20`) sets `focusedOutput`;
  `OperatorPresentationLayout.handlePickSet` does `loadSetForPresentation(setId,
  focusedOutput)` then `enterPresentation(focusedOutput)` (`OperatorPresentationLayout.tsx:65-75`).

### Per-output monitor selection: backend done, UI single (gap for #2)

- Keys exist: `PRESENTATION_MONITOR_KEY = "presentation.monitor_index"` and
  `OUTPUT2_MONITOR_KEY = "output2.monitor_index"` (`commands.ts:46-50`).
- `enterPresentation(output, monitorIndex?)` already resolves the per-output key:
  `output === "two" ? OUTPUT2_MONITOR_KEY : PRESENTATION_MONITOR_KEY` and passes it to the
  Rust command (`commands.ts:62-79`).
- Rust `enter_presentation` honours the manual `monitor_index`, auto-detects a free
  monitor, and **excludes the monitor the other output already occupies** so two auto-placed
  outputs don't collide (`window.rs:244-376`, `resolve_output_monitor` :110-130).
- **Gap:** the Settings UI `MonitorPicker.tsx` only reads/writes the **single**
  `PRESENTATION_MONITOR_KEY` (`MonitorPicker.tsx:6-29`). There is **no picker for Tela 2's
  monitor**, so `OUTPUT2_MONITOR_KEY` is never set from the UI.

### Camera + mic on both screens: essentially already implemented (gap for #4 is small)

- Per-output audio settings exist for **both** outputs: `outputAudioKey(o) =
  "output.${o}.audio"`, `audio: Record<OutputId, OutputAudioSettings>` with `micEnabled`,
  `micDevice`, `outputDevice` (the TV's HDMI), `micDelayMs`, `cameraUnmuted`
  (`stores/settings.ts:38-59,156-191,238-377`).
- The Settings UI already exposes **both** screens: `MicAudioSettings` maps over
  `OUTPUTS = ["one","two"]` and renders mic enable + input/output device + delay + camera
  un-mute per screen (`MicAudioSettings.tsx:12,70-141`); rendered in `SettingsScreen` when
  `multiScreenEnabled` (`SettingsScreen.tsx:296-300`).
- The renderers apply it per output: `WebViewRenderer` reads `audio[output]` →
  `muted={!cameraAudio.cameraUnmuted}` and `sinkId={cameraAudio.outputDevice?.deviceId}`
  (`WebViewRenderer.tsx:43,145-146`); `PresentationApp` mounts `useMicAudio` for its own
  output (`PresentationApp.tsx:85-89`).
- **Implication:** camera + mic are **already per-output for both screens** in code. The
  prior work was hardware-verified mainly for Tela 2. Remaining for #4 is mostly
  **verification on Screen 1** plus discoverability (the per-screen mic switch
  `MicSwitch` is operator-side and gated by `multiScreenEnabled`, `MicSwitch.tsx:16-19`).

### No mirror mode, flat sets (gaps for #1 and #3)

- There is **no** "mirror / simultaneous" concept anywhere — the two outputs are fully
  independent by design (separate `PresentationState`, separate `state_changed`).
- `ServiceSet.items` is a **flat `Vec<SetItem>`** (`domain/set.rs:124-134`) — no grouping.
  Per L-2 we do **not** add a saved sub-section schema; selection is ad-hoc at present time.

### Screen-2 bug — leading suspects (to be confirmed by Q-A repro)

The routing/subscription path looks correct, so the most likely causes are:
1. **Capabilities/permissions:** the `presentation-2` window label may be missing from the
   Tauri capability/ACL set (verify `src-tauri/capabilities/*` + `tauri.conf.json`), so the
   second window can't run the commands/asset protocol the first one can.
2. **Monitor collision:** with only the operator + one TV reachable, `resolve_output_monitor`
   may return `None` for Two (no free non-primary monitor) and the window lands hidden
   behind / on the primary (`window.rs:300-369`).
3. **Entry path:** the only way to present Tela 2 is via `multiScreenEnabled` + the per-output
   set picker; if the user tested with multi-screen **off**, there is no Tela-2 entry point
   at all (this may be the whole "not working").

---

## Requirements (WHAT — testable, traceable)

### P1 — MVP

**MIR — Mirror / simultaneous mode** ⭐
As an operator, I want a button to make both screens show the same thing, so a single
monitor or a duplicated-feed venue is one click away.

- MIR-01: WHEN the operator toggles **Simultânea** ON THEN the system SHALL render
  Screen 2 with the **same** slide, overlay, and blackout state as Screen 1.
- MIR-02: WHILE Simultânea is ON, WHEN the operator navigates / sets an overlay / blacks
  out THEN both screens SHALL reflect it (one control, no per-screen focus).
- MIR-03: WHEN the operator toggles **Independente** (OFF) THEN each screen SHALL resume
  being controlled separately (today's behaviour), keeping whatever each was last showing.
- MIR-04: WHEN Simultânea is toggled ON with different sets loaded THEN Screen 1's set
  SHALL be the master that Screen 2 mirrors _(per Q-B assumption — confirm)_.
- _Independent test:_ enable multi-screen, load a set, toggle Simultânea → both windows
  show the same slide; advance → both advance; toggle off → they decouple.

**FIX — Screen 2 actually presents** ⭐
As an operator, I want Tela 2 to display the set I send to it, because today it does not.

- FIX-01: WHEN the operator loads a set onto Tela 2 and presses Present THEN the
  `presentation-2` window SHALL open on its target monitor and **display the set's
  slides**.
- FIX-02: WHEN the operator navigates Tela 2 THEN the `presentation-2` window SHALL
  advance slides identically to Tela 1.
- FIX-03: WHEN no second monitor is reachable THEN the system SHALL still open the window
  (visible, not hidden behind the primary) so the operator can confirm it works.
- _Independent test:_ reproduce the current failure (Q-A), then verify Tela 2 shows and
  navigates a real set on the rig.

**SEL — Ad-hoc per-screen presenting** ⭐
As an operator, I want to pick what to present to the focused screen, then switch screens
and pick something else, so each TV shows a different part of the service.

- SEL-01: WHEN the operator selects an item while Tela 1 is focused THEN **only Tela 1**
  SHALL present it (Tela 2 unchanged).
- SEL-02: WHEN the operator switches focus to Tela 2 and selects another item THEN **only
  Tela 2** SHALL present it, and Tela 1 SHALL keep showing its own item.
- SEL-03: WHEN Simultânea (MIR) is ON THEN per-screen selection SHALL be disabled/hidden
  (one control only).
- _Independent test:_ multi-screen on, Independente; send Song A to Tela 1, switch focus,
  send Song B to Tela 2 → the two windows show A and B respectively.

### P2 — Should have

**MON — Per-screen monitor assignment in Settings**
As an operator, I want to pick which physical monitor each screen uses, so placement is
reliable on the venue's display layout (esp. Wayland/multi-TV).

- MON-01: WHEN the operator opens Settings THEN the system SHALL show a monitor picker for
  **Screen 1** and a separate picker for **Screen 2**.
- MON-02: WHEN the operator sets Screen 2's monitor THEN the choice SHALL persist to
  `output2.monitor_index` and `enterPresentation("two")` SHALL open on that monitor.
- MON-03: WHEN a chosen monitor index is out of range / disconnected THEN the system SHALL
  fall back to auto-placement (existing `resolve_output_monitor` behaviour) without error.
- _Independent test:_ assign Tela 2 → monitor index 2 in Settings, Present Tela 2 → it
  opens on that monitor; persists across restart.

### P3 — Nice to have / verify

**CAM — Camera + mic independently active on each screen**
As an operator, I want camera and mic to work on either screen independently, configured
globally.

- CAM-01: WHEN the operator enables mic/camera-audio for a screen in Settings THEN that
  screen SHALL play it out its configured HDMI device, independently of the other screen.
- CAM-02: WHEN both screens have camera + mic enabled THEN both SHALL play simultaneously
  (per L-3; accept the same mic audible on both TVs).
- _Status:_ **already implemented in code** (see findings). This requirement is mostly
  **verification on Screen 1** + confirming the Settings surface meets "global config".
- _Independent test:_ in Settings, enable mic for Tela 1 and Tela 2 with different HDMI
  output devices; present the camera item on each → each TV gets the camera with mic audio.

---

## Edge cases

- WHEN Simultânea is ON and the operator hits Esc/Stop THEN **both** screens SHALL exit.
- WHEN a screen's set is empty and Present is pressed THEN the existing
  `presentation.empty_set` error SHALL apply (unchanged) — and not break the other screen.
- WHEN multi-screen is OFF THEN none of MIR/SEL/MON-Tela2 UI SHALL appear (single-screen
  workflow visually unchanged — matches the baseline gating).
- WHEN both outputs resolve to the **same** monitor (manual mis-pick) THEN the system
  SHALL still open both windows (operator can fix the assignment); document the overlap.

---

## Design

### FIX — Screen 2 capability (do first; everything else presents *through* it)

- Add the second window label to the capability set:
  `src-tauri/capabilities/default.json:5` → `"windows": ["operator", "presentation",
  "presentation-2"]`. (Tauri 2 also accepts the glob `"presentation*"`; explicit is clearer
  and avoids granting future `presentation-3` by accident.) This restores IPC commands, the
  `asset://` scheme, and event delivery to the second window — the actual bug.
- **Hardening (FIX-03):** in `enter_presentation`, when `resolve_output_monitor` returns
  `None` (no free non-primary monitor) the code currently falls through to OS placement,
  which on a single reachable display can leave `presentation-2` behind the primary. Make
  the no-monitor case still produce a **visible, focusable** window (e.g. don't
  `always_on_top` collide with output One; ensure `set_focus`). Keep the existing
  `should_pin_on_top` (single-monitor) behaviour for output One unchanged.
- **CSP note:** the `asset:`/`http:` CSP in `tauri.conf.json:24` is global (not per-window),
  so no CSP change is needed once the capability is granted.

### MIR — Mirror / simultaneous mode (command fan-out)

- **Chosen shape: fan-out (a).** While mirror is ON, operator mutations target **both**
  outputs, so each window keeps rendering its own (identical) `PresentationState`. This
  reuses every existing per-output command and keeps the windows symmetric — no special
  "follower" subscription, no Rust changes to the state model.
- **State:** add `mirrorEnabled: boolean` to the operator-side store (`stores/settings.ts`,
  persisted setting e.g. `presentation.mirror_enabled`). Only meaningful when
  `multiScreenEnabled` is on.
- **Dispatch:** introduce a small helper, e.g. `targetsForFocused(focusedOutput,
  mirrorEnabled): OutputId[]` → `mirrorEnabled ? ["one","two"] : [focusedOutput]`. Route
  operator actions (navigation next/prev/goToItem, set load, overlays, blackout, exit)
  through it. Centralize so we don't sprinkle `if mirror` across components — wrap the
  command calls used by `OperatorPresentationLayout`/`StrophesGrid`/keyboard handlers.
- **Engage semantics (MIR-01, Q-B):** toggling ON copies Screen 1's current set + position
  to Screen 2 once (load `One`'s set onto `Two`, `enterPresentation("two")`), then keeps
  them in lockstep via fan-out. Screen 1 is the master.
- **Esc/Stop (edge case):** while mirror on, `exit` fans out to both outputs.
- **Guard against loops (R-2):** fan-out happens at the **operator command layer**, not by
  re-emitting events between windows — each presentation window still only listens to its
  own output's events, so there is no feedback loop.

### SEL — Ad-hoc per-screen presenting (mostly verification + a guard)

- Per findings, presenting is **already isolated per output**: `loadSetForPresentation(setId,
  output)` and navigation commands take `output`, and `OperatorPresentationLayout` already
  drives `focusedOutput`. SEL-01/02 should already hold once FIX lands and Screen 2 is alive.
- New work is small: **SEL-03** — when `mirrorEnabled`, hide/disable the per-screen
  `OutputSwitcher` focus tabs and per-screen pickers (one control only), and verify item
  selection on the focused screen leaves the other untouched (add a regression test).

### MON — Per-screen monitor picker in Settings

- Generalize `MonitorPicker` to accept props `{ settingKey, label }` (or an `output`),
  defaulting to `PRESENTATION_MONITOR_KEY` for back-compat. Render **two** instances in
  `SettingsScreen` when `multiScreenEnabled`: Screen 1 → `PRESENTATION_MONITOR_KEY`, Screen
  2 → `OUTPUT2_MONITOR_KEY`. Backend already consumes both keys (`commands.ts:62-79`,
  `window.rs`), so this is UI-only. MON-03 (out-of-range fallback) is already handled by
  `resolve_output_monitor`.

### CAM — Camera + mic on both screens (verification)

- No new infrastructure: settings, renderer, and hook are already per-output (findings).
  Work is (1) a manual rig check that Screen 1 plays mic + camera audio out its configured
  HDMI device, and (2) confirm the global Settings surface (`MicAudioSettings`, shown under
  `multiScreenEnabled`) satisfies "configured in global settings" — add labels/help if the
  per-screen intent isn't obvious. Tweak only if verification surfaces a gap.

---

## Files touched (anticipated)

| Area              | File(s)                                                                 | Change                                                                 |
| ----------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Mirror flag/store | `src/stores/settings.ts` (or presentation store)                         | add `mirrorEnabled` + persistence                                     |
| Mirror UI         | `src/components/presentation/OutputSwitcher.tsx` or new toggle           | Simultânea/Independente switch in operator                            |
| Mirror dispatch   | `src/components/presentation/*`, `src/api/commands.ts`                    | fan-out mutations to both outputs while mirror on                     |
| Screen-2 fix      | `src-tauri/capabilities/*`, `src-tauri/tauri.conf.json`, `commands/window.rs` | ensure `presentation-2` capability + visible-window fallback         |
| Monitor picker    | `src/components/settings/MonitorPicker.tsx`, `SettingsScreen.tsx`         | per-output picker → `OUTPUT2_MONITOR_KEY`                             |
| Ad-hoc select     | `OperatorPresentationLayout.tsx`, `SetItemList.tsx`                       | present item to focused screen (likely already isolated; verify)     |
| Camera/mic verify | `MicAudioSettings.tsx`, `WebViewRenderer.tsx`, `PresentationApp.tsx`      | verification; minor discoverability tweaks if needed                  |

---

## Tests

- Rust: extend `window.rs` tests for the "no free monitor ⇒ still open a visible window"
  rule (FIX-03); keep `resolve_output_monitor` coverage.
- Vitest: mirror fan-out (MIR-01/02 — mutating while mirror on hits both outputs); per-output
  selection isolation (SEL-01/02); `MonitorPicker` writes `OUTPUT2_MONITOR_KEY` (MON-02);
  Simultânea hides per-screen selection (SEL-03).
- Manual (rig, needs hardware): FIX-01/02 on a real second monitor; CAM-01/02 mic audible
  out each HDMI; MON-01/02 placement per assignment.

## Risks / notes

- **R-1 (resolved):** Screen-2 root cause confirmed — missing `presentation-2` capability
  (`capabilities/default.json:5`). Fix is a one-line config change + a visible-window
  hardening pass. Low risk, no repro needed.
- **R-2:** Mirror fan-out doubles per-output traffic; ensure no event feedback loop when
  both windows listen to all events (CLAUDE.md invariant).
- **R-3:** Most of #2 and #4 already exist — avoid rebuilding. The honest scope is mirror
  (#1), the Screen-2 fix (#3b), small selection/monitor UI, and verification.
- **R-4:** `state.presentation.write().await` must be dropped before `app.emit()`
  (deadlock invariant) — applies to any new mirror dispatch on the Rust side.

## Suggested commit slices

1. **FIX**: reproduce + root-cause Screen-2; make it present reliably (+ visible-window
   fallback, capability entry). Gate before building more on top.
2. **MON**: per-screen monitor picker in Settings → `OUTPUT2_MONITOR_KEY`.
3. **MIR**: mirror flag + Simultânea/Independente toggle + mutation fan-out + Esc/Stop both.
4. **SEL**: confirm/finish ad-hoc per-screen item presenting; disable under mirror.
5. **CAM**: verify camera + mic on Screen 1; discoverability tweaks only if needed.

---

## Rig verification checklist (hardware-gated — T1.4, T5.1)

All code slices (1–4) are implemented and green; camera/mic (Slice 5) was already
per-output in code (`MicAudioSettings` exposes Tela 1 + Tela 2). What is left can only be
confirmed on the real 3-display rig (operator + TV-1 + TV-2, each TV on its own HDMI).
Run with **multi-screen enabled** in Settings.

**Setup**
- [ ] Settings → enable "Segunda tela (multi-saída)".
- [ ] Settings → Janelas: set **Monitor da Tela 1** and **Monitor da Tela 2** to the two TVs.

**FIX — Screen 2 presents (T1.4 / FIX-01,02,03)**
- [ ] Focus Tela 2, pick a set, Present → `presentation-2` opens **on TV-2** and shows slides
      (not black — this is the capability fix).
- [ ] Navigate Tela 2 (click slides / arrows) → TV-2 advances; Tela 1 unaffected.
- [ ] Single-display fallback: with only one external display, Present Tela 2 → a **visible,
      focusable window** appears (does not fullscreen-cover the operator).

**SEL — Independent content per screen (SEL-01/02)**
- [ ] Independente mode: send Song A to Tela 1, switch focus to Tela 2, send Song B → TV-1
      shows A, TV-2 shows B, each navigates separately.

**MIR — Simultânea / mirror (MIR-01..04)**
- [ ] Toggle **Simultânea** ON → TV-2 immediately matches TV-1 (same slide); Tela tabs hide.
- [ ] Navigate / blackout / overlay (Oferta/Aviso) → **both** TVs change together.
- [ ] Esc / Stop → **both** screens exit.
- [ ] Toggle OFF → screens decouple, each keeps its last frame.

**MON — Monitor assignment (MON-01,02,03)**
- [ ] Change Tela 2's monitor in Settings → next Present opens TV-2 on the chosen monitor;
      persists across app restart.
- [ ] Pick an out-of-range / unplugged monitor → falls back to auto-placement, no error.

**CAM — Camera + mic on both (CAM-01,02)**
- [ ] Settings → Áudio: enable mic for Tela 1 and Tela 2 with **different HDMI output
      devices**; click Grant once if device labels are blank.
- [ ] Present the camera (WebView/RTSP item) on each screen → each TV plays the camera with
      mic audio out **its** HDMI; both can play at once. Dial `micDelayMs` to lip-sync.
- [ ] (Windows) confirm **no microphone permission prompt** appears (auto-grant, C2).

Record pass/fail in this section and flip the status line to "verified" when done. If CAM
surfaces a discoverability gap, that is the trigger for the optional T5.2 labels/help tweak.
