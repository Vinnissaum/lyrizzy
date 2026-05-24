# Phase 4 — Home UX, Design System & Monitor Rework — Tasks

**Spec:** `.specs/features/phase4-home-ux/spec.md`
**Design:** inlined in spec (each requirement has Implementation notes)
**Status:** Draft
**Created:** 2026-05-20

---

## Execution Plan

### Phase 1 — Design System Foundation (Sequential)

The token layer must exist before any sweep can reference `bg-surface`, `bg-primary`, etc.

```
T1
```

### Phase 2 — Theme sweep + independent backend (Parallel)

Once tokens exist, every component sweep operates on a disjoint file set. Independent Rust changes (auto-monitor, default-set command, overlay backend, strophe removal) have no shared state and run alongside.

```
T1 ─┬─→ T2  [P]  (SetList + SetBuilder)
    ├─→ T3  [P]  (CountdownPanel + BackupScreen)
    ├─→ T4  [P]  (MediaLibrary + MediaCard + MediaDetailPanel)
    ├─→ T5  [P]  (OperatorNotesPanel + SectionCard + CCLIReportScreen)
    ├─→ T6  [P]  (4 SetItemEditor files)
    └─→ T7  [P]  (emerald/blue → primary sweep, app-wide)

(independent of T1)
    T8  [P]  Rust auto-monitor (presentation.rs)
    T9  [P]  Rust get_or_create_default_set
    T10 [P]  Rust OverlayState + commands
    T11 [P]  Remove strophe label (PresentationApp SongSlide)
```

### Phase 3 — Frontend integration of Phase 2 backends (Parallel where possible)

```
T8  ──→ T12  Frontend monitor-index cleanup (OperatorApp, WindowsScreen, store)
T9  ──→ T13  Frontend single-set home (library store + HomeSetBuilder + nav)
T10 ─┬─→ T14 [P]  AnnouncementRenderer
     ├─→ T15 [P]  QuickMediaRenderer
     └─→ T16 [P]  Camera URL setting + QuickWebViewRenderer
```

### Phase 4 — Overlay wiring + Home shortcuts (Sequential per file)

```
T14, T15, T16 ──→ T17  Wire overlay branch in PresentationApp + Esc handler
T13           ──→ T18  "Limpar" with confirmation
T13           ──→ T19  Drag-from-library sidebar in home
T13, T17      ──→ T20  Home overlay shortcut buttons (Oferta/Câmera/Aviso/PDF)
```

### Phase 5 — Gate (Sequential)

```
T20 → T21  Full smoke + visual sweep + STATE/ROADMAP update
```

---

## Task Breakdown

### T1: Define theme tokens in CSS + Tailwind v4 `@theme`

**What:** Create the CSS custom properties for light + dark surfaces and the `#19A4DD` primary, and register them as Tailwind v4 theme tokens so `bg-surface`, `bg-primary`, `border-border`, `text-muted` are usable across components.
**Where:** `src/index.css` (modify)
**Depends on:** None
**Reuses:** Existing Tailwind v4 setup + existing `.dark` class toggle from Phase 3F
**Requirement:** P4H-04

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] `:root` block defines `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-muted`, `--color-primary`, `--color-primary-hover` per spec values
- [ ] `.dark` block overrides bg/surface/surface-2/border/muted with the dark palette
- [ ] Tailwind v4 `@theme` block registers tokens so utility classes (`bg-surface`, `bg-primary`, `hover:bg-primary-hover`, `border-border`, `text-muted`) work
- [ ] `scripts/check-theme-tokens.ps1` (existing) still passes
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 Vitest tests still green

**Tests:** none (CSS-only; no runtime logic)
**Gate:** quick

**Commit:** `feat(theme): P4H-04 — neutral gray surface tokens + #19A4DD primary`

---

### T2: Theme sweep — SetList + SetBuilder [P]

**What:** Replace all hardcoded `bg-gray-*`, `text-white`, `border-gray-*` in the two set files with the semantic tokens from T1. Component logic is untouched.
**Where:** `src/components/set/SetList.tsx`, `src/components/set/SetBuilder.tsx`
**Depends on:** T1
**Reuses:** Tokens from T1
**Requirement:** P4H-03

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] Zero matches for `bg-gray-`, `border-gray-`, `text-white` in both files (use Grep)
- [ ] Manual toggle: both screens render correctly in light + dark theme
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 Vitest tests still green

