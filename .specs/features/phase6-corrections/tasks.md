# Phase 6 — Corrections — Tasks

**Spec:** `.specs/features/phase6-corrections/spec.md`
**Design:** `.specs/features/phase6-corrections/design.md`
**Status:** Draft
**Created:** 2026-05-21

---

## Execution Plan

### Phase 1 — Independent foundations (parallel)

```
T1  [P]  Remove Stage subsystem (P6-08)
T10 [P]  CountdownTarget enum + start_countdown resolution (P6-09 backend)
```

### Phase 2 — Operator chrome cleanup (after T1)

```
T1  → T2   Remove "Open Presentation Window" button (P6-07)
T10 → T11  CountdownSetItemEditor mode toggle (P6-09 frontend)
```

### Phase 3 — Presentation mode backend (after T2)

```
T2 → T3  enter_presentation + exit_presentation + lifecycle event + PresentationState.allSlidesPerItem (P6-04 backend)
```

### Phase 4 — Presentation UI (after T3, parallel)

```
T3 → T4 [P]  OperatorApp routing + Apresentar in HomeSetBuilder + empty-set toast (P6-04 frontend)
T3 → T5 [P]  PresentationNavigator component (P6-05)
```

### Phase 5 — Keyboard handlers (after T4 + T5)

```
T4, T5 → T6  ESC exits + F10 toggles blackout + KeyBindingsScreen read-only rows (P6-06)
```

### Phase 6 — Theme polish (after T6)

```
T6 → T7   NotesField + textbox sweep + add --color-fg token (P6-01)
T7 → T8 [P]  Operator surfaces sweep + extend check-theme-tokens.ps1 (P6-02)
T7 → T9 [P]  Dark theme contrast fix (P6-03)
```

### Phase 7 — Gate

```
T8, T9, T11 → T12  Full gate + STATE/ROADMAP update
```

---

## Task Breakdown

### T1: Remove Stage subsystem [P]

**What:** Delete all Stage-related code (Rust + frontend + i18n + HTML + tests + settings rows). Pure removal.

**Where:**
- Delete `src/windows/stage/` (directory: `StageApp.tsx`, `StageApp.test.tsx`)
- Delete `src/components/stage/` (`StageRenderer.tsx`, `StageRenderer.test.tsx`, `StageNotesPanel.tsx`, `StagePreview.tsx`, `StageBlankIndicator.tsx`, `StageClock.tsx`)
- Delete `stage.html` (project root) — also drop from `tauri.conf.json` `windows` array if declared
- Modify `src-tauri/src/commands/window.rs` — remove `open_stage_window` / `close_stage_window` if present; remove any `stage` window label references
- Modify `src-tauri/src/lib.rs` — remove stage command registrations from `invoke_handler![]`
- Modify `src/windows/operator/OperatorApp.tsx` — drop `openStageWindow` import, `stageMonitorIdx` state, `loadPersistedMonitor("window.stage.monitor")`, the "Abrir Stage" button, and the stage-monitor row
- Modify `src/components/settings/SettingsScreen.tsx` — drop the stage-monitor settings row / WindowsScreen reference
- If `WindowsScreen.tsx` becomes empty after this, delete it + its route
- Modify `src/api/commands.ts` — drop `openStageWindow` wrapper
- Modify `src/i18n/locales/en-US.json` AND `src/i18n/locales/pt-BR.json` — drop all `stage.*` keys (and `operator.openStage*` if present)
- Modify `src-tauri/tests/presentation.rs` — drop any test that asserts stage behavior
- Update `src/windows/operator/OperatorApp.smoke.test.tsx` (or equivalent) — drop the stage-button assertion

**Depends on:** None

**Reuses:** None — destructive change. `OperatorNotesPanel` already exists and replaces stage display for notes.

**Tools:** NONE

