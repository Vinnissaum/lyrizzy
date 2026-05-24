# Phase 7 — Presentation Rework (Holyrics-style operator, single-monitor fullscreen, dark contrast)

**Created:** 2026-05-22
**Status:** Specifying
**Scope:** Large — touches Rust window logic, React operator UI (full rewrite of presentation surface), theme audit across ~17 components.

---

## Problem Statement

After Phase 6 shipped the in-operator `PresentationNavigator`, three blocking issues surfaced from real-world use:

1. **`Apresentar` button visibly does nothing on the user's machine.** No window appears, the operator view does not transition. The button's `onClick` IS wired (`enterPresentation` → `enter_presentation` Tauri command), and the operator state-machine IS set up to swap to `PresentationNavigator` when `mode === "live"`. Something in the chain is silently failing — most likely the secondary-monitor branch (P4H-01 / D-20) on a single-monitor machine produces a window the user cannot see, OR the lifecycle-driven view swap is not actually firing. The user perceives the click as a complete no-op. We must (a) diagnose and (b) make the success path observable.

2. **Dark theme: black text on dark surfaces, in many places.** P6-03 attempted a sweep, but 34 hardcoded `text-black` / `text-white` / `text-gray-{800,900}` / `bg-white` hits remain across 17 components (counted by `Grep "text-black|text-gray-900|text-gray-800|bg-white|text-white" src/**/*.tsx`). These render unreadable in dark mode. The sweep must finish to zero.

3. **Operator presentation UI is wrong shape.** Today `PresentationNavigator` renders a single long vertical list grouping ALL set items' slides together — every song, every overlay candidate, every counter, in one stack. The user wants Holyrics-style separation:
   - One "active" item at a time (the song currently being projected)
   - A **grid** of strophe thumbnails for that item, click-to-jump
   - A **separate** sidebar listing every other set item (the rest of the set)
   - A **live preview** of what the projection currently shows
   - Clicking a different set item makes it the new active item (replace semantics, not stack/overlay)
   - The overlay buttons (Oferta / Câmera / Aviso) remain available throughout presentation — they layer on top transiently

---

## Goals

- [ ] `Apresentar` button always produces visible, observable behavior (the window opens AND the operator chrome transitions OR a clear error toast appears)
- [ ] Single-monitor machines: presentation enters fullscreen-on-top mode that the user can dismiss with ESC; operator can still ALT+TAB back
- [ ] Two-monitor machines: existing P4H-01 / D-20 behavior preserved (fullscreen on secondary, operator on primary)
- [ ] Dark theme: zero hardcoded black-on-dark or white-on-light text. All operator surfaces meet WCAG AA contrast.
- [ ] Operator presentation surface uses a 3-pane Holyrics-style layout: SET (left) | STROPHES grid (center) | LIVE preview (right)
- [ ] Strophes are rendered as a wrapping grid of thumbnail cards, not a vertical list; click-to-jump remains
- [ ] Clicking a non-active set item in the left pane replaces the active item (the projection switches to its first slide); previous item is no longer projected
- [ ] LIVE pane shows a styled in-app render of the current slide (text + background + overlay), not a screen capture; updates on every state change
- [ ] Overlay buttons (Oferta / Câmera / Aviso) remain operable from inside the presentation layout and behave identically to today (transient overlay over whatever is live)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| True screen-mirror of the presentation window (DXGI / desktop duplication) | Native screen capture in WebView2 is complex and adds zero correctness value over rendering the known state. LIVE pane = re-renders from the same `PresentationState` the projection consumes. |
| Animated strophe thumbnail image generation (rasterized previews) | Strophe cards are text-only previews (current pattern); image rasterization is a future polish, not a blocker |
| Reordering / editing the set from inside the presentation layout | Set editing happens at home; presentation layout is read-only over the set |
| Per-monitor manual picker UI | Auto-pick stands (D-20). Single-monitor uses fullscreen-on-top. |
| Adding new overlay types | Oferta / Câmera / Aviso / PDF stand as today; their internal renderers don't change |
| Holyrics protocol compatibility (network projector, sync APIs, etc.) | We borrow Holyrics's UI ergonomics, not its protocols |
| Persisting "active song index" separately from `currentItemIndex` | The active item IS `currentItemIndex`; clicking left-pane items dispatches `goto_slide(itemIdx, 0)` |
| Sub-pane resize / persistence | Fixed proportions for v1 (e.g. 240px left / 1fr center / 320px right) |