**Tests:** none (purely classname substitution; existing component tests cover behavior)
**Gate:** quick

**Commit:** `style(theme): P4H-03 — sweep SetList + SetBuilder to semantic tokens`

---

### T3: Theme sweep — CountdownPanel + BackupScreen [P]

**What:** Same classname sweep applied to the countdown and backup screens.
**Where:** `src/components/countdown/CountdownPanel.tsx`, `src/components/backup/BackupScreen.tsx`
**Depends on:** T1
**Reuses:** Tokens from T1
**Requirement:** P4H-03

**Done when:**
- [ ] Zero `bg-gray-` / `text-white` matches in both files
- [ ] Both screens visually correct in light + dark
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 Vitest tests still green

**Tests:** none
**Gate:** quick

**Commit:** `style(theme): P4H-03 — sweep CountdownPanel + BackupScreen`

---

### T4: Theme sweep — Media library trio [P]

**What:** Classname sweep on media UI.
**Where:** `src/components/media/MediaLibrary.tsx`, `MediaCard.tsx`, `MediaDetailPanel.tsx`
**Depends on:** T1
**Reuses:** Tokens from T1
**Requirement:** P4H-03

**Done when:**
- [ ] Zero `bg-gray-` / `text-white` matches in the three files
- [ ] Media grid + detail panel visually correct in light + dark
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 Vitest tests still green

**Tests:** none
**Gate:** quick

**Commit:** `style(theme): P4H-03 — sweep MediaLibrary trio`

---

### T5: Theme sweep — OperatorNotesPanel + SectionCard + CCLIReportScreen [P]

**What:** Classname sweep on notes panel, per-section card, and CCLI report screen.
**Where:** `src/components/**/OperatorNotesPanel.tsx`, `**/SectionCard.tsx`, `src/components/reports/CCLIReportScreen.tsx`
**Depends on:** T1
**Reuses:** Tokens from T1
**Requirement:** P4H-03

**Done when:**
- [ ] Zero `bg-gray-` / `text-white` matches in the three files
- [ ] All three render correctly in light + dark
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 Vitest tests still green

**Tests:** none
**Gate:** quick

**Commit:** `style(theme): P4H-03 — sweep notes/section/CCLI report`

---

### T6: Theme sweep — set-item editors [P]

**What:** Classname sweep on the four set-item editor files.
**Where:** `src/components/set/BlankItemNotesEditor.tsx`, `CountdownSetItemEditor.tsx`, `MediaSetItemEditor.tsx`, `WebViewSetItemEditor.tsx`
**Depends on:** T1
**Reuses:** Tokens from T1
**Requirement:** P4H-03

**Done when:**
- [ ] Zero `bg-gray-` / `text-white` matches in the four files
- [ ] Each editor opens and renders correctly in light + dark
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 Vitest tests still green

**Tests:** none
**Gate:** quick

**Commit:** `style(theme): P4H-03 — sweep set-item editors`

---

### T7: Sweep emerald/blue primary actions → `bg-primary` [P]

**What:** Replace every `bg-emerald-600`/`bg-blue-600` (and matching hover variants) used as a primary-action background with `bg-primary hover:bg-primary-hover`. Replace primary-action focus rings with `focus:ring-primary`.
**Where:** Codebase-wide — search `bg-emerald-`, `bg-blue-600`, `ring-emerald-`, `ring-blue-` across `src/`
**Depends on:** T1
**Reuses:** Tokens from T1
**Requirement:** P4H-04

**Done when:**
- [ ] Grep `bg-emerald-` returns zero matches in `src/` (or only non-action contexts like status badges, documented)
- [ ] Grep `bg-blue-600` in primary-action contexts returns zero matches
- [ ] Primary action buttons across the app render `#19A4DD` background
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 Vitest tests still green

**Tests:** none (visual change only)
**Gate:** quick

**Commit:** `style(theme): P4H-04 — primary actions use #19A4DD token`

---

### T8: Rust `open_presentation_window` auto-monitor [P]

**What:** Modify the existing Tauri command to: (a) drop the `monitor_index` argument, (b) iterate `app.available_monitors()`, (c) pick the first monitor whose handle differs from `app.primary_monitor()`, (d) open fullscreen at that monitor's position using existing `logical_placement()` helper, (e) fall back to default placement when no secondary monitor is available, (f) focus the existing window if already open.
**Where:** `src-tauri/src/commands/presentation.rs` (or `commands/window.rs` — wherever `open_presentation_window` lives)
**Depends on:** None
**Reuses:** `logical_placement()`, existing `WindowBuilder` flow
**Requirement:** P4H-01