**Done when:**
- [ ] `Grep -r "StageApp|StageRenderer|StagePreview|StageNotesPanel|StageBlankIndicator|StageClock"` in `src/` returns 0 hits
- [ ] `Grep -r "open_stage_window|close_stage_window|window.*\"stage\""` in `src-tauri/src/` returns 0 hits
- [ ] `Grep -r "openStageWindow|stageMonitorIdx"` in `src/` returns 0 hits
- [ ] `Grep -r "\"stage\\.\""` in `src/i18n/locales/` returns 0 hits
- [ ] `cargo build --manifest-path src-tauri/Cargo.toml` succeeds (no broken refs)
- [ ] `tsc --noEmit` clean
- [ ] Gate: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run` green (expect Vitest count to drop by the deleted stage tests)

**Tests:** none (destructive — existing stage tests deleted; smoke test updated to not reference stage)
**Gate:** full
**Commit:** `chore(stage): P6-08 — remove Stage window subsystem`

---

### T2: Remove "Open Presentation Window" button (P6-07)

**What:** Remove the manual presentation-window-open button from operator chrome and prune its i18n keys and ActionId binding entry.

**Where:**
- `src/windows/operator/OperatorApp.tsx` — remove the toolbar button labeled "Janela de Apresentação" / "Open Presentation Window"; keep the `openPresentationWindow` ActionId callback only if still called from key bindings (it will be repurposed in T3)
- `src/i18n/locales/pt-BR.json` AND `src/i18n/locales/en-US.json` — drop `operator.openPresentationWindow` (and any related `settings.window.manual*` keys)
- `src/components/settings/KeyBindingsScreen.tsx` — if it explicitly lists "Open Presentation Window" as a row, leave the ActionId entry (used by P6-04) but check no orphan setting row references the dropped button

**Depends on:** T1

**Reuses:** Nothing — just deletion.

**Tools:** NONE

**Done when:**
- [ ] No button in OperatorApp matches `/Janela de Apresentação|Open Presentation Window/i`
- [ ] `Grep "openPresentationWindow"` shows it only as a binding ActionId, never as a toolbar button
- [ ] `tsc --noEmit` clean
- [ ] Gate: `npx vitest run` green

**Tests:** component (regression — existing OperatorApp tests still pass)
**Gate:** quick
**Commit:** `chore(operator): P6-07 — remove redundant Open Presentation Window button`

---

### T3: enter_presentation + exit_presentation + lifecycle event + state extension (P6-04 backend)

**What:** Refactor `open_presentation_window` into `enter_presentation` (always fullscreen, idempotent, emits lifecycle event). Add `exit_presentation` (closes window, resets state, clears overlay, emits lifecycle). Extend `PresentationState` with `all_slides_per_item: Vec<Vec<Slide>>` populated at `load_set_for_presentation`. Mirror TS types.

**Where:**
- `src-tauri/src/commands/window.rs`:
  - Rename `open_presentation_window` → `enter_presentation`; drop the single-monitor `1280×720` branch — always `.fullscreen(true)`; on existing window → `set_focus()` and return early without re-broadcasting; on initial open → `app.emit("presentation_lifecycle", { phase: "entered" })`
  - Add `exit_presentation(app, state)` async fn:
    1. If `presentation` window exists → `.close()` (idempotent)
    2. Acquire `state.presentation` write lock → set `mode = Idle`, `frozen_at = None`, `overlay = None`; drop lock BEFORE emitting
    3. Emit `state_changed` (existing pattern)
    4. Emit `presentation_lifecycle` with `{ phase: "exited" }`
  - Empty-set guard: at entry, if `state.presentation.read().await.set.items.is_empty()` → return `Err(ErrorPayload::new("presentation.empty_set"))` and do not open window
- `src-tauri/src/lib.rs` — replace `open_presentation_window` in `invoke_handler![]` with `enter_presentation, exit_presentation`
- `src-tauri/src/domain/presentation.rs` — add `pub all_slides_per_item: Vec<Vec<Slide>>` to `PresentationState` (mark `#[serde(default, rename = "allSlidesPerItem")]` for backward compat)
- `src-tauri/src/commands/presentation.rs` — in `load_set_for_presentation`, after computing per-item slides, populate `state.all_slides_per_item = computed.clone()` before emitting `state_changed`
- `src/api/commands.ts`:
  - Rename `openPresentationWindow()` → `enterPresentation()` (also keep an `openPresentationWindow` alias if any ActionId still references it, mapping to `enterPresentation`)
  - Add `exitPresentation(): Promise<void>`
  - Add `onPresentationLifecycle(cb: (phase: "entered" | "exited") => void)` event listener wrapper
- `src/types/index.ts` — add `allSlidesPerItem: Slide[][]` to `PresentationState` (optional `Slide[][]` to tolerate older payloads)

**Depends on:** T2 (cleaner OperatorApp diff)

**Reuses:**
- `pick_secondary_index` + `logical_placement` in `commands/window.rs` (unchanged)
- `set_presentation_mode` helper for the Idle write
- Existing `state_changed` emit pattern
- Existing `Slide` type and `computed_slides` pipeline

**Tools:** NONE

**Done when:**
- [ ] `enter_presentation` always builds the window with `.fullscreen(true)` regardless of monitor count
- [ ] `enter_presentation` on existing window is a no-op (focus only, no lifecycle re-emit)
- [ ] `enter_presentation` with empty set returns `Err("presentation.empty_set")` and does NOT open the window
- [ ] `exit_presentation` is idempotent when window is already closed
- [ ] `exit_presentation` resets `mode = Idle` and `overlay = None`
- [ ] `presentation_lifecycle` event fires on entered (first open) and on exited (always)
- [ ] `load_set_for_presentation` populates `all_slides_per_item` (one Vec<Slide> per set item, matching item order)
- [ ] `PresentationState` round-trips through serde with `allSlidesPerItem` populated and with field missing (legacy)
- [ ] Unit test: `exit_when_no_window_open_is_noop`
- [ ] Unit test: `exit_clears_overlay`
- [ ] Unit test: `enter_with_empty_set_returns_error`
- [ ] Unit test: `all_slides_per_item_serde_round_trip`
- [ ] `tsc --noEmit` clean
- [ ] Gate: `cargo test --manifest-path src-tauri/Cargo.toml` green

**Tests:** unit (domain/presentation.rs state shape; pure helper for empty-set guard if extracted)
**Gate:** quick
**Commit:** `feat(presentation): P6-04 — enter_presentation/exit_presentation + lifecycle + allSlidesPerItem`

---

### T4: OperatorApp view routing + Apresentar in HomeSetBuilder + empty-set toast (P6-04 frontend) [P]

