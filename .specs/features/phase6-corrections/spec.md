# Phase 6 — Corrections (Theme polish, PowerPoint-style presentation, Countdown finish-at)

**Created:** 2026-05-21
**Status:** Specifying
**Scope:** Large — touches Rust backend (window mgmt, countdown), React frontend (theme tokens, operator UI rework), removes stage subsystem

---

## Problem Statement

After Phase 4 + Phase 5 field use the user surfaced six concrete defects and reshapes that need correction:

1. **Light theme is still partial.** Despite the P4H-03 sweep, large textboxes (song-edit observations, countdown observation, every NotesField) still render with dark backgrounds in light mode, and several operator panels keep dark backgrounds.
2. **Dark theme has a contrast bug.** Some text is rendered black on a near-black surface, making it unreadable.
3. **Presentation does not behave like PowerPoint.** The current model opens a separate window the user must orchestrate. The user wants a single "Enter Presentation Mode" gesture that auto-targets the secondary monitor when extended, or the same display when single-monitor — exactly how PowerPoint Slide Show behaves.
4. **Operator has no in-app slide navigator while presenting.** During presentation the operator needs a scrollable list of every verse/slide in sequence, clickable to jump in real-time. ESC must exit presentation (PowerPoint parity); F10 must trigger blackout.
5. **The Stage window is dead weight.** Originally shipped in Phase 3, the user has confirmed it is not used. Remove it (window, commands, UI, tests, settings rows).
6. **The dedicated "Open Presentation Window" button is dead UI.** When the operator triggers presentation mode, the app should just present — no separate manual window-open affordance.
7. **The Countdown can only count down a duration.** The user needs an alternative mode: "finish at HH:MM" (wall-clock target), so they can say "stop at 09:30" instead of computing "13 minutes from now".

---

## Goals

- [ ] Light and dark themes are 100% complete — no hardcoded `bg-gray-*` / `text-white` / `bg-blue-*` in any operator component; every surface, including all `<textarea>`s and notes panels, uses semantic tokens
- [ ] Dark theme text is always legible — no near-black text on near-black surface anywhere
- [ ] Single "Apresentar" action transitions the app into a PowerPoint-style presentation mode: fullscreen on secondary monitor if extended, fullscreen on the only monitor otherwise — no manual window button
- [ ] During presentation the operator sees a scrollable list of all slides for the current item, can click any slide to jump to it, and the projection updates in real-time
- [ ] ESC exits presentation (returns operator to home, closes projection); F10 toggles blackout
- [ ] Stage window and all its plumbing are removed
- [ ] Countdown editor offers a "Finish at" mode in addition to "Duration"; ticker honors it identically (drift-free wall-clock target)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Presenter-view animations / slide thumbnails as images | The in-app navigator shows text only (slide preview text); image thumbnails are deferred |
| New theme tokens or palette changes | Phase 4 palette stands; this is a sweep + bugfix, not a redesign |
| Per-section blackout vs full blackout | F10 toggles full blackout (existing B-key behavior); no scoped variants |
| Countdown auto-detection of next service time | Operator types HH:MM manually; no integration with church scheduling |
| Migrating Stage notes to operator panel | OperatorNotesPanel already exists and is sufficient |
| Rebinding ESC / F10 in shortcuts settings | Hardcoded for PowerPoint parity; no user customization |

---

## User Stories

### P6-01: Light theme — notes/textbox surfaces ⭐ MVP

**User Story:** As an operator in light theme, I want every text-input area (song observation notes, countdown observation, set-item notes, section notes) to use a light surface with dark text, matching the rest of the light theme.

**Why P6-01:** Visible regression: NotesField renders `bg-gray-700` hardcoded, so every notes textarea is a dark island in an otherwise light UI. Same pattern repeats in SongEditor's observation field and the countdown editor.

**Acceptance Criteria:**