**Done when:**
- [ ] `open_presentation_window` takes no `monitor_index` parameter
- [ ] Unit test for the monitor-selection helper: given a primary monitor and 2 candidates, picks the first non-primary one
- [ ] Unit test: empty monitor list returns `None` (caller falls back to default)
- [ ] Re-invocation when window exists calls `.set_focus()` instead of building a new window
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: existing 109 + 2 new = 111 Rust tests green

**Tests:** unit (services-style helper extracted from the command if needed for testability; commands themselves are matrix "none")
**Gate:** quick

**Commit:** `feat(presentation): P4H-01 — auto-pick secondary monitor for presentation window`

---

### T9: Rust `get_or_create_default_set` command [P]

**What:** Add a Tauri command that returns the ID of the single fixed set, creating "Culto Dominical" if the `sets` table is empty. Idempotent and safe to call on every app launch.
**Where:** `src-tauri/src/commands/set.rs` (modify) + registered in `lib.rs` invoke_handler
**Depends on:** None
**Reuses:** Existing `create_set` + `list_sets` flow
**Requirement:** P4H-02

**Done when:**
- [ ] Command `get_or_create_default_set` returns `Result<Set, String>`
- [ ] Registered in `lib.rs` invoke_handler![]
- [ ] Service-level integration test (`sqlx::test`): on empty DB returns a newly created set named "Culto Dominical"; on non-empty DB returns the first set (does not duplicate)
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: existing 109 + 1 new = 110 Rust tests green

**Tests:** integration (DB-touching service path; sqlx::test)
**Gate:** quick

**Commit:** `feat(set): P4H-02 — get_or_create_default_set command`

---

### T10: Rust overlay backend — state + commands + event [P]

**What:** Add `OverlayState` enum (`Announcement{text}`, `QuickMedia{media_id}`, `QuickWebView{url}`), add `overlay: Option<OverlayState>` to `PresentationState`, implement 4 commands (`set_announcement_overlay`, `set_media_overlay`, `set_webview_overlay`, `clear_overlay`), all emit `state_changed`. Register in `lib.rs`. Ensure write lock is dropped before `app.emit()` (per CLAUDE.md invariant).
**Where:** `src-tauri/src/domain/presentation.rs` (or wherever `PresentationState` lives) + new `src-tauri/src/commands/overlay.rs` + `lib.rs` (modify)
**Depends on:** None
**Reuses:** Existing `state_changed` emit pattern, `PresentationState` write lock pattern
**Requirement:** P4H-07a

**Done when:**
- [ ] `OverlayState` enum defined with serde tagging matching frontend expectations
- [ ] `PresentationState.overlay: Option<OverlayState>` added; defaults to `None`
- [ ] 4 commands registered in `lib.rs` invoke_handler![]
- [ ] All 4 commands emit `state_changed` AFTER dropping the write lock
- [ ] Unit test for `PresentationState`: set → read → clear → read transitions for each variant
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: existing 109 + 3 new = 112 Rust tests green

**Tests:** unit (domain type) — commands themselves are matrix "none"
**Gate:** quick

**Commit:** `feat(overlay): P4H-07a — OverlayState + set/clear commands`

---

### T11: Remove strophe label from presentation [P]

**What:** Delete the `sectionLabel` paragraph from the `SongSlide` component in the presentation window. Stage window keeps it.
**Where:** `src/windows/presentation/PresentationApp.tsx` (or wherever `SongSlide` lives)
**Depends on:** None
**Reuses:** Existing renderer
**Requirement:** P4H-05

**Done when:**
- [ ] The `<p className="text-gray-400/60 text-xs uppercase tracking-widest mb-4">` element is removed from presentation `SongSlide`
- [ ] Stage `StageRenderer.tsx` is untouched (still shows section label)
- [ ] Add/update a Vitest assertion that the presentation `SongSlide` does NOT render a section header element
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 + 1 new (or modified) = 75 Vitest tests green

**Tests:** component (presentation window component)
**Gate:** quick

**Commit:** `feat(presentation): P4H-05 — hide section label on projection`

---