**What:** Wire the operator window to switch its main content to the navigator whenever `state.mode != "idle"`. Move the "Apresentar" button into `HomeSetBuilder` next to "Limpar". Show a toast when invoked on an empty set. Subscribe to `presentation_lifecycle` event.

**Where:**
- `src/windows/operator/OperatorApp.tsx`:
  - Derive `const isPresenting = state?.mode === "live" || state?.mode === "blank" || state?.mode === "frozen"`
  - In `<main>`, render `<PresentationNavigator />` when `isPresenting`, else fall through to the existing `currentView` switch (placeholder for T5 — render `<div>Navigator</div>` temporarily if T5 not yet merged)
  - Subscribe to `onPresentationLifecycle` — on `"exited"`, ensure `currentView` defaults to `"home"` (no-op if already there)
- `src/components/setbuilder/HomeSetBuilder.tsx`:
  - Add a primary "Apresentar" button near the "Limpar" / set actions area
  - Handler: if `fixedSet.items.length === 0` → `toast.warning(t("presentation.emptySet"))` and return; else `await enterPresentation()`
- `src/i18n/locales/pt-BR.json` AND `src/i18n/locales/en-US.json`:
  - Add `presentation.emptySet` ("Adicione itens ao conjunto antes de apresentar" / "Add items to the set before presenting")
  - Add `presentation.action.present` ("Apresentar" / "Present")

**Depends on:** T3 (needs `enterPresentation` API + `onPresentationLifecycle` event)

**Reuses:**
- Existing toast component (already used elsewhere; if not, `react-hot-toast` or whatever the project standardized on — check `package.json`)
- Existing presentation Zustand store
- Existing event-listener install pattern

**Tools:** NONE

**Done when:**
- [ ] OperatorApp renders the navigator (or placeholder) when `state.mode` is not `idle`
- [ ] OperatorApp renders the standard `currentView` when `state.mode === "idle"`
- [ ] Top-bar tabs remain visible AND clickable during presentation (clicks set `currentView` underneath the navigator overlay)
- [ ] "Apresentar" button exists in HomeSetBuilder; clicking with non-empty set calls `enterPresentation`
- [ ] "Apresentar" with empty set shows toast AND does not call `enterPresentation`
- [ ] `presentation_lifecycle` listener installed; `exited` event triggers a re-render and falls back to standard view
- [ ] i18n keys present in both locales
- [ ] Component test: HomeSetBuilder renders Apresentar button; click with empty set shows toast (mock `enterPresentation` to assert NOT called)
- [ ] Component test: HomeSetBuilder click with items invokes `enterPresentation`
- [ ] Gate: `npx vitest run` green

**Tests:** component (HomeSetBuilder button + toast behavior; OperatorApp routing assertion)
**Gate:** quick
**Commit:** `feat(operator): P6-04 — Apresentar in HomeSetBuilder + view routing + lifecycle subscription`

---

### T5: PresentationNavigator component (P6-05) [P]

**What:** Scrollable navigator listing every slide of every item in the current set; current slide highlighted; click jumps via `go_to_item`; auto-scrolls current into view.

**Where:**
- `src/components/presentation/PresentationNavigator.tsx` (new)
- `src/components/presentation/PresentationNavigator.test.tsx` (new)
- `src/api/commands.ts` — confirm `goToItem(itemIndex, slideIndex)` wrapper exists; if missing, add it (reuses existing `go_to_item` Rust command per design)

**Depends on:** T3 (needs `allSlidesPerItem` in state + TS type)

**Reuses:**
- `usePresentationStore` for `set.items`, `currentItemIndex`, `currentSlideIndex`, `allSlidesPerItem`, `mode`
- Existing `go_to_item` Tauri command (`commands/presentation.rs:307-342` per design)
- Semantic tokens (`bg-surface`, `bg-primary/10`, `ring-primary`, `text-fg`, `text-muted`, `border-border`)
- `line-clamp-4` Tailwind utility (or equivalent)

**Tools:** NONE

**Layout / behavior (per design):**
- Flat scroll container; one sticky group header per item (`top-0` inside scroll); cards under each header
- Card text: first 3-4 lines of `slide.lines`, clamped
- Current slide card: `bg-primary/10 ring-2 ring-primary` + `aria-current="true"`
- Non-current cards: `bg-surface text-fg`
- Non-song items: single card showing item-type icon + title (e.g., "Cronômetro — 10:00", "Mídia — sunset.mp4", "WebView — http://…", "Apresentação — slide 3/12")
- For `SlideShow` items: one card per pseudo-slide labeled `Slide N/M` (per design recommendation)
- `useEffect` on `[currentItemIndex, currentSlideIndex]` → `currentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })`
- Click handler: `invoke('go_to_item', { itemIndex, slideIndex })`