1. WHEN the operator opens the song editor in light theme THEN the observation textarea SHALL render with a light surface and dark text
2. WHEN the operator opens any countdown editor's message field in light theme THEN the textarea SHALL render with a light surface
3. WHEN the operator opens the section notes editor OR the set-item notes editor in light theme THEN the textarea SHALL render with a light surface
4. WHEN the operator opens the OperatorNotesPanel in light theme THEN background and text SHALL match the surrounding panel (light)
5. WHEN the theme toggles between light and dark THEN no textarea SHALL retain stale theme colors after the next render

**Implementation notes:**
- `src/components/common/NotesField.tsx` — replace `bg-gray-700 border-gray-600 focus:border-blue-500` with semantic tokens (`bg-surface-2 border-border focus:border-primary text-fg`)
- Sweep all `<textarea>` and `<input>` elements in: `SongEditor.tsx`, `SectionCard.tsx`, `CountdownSetItemEditor.tsx`, `BlankItemNotesEditor.tsx`, `MediaSetItemEditor.tsx`, `WebViewSetItemEditor.tsx`, `SlideshowSetItemEditor.tsx`, `HomeSetBuilder.tsx` (announcement dialog)
- Verify token coverage of `text-fg` (foreground) exists; if missing add to the Tailwind v4 theme block

**Independent Test:** Switch to light theme, open every editor that has a text/notes field — every textarea is light with dark text.

---

### P6-02: Light theme — remaining operator surfaces ⭐ MVP

**User Story:** As an operator in light theme, I want the operator chrome (panels, side bars, list backgrounds) to be fully light — no dark sections leaking through.

**Why P6-02:** Specific user-reported pain points: operator screen backgrounds and panel surfaces still render dark in light mode.

**Acceptance Criteria:**

1. WHEN the operator views the home screen (HomeSetBuilder) in light theme THEN both the set list panel AND the song sidebar SHALL render with light surfaces
2. WHEN the operator views the SlideController in light theme THEN the slide buttons, blank-state indicator, and surrounding chrome SHALL render with light surfaces
3. WHEN the operator views the CountdownPanel in light theme THEN all panels SHALL render with light surfaces
4. WHEN the operator views any settings sub-screen (KeyBindings, Backup, Updates, Language) in light theme THEN no panel SHALL render dark
5. WHEN the operator views the MediaLibrary, MediaDetailPanel, MediaCard in light theme THEN no panel SHALL render dark

**Scope of files to sweep for hardcoded `bg-gray-{700,800,900}`, `border-gray-{600,700}`, `text-white`, `bg-blue-{500,600}`:**
- `HomeSetBuilder.tsx`, `SetBuilder.tsx`
- `SlideController.tsx`, `OperatorNotesPanel.tsx`
- `CountdownPanel.tsx`, all `*SetItemEditor.tsx`
- `MediaLibrary.tsx`, `MediaCard.tsx`, `MediaDetailPanel.tsx`, `MediaUploadDropzone.tsx`
- `KeyBindingsScreen.tsx`, `BackupScreen.tsx`, `RestoreInProgressDialog.tsx`, `LanguagePicker.tsx`
- `SongList.tsx`, `SongListItem.tsx`, `SongEditor.tsx`, `SectionCard.tsx`
- `UpdateBanner.tsx`, `UpdateDialog.tsx`, `UpdateCheckButton.tsx`
- `HolyricsImport.tsx`, `PlainTextImport.tsx`, `ImportWizardFrame.tsx`
- `LibreOfficeBanner.tsx`, `MediaPicker.tsx`, `ConfirmDialog.tsx`, `Toggle.tsx`, `Keycap.tsx`

**Implementation notes:**
- Continue Phase 4 sweep using the same semantic tokens already defined in `index.css`
- Run `scripts/check-theme-tokens.ps1` (existing helper) and grow the deny-list until it greps clean
- Presentation/projection components are exempt (always black bg)

**Independent Test:** Switch to light theme, navigate every operator tab and dialog — zero dark panels in screenshots.

---

### P6-03: Dark theme — text contrast fix ⭐ MVP