### T12: Frontend monitor-index cleanup

**What:** Remove the now-unused `monitor_index` argument from `src/api/commands.ts`'s `openPresentationWindow` wrapper; remove `loadPersistedMonitor("window.presentation.monitor")` and related state from `OperatorApp`; remove the presentation-monitor row from `WindowsScreen` (keep the stage row's manual "Open Stage Window" button).
**Where:** `src/api/commands.ts`, `src/windows/operator/OperatorApp.tsx`, `src/components/settings/WindowsScreen.tsx` (and any settings store key cleanup)
**Depends on:** T8
**Reuses:** Existing settings store
**Requirement:** P4H-01

**Done when:**
- [ ] `openPresentationWindow()` wrapper has no `monitor_index` argument
- [ ] `OperatorApp` no longer reads/writes `window.presentation.monitor` settings key
- [ ] `WindowsScreen` shows no presentation-monitor row (stage row preserved)
- [ ] Existing `OperatorApp` smoke test still passes
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing tests green

**Tests:** component (settings + operator app touched; covered by existing smoke test)
**Gate:** quick

**Commit:** `feat(presentation): P4H-01 — drop manual monitor picker from operator UI`

---

### T13: Frontend single-set home

**What:** On app init, call `getOrCreateDefaultSet()` and store the returned ID in the library store as `fixedSetId`. Replace the operator nav: remove the "Conjuntos" entry, default view becomes `"home"` rendering a `HomeSetBuilder` (thin wrapper around `SetBuilder` bound to `fixedSetId`). Rename nav label to "Início" with a house icon. Eliminate the old `"sets"`/`"set-builder"` view distinction.
**Where:** `src/stores/libraryStore.ts`, `src/windows/operator/OperatorApp.tsx`, new `src/components/setbuilder/HomeSetBuilder.tsx`, removal of `SetList` from navigation (the component file can remain unreferenced for now)
**Depends on:** T9
**Reuses:** Existing `SetBuilder` component, `useLibraryStore`
**Requirement:** P4H-02

**Done when:**
- [ ] `useLibraryStore` exposes `fixedSetId: number | null` and `loadFixedSet()` that calls `getOrCreateDefaultSet`
- [ ] `OperatorApp` calls `loadFixedSet()` on mount before rendering home view
- [ ] Default view is `"home"`; nav bar has no "Conjuntos" entry
- [ ] `HomeSetBuilder` renders the set builder for `fixedSetId`
- [ ] Restart: items persist across app launches (verified via smoke test or manual)
- [ ] Updated `OperatorApp` smoke test: starting view is home, nav has no Conjuntos entry
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 + adjustments green

**Tests:** component (operator window structure + store)
**Gate:** quick

**Commit:** `feat(home): P4H-02 — single fixed set as home view`

---

### T14: `AnnouncementRenderer` component [P]

**What:** New presentation-window component rendering centered white text on a black background with `font-size: clamp(1.5rem, 4vw, 3rem)`. Accepts a `text` prop.
**Where:** `src/components/presentation/AnnouncementRenderer.tsx` (new) + co-located `AnnouncementRenderer.test.tsx`
**Depends on:** T10
**Reuses:** Tailwind classes; no external state
**Requirement:** P4H-07b

**Done when:**
- [ ] Component renders given text centered, fullscreen, on black background
- [ ] Vitest covers: renders text content, applies center alignment, uses clamp-style sizing
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 + 2 new = 76 Vitest tests green

**Tests:** component
**Gate:** quick

**Commit:** `feat(overlay): P4H-07b — AnnouncementRenderer`

---

### T15: `QuickMediaRenderer` (reuses `MediaSlideRenderer`) [P]

**What:** Thin wrapper component that takes a `mediaId`, looks up the media item from the media store, and delegates rendering to the existing `MediaSlideRenderer`.
**Where:** `src/components/presentation/QuickMediaRenderer.tsx` (new) + co-located test
**Depends on:** T10
**Reuses:** `MediaSlideRenderer`, media store
**Requirement:** P4H-07c

**Done when:**
- [ ] Component fetches media item by ID and forwards to `MediaSlideRenderer`
- [ ] Missing media ID renders a graceful black background (no crash)
- [ ] Vitest: happy path + missing media fallback
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 + 2 new = 76 Vitest tests green

**Tests:** component
**Gate:** quick