---

## User Stories

### P7-01: Diagnose & fix silent `Apresentar` failure ⭐ MVP

**User Story:** As an operator, when I click `Apresentar`, I want either the presentation to start visibly OR a clear error message — not a silent no-op.

**Why P7-01:** User reports clicking the button has zero observable effect. The handler exists (`HomeSetBuilder.handleApresentar` line 83). It calls `loadSetForPresentation` then `enterPresentation`. The most likely silent failures:
- `enter_presentation` Rust command rejects with `presentation.empty_set` but the frontend `catch` only `console.error`s (no UI surfacing)
- `enter_presentation` succeeds but the window opens on a phantom secondary monitor (e.g. driver reports a disconnected projector as available) and is invisible to the user
- `loadSetForPresentation` silently fails (e.g. missing media file for a set item) and `enter_presentation` then errors out
- Lifecycle event `presentation_lifecycle {phase: "entered"}` never fires → operator chrome stays on home view → user sees nothing change

**Acceptance Criteria:**

1. WHEN the operator clicks `Apresentar` AND the backend returns ANY error THEN a toast SHALL appear in the operator chrome with the error message (Portuguese, user-facing — never raw `console.error` only)
2. WHEN `enter_presentation` succeeds THEN the presentation window SHALL be observable to the user (either on the secondary monitor when extended OR fullscreen-on-top on the primary when single-monitor — see P7-02)
3. WHEN the operator chrome receives `presentation_lifecycle {phase: "entered"}` THEN the main view SHALL swap to the new `OperatorPresentationLayout` (P7-04) within 200ms
4. WHEN `available_monitors()` reports a monitor that is offline/disconnected THEN it SHALL NOT be selected as the presentation target (filter on `size.width > 0 && size.height > 0`)
5. WHEN diagnostics are enabled (an info log line at `enter_presentation` start AND at lifecycle emit) THEN the operator can verify in dev console what path executed
6. WHEN `loadSetForPresentation` fails partway THEN the subsequent `enterPresentation` SHALL NOT be called AND the user SHALL see a toast explaining what failed (e.g. "Media file missing — fix the set first")

**Implementation notes:**
- `src-tauri/src/commands/window.rs::enter_presentation` — add `tracing::info!` at start, before `set_focus()` (existing-window branch), and immediately before the `builder.build()` call (new-window branch). Same for emit.
- Add a defensive filter in monitor enumeration: drop monitors with width=0 OR height=0 (a phantom secondary will report 0×0 on some Windows drivers).
- `src/components/setbuilder/HomeSetBuilder.tsx::handleApresentar` — wrap both `loadSetForPresentation` and `enterPresentation` in a try/catch that converts the `ErrorPayload` into a toast (reuse the existing `emptySetToast` UI pattern, generalize to `errorToast: string | null`)
- Add an end-to-end Vitest test that mocks both commands and asserts the toast appears when either rejects

**Independent Test:** With no projector attached, click Apresentar — either the fullscreen-on-top window appears OR a toast says exactly why it didn't.

---

### P7-02: Single-monitor fullscreen-on-top presentation ⭐ MVP

**User Story:** As an operator on a laptop with one screen, I want `Apresentar` to enter PowerPoint-style "Slide Show" fullscreen-on-top, dismissible with ESC, so I can rehearse on a single screen.

**Why P7-02:** P6-04 mandated `.fullscreen(true)` in both monitor cases, but reports indicate the single-monitor path either fails to draw or draws behind the operator (z-order issue) on Windows. Holyrics and PowerPoint both expose this mode explicitly as "Browse mode" / "single-screen present". The user explicitly chose this option.

**Acceptance Criteria:**