**User Story:** As an operator in dark theme, I want every text element to be readable — no near-black text rendered on a near-black background.

**Why P6-03:** User reports: "the black text color is hard to see because the text background is also very dark". This is a contrast failure — likely from components that hardcode `text-black` / `text-gray-900` while the surface follows the semantic token to a dark surface.

**Acceptance Criteria:**

1. WHEN in dark theme THEN no text element SHALL be rendered in `text-black`, `text-gray-900`, `text-gray-800` on a dark surface
2. WHEN in dark theme THEN body text SHALL render at WCAG AA contrast minimum (4.5:1) against its surface
3. WHEN in dark theme THEN placeholder text in inputs SHALL be at least the muted-fg token (≈ `#888888`), not near-black
4. WHEN in dark theme THEN inputs/selects render with foreground in `--color-fg` (light in dark mode) and background in `--color-surface-2`

**Implementation notes:**
- Add `--color-fg` token if missing: `#111111` (light), `#EAEAEA` (dark)
- Grep for `text-black`, `text-gray-900`, `text-gray-800` across `src/components/**` and `src/windows/operator/**`; replace each with `text-fg` (or `text-muted` as appropriate)
- Audit `<input>` and `<select>` elements — Tailwind defaults to OS-styled inputs which inherit black text; add explicit `text-fg bg-surface-2`
- Native `<input type="time">`, `<input type="number">`: verify browser dark-mode rendering or wrap with explicit styling

**Independent Test:** Switch to dark theme, open every screen, sample a screenshot — every text element legible (no near-black on near-black).

---

### P6-04: PowerPoint-style presentation mode (replaces P4H-01) ⭐ MVP

**User Story:** As an operator, I want a single "Apresentar" gesture to put the app into presentation mode — fullscreen on the projector if two extended displays exist, or fullscreen on the only display if single-monitor — exactly like PowerPoint's F5 / Slide Show.

**Why P6-04:** The current model treats the presentation window as a separate, manually-opened entity. The user wants a mode, not a window. P4H-01 partially achieved this (auto-secondary-monitor), but the user clarified the desired behavior is broader: it's a state transition, not a window opening, and the single-monitor case must also fullscreen (current single-monitor falls back to a 1280×720 windowed view).

**Acceptance Criteria:**

1. WHEN the operator clicks "Apresentar" OR presses the configured "Start Presentation" key AND there are 2+ monitors THEN the presentation window SHALL open fullscreen on the non-primary monitor (existing P4H-01 behavior)
2. WHEN the operator clicks "Apresentar" AND there is only 1 monitor THEN the presentation window SHALL open fullscreen on that monitor (not 1280×720 windowed) — operator interacts via the slide navigator (see P6-05)
3. WHEN the presentation window is already open AND the operator clicks "Apresentar" again THEN it SHALL be a no-op (focus the existing window)
4. WHEN the operator is in presentation mode THEN the operator window's main view SHALL switch to the in-app presentation navigator (P6-05) — automatically, without an explicit "switch tab" click
5. WHEN the operator presses ESC anywhere (operator window OR presentation window) THEN presentation SHALL exit: close the presentation window, return operator view to home (PowerPoint parity)
6. WHEN presentation exits THEN any active overlay (announcement/quick media/camera) SHALL also be cleared
7. WHEN there is no current set item OR the set is empty AND "Apresentar" is clicked THEN a non-blocking warning toast SHALL appear ("Adicione itens ao conjunto antes de apresentar") AND no window SHALL open

**Implementation notes:**
- `open_presentation_window` Rust command: change single-monitor branch to also use `.fullscreen(true)` (drop the 1280×720 fallback)
- ESC handler in PresentationApp already calls clearOverlay + idle; extend it to invoke a new `exit_presentation()` command that closes the presentation window AND broadcasts a `presentation_exited` event
- Operator window listens to `presentation_exited` event: routes view back to `"home"`
- The single "Apresentar" button stays where it is in the operator chrome; the manual "Open Presentation Window" button (currently in OperatorApp toolbar) is removed (P6-07)