**Commit:** `feat(overlay): P4H-07c — QuickMediaRenderer wrapping MediaSlideRenderer`

---

### T16: Camera URL setting + `QuickWebViewRenderer` [P]

**What:** Add `cameraUrl: string` field to `useSettingsStore`, persisted via the existing settings IPC under `settings["camera.url"]`. Add a "URL da câmera" text field to `SettingsScreen` (in the appropriate tab). Add `QuickWebViewRenderer` component that wraps the existing `WebViewRenderer` for overlay use.
**Where:** `src/stores/settingsStore.ts`, `src/components/settings/SettingsScreen.tsx` (or relevant sub-tab), new `src/components/presentation/QuickWebViewRenderer.tsx` + co-located test
**Depends on:** T10
**Reuses:** Existing settings store pattern, `WebViewRenderer`
**Requirement:** P4H-07d

**Done when:**
- [ ] `useSettingsStore.cameraUrl` reads from/writes to `settings["camera.url"]`
- [ ] Settings UI has a "URL da câmera" input with save-on-blur
- [ ] `QuickWebViewRenderer` renders the existing `WebViewRenderer` for an arbitrary URL
- [ ] Vitest: store round-trip + component renders iframe for given URL
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing 74 + 2 new = 76 Vitest tests green

**Tests:** component + store unit
**Gate:** quick

**Commit:** `feat(overlay): P4H-07d — camera URL setting + QuickWebViewRenderer`

---

### T17: Wire overlay branch into `PresentationApp` + Esc handler

**What:** In `PresentationApp.tsx`, after resolving `mode`, check `state.overlay`; if `Some`, render the matching overlay component instead of the normal set content. Also wire the Esc key in presentation window (and `exitPresentation` action in operator) to call `clearOverlay()` as part of the existing idle dispatch.
**Where:** `src/windows/presentation/PresentationApp.tsx`, `src/api/commands.ts` (add `clearOverlay`, `setAnnouncementOverlay`, `setMediaOverlay`, `setWebViewOverlay` wrappers), operator keybinding dispatch for `exitPresentation`
**Depends on:** T14, T15, T16
**Reuses:** Existing event listener + state branching pattern in `PresentationApp`
**Requirement:** P4H-07