**Done when:**
- [ ] Component renders all items × slides from `allSlidesPerItem`
- [ ] Current slide is highlighted with `aria-current="true"` and `ring-primary`
- [ ] Clicking any slide card calls `go_to_item` with correct indices
- [ ] On `currentSlideIndex` change, `scrollIntoView` is called (jsdom spy)
- [ ] Non-song items render as single cards with type-specific icon + title
- [ ] SlideShow items render one card per pseudo-slide
- [ ] OperatorApp wires this component into the `isPresenting` branch (replace placeholder from T4)
- [ ] Vitest: renders for a 2-item set with mixed Song + Countdown
- [ ] Vitest: click handler invokes `go_to_item` with `{ itemIndex: 1, slideIndex: 2 }`
- [ ] Vitest: highlight follows current state on prop change
- [ ] Vitest: SlideShow item renders N cards (mock `allSlidesPerItem` accordingly)
- [ ] Gate: `npx vitest run` green

**Tests:** component
**Gate:** quick
**Commit:** `feat(presentation): P6-05 — PresentationNavigator with click-to-jump`

---

### T6: ESC exits + F10 toggles blackout + KeyBindingsScreen read-only rows (P6-06)

**What:** Hardcode ESC and F10 in the keyboard dispatcher. ESC exits presentation (invokes `exit_presentation`); F10 toggles blackout. Both fire in either window. Mark the ESC and F10 rows in `KeyBindingsScreen` as read-only (or hide).

**Where:**
- `src/runtime/keyboard.ts` (or wherever `installKeyboardDispatcher` lives):
  - Add an unconditional branch BEFORE the bindings-match logic:
    - `if (e.key === "Escape")` → if `getIsPresenting()` → `exitPresentation()` + `e.preventDefault()` + return
    - `if (e.key === "F10")` → if `getIsPresenting()` → `toggleBlank()` + `e.preventDefault()` + return
  - Extend the dispatcher API to accept `getIsPresenting: () => boolean`, `onEscape: () => void`, `onF10: () => void`
- `src/windows/operator/OperatorApp.tsx`:
  - Pass `getIsPresenting = () => isPresenting`
  - Pass `onEscape = () => exitPresentation()`
  - Pass `onF10 = () => setPresentationMode(mode === "blank" ? "live" : "blank")` (use existing command)
- `src/windows/presentation/PresentationApp.tsx`:
  - Same dispatcher install with the same callbacks (ESC → `exitPresentation`, F10 → toggle blackout) — fires directly without needing operator forwarding
- `src/components/settings/KeyBindingsScreen.tsx`:
  - For the rows whose ActionId corresponds to ESC ("exitPresentation") and F10 (no existing ActionId → simply do not list F10 there), render them as read-only with an info tooltip "PowerPoint parity — não reatribuível" (per design open-question recommendation)
- `src/runtime/keyboard.test.ts` (new or extend): test the new unconditional ESC + F10 branches

**Depends on:** T4 (needs `exitPresentation` + `isPresenting` state), T5 (need the navigator to be present so ESC has somewhere to return to)

**Reuses:**
- Existing `installKeyboardDispatcher` infra
- Existing `set_presentation_mode` command for blackout toggle
- Existing `exit_presentation` from T3

**Tools:** NONE

**Done when:**
- [ ] ESC during presentation calls `exit_presentation` in either window
- [ ] ESC outside presentation falls through to existing modal-closing behavior (no regression)
- [ ] F10 during presentation toggles blackout (`mode: "live" ↔ "blank"`)
- [ ] F10 outside presentation is a no-op (gated on `getIsPresenting()`)
- [ ] `e.preventDefault()` is called for both hardcoded keys (prevents browser/menu interception)
- [ ] KeyBindingsScreen renders ESC row as read-only with tooltip; F10 not shown
- [ ] Vitest: keyboard dispatcher — ESC presenting → `exitPresentation` called
- [ ] Vitest: keyboard dispatcher — ESC not presenting → not called
- [ ] Vitest: keyboard dispatcher — F10 presenting → `toggleBlank` called
- [ ] Gate: `npx vitest run` green

**Tests:** unit (`src/runtime/keyboard.ts` is utility layer — unit-tested) + component (KeyBindingsScreen read-only render)
**Gate:** quick
**Commit:** `feat(keyboard): P6-06 — ESC exits + F10 blackout hardcoded`

---

### T7: NotesField + textbox sweep + add --color-fg token (P6-01)

**What:** Replace hardcoded dark classes in `NotesField` and all textbox / input fields with semantic tokens. Add the `--color-fg` and `--color-fg-on-primary` tokens to `index.css` (Tailwind v4 `@theme` block) so light-mode foregrounds resolve correctly. This is the prerequisite for T8 and T9.

**Where:**
- `src/index.css` — add `--color-fg` (light: `#111111`, dark: `#EAEAEA`) and `--color-fg-on-primary` (white-ish) under the existing Tailwind v4 `@theme` block; verify the token shows up via `text-fg` / `bg-fg` utilities
- `src/components/common/NotesField.tsx` — replace `bg-gray-700 border-gray-600 focus:border-blue-500` → `bg-surface-2 border-border focus:border-primary text-fg`
- Textarea/input sweep in:
  - `src/components/song/SongEditor.tsx` (observation field)
  - `src/components/song/SectionCard.tsx` (notes textarea)
  - `src/components/set/CountdownSetItemEditor.tsx` (message field — will be re-touched by T11 but baseline must be clean)
  - `src/components/set/BlankItemNotesEditor.tsx`
  - `src/components/set/MediaSetItemEditor.tsx`
  - `src/components/set/WebViewSetItemEditor.tsx`
  - `src/components/set/SlideshowSetItemEditor.tsx`
  - `src/components/setbuilder/HomeSetBuilder.tsx` (announcement dialog textarea)