1. WHEN `available_monitors()` returns exactly 1 monitor AND `enter_presentation` is invoked THEN the presentation window SHALL open with `.fullscreen(true).always_on_top(true)` on that monitor
2. WHEN the single-monitor presentation window is open THEN it SHALL cover the operator window (z-order on top) AND the user can ALT+TAB back to the operator
3. WHEN the user presses ESC inside the presentation window OR inside the operator window THEN presentation SHALL exit (existing P6-06 behavior preserved)
4. WHEN `available_monitors()` returns ≥2 monitors THEN `always_on_top` SHALL NOT be set (existing P6-04 behavior on secondary monitor stands)
5. WHEN the user ALT+TABs to the operator during single-monitor presentation THEN the presentation window SHALL remain at top z-order (operator is below)
6. WHEN the presentation window is single-monitor fullscreen-on-top AND the operator clicks anywhere in the operator's `OperatorPresentationLayout` (P7-04) THEN the click SHALL register (i.e. ALT+TAB or click-through brings operator forward; presentation stays on screen behind/around)

**Implementation notes:**
- `src-tauri/src/commands/window.rs::enter_presentation` — when `monitors.len() == 1` (after filtering phantoms per P7-01), call `.always_on_top(true)` before `.fullscreen(true).build()`
- Tauri 2 builder: `WebviewWindowBuilder::always_on_top(true)` is the API (verified at compile time — if absent in 2.x, fall back to `.set_always_on_top(true)` on the built window). Verify via Context7 / Tauri 2 docs before implementation.
- Document the trade-off in design.md: single-monitor user MUST use ESC or F10/blackout — there's no other way to see the operator without dismissing presentation entirely. This matches PowerPoint single-screen.
- The 2+ monitor branch must NOT receive `always_on_top` — secondary fullscreen on the projector should not steal focus from the operator's primary

**Independent Test:** Disconnect external monitor. Click Apresentar. Window covers the screen on top. ALT+TAB shows operator behind it. ESC dismisses.

---

### P7-03: Dark theme — finish the hardcoded-color sweep ⭐ MVP

**User Story:** As an operator using dark theme, I want every text element to be readable on its surface — no leftover black-text-on-dark-surface, no white-text-on-light cases.

**Why P7-03:** P6-03 set up the `--color-fg` token and removed many cases, but 34 occurrences remain across 17 components. The user reports this is still painful. Finish the job; gate it with a script.

**Acceptance Criteria:**