**Done when:**
- [ ] When `state.overlay = Announcement{text}` is emitted, `PresentationApp` renders `AnnouncementRenderer`
- [ ] Same for `QuickMedia` → `QuickMediaRenderer` and `QuickWebView` → `QuickWebViewRenderer`
- [ ] Esc in presentation window calls `clearOverlay()` in addition to existing idle logic
- [ ] Operator `exitPresentation` action calls `clearOverlay()`
- [ ] Vitest: render `PresentationApp` with each overlay variant and assert the right child renderer is mounted
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`
- [ ] Test count: existing + 3 new = 79 Vitest tests green

**Tests:** component (window) — integration-style with mocked event stream
**Gate:** full

**Commit:** `feat(overlay): P4H-07 — wire overlay branch into PresentationApp + Esc`

---

### T18: "Limpar" set button with confirmation

**What:** Add a "Limpar" action to the home set builder header that opens a confirmation dialog; on confirm, deletes all `set_items` for `fixedSetId` (preserving the set record itself). Historical CCLI play records remain untouched.
**Where:** `src/components/setbuilder/HomeSetBuilder.tsx` (or `SetBuilder` if shared) + a small `ConfirmDialog` use (reuse existing if present, otherwise add to `common`)
**Depends on:** T13
**Reuses:** Existing `delete_set_item` command in a loop, OR add a `clear_set_items(set_id)` helper command if cleaner
**Requirement:** P4H-02

**Done when:**
- [ ] "Limpar" button appears in the home header
- [ ] Click shows confirmation dialog with Cancelar / Confirmar
- [ ] Confirm removes all items for the fixed set; set record + CCLI history preserved
- [ ] Vitest: clicking opens dialog; confirm calls the clear action; cancel does nothing
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing + 3 new green

**Tests:** component
**Gate:** quick

**Commit:** `feat(home): P4H-02 — Limpar action with confirmation`

---

### T19: Drag-from-library sidebar on home

**What:** Add a collapsible right-side panel inside the home view containing a song search box (uses existing `list_songs` with FTS search). Each song row is `useDraggable` (dnd-kit). The existing `DndContext` in `SetBuilder` accepts these drops and inserts the song into the set at the drop position (duplicates allowed).
**Where:** `src/components/setbuilder/HomeSetBuilder.tsx`, new `src/components/setbuilder/SongSearchSidebar.tsx`
**Depends on:** T13
**Reuses:** dnd-kit (already used in `SetBuilder`), `list_songs` API, existing song-to-set-item creation flow
**Requirement:** P4H-06

**Done when:**
- [ ] Sidebar is collapsible (default open)
- [ ] Search input filters songs in real time via `list_songs`
- [ ] Dragging a song row onto the set list inserts a song set-item at the drop position
- [ ] Duplicate songs allowed (no dedup)
- [ ] Vitest: search filters list; drag-drop simulation appends item
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: existing + 3 new green

**Tests:** component
**Gate:** quick

**Commit:** `feat(home): P4H-06 — drag-from-library sidebar`

---

### T20: Home overlay shortcut buttons

**What:** Add four buttons to the home header/toolbar:
- "Oferta (Mídia)" — opens existing `MediaPicker` filtered to images; on select, calls `setMediaOverlay(mediaId)` (auto-opens presentation window first if closed, via existing `openPresentationWindow` path).
- "Câmera" — if `cameraUrl` is empty, opens a small settings dialog to capture it; otherwise calls `setWebViewOverlay(cameraUrl)`.
- "Aviso" — opens a text input dialog; on confirm calls `setAnnouncementOverlay(text)`.
- "PDF" — disabled button with tooltip "Em breve — Phase 5" (P4H-07e).

Each handler ensures the presentation window is open (using auto-monitor logic from T8) before issuing the overlay command. Also add "Fechar Overlay" button visible only while an overlay is active, which calls `clearOverlay()`.
**Where:** `src/components/setbuilder/HomeSetBuilder.tsx` (or new `HomeOverlayBar.tsx`), reuse of `MediaPicker`
**Depends on:** T13, T17
**Reuses:** `MediaPicker`, `openPresentationWindow`, command wrappers from T17
**Requirement:** P4H-07, P4H-07e

**Done when:**
- [ ] Four buttons render with the correct labels + PDF disabled with tooltip
- [ ] Each button's happy path issues the matching overlay command and ensures presentation window is open
- [ ] "Câmera" with empty `cameraUrl` opens the settings prompt instead of issuing the command
- [ ] "Fechar Overlay" visible only when `state.overlay` is `Some`; click clears the overlay
- [ ] Vitest: each button's click handler dispatches the expected command (mock the API wrappers)
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`
- [ ] Test count: existing + 5 new green

**Tests:** component
**Gate:** full

**Commit:** `feat(home): P4H-07 — overlay shortcut buttons (Oferta/Câmera/Aviso/PDF)`

---

### T21: Phase 4 gate — smoke run + STATE/ROADMAP update

**What:** Run the full test suite and a manual smoke pass on a 2-monitor + 1-monitor setup; verify each P4H acceptance criterion; update `.specs/project/STATE.md` and `.specs/project/ROADMAP.md` with Phase 4 completion summary.
**Where:** `.specs/project/STATE.md`, `.specs/project/ROADMAP.md`
**Depends on:** T20
**Reuses:** Existing STATE/ROADMAP pattern from Phase 3H
**Requirement:** All P4H-* success criteria

**Done when:**
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` green
- [ ] `npx vitest run` green
- [ ] `tsc --noEmit` clean
- [ ] Manual smoke checklist (one entry per acceptance criterion in the spec) all checked
- [ ] STATE.md updated with completion entry
- [ ] ROADMAP.md Phase 4 marked Done
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`
- [ ] Test count: full suite green (Rust ≥ 112, Vitest ≥ 88 by my estimates)

**Tests:** none (validation pass, not new code)
**Gate:** full

**Commit:** `chore(phase4): P4H — STATE/ROADMAP completion summary`

---

## Parallel Execution Map