**Depends on:** T6 (avoids merge conflicts with operator/keyboard work)

**Reuses:** Existing semantic tokens (`bg-surface-2`, `border-border`, `focus:border-primary`); existing helper `scripts/check-theme-tokens.ps1`

**Tools:** NONE

**Done when:**
- [ ] `--color-fg` and `--color-fg-on-primary` tokens defined in `index.css` and pickup via Tailwind utility `text-fg` works
- [ ] `Grep "bg-gray-(700|800|900)|text-white"` returns 0 hits in `src/components/common/NotesField.tsx` and the listed editor files
- [ ] All listed `<textarea>` and `<input>` elements use `bg-surface-2 text-fg border-border` (or `bg-surface` where appropriate)
- [ ] Existing component tests still pass (no behavioral changes)
- [ ] Manual: switch to light theme; every listed editor's textarea renders light surface + dark text
- [ ] Gate: `npx vitest run` green

**Tests:** component (regression — existing tests cover render; sweep does not add new tests but must not break any)
**Gate:** quick
**Commit:** `style(theme): P6-01 — NotesField + textbox sweep + --color-fg token`

---

### T8: Operator surfaces sweep + extend check-theme-tokens.ps1 (P6-02) [P]

**What:** Replace hardcoded dark classes (`bg-gray-{700,800,900}`, `border-gray-{600,700}`, `text-white`, `bg-blue-{500,600}`, `bg-emerald-{500,600}`) with semantic tokens across the operator chrome. Extend the deny-list in `scripts/check-theme-tokens.ps1` and run it as the gate.

**Where:**
- `scripts/check-theme-tokens.ps1` — extend `denyPatterns` array to: `bg-gray-(700|800|900)`, `border-gray-(600|700)`, `text-white`, `text-gray-(800|900)`, `bg-blue-(500|600)`, `bg-emerald-(500|600)`; ensure presentation/projection components (`src/windows/presentation/`, `src/components/presentation/SlideshowRenderer.tsx`, `MediaSlideRenderer.tsx`, `SongBackground.tsx`, `TransitionStage.tsx`, `WebViewRenderer.tsx`, `CountdownRenderer.tsx`, `AnnouncementRenderer.tsx`) are excluded from the scan
- Sweep these operator files (replace each match per spec P6-02 file list):
  - `src/components/setbuilder/HomeSetBuilder.tsx`, `src/components/set/SetBuilder.tsx`
  - `src/components/presentation/SlideController.tsx`, `src/components/presentation/OperatorNotesPanel.tsx`
  - `src/components/set/*SetItemEditor.tsx` (operator-side editors not already covered by T7)
  - `src/components/media/MediaLibrary.tsx`, `MediaCard.tsx`, `MediaDetailPanel.tsx`, `MediaUploadDropzone.tsx`, `MediaPicker.tsx`, `LibreOfficeBanner.tsx`
  - `src/components/settings/KeyBindingsScreen.tsx`, `BackupScreen.tsx`, `LanguagePicker.tsx`
  - `src/components/common/RestoreInProgressDialog.tsx`, `ConfirmDialog.tsx`, `Toggle.tsx`, `Keycap.tsx`
  - `src/components/song/SongList.tsx`, `SongListItem.tsx`, `SongEditor.tsx`, `SectionCard.tsx` (chrome only — textareas handled by T7)
  - `src/components/updates/UpdateBanner.tsx`, `UpdateDialog.tsx`, `UpdateCheckButton.tsx`
  - `src/components/import/HolyricsImport.tsx`, `PlainTextImport.tsx`, `ImportWizardFrame.tsx`
  - Any `CountdownPanel.tsx` if present

**Depends on:** T7 (needs `--color-fg` token defined and NotesField stable)

**Reuses:** Existing tokens; `check-theme-tokens.ps1` script

**Tools:** NONE

**Done when:**
- [ ] `pwsh scripts/check-theme-tokens.ps1` exits 0 (no deny-list hits in operator surfaces)
- [ ] Manual: navigate every operator tab + dialog in light theme — no dark panel anywhere
- [ ] Presentation/projection components remain untouched (still black bg / white text on the projection screen)
- [ ] Existing component tests pass
- [ ] Gate: `npx vitest run` green

**Tests:** component (regression — existing tests; sweep does not add new tests)
**Gate:** quick
**Commit:** `style(theme): P6-02 — operator surfaces sweep + check-theme-tokens deny-list`

---

### T9: Dark theme contrast fix (P6-03) [P]

**What:** Replace `text-black`, `text-gray-900`, `text-gray-800` on operator surfaces with `text-fg` (or `text-muted` where appropriate). Add explicit `color-scheme: dark` / `text-fg bg-surface-2` to native `<input>` / `<select>` controls so they don't render black-on-black in dark mode.