**Independent Test:** Single monitor: click Apresentar → projection covers the full screen, operator view switches to navigator. Two monitors: click Apresentar → projection on secondary, operator on primary. Press ESC anywhere → both return to normal.

---

### P6-05: In-app slide navigator during presentation ⭐ MVP

**User Story:** As an operator presenting a song, I want the operator window to show a scrollable list of all the song's slides in order, with the current slide highlighted, so I can click any slide to jump to it instantly while presenting.

**Why P6-05:** Currently `SlideController` renders fixed-position arrow/prev/next buttons but the operator has no quick way to jump to "verse 3" mid-song. PowerPoint-style "all slides visible, click to jump" is the canonical workflow.

**Acceptance Criteria:**

1. WHEN presentation mode is active THEN the operator window's main view SHALL render a presentation navigator panel as the primary content (replacing the home set builder for the duration of presentation)
2. WHEN the current set item is a Song THEN the navigator SHALL render every slide of that song in vertical sequence, each with its lyrics text visible
3. WHEN the current set item is a Countdown / Media / WebView / SlideShow THEN the navigator SHALL render a single card for that item with the item title and "Jump to" affordance (or, for SlideShow, one card per slide)
4. WHEN the operator clicks any slide card in the navigator THEN the projection SHALL advance to that slide in real-time (under 200ms perceived latency) AND the navigator SHALL re-highlight
5. WHEN the projection's slide changes (via prev/next keys, click anywhere, or remote control) THEN the navigator's highlight SHALL update AND auto-scroll into view
6. WHEN the operator advances past the last slide of the current item THEN the navigator SHALL render the NEXT item's slides as a follow-on section (so the operator can see ahead in the set)
7. WHEN the panel content overflows THEN a vertical scrollbar SHALL appear and the current slide SHALL remain visible (auto-scroll on change)
8. WHEN presentation exits THEN the operator window SHALL return to home view (the navigator is mode-scoped, not persistent)

**Implementation notes:**
- New component: `src/components/presentation/PresentationNavigator.tsx`
- Data source: existing `presentationState` from Zustand store (already has `slides` and `currentIndex` for the current item); extend backend if needed to also expose upcoming items' slides
- Click handler: invoke existing `goto_slide(index)` Tauri command (or add one if not present — current `next_slide` / `prev_slide` are step-only; check `commands/presentation.rs`)
- Highlight current slide with `bg-primary/20` ring; surface uses `bg-surface`
- Auto-scroll: `useEffect` on currentIndex change → `ref.scrollIntoView({ block: "nearest" })`
- Slide cards show truncated lyric text (clamp to 4 lines, ellipsis); item title appears as a sticky group header

**Independent Test:** Start presentation with a multi-section song. Navigator shows all slides. Click "Verse 2" — projection jumps to verse 2 immediately and navigator updates.

---

### P6-06: Keyboard — ESC exits presentation, F10 toggles blackout ⭐ MVP

**User Story:** As an operator, I want ESC to exit presentation mode (PowerPoint parity) and F10 to instantly toggle a black projection screen.