```
Phase 1:
  T1

Phase 2 (after T1; T8/T9/T10/T11 also start here, all [P]):
  ├─ T2  [P]  set sweep
  ├─ T3  [P]  countdown+backup sweep
  ├─ T4  [P]  media sweep
  ├─ T5  [P]  notes+section+CCLI sweep
  ├─ T6  [P]  set-item editors sweep
  ├─ T7  [P]  emerald/blue → primary sweep
  ├─ T8  [P]  Rust auto-monitor
  ├─ T9  [P]  Rust default-set command
  ├─ T10 [P]  Rust overlay backend
  └─ T11 [P]  Remove strophe label

Phase 3:
  T8  ─→ T12  (sequential — UI cleanup after backend)
  T9  ─→ T13  (sequential — UI wiring after backend)
  T10 ─┬→ T14 [P]  AnnouncementRenderer
       ├→ T15 [P]  QuickMediaRenderer
       └→ T16 [P]  Camera URL + QuickWebViewRenderer

Phase 4:
  T14, T15, T16 ─→ T17  (overlay wired into PresentationApp)
  T13           ─→ T18  (Limpar)
  T13           ─→ T19  (drag sidebar)
  T13, T17      ─→ T20  (home overlay buttons)

Phase 5:
  T20 ─→ T21  (gate + STATE/ROADMAP)
```

**Parallelism constraint check:** All `[P]` tasks have disjoint file sets (different components or non-overlapping Rust modules). Per TESTING.md, Rust unit/integration and Vitest tests are all parallel-safe. No `[P]` task shares mutable state with a sibling.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Theme tokens in CSS | 1 file (index.css) | ✅ Granular |
| T2–T6: Theme sweeps | 2–4 cohesive files each | ✅ Granular (cohesive sweep) |
| T7: Primary action sweep | 1 cohesive sweep (single concept) | ✅ Granular |
| T8: Auto-monitor command | 1 command + 1 helper | ✅ Granular |
| T9: get_or_create_default_set | 1 command | ✅ Granular |
| T10: Overlay backend | 1 enum + 1 state field + 4 commands (cohesive feature slice) | ✅ Granular (single concern) |
| T11: Remove strophe label | 1 component change | ✅ Granular |
| T12: Monitor-index cleanup | 3 small frontend touches (single concern) | ✅ Granular |
| T13: Single-set home wiring | 1 store + 1 wrapper + nav (single concern) | ✅ Granular |
| T14: AnnouncementRenderer | 1 component | ✅ Granular |
| T15: QuickMediaRenderer | 1 component | ✅ Granular |
| T16: Camera URL + QuickWebViewRenderer | 1 store field + 1 component (cohesive) | ✅ Granular |
| T17: PresentationApp overlay wiring | 1 component branch + API wrappers (single concern) | ✅ Granular |
| T18: Limpar + confirmation | 1 component change | ✅ Granular |
| T19: SongSearchSidebar | 1 new component | ✅ Granular |
| T20: Home overlay buttons | 1 toolbar (cohesive — same UX slice) | ✅ Granular |
| T21: Gate + docs | 1 verification + 2 doc files | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | (root) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T1 | T1 → T5 | ✅ Match |
| T6 | T1 | T1 → T6 | ✅ Match |
| T7 | T1 | T1 → T7 | ✅ Match |
| T8 | None | (independent) | ✅ Match |
| T9 | None | (independent) | ✅ Match |
| T10 | None | (independent) | ✅ Match |
| T11 | None | (independent) | ✅ Match |
| T12 | T8 | T8 → T12 | ✅ Match |
| T13 | T9 | T9 → T13 | ✅ Match |
| T14 | T10 | T10 → T14 | ✅ Match |
| T15 | T10 | T10 → T15 | ✅ Match |
| T16 | T10 | T10 → T16 | ✅ Match |
| T17 | T14, T15, T16 | T14, T15, T16 → T17 | ✅ Match |
| T18 | T13 | T13 → T18 | ✅ Match |
| T19 | T13 | T13 → T19 | ✅ Match |
| T20 | T13, T17 | T13, T17 → T20 | ✅ Match |
| T21 | T20 | T20 → T21 | ✅ Match |

---

## Test Co-location Validation