**Where:**
- `src/index.css` — add a base layer rule for `input, select, textarea { color: var(--color-fg); background-color: var(--color-surface-2); }` if not already covered; add `[data-theme="dark"] input[type="time"], [data-theme="dark"] input[type="number"] { color-scheme: dark; }` (or use the theme store to set `style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}` on specific inputs as needed)
- Sweep across `src/components/**` and `src/windows/operator/**`:
  - Replace `text-black` → `text-fg`
  - Replace `text-gray-(800|900)` on dark-eligible surfaces → `text-fg`
  - Native `<input type="time">` / `<input type="number">` / `<input type="date">` instances — add explicit `text-fg bg-surface-2` AND `style={{ colorScheme: theme }}` (read theme from existing store)
- Verify WCAG AA contrast on 5 random screens manually (sample only)

**Depends on:** T7 (needs `--color-fg` token)

**Reuses:** Theme store for `colorScheme` hint; existing `--color-fg`, `--color-muted-fg`, `--color-surface-2` tokens

**Tools:** NONE

**Done when:**
- [ ] `Grep "text-black|text-gray-(800|900)"` returns 0 hits in `src/components/**` and `src/windows/operator/**` (presentation/projection components excluded)
- [ ] All native `<input type="time|number|date">` instances render legible text in dark mode (manual check)
- [ ] Body text contrast ≥ 4.5:1 on dark surfaces (manual spot check on 5 screens — log results in commit description)
- [ ] Existing component tests pass
- [ ] Gate: `npx vitest run` green

**Tests:** component (regression — sweep does not add new tests)
**Gate:** quick
**Commit:** `style(theme): P6-03 — dark theme contrast fix + native input colorScheme`

---

### T10: CountdownTarget enum + start_countdown resolution (P6-09 backend) [P]

**What:** Introduce `CountdownTarget` tagged enum (`Duration` | `FixedTime`); replace `CountdownConfig.duration_ms` with `target: CountdownTarget`; implement custom `Deserialize` for backward compat with the old flat `{durationMs: ...}` shape; update `start_countdown` to resolve `FixedTime` to a wall-clock target (today if future, tomorrow if past). Validator rejects out-of-range hour/minute.

**Where:**
- `src-tauri/src/domain/countdown.rs`:
  - Define `pub enum CountdownTarget { Duration { duration_ms: u64 }, FixedTime { hour: u8, minute: u8 } }` with `#[serde(tag = "kind", rename_all = "camelCase")]`
  - Change `CountdownConfig.duration_ms` → `CountdownConfig.target: CountdownTarget`
  - Implement custom `impl<'de> Deserialize for CountdownConfig` that first tries the new tagged shape; on failure, falls back to the old flat `{durationMs, message?, endBehavior?, backgroundMediaId?}` and constructs `target: Duration { duration_ms }`
- `src-tauri/src/commands/countdown.rs`:
  - In `start_countdown`, add a helper `fn resolve_target_epoch_ms(target: &CountdownTarget, now_ms: u64) -> Result<u64, ErrorPayload>`:
    - `Duration { duration_ms }` → `now_ms + duration_ms`
    - `FixedTime { hour, minute }` → validate `hour < 24 && minute < 60` else `Err("countdown.invalid_time")`; compute today's local-tz epoch ms at `HH:MM:00`; if `<= now_ms` → add 86_400_000 (24h)
  - Use the helper to set `target_epoch_ms`; the existing drift-free ticker downstream is unchanged
- `src/types/index.ts` — mirror `CountdownTarget` discriminated union; update `CountdownConfig` type
- `src/api/commands.ts` — no signature change if commands pass through (verify)

**Depends on:** None (fully independent — touches countdown domain only)

**Reuses:**
- Drift-free Tokio ticker in `commands/countdown.rs` (unchanged)
- `target_epoch_ms` field in `CountdownState` (already exists per design)
- `chrono` (or whatever local-tz date math the project uses — check Cargo.toml)

**Tools:** NONE

**Done when:**
- [ ] `CountdownTarget` enum defined with `Duration` + `FixedTime` variants
- [ ] `CountdownConfig.target` replaces `duration_ms`
- [ ] Unit test: new tagged JSON `{"target":{"kind":"fixedTime","hour":9,"minute":30},...}` round-trips
- [ ] Unit test: new tagged JSON `{"target":{"kind":"duration","durationMs":600000},...}` round-trips
- [ ] Unit test: legacy JSON `{"durationMs":600000,"message":null,...}` (no `target` field) deserializes into `target: Duration { duration_ms: 600000 }` (backward compat)
- [ ] Unit test: `resolve_target_epoch_ms(FixedTime{23,59}, today_at_08:00)` → today's 23:59 epoch
- [ ] Unit test: `resolve_target_epoch_ms(FixedTime{6,0}, today_at_08:00)` → tomorrow's 6:00 epoch (+24h rollover)
- [ ] Unit test: `resolve_target_epoch_ms(FixedTime{25,0}, _)` → `Err("countdown.invalid_time")`
- [ ] Existing countdown ticker tests still pass (no regression)
- [ ] Gate: `cargo test --manifest-path src-tauri/Cargo.toml` green

**Tests:** unit (`src-tauri/src/domain/countdown.rs` is domain layer — unit-tested)
**Gate:** quick
**Commit:** `feat(countdown): P6-09 — CountdownTarget enum + FixedTime resolution`

---

### T11: CountdownSetItemEditor mode toggle (P6-09 frontend) [P]