**Why P6-06:** Existing bindings: ESC currently clears overlay then sets idle; B toggles blackout. The user wants ESC to fully exit (close projection window, return to home) and F10 as a hardware-friendly blackout toggle (some operators prefer F10's prominence on the keyboard).

**Acceptance Criteria:**

1. WHEN presentation mode is active AND the operator presses ESC (in either window) THEN presentation SHALL exit (P6-04 acceptance criterion 5)
2. WHEN presentation mode is NOT active AND the operator presses ESC THEN existing behavior SHALL apply (close modal/dialog if any, else no-op)
3. WHEN presentation mode is active AND the operator presses F10 THEN blackout SHALL toggle (same effect as the existing B-key)
4. WHEN F10 is pressed in the operator window OR the presentation window THEN the effect SHALL be identical
5. WHEN blackout is active AND F10 is pressed THEN blackout SHALL turn off; the previous slide content SHALL re-appear
6. F10 and ESC bindings SHALL NOT be reassignable in the key-bindings settings UI (PowerPoint parity is hardcoded)

**Implementation notes:**
- `src/runtime/keyboard.ts` — add ESC handler scoped to "is presenting"; add F10 → `set_blank(!current)` dispatch
- Hide ESC and F10 rows from `KeyBindingsScreen.tsx` (or render them as read-only with an info tooltip)
- The existing `B` binding stays as a user-configurable alias for blackout (don't remove)

**Independent Test:** Start presentation. F10 → projection goes black. F10 → restores. ESC → presentation exits, operator back at home.

---

### P6-07: Remove "Open Presentation Window" button ⭐ MVP

**User Story:** As an operator, I want a single way to enter presentation — clicking "Apresentar" — without a redundant "Open Presentation Window" button cluttering the toolbar.

**Why P6-07:** The dedicated window-open button exists from earlier phases when window management was manual. With P6-04's mode-based behavior it is dead UI.

**Acceptance Criteria:**

1. WHEN the operator views the operator chrome THEN there SHALL be no button labeled "Open Presentation Window" / "Janela de Apresentação"
2. WHEN the operator clicks "Apresentar" THEN the presentation window SHALL be opened (existing behavior preserved)
3. WHEN settings is opened THEN no row SHALL reference manual presentation-window opening

**Implementation notes:**
- Remove the button from `OperatorApp.tsx` (or wherever it currently lives — likely top-right toolbar)
- Search for `openPresentationWindow()` call sites — the only remaining caller should be the unified "Apresentar" code path; remove others
- Drop related i18n keys ("operator.openPresentationWindow", etc.) from `pt-BR.json` / `en-US.json`

**Independent Test:** Visual scan of every screen — no separate "Open Presentation Window" affordance exists.

---

### P6-08: Remove Stage window subsystem ⭐ MVP

**User Story:** As a maintainer, I want to remove the stage window code, settings, and UI because the user has confirmed it is not used — it adds maintenance burden with zero usage.

**Why P6-08:** Phase 3 shipped a stage window (label `"stage"`). After 8 weeks of field use the user reports it is not part of the workflow. Removing now prevents future regressions from carrying it forward.

**Acceptance Criteria:**

1. WHEN the operator opens settings THEN there SHALL be no Stage-related row, button, or section
2. WHEN the app runs THEN no `"stage"` window SHALL ever be created
3. WHEN the codebase is searched THEN no reference to `StageApp`, `StageRenderer`, `StagePreview`, `StageNotesPanel`, `StageBlankIndicator`, `open_stage_window`, `close_stage_window`, `stage` window label SHALL remain
4. WHEN section notes are saved THEN they SHALL still be available in the OperatorNotesPanel (notes data stays; only the stage display goes)
5. WHEN existing tests run THEN any test depending on stage subsystem SHALL be either deleted or rewritten to not require it

**Files/areas to remove:**
- Rust: `src-tauri/src/commands/stage.rs` (if exists), `open_stage_window` / `close_stage_window` registrations in `lib.rs`, any stage-related state fields
- Frontend: `src/windows/stage/` directory (StageApp, StageApp.test.tsx)
- Frontend: `src/components/stage/` directory (StageRenderer, StageNotesPanel, StagePreview, StageBlankIndicator)
- Frontend: `WindowsScreen.tsx` — drop the stage-monitor row (note: WindowsScreen may already be near-empty; if so delete the file and its route)
- Operator: `OperatorApp.tsx` — drop `openStageWindow` import, `stageMonitorIdx` state, and any "Abrir Stage" button
- i18n: drop all `stage.*` translation keys from `en-US.json` and `pt-BR.json`
- HTML: drop `stage.html` from project root and from `tauri.conf.json` windows config (if declared)
- Tests: delete `StageApp.test.tsx`; update operator smoke test if it asserts stage button presence

**Implementation notes:**
- Section notes persist (per-section column); only the stage view is removed
- OperatorNotesPanel continues to render section notes inline in operator chrome
- Migration: not needed (no schema removed; columns stay)
- The decision needs to be logged in STATE.md (D-15 superseded)

**Independent Test:** `Get-ChildItem -Recurse | Select-String -Pattern "stage|StageApp"` returns zero hits in `src/` and `src-tauri/`. App builds and runs. Section notes still visible in OperatorNotesPanel.

---

### P6-09: Countdown — finish-at wall-clock mode ⭐ MVP

**User Story:** As an operator, I want a countdown set item to be configurable as "finish at HH:MM" instead of "duration N minutes", so I can say "the service starts at 09:30" instead of computing the duration manually.

**Why P6-09:** Operators always think in terms of "by when" not "how long". Forcing a duration arithmetic on every service is unnecessary friction.

**Acceptance Criteria:**

1. WHEN the operator opens the countdown set-item editor THEN they SHALL see a mode toggle: "Duração" / "Horário fixo"
2. WHEN "Duração" is selected THEN the existing duration input (mm:ss) SHALL be shown (no change)
3. WHEN "Horário fixo" is selected THEN a time input (HH:MM) SHALL be shown (no date — assumes today)
4. WHEN the countdown is started AND mode is "Horário fixo" AND the target time has not yet passed today THEN the ticker SHALL count down to today's HH:MM
5. WHEN the countdown is started AND mode is "Horário fixo" AND the target time has already passed today THEN the ticker SHALL count down to tomorrow's HH:MM (assume next-day rollover)
6. WHEN mode is "Horário fixo" AND the ticker reaches zero THEN the existing `end_behavior` (HoldZero / Blackout / AdvanceSet) SHALL apply identically
7. WHEN the countdown is paused AND resumed in "Horário fixo" mode THEN the remaining time SHALL be recomputed from current wall-clock to target (drift-free)
8. WHEN the saved set is reloaded across app restarts THEN the mode and target time SHALL persist
9. WHEN the operator switches mode in the editor THEN the previously-entered value SHALL be preserved per-mode (switching duration → fixed → back to duration restores the duration)

**Implementation notes:**
- Domain (`src-tauri/src/domain/countdown.rs`): extend `CountdownConfig` with a new variant or field:
  ```rust
  pub enum CountdownTarget {
      Duration { duration_ms: u64 },
      FixedTime { hour: u8, minute: u8 },  // 0..23, 0..59 — assumes local tz today
  }

  pub struct CountdownConfig {
      pub target: CountdownTarget,
      pub message: Option<String>,
      pub end_behavior: CountdownEndBehavior,
      pub background_media_id: Option<String>,
  }
  ```
- Migration: add a new column or store the new shape inside the existing `slide_config` JSON blob (project uses JSON for set-item config — see how slides are persisted). Backward-compat: serde alias for the old `duration_ms` field at the root maps to `target: { Duration }`.
- Ticker service (`src-tauri/src/services/countdown.rs` or wherever the Tokio ticker lives): on Start, resolve `CountdownTarget` → an absolute `target_epoch_ms` (today if future; tomorrow if past); ticker stays drift-free (already wall-clock target based — D-7)
- Frontend `CountdownSetItemEditor.tsx`: add mode toggle + time `<input type="time">` field; serialize via the new shape
- TS types: extend `CountdownConfig` discriminated union to match the new Rust shape
- i18n: add `countdown.mode.duration`, `countdown.mode.fixedTime`, `countdown.fixedTime.input.label`

**Independent Test:** Set countdown to "Horário fixo 23:59"; start it; verify ticker counts down to 23:59 today. Set it to "00:01" while wall-clock is 23:50; start it; verify ticker counts down to 00:01 tomorrow.

---

## Edge Cases

- WHEN the operator clicks "Apresentar" with zero set items THEN system SHALL show a toast "Adicione itens ao conjunto" AND not open the projection window (P6-04 AC 7)
- WHEN the operator presses F10 outside presentation mode THEN system SHALL be a no-op (F10 is scoped to presentation)
- WHEN the operator presses ESC while a modal dialog is open during presentation THEN system SHALL close the dialog first; a second ESC press exits presentation
- WHEN the navigator is open AND the current item changes (operator advances past last slide of song) THEN navigator SHALL re-render with the new item's slides AND scroll to top
- WHEN the navigator's slide list is very long (e.g. 60-slide hymn) THEN scrolling SHALL be smooth AND auto-scroll-to-current SHALL not stutter
- WHEN dark-theme native `<input>` controls (especially `<input type="time">`) render black system text on dark background THEN system SHALL apply explicit `color-scheme: dark` CSS to those inputs (browser hint for dark form controls)
- WHEN the user upgrades from a Phase 5 install with stage-monitor configured THEN system SHALL silently drop the stale settings row (no migration error)
- WHEN the countdown is in "Horário fixo" mode AND the system clock changes (e.g. DST) mid-countdown THEN system SHALL recompute remaining_ms on the next tick (already drift-free per D-7)

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
|---------------|-------|----------|--------|
| P6-01 | Light theme — notes/textbox surfaces | P1 | Pending |
| P6-02 | Light theme — remaining operator surfaces | P1 | Pending |
| P6-03 | Dark theme — text contrast fix | P1 | Pending |
| P6-04 | PowerPoint-style presentation mode | P1 | Pending |
| P6-05 | In-app slide navigator | P1 | Pending |
| P6-06 | Keyboard — ESC exits, F10 blackout | P1 | Pending |
| P6-07 | Remove "Open Presentation Window" button | P1 | Pending |
| P6-08 | Remove Stage window subsystem | P1 | Pending |
| P6-09 | Countdown — finish-at wall-clock mode | P1 | Pending |

**Coverage:** 9 requirements, all P1. All are necessary corrections from field use — none are nice-to-haves.

---

## Success Criteria

- [ ] `Get-Content src/components/**/*.tsx | Select-String "bg-gray-(700|800|900)|text-white|bg-blue-(500|600)"` returns zero hits outside presentation/projection components
- [ ] WCAG AA contrast (4.5:1) verified for body text in both themes via manual spot check on 5 random screens
- [ ] Single monitor: "Apresentar" → fullscreen on the only display; operator window shows navigator; ESC exits
- [ ] Two monitors: "Apresentar" → fullscreen on secondary; operator window shows navigator on primary; ESC exits
- [ ] Navigator click-to-jump latency < 200ms (perceived)
- [ ] F10 toggles blackout in both windows
- [ ] `Get-ChildItem -Recurse src,src-tauri/src | Select-String "stage|StageApp|open_stage"` returns zero hits in code (not counting decision logs)
- [ ] Countdown "Horário fixo 09:30" counts down to today 09:30 if before, tomorrow 09:30 if after
- [ ] All existing Rust tests (124) and Vitest tests (96) remain green after removals + additions; new tests cover the new countdown variant and the navigator
- [ ] `tsc --noEmit` clean
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` clean

---

## Implementation Order (suggested)

1. **P6-08** (remove stage) — net-negative work; smaller surface afterwards for everything else
2. **P6-07** (remove redundant button) — trivial, paves the path for P6-04
3. **P6-04** (PowerPoint-style mode) — backend `open_presentation_window` change + operator state machine
4. **P6-05** (navigator) — depends on P6-04's mode signal
5. **P6-06** (ESC/F10) — depends on P6-04 (exit behavior) and P6-05 (visible navigator)
6. **P6-01 + P6-02** (light theme sweep) — large but mechanical; can happen in parallel
7. **P6-03** (dark contrast) — quick once tokens established
8. **P6-09** (countdown finish-at) — independent feature; can ship last