Coverage matrix references (`.specs/codebase/TESTING.md`):
- `src/components/**/*.tsx` → component (Vitest)
- `src/windows/**/*.tsx` → component (Vitest)
- `src/stores/*.ts` → unit (Vitest)
- `src-tauri/src/services/*.rs` → unit
- `src-tauri/src/db/*.rs` → integration (sqlx::test)
- `src-tauri/src/domain/*.rs` → unit (pure types only)
- `src-tauri/src/commands/*.rs` → none (tested via integration)
- CSS / config files → none

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | CSS only | none | none | ✅ OK |
| T2 | components (classname-only) | component | none (covered by existing) | ✅ OK — no behavior change |
| T3 | components (classname-only) | component | none | ✅ OK — no behavior change |
| T4 | components (classname-only) | component | none | ✅ OK — no behavior change |
| T5 | components (classname-only) | component | none | ✅ OK — no behavior change |
| T6 | components (classname-only) | component | none | ✅ OK — no behavior change |
| T7 | components (classname-only) | component | none | ✅ OK — no behavior change |
| T8 | command + extracted helper (logic) | unit on helper | unit | ✅ OK |
| T9 | command + DB path | integration via sqlx::test | integration | ✅ OK |
| T10 | domain type + commands | unit on domain | unit | ✅ OK |
| T11 | window component (behavior change) | component | component | ✅ OK |
| T12 | components + store (cleanup, no new behavior) | component | covered by existing smoke test | ✅ OK |
| T13 | store + window + new component | component + unit | component | ✅ OK |
| T14 | new component | component | component | ✅ OK |
| T15 | new component | component | component | ✅ OK |
| T16 | store + new component | component + unit | component + store unit | ✅ OK |
| T17 | window + API wrappers (behavior) | component | component | ✅ OK |
| T18 | component (behavior) | component | component | ✅ OK |
| T19 | new component | component | component | ✅ OK |
| T20 | component (behavior, dispatches IPC) | component | component | ✅ OK |
| T21 | docs only | none | none | ✅ OK |

**Note on "classname-only" sweeps:** Theme sweeps T2–T7 don't change component behavior — they only substitute Tailwind utility classes. Existing component tests verify behavior and continue to pass. No new tests are needed under the matrix because no new code layer/behavior is introduced. If during execution a sweep accidentally changes structure (e.g., removes/renames an element), the corresponding test will fail and the task is no longer "classname-only" — at that point add the missing component test.

---

## MCPs and Skills

For each task, suggested tooling:

| Task | MCP | Skill |
| ---- | --- | ----- |
| T1 | NONE | NONE |
| T2–T7 | NONE | NONE (Grep + Edit suffice) |
| T8 | NONE (context7 if Tauri 2 monitor API needs re-verification) | NONE |
| T9 | NONE | NONE |
| T10 | NONE | NONE |
| T11 | NONE | NONE |
| T12 | NONE | NONE |
| T13 | NONE | NONE |
| T14–T16 | NONE | NONE |
| T17 | NONE | NONE |
| T18 | NONE | NONE |
| T19 | NONE (context7 if dnd-kit usage needs refresh) | NONE |
| T20 | NONE | NONE |
| T21 | NONE | NONE |

---

## Commit Plan Summary (one commit per task)

1. `feat(theme): P4H-04 — neutral gray surface tokens + #19A4DD primary`
2. `style(theme): P4H-03 — sweep SetList + SetBuilder to semantic tokens`
3. `style(theme): P4H-03 — sweep CountdownPanel + BackupScreen`
4. `style(theme): P4H-03 — sweep MediaLibrary trio`
5. `style(theme): P4H-03 — sweep notes/section/CCLI report`
6. `style(theme): P4H-03 — sweep set-item editors`
7. `style(theme): P4H-04 — primary actions use #19A4DD token`
8. `feat(presentation): P4H-01 — auto-pick secondary monitor for presentation window`
9. `feat(set): P4H-02 — get_or_create_default_set command`
10. `feat(overlay): P4H-07a — OverlayState + set/clear commands`
11. `feat(presentation): P4H-05 — hide section label on projection`
12. `feat(presentation): P4H-01 — drop manual monitor picker from operator UI`
13. `feat(home): P4H-02 — single fixed set as home view`
14. `feat(overlay): P4H-07b — AnnouncementRenderer`
15. `feat(overlay): P4H-07c — QuickMediaRenderer wrapping MediaSlideRenderer`
16. `feat(overlay): P4H-07d — camera URL setting + QuickWebViewRenderer`
17. `feat(overlay): P4H-07 — wire overlay branch into PresentationApp + Esc`
18. `feat(home): P4H-02 — Limpar action with confirmation`
19. `feat(home): P4H-06 — drag-from-library sidebar`
20. `feat(home): P4H-07 — overlay shortcut buttons (Oferta/Câmera/Aviso/PDF)`
21. `chore(phase4): P4H — STATE/ROADMAP completion summary`