**What:** Add a mode toggle ("Duração" / "Horário fixo") to `CountdownSetItemEditor`. Render mm:ss for Duration, `<input type="time">` for FixedTime. Preserve the unused value per-mode so toggling back restores it. Serialize using the new tagged shape.

**Where:**
- `src/components/set/CountdownSetItemEditor.tsx`:
  - Local state: `mode: 'duration' | 'fixedTime'`, `durationMs: number`, `fixedTime: { hour: number; minute: number }`
  - Two-button toggle group at the top
  - Existing mm:ss input rendered when `mode === 'duration'` (no change)
  - New `<input type="time" value="HH:MM" />` with `style={{ colorScheme: themeStore.theme }}` when `mode === 'fixedTime'`
  - On save, serialize `{ target: { kind, ... }, message, endBehavior, backgroundMediaId }` matching the new Rust shape
  - Switching modes preserves the other value in component state (don't reset)
- `src/components/set/CountdownSetItemEditor.test.tsx` (new):
  - Renders both modes
  - Mode toggle preserves the value of the other input
  - Save in fixedTime mode dispatches payload with `target: { kind: 'fixedTime', hour, minute }`
  - Save in duration mode dispatches payload with `target: { kind: 'duration', durationMs }`
- `src/i18n/locales/pt-BR.json` AND `src/i18n/locales/en-US.json`:
  - `countdown.mode.duration` ("Duração" / "Duration")
  - `countdown.mode.fixedTime` ("Horário fixo" / "Fixed time")
  - `countdown.fixedTime.input.label` ("Terminar em" / "Finish at")

**Depends on:** T10 (needs the new TS `CountdownConfig` shape)

**Reuses:**
- Existing form chrome in `CountdownSetItemEditor`
- Existing `themeStore` for `colorScheme` hint
- Existing `update_set_item` command (no signature change)

**Tools:** NONE

**Done when:**
- [ ] Toggle renders both buttons; clicking switches between the two input UIs
- [ ] Duration mode unchanged from current behavior
- [ ] FixedTime mode renders `<input type="time">` with theme-aware colorScheme
- [ ] Toggling modes preserves the other input's value
- [ ] Save dispatches the new tagged `target: { kind, ... }` shape
- [ ] Vitest: 4 tests above pass
- [ ] Reloading a saved set with `FixedTime` mode re-renders in FixedTime mode with persisted hour/minute
- [ ] i18n keys present in both locales
- [ ] Gate: `npx vitest run` green

**Tests:** component
**Gate:** quick
**Commit:** `feat(countdown): P6-09 — CountdownSetItemEditor mode toggle + FixedTime input`

---

### T12: Gate — full test suite + STATE + ROADMAP

**What:** Final pass — run all tests, type-check, theme-token script, manual smoke per spec Success Criteria; update STATE.md (record D-15 stage decision supersession + Phase 6 completion) and ROADMAP.md.

**Where:**
- `.specs/project/STATE.md` — add Phase 6 completion entry; mark stage decision (D-15) as superseded; record any new decisions encountered
- `.specs/project/ROADMAP.md` — mark Phase 6 Done

**Depends on:** T8, T9, T11

**Tools:** NONE

**Done when:**
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` green (≥ existing 124 minus stage tests + new T3/T10 tests)
- [ ] `npx vitest run` green (≥ existing 96 minus stage tests + new T4/T5/T6/T11 tests)
- [ ] `tsc --noEmit` clean
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` clean
- [ ] `pwsh scripts/check-theme-tokens.ps1` exits 0
- [ ] Manual smoke (single monitor): click Apresentar → fullscreen on the only display; operator shows navigator; ESC exits
- [ ] Manual smoke (two monitors): Apresentar → projection on secondary; navigator on primary; ESC exits
- [ ] Manual smoke: navigator click-to-jump < 200ms perceived
- [ ] Manual smoke: F10 toggles blackout in both windows
- [ ] Manual smoke: `Grep -r "stage|StageApp|open_stage"` in `src/` + `src-tauri/src/` returns 0 (excluding decision logs)
- [ ] Manual smoke: Countdown "Horário fixo 09:30" counts down to today's 09:30 if before, tomorrow's 09:30 if after
- [ ] STATE.md updated
- [ ] ROADMAP.md Phase 6 marked Done

**Tests:** none (validation + docs)
**Gate:** full
**Commit:** `chore(phase6): P6 — STATE/ROADMAP completion summary`

---

## Parallel Execution Map

```
Phase 1:
  T1  [P]  Remove Stage subsystem
  T10 [P]  CountdownTarget backend

Phase 2:
  T1  → T2   Remove redundant button
  T10 → T11  Countdown editor toggle

Phase 3:
  T2 → T3    enter/exit_presentation + state ext

Phase 4:
  T3 → T4 [P]  Operator routing + Apresentar
  T3 → T5 [P]  PresentationNavigator

Phase 5:
  T4, T5 → T6  ESC + F10

Phase 6:
  T6 → T7     NotesField + textbox sweep + tokens
  T7 → T8 [P] Operator surfaces sweep
  T7 → T9 [P] Dark contrast fix

Phase 7:
  T8, T9, T11 → T12  Gate
```

**Parallel-safety note:** All test types in this project are marked parallel-safe in TESTING.md. `[P]` flags here reflect only file-level non-overlap.

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|------|-------------------|---------------|--------|
| T1   | None              | (phase 1 root) | ✅ Match |
| T2   | T1                | T1 → T2        | ✅ Match |
| T3   | T2                | T2 → T3        | ✅ Match |
| T4   | T3                | T3 → T4 [P]    | ✅ Match |
| T5   | T3                | T3 → T5 [P]    | ✅ Match |
| T6   | T4, T5            | T4, T5 → T6    | ✅ Match |
| T7   | T6                | T6 → T7        | ✅ Match |
| T8   | T7                | T7 → T8 [P]    | ✅ Match |
| T9   | T7                | T7 → T9 [P]    | ✅ Match |
| T10  | None              | (phase 1 root) | ✅ Match |
| T11  | T10               | T10 → T11      | ✅ Match |
| T12  | T8, T9, T11       | T8, T9, T11 → T12 | ✅ Match |

---

## Test Co-location Matrix

| Task | Code Layer Modified | Matrix Requires | Task Says | Status |
|------|---------------------|------------------|-----------|--------|
| T1   | many (destructive)  | n/a (deletion)   | none      | ✅ OK (no new code) |
| T2   | components/window   | component        | regression| ✅ OK |
| T3   | domain + commands   | unit (domain) + none (commands) | unit | ✅ OK |
| T4   | components/window   | component        | component | ✅ OK |
| T5   | components          | component        | component | ✅ OK |
| T6   | runtime + components| unit (utility) + component | unit + component | ✅ OK |
| T7   | components (sweep)  | component        | regression| ✅ OK (mechanical change, no new behavior) |
| T8   | components (sweep)  | component        | regression| ✅ OK |
| T9   | components (sweep)  | component        | regression| ✅ OK |
| T10  | domain + commands   | unit (domain) + none (commands) | unit | ✅ OK |
| T11  | components          | component        | component | ✅ OK |
| T12  | docs only           | none             | none      | ✅ OK |

**Note on sweep tasks (T7/T8/T9):** These tasks change visual class strings in components — no new logic, no new render paths. The required coverage is "existing component tests still pass" (regression). No new tests are mandated because no new branches exist. If a sweep accidentally changes a class name an existing test asserts on, the gate catches it.

---

## Task Granularity Check

| Task | Scope                                       | Status     |
|------|---------------------------------------------|------------|
| T1   | Coherent deletion (Stage subsystem)         | ✅ Granular (atomic removal) |
| T2   | One UI button + i18n cleanup                | ✅ Granular |
| T3   | 2 commands + 1 state field + TS mirror      | ✅ Granular (one feature unit) |
| T4   | OperatorApp routing + 1 button move + toast | ✅ Granular |
| T5   | 1 component                                 | ✅ Granular |
| T6   | Keyboard dispatcher extension + 1 settings row | ✅ Granular |
| T7   | 1 token addition + NotesField + textbox sweep | ⚠️ OK (mechanical sweep cohesive with token add) |
| T8   | Operator chrome sweep                       | ⚠️ OK (single mechanical change across files; script-gated) |
| T9   | Dark contrast sweep                         | ⚠️ OK (mechanical) |
| T10  | 1 enum + 1 resolver + serde backward compat | ✅ Granular |
| T11  | 1 component extension                       | ✅ Granular |
| T12  | Tests + docs                                | ✅ Granular |

The three sweep tasks (T7/T8/T9) span many files by necessity — they are mechanical search-and-replace operations gated by a script (`check-theme-tokens.ps1`). Splitting per file would multiply task count by ~30 without improving safety. The script provides the binary pass/fail criterion the granularity rule asks for.

---

## Commit Plan

1. `chore(stage): P6-08 — remove Stage window subsystem`
2. `chore(operator): P6-07 — remove redundant Open Presentation Window button`
3. `feat(presentation): P6-04 — enter_presentation/exit_presentation + lifecycle + allSlidesPerItem`
4. `feat(operator): P6-04 — Apresentar in HomeSetBuilder + view routing + lifecycle subscription`
5. `feat(presentation): P6-05 — PresentationNavigator with click-to-jump`
6. `feat(keyboard): P6-06 — ESC exits + F10 blackout hardcoded`
7. `style(theme): P6-01 — NotesField + textbox sweep + --color-fg token`
8. `style(theme): P6-02 — operator surfaces sweep + check-theme-tokens deny-list`
9. `style(theme): P6-03 — dark theme contrast fix + native input colorScheme`
10. `feat(countdown): P6-09 — CountdownTarget enum + FixedTime resolution`
11. `feat(countdown): P6-09 — CountdownSetItemEditor mode toggle + FixedTime input`
12. `chore(phase6): P6 — STATE/ROADMAP completion summary`

---

## Open Questions Resolved (from design.md)

| Question | Resolution |
|----------|-----------|
| Header "Apresentar" button vs HomeSetBuilder | HomeSetBuilder (user confirmed) |
| Tabs during presentation | Stay clickable (design default) |
| SlideShow items in navigator | One card per pseudo-slide (design default) |
| F10/ESC rows in KeyBindingsScreen | Show read-only with tooltip (design default) |