1. WHEN `Grep "text-black|text-gray-900|text-gray-800|text-white|bg-white" src/**/*.tsx` is run THEN it SHALL return zero hits outside `src/windows/presentation/` and `src/components/presentation/{Announcement,Countdown,QuickMedia,Slideshow,Webview}Renderer.tsx` (presentation/projection renderers are intentionally content-driven and exempt)
2. WHEN `Grep "bg-gray-(700|800|900)|border-gray-(600|700)|bg-blue-(500|600)"` is run THEN it SHALL return zero hits in operator components (same exemption as #1)
3. WHEN any element previously using `text-white` for "always white" semantic (e.g. button-on-primary) THEN it SHALL use `text-fg-on-primary` token instead
4. WHEN any element previously using `text-black` THEN it SHALL use `text-fg`
5. WHEN any element previously using `bg-white` for a card surface THEN it SHALL use `bg-surface` (semantic token already adapts)
6. WHEN `scripts/check-theme-tokens.ps1` is updated with the expanded deny-list THEN running it SHALL exit 0
7. WHEN the operator switches to dark theme AND visits every screen (home, library, editor, importers, sets, set-player, countdown, media, backup, settings, presentation-layout) THEN no body text SHALL render at <4.5:1 contrast against its surface

**Scope — 17 files to sweep (from grep count):**
- `BackupScreen.tsx` (3 hits)
- `windows/presentation/PresentationApp.tsx` (2 — verify intentional, may be exempt)
- `CountdownPanel.tsx` (2)
- `AnnouncementRenderer.tsx` (1 — exempt)
- `AnnouncementRenderer.test.tsx` (1 — exempt)
- `ConfirmDialog.tsx` (1)
- `CountdownRenderer.tsx` (1 — exempt)
- `HomeSetBuilder.tsx` (4 — `text-white` on primary buttons; convert to `text-fg-on-primary`)
- `CCLIReportScreen.tsx` (2)
- `MediaPicker.tsx` (1)
- `MediaDetailPanel.tsx` (1)
- `MediaLibrary.tsx` (3)
- `MediaCard.tsx` (3)
- `SlideController.tsx` (2)
- `CountdownSetItemEditor.tsx` (1)
- `SetList.tsx` (2)
- `SetBuilder.tsx` (4)

**Implementation notes:**
- Each file: read, identify each hit, replace with semantic equivalent (`text-fg`, `text-fg-on-primary`, `text-muted`, `bg-surface`, `bg-surface-2`, `bg-primary`, `border-border`)
- For renderer components (Announcement / Countdown / QuickMedia / Slideshow / Webview), KEEP hardcoded `text-white` — these draw on user-supplied media backgrounds and need maximum contrast against any background
- Add `text-fg-on-primary` to the Tailwind theme block in `index.css` if not already there (already declared per line 16 of index.css: `--color-fg-on-primary: #FFFFFF`)
- Update `scripts/check-theme-tokens.ps1` deny-list to include `text-black`, `text-gray-{800,900}`, `bg-white`, and `text-white` (with explicit exemption paths)

**Independent Test:** Run the deny-list script. It exits 0. Switch to dark theme, screenshot 5 random screens — body text is light, never black on near-black.

---

### P7-04: OperatorPresentationLayout — 3-pane Holyrics-style ⭐ MVP

**User Story:** As an operator presenting, I want a 3-pane workspace: SET items on the left, STROPHES of the active item in the center, LIVE preview on the right — matching how Holyrics, OpenLP, and other church-presentation software lay out the operator surface.

**Why P7-04:** The current `PresentationNavigator` (long vertical list grouping all items together) is hard to scan, hides what's NEXT, and forces operators to scroll. The 3-pane model:
- LEFT pane = "what's in the service" — always-visible set outline
- CENTER pane = "what I'm controlling right now" — strophe grid for the current song
- RIGHT pane = "what the audience sees" — live preview of the projection

**Acceptance Criteria:**

1. WHEN presentation mode is active THEN the operator window's main area SHALL render `OperatorPresentationLayout` instead of `PresentationNavigator` (which is replaced/renamed)
2. WHEN `OperatorPresentationLayout` renders THEN it SHALL show three vertically-stacked panes: LEFT (set list, ~240px fixed), CENTER (strophe grid, flex-1), RIGHT (live preview, ~320px fixed)
3. WHEN the screen is narrower than ~1024px THEN RIGHT pane SHALL collapse (hidden); LEFT can also collapse below ~720px (the existing collapse-sidebar pattern from HomeSetBuilder is reused)
4. WHEN presentation exits (ESC / `presentation_lifecycle exited`) THEN the operator view SHALL return to `home` (existing P6-04 behavior)
5. WHEN overlay buttons are clicked (Oferta / Câmera / Aviso / Clear) THEN they SHALL be available from a thin toolbar above or below the 3-pane area (so the operator doesn't have to leave presentation mode to project an overlay)
6. WHEN an overlay is active THEN the LIVE pane SHALL show the overlay (not the underlying slide) — matching what the audience sees
7. WHEN the layout renders THEN each pane SHALL have a labeled header ("Conjunto" / "Estrofes — [item title]" / "Ao vivo") so the role of each pane is clear

**Implementation notes:**
- Create `src/components/presentation/OperatorPresentationLayout.tsx` as the new top-level presentation surface
- Delete `src/components/presentation/PresentationNavigator.tsx` AND its test file after the new layout passes its own tests (P7-04, P7-05, P7-06, P7-07 all share files)
- Wire it in `src/windows/operator/OperatorApp.tsx`: replace `{isPresenting ? <PresentationNavigator /> : ...}` with `{isPresenting ? <OperatorPresentationLayout /> : ...}`
- The overlay toolbar (Oferta / Câmera / Aviso) is extracted from `HomeSetBuilder.tsx` into a shared `<OverlayActionBar />` component so both home and presentation can use it
- Layout uses Tailwind grid: `grid grid-cols-[240px_1fr_320px] gap-2` (with media-query collapses)
- Add `data-testid="operator-presentation-layout"` for tests

**Independent Test:** Start presentation. See three panes: set list on left, strophes in middle, live preview on right. Each pane has a header. Layout responsive at 1280×800 down to 1024×768.

---

### P7-05: STROPHES pane — wrapping thumbnail grid ⭐ MVP

**User Story:** As an operator presenting a song, I want the strophes shown as a wrapping grid of thumbnail-sized cards (V1, C, V2, C, V3, Bridge, End) so I can scan at a glance and click any one to jump.

**Why P7-05:** Today the strophes render as a tall vertical list. A grid: (a) shows more strophes at once, (b) gives a song-structure-at-a-glance feel (chorus repetition becomes visually obvious), (c) matches the user's mental model from Holyrics.

**Acceptance Criteria:**

1. WHEN the active set item is a Song OR SlideShow THEN the CENTER pane SHALL render its slides as a wrapping CSS grid (e.g. `grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2`)
2. WHEN a slide card renders THEN it SHALL show: section label as a small top tag (e.g. "V1", "Coro", "Bridge"), a multi-line truncated lyric preview (≤4 lines), and a visible card border
3. WHEN the current slide is highlighted THEN the active card SHALL have `ring-2 ring-primary bg-primary/10`
4. WHEN the operator clicks any slide card THEN `goto_slide(currentItemIndex, slideIdx)` SHALL fire AND the projection SHALL update in real-time AND the active card SHALL update
5. WHEN the current slide changes (via keys, click, or remote) THEN the active card SHALL update without a page reload AND auto-scroll into view (only if the grid overflows)
6. WHEN the active set item is NOT a Song / SlideShow (Countdown / Media / WebView) THEN the CENTER pane SHALL show a single large card with the item title + an icon + a "Esta apresentação ainda está sendo exibida" message (no strophes to navigate)
7. WHEN the slides array is empty for the active item THEN the CENTER pane SHALL show a friendly empty state ("Nenhum slide encontrado")

**Implementation notes:**
- Component: `src/components/presentation/StrophesGrid.tsx` (consumed by `OperatorPresentationLayout`)
- Slide card subcomponent reuses the styling from the existing `SlideCard` in `PresentationNavigator.tsx` (delete the old component after migration)
- Section label: read from `slide.section_label` if the splitter emits it; otherwise derive from `slide.section_index` (e.g. "1", "2"). Verify the slide_splitter output shape.
- Lyric preview: `<p className="line-clamp-4 leading-snug whitespace-pre-wrap text-xs">{slide.lines.join("\n")}</p>`
- Auto-scroll: `useEffect` on `currentSlideIndex` change → `ref.scrollIntoView({ block: "nearest" })`
- Card aspect ratio: roughly 16:9 (`aspect-video`) — gives a slide-like preview shape
- For Countdown/Media/WebView (single-card variant), keep a "Próximo →" hint (advances to the next set item via `goto_slide(currentItemIndex + 1, 0)`)

**Independent Test:** Load a 6-section song. The center pane shows 6 cards in a grid (2–3 per row depending on width). Each shows the section label and lyric preview. Click verse 3 — projection jumps to verse 3.

---

### P7-06: LIVE preview pane — rendered, not captured ⭐ MVP

**User Story:** As an operator, I want a small live preview of exactly what the audience sees, so I can verify the projection without looking away from the operator screen.

**Why P7-06:** The user explicitly called out wanting to "see the other presentation" — the LIVE pane gives a constant view of "what's currently on the projector". We render it from state (same `PresentationState` the projection consumes) rather than screen-capturing — simpler, no DXGI plumbing, always accurate to state.

**Acceptance Criteria:**

1. WHEN the RIGHT pane renders THEN it SHALL show a 16:9 framed preview that mirrors the current projection content
2. WHEN the projection is showing the current item's slide THEN the preview SHALL render that slide's text on its background (color or media) at a scaled-down size
3. WHEN an overlay is active (Announcement / QuickMedia / QuickWebView) THEN the preview SHALL render the overlay (matching what the audience sees), NOT the underlying slide
4. WHEN the projection is in blackout mode (`PresentationMode::Blank`) THEN the preview SHALL render as a solid black box with a small "BLACKOUT" label
5. WHEN the projection is in frozen mode (`PresentationMode::Frozen`) THEN the preview SHALL render the frozen slide with a small "CONGELADO" label
6. WHEN `PresentationState` changes (via the existing `state_changed` Tauri event) THEN the preview SHALL re-render within 200ms (uses the same Zustand subscription as the rest of the operator)
7. WHEN the preview cannot determine what to render (no set, no current item) THEN it SHALL show a neutral placeholder ("Aguardando início")

**Implementation notes:**
- Component: `src/components/presentation/LivePreview.tsx`
- Reuse the **same renderer components** used in the presentation window (e.g. `QuickMediaRenderer`, `AnnouncementRenderer`, `CountdownRenderer`, `WebviewRenderer`, `SlideshowRenderer`) at a scaled-down size inside a `aspect-video` container. CSS `transform: scale()` or a small `<iframe srcDoc>` — DON'T re-implement the rendering logic.
- DECISION TO CONFIRM in design.md: use direct component composition (re-mount the renderer at 320×180-ish) vs. a fixed-size root with `transform: scale(0.25)` on the actual renderer markup. Direct composition is simpler if renderers are pure; `scale()` is safer for media/video content.
- Performance: video overlay in the LIVE pane is acceptable to MUTE and downscale; user only needs visual confirmation, not audio
- Subscribe to the same `usePresentationStore` already wired in `OperatorApp` — no new IPC

**Independent Test:** Start presentation with a song over a background image. Activate the Oferta overlay. The LIVE pane updates from "song lyrics on background" to "Oferta image". Clear overlay — LIVE pane updates back to lyrics.

---

### P7-07: SET pane — click-to-replace, overlays as buttons ⭐ MVP

**User Story:** As an operator, I want the LEFT pane to list every set item (song, image, counter, slideshow, web view) so I can click any one to switch the active item. Overlay actions (Oferta / Câmera / Aviso) live in a separate toolbar — clicking a set item is REPLACE (projection switches), clicking an overlay button is OVERLAY (projection layers).

**Why P7-07:** The user explicitly chose Replace semantics for inter-item navigation. The existing overlay system (P4H Oferta/Câmera/Aviso/PDF) stays — it already provides layering for transient announcements/media without disrupting the set flow.

**Acceptance Criteria:**

1. WHEN the LEFT pane renders THEN it SHALL list every set item in order (song titles, media display names, countdown labels, web view URLs, slideshow titles) with an icon prefix matching the item type
2. WHEN the active item is rendered in the list THEN its row SHALL have a visible `▶` indicator AND `bg-primary/10 ring-1 ring-primary` highlight
3. WHEN the operator clicks a non-active set item row THEN `goto_slide(targetItemIdx, 0)` SHALL fire — the projection switches to that item's first slide, the CENTER pane retargets to its strophes, the previous item is no longer projected
4. WHEN the operator clicks the currently-active item's row THEN it SHALL be a no-op (no flash, no state change)
5. WHEN the operator hovers a set item row THEN it SHALL show `hover:bg-surface-2` (standard interactive feedback)
6. WHEN an overlay button (Oferta / Câmera / Aviso) is clicked from the OverlayActionBar (P7-04 AC 5) THEN the overlay SHALL layer on top of whatever is currently active (existing P4H behavior unchanged) — clicking Clear Overlay returns to the underlying active item
7. WHEN keyboard 1-9 is pressed (existing P1-10 binding) THEN the same Replace semantics SHALL apply (jump to item N+1) — the existing `jumpToItem` shortcut already routes through `goto_slide(N, 0)` so no new wiring is needed

**Implementation notes:**
- Component: `src/components/presentation/SetItemList.tsx` (consumed by `OperatorPresentationLayout`)
- Icons: reuse the `itemIcon` helper from `PresentationNavigator.tsx` (♪ ▶ 🖼 ⏱ 🌐 📄) — move it to a shared util `src/components/presentation/itemIcon.ts`
- Item label: reuse the `groupHeader` logic from `PresentationNavigator.tsx`; extract to a shared helper `itemLabel(item, songs, media): string`
- Click handler: `() => goToItem(itemIdx, 0).catch(console.error)` — same command that already powers the existing navigator
- Inline overlay shortcuts: render `<OverlayActionBar />` extracted from HomeSetBuilder.tsx as a top strip above the 3-pane grid

**Independent Test:** Set has 3 songs + 1 image. Start presentation on song 1. Click song 3 in the left pane — projection jumps to song 3 verse 1; CENTER pane shows song 3's strophes. Click the image — projection switches to the image. Click Oferta — overlay layers on top of the image. Clear overlay — image still showing.

---

### P7-08: Extract `OverlayActionBar` component ⭐ MVP

**User Story:** As a maintainer, I want the overlay-action toolbar (Apresentar / Oferta / Câmera / Aviso / PDF / Clear) extracted to a reusable component so home and presentation can both use it without duplication.

**Why P7-08:** Today the bar is inline in `HomeSetBuilder.tsx` (lines 228–275). P7-04 needs the same bar inside the presentation layout. Extract once, reuse twice.

**Acceptance Criteria:**

1. WHEN `OverlayActionBar` is rendered THEN it SHALL emit the same buttons currently in `HomeSetBuilder` (Apresentar, optional Clear Overlay, Oferta, Câmera, Aviso, PDF)
2. WHEN the `showApresentarButton` prop is `false` THEN the Apresentar button SHALL be hidden (presentation layout: no need to start presentation when already presenting)
3. WHEN `HomeSetBuilder` is rendered THEN it SHALL use `<OverlayActionBar showApresentarButton />` (passing all required handlers as props)
4. WHEN `OperatorPresentationLayout` is rendered THEN it SHALL use `<OverlayActionBar showApresentarButton={false} />`
5. WHEN dialogs are triggered (Camera URL prompt, Announcement textarea, Media picker) THEN they SHALL live in their own component (`<OverlayDialogs />`) shared by both call sites OR remain inline in their respective parents — pick one in design.md
6. WHEN the toolbar renders in either context THEN keyboard shortcuts and i18n keys SHALL be identical

**Implementation notes:**
- Component: `src/components/presentation/OverlayActionBar.tsx`
- Props: `{ onApresentar?, onOferta, onCamera, onAviso, onPdf, onClearOverlay, isOverlayActive, showApresentarButton, isImportingPresentation }`
- Dialogs decision: keep them in `HomeSetBuilder` for the home context and in `OperatorPresentationLayout` for the presentation context — OR extract `<OverlayDialogs />`. Decide in design.md based on duplication cost.
- Test: snapshot test the bar in both modes

**Independent Test:** `HomeSetBuilder` and `OperatorPresentationLayout` render the same toolbar (visually identical) — just one has Apresentar, the other doesn't.

---

## Edge Cases

- WHEN the operator clicks `Apresentar` AND `loadSetForPresentation` throws (e.g. missing media) THEN system SHALL surface the error in a toast AND NOT call `enterPresentation` (P7-01 AC 6)
- WHEN the operator's machine has a connected-but-asleep secondary monitor THEN system SHALL detect it as size 0×0 OR include it (driver-dependent) — test both, prefer size-filtering at the monitor enumeration step
- WHEN the operator presses ESC inside the operator window while presentation is fullscreen-on-top (single-monitor) THEN system SHALL exit presentation (operator's keydown still works under fullscreen-on-top because ALT+TAB or focus on operator restores keyboard scope)
- WHEN a song has zero slides (edge case — empty song body) THEN system SHALL show the empty-state in the CENTER pane (P7-05 AC 7) AND NOT crash navigation
- WHEN the operator is on the SlideShow item (PPTX/PDF with N slides) THEN CENTER pane SHALL render N cards, one per slide, labeled `Slide 1`, `Slide 2`, …, `Slide N` (P7-05 AC 1)
- WHEN the operator switches monitors mid-presentation (unplug projector) THEN system SHALL NOT crash; the existing window remains open; user can ESC out and restart
- WHEN multiple overlays are stacked rapidly (Oferta → Câmera → Aviso) THEN system SHALL show only the most recent (existing P4H behavior; not changed)
- WHEN the operator clicks Apresentar AND no monitors are reported (degenerate hardware) THEN system SHALL show a toast "Nenhum monitor detectado" AND NOT crash
- WHEN dark theme is active AND the LIVE preview renders a media background THEN the preview frame SHALL retain a `border-border` border so the preview is distinguishable from the surrounding pane

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
|---------------|-------|----------|--------|
| P7-01 | Diagnose & fix silent `Apresentar` failure | P1 | Pending |
| P7-02 | Single-monitor fullscreen-on-top presentation | P1 | Pending |
| P7-03 | Dark theme — finish hardcoded-color sweep | P1 | Pending |
| P7-04 | OperatorPresentationLayout — 3-pane Holyrics-style | P1 | Pending |
| P7-05 | STROPHES pane — wrapping thumbnail grid | P1 | Pending |
| P7-06 | LIVE preview pane — rendered, not captured | P1 | Pending |
| P7-07 | SET pane — click-to-replace, overlays as buttons | P1 | Pending |
| P7-08 | Extract `OverlayActionBar` component | P2 | Pending |

**Coverage:** 8 requirements (7× P1, 1× P2). All necessary to deliver the three reported pain points.

---

## Success Criteria

- [ ] Clicking `Apresentar` on any hardware configuration produces either: a visible presentation window OR a clear toast explaining what went wrong (P7-01)
- [ ] Single-monitor laptop: presentation enters fullscreen-on-top, ALT+TAB shows operator, ESC dismisses (P7-02)
- [ ] Two-monitor: presentation on secondary, operator on primary, no `always_on_top` regression (P7-02 AC 4)
- [ ] `Grep "text-black|text-gray-(800|900)|bg-white|text-white" src/**/*.tsx` returns zero hits outside the renderer exemption list (P7-03)
- [ ] WCAG AA contrast verified by visual sampling on 5 random dark-theme screens (P7-03)
- [ ] During presentation, the operator screen shows three labeled panes: Conjunto / Estrofes / Ao vivo (P7-04)
- [ ] Strophes render as a wrapping grid; clicking any card jumps the projection (P7-05)
- [ ] LIVE pane updates in real-time as state changes, including overlays and blackout (P7-06)
- [ ] Clicking a different set item in the left pane replaces the active item (projection switches) (P7-07)
- [ ] Overlay buttons (Oferta/Câmera/Aviso) work identically from presentation as from home (P7-08)
- [ ] Existing Rust test count (175) holds or grows; new tests cover P7-01 monitor-filter, P7-02 always_on_top branch, P7-04 layout smoke, P7-05 grid click-to-jump, P7-06 preview state-sync, P7-07 replace semantics
- [ ] Existing Vitest test count (104) holds or grows; old `PresentationNavigator.test.tsx` deleted as part of P7-04 cleanup
- [ ] `tsc --noEmit` clean
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` clean
- [ ] `scripts/check-theme-tokens.ps1` exit 0 with expanded deny-list (P7-03 AC 6)

---

## Implementation Order (suggested)

1. **P7-01** (diagnose Apresentar) — until this works the user can't validate anything else; pure debugging + observability
2. **P7-02** (single-monitor fullscreen-on-top) — small Rust change, unblocks single-monitor testing
3. **P7-08** (extract OverlayActionBar) — pure refactor, paves the way for P7-04 reuse
4. **P7-04** (3-pane layout shell) — depends on P7-08; lays the structural grid
5. **P7-05** (strophes grid) — depends on P7-04; replaces the center pane's content
6. **P7-07** (set list pane) — depends on P7-04; populates the left pane
7. **P7-06** (live preview) — depends on P7-04; populates the right pane
8. **P7-03** (dark contrast sweep) — independent, mechanical; can run in parallel with any of the above

---

## Gray Areas — Resolved (see [context.md](context.md))

- Single-monitor behavior: **fullscreen on top, toggleable via ESC/ALT+TAB**
- Layout shape: **3-pane (set list | strophes grid | live preview)**
- Click-on-non-active-item: **Replace (becomes the new active item)**
- Dark mode fix scope: **Audit & re-token every hardcoded color (zero-tolerance sweep)**

## Gray Areas — Deferred to Design

- LIVE preview implementation: direct renderer composition vs. CSS `transform: scale()` — to be decided in design.md (P7-06 implementation notes)
- OverlayDialogs extraction: shared component vs. inline duplication — to be decided in design.md (P7-08 implementation notes)
- `always_on_top` Tauri 2 API path: builder method vs. post-build setter — verify via Context7 in design.md
