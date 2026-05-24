# Phase 7 — Presentation Rework — Tasks

**Spec:** `.specs/features/phase7-presentation-rework/spec.md` (8 requirements P7-01..P7-08)
**Design:** `.specs/features/phase7-presentation-rework/design.md`
**Context:** `.specs/features/phase7-presentation-rework/context.md`
**Status:** Draft
**Created:** 2026-05-22

---

## Execution Plan

### Phase 1 — Independent foundations (parallel)

```
T1 [P]  enter_presentation: monitor filter + no_monitors error + tracing observability (P7-01 backend)
T9 [P]  Dark theme zero-tolerance sweep + check-theme-tokens.ps1 expansion (P7-03)
```

### Phase 2 — Build on backend foundation (parallel after T1)

```
T1 → T2 [P]  HomeSetBuilder error toast wiring + i18n (P7-01 frontend)
T1 → T3 [P]  enter_presentation: always_on_top branch for single-monitor (P7-02)
```

### Phase 3 — Refactor toolbar (after T2)

```
T2 → T4  Extract <OverlayActionBar /> from HomeSetBuilder (P7-08)
```

### Phase 4 — 3-pane shell (after T4)

```
T4 → T5  OperatorPresentationLayout shell + itemMeta helpers + OperatorApp swap-in (P7-04)
```

### Phase 5 — Populate panes (parallel after T5)

```
T5 → T6 [P]  SetItemList — LEFT pane, click-to-replace (P7-07)
T5 → T7 [P]  StrophesGrid — CENTER pane, wrapping thumbnail grid (P7-05)
T5 → T8 [P]  LivePreview — RIGHT pane, hybrid render strategy (P7-06)
```

### Phase 6 — Cleanup + Gate

```
T3, T6, T7, T8, T9 → T10  Delete PresentationNavigator + full gate + STATE/ROADMAP update
```

---

## Task Breakdown

### T1: enter_presentation monitor filter + no_monitors error + tracing (P7-01 backend) [P]

**What:** Filter phantom 0×0 monitors out of `app.available_monitors()`. Return `presentation.no_monitors` when all monitors are filtered. Add `tracing::info!` lines at start, before window build, and after lifecycle emit for diagnosis of the user's silent-failure report.

**Where:**
- `src-tauri/src/commands/window.rs::enter_presentation`:
  - After `app.available_monitors()` (currently line ~128), insert a filter step: `monitors.retain(|m| { let s = m.size(); s.width > 0 && s.height > 0 })`
  - If `monitors.is_empty()` → `return Err(ErrorPayload::new("presentation.no_monitors"))` BEFORE entering either branch (new-window or existing-window-focus)
  - Add `tracing::info!(monitors = monitors.len(), secondary_idx = ?secondary_idx, "enter_presentation: building window")` immediately before the `.build()` call in the new-window branch
  - Add `tracing::info!("enter_presentation: lifecycle entered emitted")` immediately after `app.emit("presentation_lifecycle", ...)` for the entered phase
  - Extract a pure helper `pub(crate) fn filter_real_monitors(monitors: Vec<Monitor>) -> Vec<Monitor>` so the filter logic is unit-testable without a live Tauri app (or, if `tauri::Monitor` is opaque, define a private trait/struct shim `MonitorSize { width: u32, height: u32 }` and unit-test that)
- `src-tauri/src/lib.rs` — verify a `tracing_subscriber` is initialized at setup; if absent, add `tracing_subscriber::fmt().init();` in the dev branch so `tracing::info!` output reaches the dev console (risk register §10 row 2)

**Depends on:** None

**Reuses:**
- Existing `ErrorPayload::new(code)` infra
- Existing `tracing` dependency (already in `Cargo.toml` per design §11)
- Existing `enter_presentation` skeleton from Phase 6 T3 (D-28)

**Tools:** NONE

**Done when:**
- [ ] `enter_presentation` filters monitors with width=0 OR height=0 BEFORE selecting secondary
- [ ] When no monitors survive the filter, `enter_presentation` returns `Err(ErrorPayload::new("presentation.no_monitors"))` and does NOT call `.build()`
- [ ] `tracing::info!` line emits monitor count + secondary index at window build time
- [ ] `tracing::info!` line emits at lifecycle entered emit
- [ ] If a tracing subscriber was missing, `lib.rs` now initializes one in the dev branch
- [ ] Unit test: `filter_real_monitors` (or equivalent shim) drops `MonitorSize{0,0}` and keeps `MonitorSize{1920,1080}`
- [ ] Unit test: `filter_real_monitors` on all-zero input returns empty `Vec`
- [ ] Unit test: returns error code `"presentation.no_monitors"` when filter yields empty (via the existing `ErrorPayload` round-trip test pattern from Phase 2)
- [ ] `cargo build --manifest-path src-tauri/Cargo.toml` clean
- [ ] Gate: `cargo test --manifest-path src-tauri/Cargo.toml` green

**Tests:** unit (`src-tauri/src/commands/window.rs` filter helper via extracted pure fn)
**Gate:** quick
**Commit:** `feat(presentation): P7-01 — enter_presentation monitor filter + observability`

---

### T2: HomeSetBuilder error toast wiring + i18n (P7-01 frontend) [P]

**What:** Wrap `handleApresentar` so any `ErrorPayload` from `loadSetForPresentation` OR `enterPresentation` surfaces as a top-center toast (Portuguese, user-facing). Do not call `enterPresentation` if `loadSetForPresentation` rejected. Reuse the existing empty-set toast UI; generalize state from `emptySetToast: boolean` to `errorToast: string | null`.

**Where:**
- `src/components/setbuilder/HomeSetBuilder.tsx::handleApresentar`:
  - Replace `useState<boolean>(false)` for `emptySetToast` with `useState<string | null>(null)` named `errorToast`
  - Try block: `await loadSetForPresentation(fixedSetId); await enterPresentation();`
  - Catch: `const payload = err as { code?: string; params?: Record<string, string> }; setErrorToast(t(\`error.\${payload.code ?? "unknown"}\`, payload.params))`
  - `setTimeout(() => setErrorToast(null), 5000)` after set
  - Toast JSX renders if `errorToast` is non-null (top-center, amber, mirror the existing empty-set styling)
  - The existing empty-set short-circuit (`if (currentSet.items.length === 0)`) keeps its own toast variant OR routes through `setErrorToast(t("error.presentation.empty_set"))` — pick the route that keeps the message identical
- `src/i18n/locales/pt-BR.json` AND `src/i18n/locales/en-US.json`:
  - `error.presentation.no_monitors` ("Nenhum monitor detectado" / "No monitor detected")
  - `error.presentation.empty_set` ("Adicione itens ao conjunto antes de apresentar" / "Add items to the set before presenting") — verify existing key or rename to `error.*` namespace for consistency
  - `error.unknown` ("Erro ao iniciar apresentação" / "Failed to start presentation")
- `src/components/setbuilder/HomeSetBuilder.test.tsx` — add:
  - Test: when `enterPresentation` mocked to reject with `{ code: "presentation.no_monitors" }`, the toast text appears
  - Test: when `loadSetForPresentation` mocked to reject, `enterPresentation` is NOT called (assert via mock)
  - Test: existing empty-set behavior still surfaces a toast

**Depends on:** T1 (needs the `presentation.no_monitors` error code defined)

**Reuses:**
- Existing toast UI pattern in `HomeSetBuilder.tsx` (lines ~310–330 — the empty-set toast)
- Existing `t()` i18n hook
- Existing `ErrorPayload { code, params }` deserialization (Phase 2 D-9)

**Tools:** NONE

**Done when:**
- [ ] `handleApresentar` wraps BOTH `loadSetForPresentation` AND `enterPresentation` in one try/catch
- [ ] On error, `enterPresentation` is NOT called when `loadSetForPresentation` rejects (verified by mock-call assertion in the test)
- [ ] Error code maps to a translated, user-facing toast (never raw `console.error` only)
- [ ] Toast auto-dismisses after 5 seconds
- [ ] i18n keys added in BOTH locales
- [ ] Vitest: 3 tests above pass
- [ ] `tsc --noEmit` clean
- [ ] Gate: `npx vitest run` green

**Tests:** component (HomeSetBuilder toast surfacing)
**Gate:** quick
**Commit:** `feat(operator): P7-01 — HomeSetBuilder error toast for Apresentar failures`

---

### T3: enter_presentation always_on_top for single-monitor (P7-02) [P]

**What:** When the filtered monitor list has exactly 1 entry, build the presentation window with `.always_on_top(true)` in addition to `.fullscreen(true)`. The 2+ monitor branch is unchanged (no `always_on_top`, secondary fullscreen as today). Extract the branch decision as a pure testable helper.

**Where:**
- `src-tauri/src/commands/window.rs::enter_presentation`:
  - After T1's filter, in the new-window branch, compute `let pin_on_top = monitors.len() == 1;`
  - Apply: `let builder = if pin_on_top { builder.always_on_top(true) } else { builder };`
  - Continue with `.fullscreen(true).build()`
  - Extract a pure helper `pub(crate) fn should_pin_on_top(monitor_count: usize) -> bool { monitor_count == 1 }` for unit-testability (matches design §4.2 + risk register §10 row 1 mitigation)
- The 2+ monitor branch via `apply_monitor()` stays untouched (no `always_on_top`)
- Update the `tracing::info!` in T1 to also log `always_on_top = pin_on_top`

**Depends on:** T1 (needs the post-filter `monitors.len()` and the same builder block)

**Reuses:**
- `WebviewWindowBuilder::always_on_top(bool) -> Self` (Tauri 2.11.2 stable API, verified design §4.2)
- `apply_monitor` helper (untouched)
- The `tracing::info!` line from T1 (extends its fields)

**Tools:** Context7 — re-verify `WebviewWindowBuilder::always_on_top` signature against Tauri 2.11.2 docs before implementation (design §4.2 says verified, but build may have moved)

**Done when:**
- [ ] `should_pin_on_top(1) == true`, `should_pin_on_top(2) == false`, `should_pin_on_top(0) == false`
- [ ] In `enter_presentation`, single-monitor branch applies `.always_on_top(true)` BEFORE `.fullscreen(true).build()`
- [ ] Multi-monitor branch does NOT apply `.always_on_top`
- [ ] `tracing::info!` includes the `always_on_top` boolean
- [ ] Unit test: `should_pin_on_top` covers 0, 1, 2, 3 monitor counts
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` clean
- [ ] Gate: `cargo test --manifest-path src-tauri/Cargo.toml` green

**Tests:** unit (`should_pin_on_top` pure fn)
**Gate:** quick
**Commit:** `feat(presentation): P7-02 — single-monitor always_on_top fullscreen`

---

### T4: Extract <OverlayActionBar /> from HomeSetBuilder (P7-08)

**What:** Pure refactor — pull the overlay-button toolbar (Apresentar / Clear-Overlay / Oferta / Câmera / Aviso / PDF) out of `HomeSetBuilder.tsx` into a reusable `<OverlayActionBar />` component. Dialogs (Camera URL prompt, Announcement textarea, Media picker) STAY inline in `HomeSetBuilder` per design §6.

**Where:**
- `src/components/presentation/OverlayActionBar.tsx` (new):
  ```ts
  interface Props {
    showApresentarButton: boolean;
    onApresentar?: () => void;
    onOferta: () => void;
    onCamera: () => void;
    onAviso: () => void;
    onPdf: () => void;
    onClearOverlay: () => void;
    isOverlayActive: boolean;
    isImportingPresentation: boolean;
  }
  ```
  - Render the same JSX currently in `HomeSetBuilder.tsx` lines ~228–275 (toolbar row only)
  - Apresentar button hidden when `showApresentarButton === false`
  - Clear-Overlay button visible only when `isOverlayActive === true`
  - PDF button shows the "Em breve" tooltip currently in HomeSetBuilder (P4H-07e — unchanged behavior)
  - Use semantic tokens throughout (`bg-surface`, `text-fg`, `border-border`, `bg-primary text-fg-on-primary`) — no hardcoded colors (paves the way for T9 sweep)
- `src/components/setbuilder/HomeSetBuilder.tsx`:
  - Replace the inline toolbar JSX with `<OverlayActionBar showApresentarButton={true} onApresentar={handleApresentar} onOferta={handleOferta} onCamera={handleCameraClick} onAviso={handleAvisoClick} onPdf={handlePdfClick} onClearOverlay={handleClearOverlay} isOverlayActive={!!state?.overlay} isImportingPresentation={isImportingPresentation} />`
  - All existing dialog state and handlers stay in `HomeSetBuilder`
- `src/components/presentation/OverlayActionBar.test.tsx` (new):
  - Snapshot: `showApresentarButton={true}` renders Apresentar button
  - Snapshot: `showApresentarButton={false}` does NOT render Apresentar button
  - Click each button — assert respective handler called via `vi.fn()` mocks
  - `isOverlayActive={true}` renders Clear-Overlay; `false` hides it
- Verify `HomeSetBuilder.test.tsx` still passes (button text and click-paths unchanged from caller perspective)

**Depends on:** T2 (avoids touching `handleApresentar` twice)

**Reuses:**
- Existing handlers in `HomeSetBuilder.tsx`
- Existing i18n keys for button labels (`operator.apresentar`, `overlay.oferta`, etc.)
- Existing semantic tokens

**Tools:** NONE

**Done when:**
- [ ] `OverlayActionBar.tsx` exists; props match design §8.5
- [ ] `HomeSetBuilder.tsx` no longer contains the toolbar JSX inline (only the dialog state + handlers)
- [ ] Visual rendering of `HomeSetBuilder` is byte-identical before/after (no DOM tree change beyond component wrapping)
- [ ] `OverlayActionBar.test.tsx` covers both `showApresentarButton` modes + each button's click handler
- [ ] Existing `HomeSetBuilder.test.tsx` still passes
- [ ] `tsc --noEmit` clean
- [ ] Gate: `npx vitest run` green

**Tests:** component (OverlayActionBar new tests + HomeSetBuilder regression)
**Gate:** quick
**Commit:** `refactor(presentation): P7-08 — extract OverlayActionBar component`

---

### T5: OperatorPresentationLayout shell + itemMeta helpers + OperatorApp swap-in (P7-04)

**What:** Create the new 3-pane shell `OperatorPresentationLayout.tsx` that replaces `PresentationNavigator` as the operator's main view during presentation. Wires in `<OverlayActionBar showApresentarButton={false} />` as a top strip + 3-pane grid with labeled pane headers (Conjunto / Estrofes / Ao vivo). Child panes are stubbed in this task (`<div>{label}</div>` placeholders); T6/T7/T8 fill them in. Extract `itemIcon()` + `itemLabel()` from `PresentationNavigator.tsx` into a shared `itemMeta.ts`.

**Where:**
- `src/components/presentation/itemMeta.ts` (new):
  - Export `itemIcon(item: SetItem): string` — copy of the icon helper from `PresentationNavigator.tsx` (♪ ▶ 🖼 ⏱ 🌐 📄 mapping)
  - Export `itemLabel(item: SetItem, songs: Song[], media: MediaItem[]): string` — copy of `groupHeader` logic from `PresentationNavigator.tsx`
- `src/components/presentation/OperatorPresentationLayout.tsx` (new):
  - Subscribes to `usePresentationStore`
  - Returns the empty-state placeholder when `!state || !state.set`
  - Renders top strip: `<OverlayActionBar showApresentarButton={false} onOferta={...} onCamera={...} onAviso={...} onPdf={...} onClearOverlay={...} isOverlayActive={!!state.overlay} isImportingPresentation={false} />` (handlers wire to the same Tauri commands as `HomeSetBuilder`; promote them to a shared hook or inline-duplicate per design §6 — design says inline)
  - Below the toolbar: `<div className="grid grid-cols-[240px_1fr_320px] gap-2 h-full">`
    - LEFT: `<header className="text-xs text-muted px-2 py-1">Conjunto</header>` + `<div data-testid="set-pane-stub">SetItemList</div>` (T6 replaces stub)
    - CENTER: `<header>Estrofes — {itemLabel(activeItem)}</header>` + `<div data-testid="strophes-pane-stub">StrophesGrid</div>` (T7 replaces stub)
    - RIGHT: `<header>Ao vivo</header>` + `<div data-testid="live-pane-stub">LivePreview</div>` (T8 replaces stub)
  - Responsive collapse: `lg:grid-cols-[240px_1fr_320px] md:grid-cols-[240px_1fr] sm:grid-cols-[1fr]` (LEFT collapses below 720px; RIGHT collapses below 1024px — design §AC 3)
  - `data-testid="operator-presentation-layout"` on the root
- `src/windows/operator/OperatorApp.tsx`:
  - Replace the `{isPresenting && <PresentationNavigator />}` branch with `{isPresenting && <OperatorPresentationLayout />}`
  - Keep `PresentationNavigator` import + file in place for now (T10 deletes both)
- Add new i18n keys in BOTH locales:
  - `presentation.pane.set` ("Conjunto" / "Set")
  - `presentation.pane.strophes` ("Estrofes" / "Strophes")
  - `presentation.pane.live` ("Ao vivo" / "Live")
  - `presentation.empty` ("Aguardando início" / "Waiting to start")
- `src/components/presentation/OperatorPresentationLayout.test.tsx` (new):
  - Renders all 3 pane headers when state has a non-empty set
  - Renders empty-state placeholder when `state.set` is undefined or has no items
  - Renders `<OverlayActionBar />` with `showApresentarButton={false}`

**Depends on:** T4 (needs `<OverlayActionBar />` extracted)

**Reuses:**
- `usePresentationStore` (existing Zustand store)
- `<OverlayActionBar />` (from T4)
- Existing semantic tokens
- `PresentationNavigator.tsx` lines 9–18 (icon map) and 79–113 (groupHeader) — copied into `itemMeta.ts` (delete the originals in T10 after migration)

**Tools:** NONE

**Done when:**
- [ ] `itemMeta.ts` exports `itemIcon` and `itemLabel` matching the existing `PresentationNavigator` helpers
- [ ] `OperatorPresentationLayout.tsx` renders a 3-pane grid with three labeled headers
- [ ] All three pane bodies are stub `<div>` elements with predictable `data-testid` markers
- [ ] `<OverlayActionBar />` renders above the grid with Apresentar hidden
- [ ] OperatorApp swaps `<PresentationNavigator />` → `<OperatorPresentationLayout />` in the `isPresenting` branch
- [ ] Responsive grid collapses RIGHT below 1024px and LEFT below 720px (verify with `window.matchMedia` mock OR by class-string assertion)
- [ ] i18n keys added in BOTH locales
- [ ] Vitest: 3 tests above pass
- [ ] `tsc --noEmit` clean
- [ ] Gate: `npx vitest run` green

**Tests:** component (layout shell + i18n + OperatorApp routing assertion)
**Gate:** quick
**Commit:** `feat(presentation): P7-04 — OperatorPresentationLayout 3-pane shell + itemMeta helpers`

---

### T6: SetItemList — LEFT pane, click-to-replace (P7-07) [P]

**What:** Implement the LEFT pane: a vertical list of every set item with icon + label. The active item is highlighted (`bg-primary/10 ring-1 ring-primary` + `▶` indicator). Clicking a non-active row dispatches `goto_slide(targetItemIdx, 0)` — REPLACE semantics. Clicking the active row is a no-op.

**Where:**
- `src/components/presentation/SetItemList.tsx` (new):
  - Subscribe via narrow selectors: `usePresentationStore((s) => s.state?.set?.items ?? [])` and `usePresentationStore((s) => s.state?.currentItemIndex)` (design §3 — avoids re-render on `currentSlideIndex`)
  - For each item, render `<button>` row with:
    - `itemIcon(item)` prefix
    - `itemLabel(item, songs, media)` body
    - Active row: `bg-primary/10 ring-1 ring-primary text-fg` + `▶` glyph; `aria-current="true"`
    - Hover: `hover:bg-surface-2`
  - `onClick = (idx) => { if (idx !== currentItemIndex) goToItem(idx, 0).catch((e) => console.error(e)) }` — active row click is a no-op
  - Wrap container: `overflow-y-auto` so long sets scroll
- `src/components/presentation/SetItemList.test.tsx` (new):
  - Set with 3 items renders 3 rows
  - Active item row has `aria-current="true"`
  - Click on non-active row invokes `goToItem(idx, 0)` once (mock `goToItem` via `vi.mock("@/api/commands")`)
  - Click on active row does NOT invoke `goToItem`
  - Each row shows `itemIcon` + `itemLabel`
- Replace the `SetItemList` stub in `OperatorPresentationLayout.tsx` with the real component

**Depends on:** T5 (needs the layout shell slot + itemMeta helpers)

**Reuses:**
- `itemIcon` + `itemLabel` from T5's `itemMeta.ts`
- `goToItem` API command wrapper (existing — `commands/presentation.rs::go_to_item` per design §10 risk row)
- Existing `usePresentationStore` selector pattern from `OperatorApp.tsx`
- Existing `useSongStore` and `useMediaStore` for `songs` / `media` lookups (verify selectors)

**Tools:** NONE

**Done when:**
- [ ] LEFT pane lists every set item in order
- [ ] Active item row visibly highlighted + `aria-current`
- [ ] Click on non-active row dispatches `goToItem(idx, 0)`
- [ ] Click on active row is a no-op (no command call)
- [ ] Hover styling uses `hover:bg-surface-2`
- [ ] No hardcoded colors (uses semantic tokens — will pass T9's deny-list)
- [ ] Vitest: 5 tests above pass
- [ ] OperatorPresentationLayout no longer renders the SetItemList stub
- [ ] Gate: `npx vitest run` green

**Tests:** component
**Gate:** quick
**Commit:** `feat(presentation): P7-07 — SetItemList LEFT pane with click-to-replace`

---

### T7: StrophesGrid — CENTER pane, wrapping thumbnail grid (P7-05) [P]

**What:** Implement the CENTER pane: a wrapping CSS grid of slide cards for the active item. Each card shows a section-label tag + clamped lyric preview. Active card is ringed in primary. Click jumps via `goto_slide(currentItemIndex, slideIdx)`. Active card auto-scrolls into view. Non-Song/SlideShow items render a single info card with a "Próximo →" hint.

**Where:**
- `src/components/presentation/StrophesGrid.tsx` (new):
  - Narrow selectors: `usePresentationStore((s) => s.state?.currentItemIndex)`, `usePresentationStore((s) => s.state?.currentSlideIndex)`, `usePresentationStore((s) => s.state?.allSlidesPerItem)`, `usePresentationStore((s) => s.state?.set?.items)`
  - Compute `activeItem = items[currentItemIndex]` and `slides = allSlidesPerItem[currentItemIndex] ?? []`
  - Branch:
    - **Song / SlideShow:** wrapping grid `className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2"`, one card per slide
    - **Countdown / Media / WebView:** single info card with `itemIcon` + `itemLabel` + `<p>{t("presentation.singleItem.hint")}</p>` (e.g. "Esta apresentação está sendo exibida")
    - **Empty slides:** `<div className="text-muted text-center py-12">{t("presentation.noSlides")}</div>`
  - Slide card subcomponent (private to this file):
    - `aspect-video` container with `border border-border rounded-md bg-surface`
    - Top: small tag with section label (read `slide.section_label` if present, else derive from `slide.section_index + 1`)
    - Body: `<p className="line-clamp-4 leading-snug whitespace-pre-wrap text-xs text-fg">{slide.lines.join("\n")}</p>`
    - Active: add `ring-2 ring-primary bg-primary/10`
    - For SlideShow items, label "Slide N/M" (per spec P7-05 AC 1 + Phase 6 navigator parity)
  - `useEffect` on `[currentSlideIndex]`: `activeCardRef.current?.scrollIntoView({ block: "nearest" })`
  - `onClick = (slideIdx) => goToItem(currentItemIndex, slideIdx)` — uses the same command as SetItemList
- `src/components/presentation/StrophesGrid.test.tsx` (new):
  - Song with 6 slides renders 6 cards; each card shows lyric preview text
  - Active slide card has `ring-primary` class and is scrolled into view (`scrollIntoView` spy)
  - Click on card N dispatches `goToItem(currentItemIndex, N)`
  - Countdown active item renders a single info card (not a grid)
  - Empty slides → empty-state copy
  - SlideShow item renders N cards labeled "Slide 1", "Slide 2", … (cf. Phase 6 navigator behavior)
- Replace the `StrophesGrid` stub in `OperatorPresentationLayout.tsx` with the real component
- Verify `slide.section_label` exists on the splitter output — if absent, derive from `section_index`. Audit `src-tauri/src/services/slide_splitter.rs` output OR `src/types/index.ts` `Slide` shape before relying on the field

**Depends on:** T5 (needs the layout slot)

**Reuses:**
- `itemIcon` + `itemLabel` from `itemMeta.ts` (single-card branch)
- `goToItem` API wrapper
- `allSlidesPerItem` from `PresentationState` (populated in Phase 6 T3 via `load_set_for_presentation`)
- Card styling from existing `PresentationNavigator.tsx` slide cards
- `line-clamp-4` Tailwind utility (already used in P6-05)

**Tools:** NONE

**Done when:**
- [ ] Song with N slides renders N cards in a wrapping grid
- [ ] Active card visibly ringed with primary color + `aria-current="true"`
- [ ] Click on card dispatches `goToItem(currentItemIndex, slideIdx)`
- [ ] `scrollIntoView({ block: "nearest" })` called on `currentSlideIndex` change
- [ ] Countdown / Media / WebView items render a single info card
- [ ] Empty slides array renders an empty-state placeholder
- [ ] SlideShow items render N cards labeled "Slide 1"…"Slide N"
- [ ] No hardcoded colors
- [ ] Vitest: 6 tests above pass
- [ ] OperatorPresentationLayout no longer renders the StrophesGrid stub
- [ ] Gate: `npx vitest run` green

**Tests:** component
**Gate:** quick
**Commit:** `feat(presentation): P7-05 — StrophesGrid wrapping thumbnail grid`

---

### T8: LivePreview — RIGHT pane, hybrid render strategy (P7-06) [P]

**What:** Implement the RIGHT pane: a 16:9 framed preview that mirrors the projection. Hybrid render per design §5: full-render text-only content; placeholder cards for video and iframe (cannot double-mount). Renders overlay when present, BLACKOUT tag in blank mode, CONGELADO tag in frozen mode.

**Where:**
- `src/components/presentation/LivePreview.tsx` (new):
  - Subscribe via `usePresentationStore` (state + overlay + mode); subscribe via `useMediaStore` for media lookup
  - Top-level container: `<div className="aspect-video w-full bg-black rounded border border-border overflow-hidden">` (exempt from theme deny-list per design §7)
  - Branching logic mirrors `PresentationApp.tsx` lines ~178–252 (type-dispatch):
    - `state.mode === "blank"` → solid black + small `BLACKOUT` corner label
    - `state.overlay?.kind === "announcement"` → `<AnnouncementRenderer overlay={state.overlay} />` (full render at small size — fluid typography)
    - `state.overlay?.kind === "quickMedia"` AND image kind → render `<img>` directly
    - `state.overlay?.kind === "quickMedia"` AND video kind → placeholder card (`<div>` with play icon + media name)
    - `state.overlay?.kind === "quickWebView"` → placeholder card with globe icon + URL
    - No overlay, active item Song → existing `SongSlide` renderer (or its smallest reusable subcomponent) at scale
    - No overlay, active item Image media → `<img>` directly
    - No overlay, active item Video media → placeholder card with play icon + media name
    - No overlay, active item Countdown → existing `CountdownRenderer` (shares the same Tokio-driven `target_epoch_ms` state)
    - No overlay, active item WebView → placeholder card with globe icon + URL
    - No overlay, active item SlideShow → render the slide's PNG via `<img src={asset://…}>`
    - `state.mode === "frozen"` → render current slide + small `CONGELADO` corner label
    - Otherwise → `<Placeholder label={t("presentation.empty")} />`
  - Small label component `<FrameTag label="BLACKOUT" />` / `<FrameTag label="CONGELADO" />` positioned absolute top-right (these may use hardcoded `text-white bg-black/70` — explicit exempt addition for `LivePreview.tsx` in T9's deny-list paths)
  - For media/video/iframe placeholder cards: `<div className="flex flex-col items-center justify-center h-full text-fg-on-primary"><Icon /> <span className="text-xs">{name}</span></div>`
  - Audit renderer components used inline (`AnnouncementRenderer`, `CountdownRenderer`, `SongSlide`) for `h-screen` vs `h-full` — if any use `h-screen`, change to `h-full` (risk register §10 row 4). Verify by reading each renderer file at the start of this task.
- `src/components/presentation/LivePreview.test.tsx` (new):
  - Renders song slide text when active item is Song (dark mode)
  - Renders `BLACKOUT` tag when `state.mode === "blank"`
  - Renders `CONGELADO` tag when `state.mode === "frozen"`
  - Renders announcement overlay when `state.overlay?.kind === "announcement"`
  - Renders placeholder card (NOT a `<video>` element) when active item is video media
  - Renders placeholder card (NOT an `<iframe>` element) when active item is WebView
  - Renders `<Placeholder>` when `state.set` is undefined
- Replace the `LivePreview` stub in `OperatorPresentationLayout.tsx` with the real component
- Audit + adjust `h-screen` → `h-full` in the renderer components reused inside `LivePreview`, if needed (commit as part of this task)

**Depends on:** T5 (needs the layout slot)

**Reuses:**
- `AnnouncementRenderer`, `CountdownRenderer`, `SlideshowRenderer`, `SongSlide` (or the deepest reusable subcomponent of `PresentationApp` for song slides)
- `usePresentationStore`, `useMediaStore`
- `asset://` URL builder for slideshow PNG
- Semantic tokens for the frame border + placeholder cards (`border-border`, `text-fg-on-primary`)

**Tools:** NONE

**Done when:**
- [ ] LivePreview renders a 16:9 framed container with border
- [ ] Mirror of projection content updates within 200ms of `state_changed` (Zustand subscription, no new IPC)
- [ ] BLACKOUT tag visible when `mode === "blank"`
- [ ] CONGELADO tag visible when `mode === "frozen"`
- [ ] Overlay rendering matches projection (`announcement`, `quickMedia` image, `quickMedia` video, `quickWebView`)
- [ ] Video media renders a placeholder card with play icon + media name (NEVER a `<video>` element — verified by `queryByRole("video")` returning null in the test)
- [ ] WebView renders a placeholder card (NEVER an `<iframe>`)
- [ ] Empty-state placeholder when `state.set` missing
- [ ] No double-mounting of video/iframe (manual test: start presentation with video background; verify CPU/RAM does not spike from a second video element)
- [ ] Vitest: 7 tests above pass
- [ ] OperatorPresentationLayout no longer renders the LivePreview stub
- [ ] Gate: `npx vitest run` green

**Tests:** component
**Gate:** quick
**Commit:** `feat(presentation): P7-06 — LivePreview hybrid render strategy`

---

### T9: Dark theme zero-tolerance sweep + check-theme-tokens.ps1 (P7-03) [P]

**What:** Mechanical replacement of remaining `text-black|text-gray-900|text-gray-800|text-white|bg-white|bg-gray-{700..900}|border-gray-{600,700}|bg-blue-{500,600}|text-blue-{500,600}` across 17 operator-side files. Expand `check-theme-tokens.ps1` deny-list with explicit exemption paths for renderer components. Verify script exits 0. This task is fully independent and runs in parallel with all backend + UI work.

**Where:**
- 17 operator files to sweep (counts per spec §P7-03):
  - `src/components/backup/BackupScreen.tsx` (3 hits)
  - `src/components/countdown/CountdownPanel.tsx` (2 hits)
  - `src/components/common/ConfirmDialog.tsx` (1 hit)
  - `src/components/setbuilder/HomeSetBuilder.tsx` (4 hits) — coordinate with T2/T4 commits to avoid conflict
  - `src/components/reports/CCLIReportScreen.tsx` (2 hits)
  - `src/components/common/MediaPicker.tsx` (1 hit)
  - `src/components/set/CountdownSetItemEditor.tsx` (1 hit)
  - `src/components/set/SetBuilder.tsx` (4 hits)
  - `src/components/media/MediaCard.tsx` (3 hits)
  - `src/components/media/MediaDetailPanel.tsx` (1 hit)
  - `src/components/media/MediaLibrary.tsx` (3 hits)
  - `src/components/presentation/SlideController.tsx` (2 hits)
  - `src/components/set/SetList.tsx` (2 hits)
  - Plus any new files added in T4..T8 (audit at gate time)
- Mechanical mapping per design §7:
  ```
  text-black                  → text-fg
  text-gray-(900|800)         → text-fg  (or text-muted if it was muted copy)
  text-white                  → text-fg-on-primary (on primary surfaces) OR text-fg (on neutral surfaces in light mode)
  bg-white                    → bg-surface
  bg-gray-(700|800|900)       → bg-surface-2 / bg-surface
  border-gray-(600|700)       → border-border
  bg-blue-(500|600)           → bg-primary
  text-blue-(500|600)         → text-primary
  ```
- Renderer exemptions (do NOT touch):
  - `src/windows/presentation/PresentationApp.tsx`
  - `src/components/presentation/AnnouncementRenderer.tsx`
  - `src/components/presentation/CountdownRenderer.tsx`
  - `src/components/presentation/QuickMediaRenderer.tsx`
  - `src/components/presentation/QuickWebViewRenderer.tsx`
  - `src/components/presentation/SlideshowRenderer.tsx`
  - `src/components/presentation/MediaSlideRenderer.tsx`
  - `src/components/presentation/WebViewRenderer.tsx`
  - `src/components/presentation/LivePreview.tsx` (new from T8 — frame tags + placeholder cards intentionally use white on black)
  - `src/components/presentation/SongBackground.tsx`
  - `src/components/presentation/TransitionStage.tsx`
- `scripts/check-theme-tokens.ps1`:
  - Expand `$Deny` to: `text-black\b`, `text-gray-(800|900)\b`, `text-white\b`, `bg-white\b`, `bg-gray-(700|800|900)\b`, `border-gray-(600|700)\b`, `bg-blue-(500|600)\b`, `text-blue-(500|600)\b`
  - Expand `$ExemptPaths` to the 11 paths listed above
  - Script must exit 0 after the sweep

**Depends on:** None (can run in parallel with all other tasks). At gate time (T10) verify no late additions slipped through.

**Reuses:**
- Existing semantic tokens (`text-fg`, `text-fg-on-primary`, `text-muted`, `bg-surface`, `bg-surface-2`, `bg-primary`, `border-border`)
- Existing `check-theme-tokens.ps1` script (extends, does not rewrite)

**Tools:** NONE

**Done when:**
- [ ] `Grep "text-black|text-gray-(800|900)|text-white|bg-white|bg-gray-(700|800|900)|border-gray-(600|700)|bg-blue-(500|600)|text-blue-(500|600)" src/**/*.tsx` returns zero hits outside the 11 exemption paths
- [ ] `pwsh scripts/check-theme-tokens.ps1` exits 0
- [ ] All existing component tests still pass (mechanical change — no behavioral diff)
- [ ] Manual visual: switch to dark theme; sample 5 random screens (home, library, editor, importers, sets, backup, settings, set-player, countdown, media) — body text ≥ 4.5:1 contrast (spot check, document in commit body)
- [ ] Renderer components untouched (still hardcoded white on black for projection)
- [ ] Gate: `npx vitest run` green

**Tests:** component (regression — sweep is mechanical, no new tests)
**Gate:** quick
**Commit:** `style(theme): P7-03 — zero-tolerance dark contrast sweep + check-theme-tokens expansion`

---

### T10: Delete PresentationNavigator + full gate + STATE/ROADMAP update

**What:** Final cleanup pass. Delete the now-orphan `PresentationNavigator.tsx` + its test file. Run the full gate (cargo test + vitest + tsc + clippy + theme-tokens script). Update STATE.md and ROADMAP.md to mark Phase 7 complete.

**Where:**
- `src/components/presentation/PresentationNavigator.tsx` — DELETE
- `src/components/presentation/PresentationNavigator.test.tsx` — DELETE
- Verify no remaining imports: `Grep "PresentationNavigator" src/` must return 0 hits (risk register §10 row 8 mitigation)
- `.specs/project/STATE.md`:
  - Add "Phase 7 Completion Summary" section mirroring the Phase 6 style
  - Confirm D-29, D-30, D-31 still describe the as-shipped behavior; add new decisions if any surfaced during implementation
- `.specs/project/ROADMAP.md`:
  - Change Phase 7 status to "DONE" with completion date 2026-05-??
  - Mark each P7-01..P7-08 row as Done

**Depends on:** T3, T6, T7, T8, T9 (all in-flight work merged)

**Reuses:**
- Existing STATE.md / ROADMAP.md format
- Phase 6 completion summary as the template

**Tools:** NONE

**Done when:**
- [ ] `Grep "PresentationNavigator" src/` returns 0 hits
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` green (≥ 175 + new T1 + T3 tests)
- [ ] `npx vitest run` green (≥ 104 minus deleted `PresentationNavigator.test.tsx` + new tests from T2, T4, T5, T6, T7, T8)
- [ ] `tsc --noEmit` clean
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` clean
- [ ] `pwsh scripts/check-theme-tokens.ps1` exits 0
- [ ] Manual smoke (single monitor, no projector): Apresentar → fullscreen-on-top → ALT+TAB → operator visible → ESC → both restored
- [ ] Manual smoke (two monitors): Apresentar → projection on secondary → operator on primary → ESC exits → no `always_on_top` regression
- [ ] Manual smoke (no monitors via debugger): toast "Nenhum monitor detectado"
- [ ] Manual smoke (empty set): toast "Adicione itens ao conjunto antes de apresentar"
- [ ] Manual smoke (in-presentation): click song 3 in SET pane → STROPHES retargets → projection switches
- [ ] Manual smoke (in-presentation): click Oferta → overlay layers on projection AND LIVE pane
- [ ] Manual smoke (in-presentation): F10 toggles blackout in both windows; LIVE shows BLACKOUT tag
- [ ] STATE.md updated with Phase 7 completion summary
- [ ] ROADMAP.md Phase 7 marked DONE; all P7-01..P7-08 rows Done

**Tests:** none (validation + docs)
**Gate:** full
**Commit:** `chore(phase7): P7 — STATE/ROADMAP completion summary + remove PresentationNavigator`

---

## Parallel Execution Map

```
Phase 1:
  T1 [P]  enter_presentation monitor filter + observability
  T9 [P]  Dark theme sweep + check-theme-tokens.ps1

Phase 2:
  T1 → T2 [P]  HomeSetBuilder error toast
  T1 → T3 [P]  always_on_top single-monitor

Phase 3:
  T2 → T4  Extract OverlayActionBar

Phase 4:
  T4 → T5  OperatorPresentationLayout shell + itemMeta

Phase 5:
  T5 → T6 [P]  SetItemList (LEFT)
  T5 → T7 [P]  StrophesGrid (CENTER)
  T5 → T8 [P]  LivePreview (RIGHT)

Phase 6:
  T3, T6, T7, T8, T9 → T10  Cleanup + Gate + STATE/ROADMAP
```

**Parallel-safety note:** All test types in this project are marked parallel-safe in `.specs/codebase/TESTING.md`. `[P]` here reflects file-level non-overlap (T9 only touches operator components; T6/T7/T8 each touch distinct new files + the same `OperatorPresentationLayout.tsx` stub slot — last-merge wins on stub removal, no real conflict).

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|------|-------------------|---------------|--------|
| T1   | None              | (phase 1 root)        | ✅ Match |
| T2   | T1                | T1 → T2 [P]           | ✅ Match |
| T3   | T1                | T1 → T3 [P]           | ✅ Match |
| T4   | T2                | T2 → T4               | ✅ Match |
| T5   | T4                | T4 → T5               | ✅ Match |
| T6   | T5                | T5 → T6 [P]           | ✅ Match |
| T7   | T5                | T5 → T7 [P]           | ✅ Match |
| T8   | T5                | T5 → T8 [P]           | ✅ Match |
| T9   | None              | (phase 1 root)        | ✅ Match |
| T10  | T3, T6, T7, T8, T9 | T3, T6, T7, T8, T9 → T10 | ✅ Match |

---

## Test Co-location Matrix

| Task | Code Layer Modified            | Matrix Requires            | Task Says       | Status |
|------|--------------------------------|----------------------------|-----------------|--------|
| T1   | commands (extracted pure fn)   | unit (helper)              | unit            | ✅ OK |
| T2   | components/setbuilder          | component                  | component       | ✅ OK |
| T3   | commands (extracted pure fn)   | unit (helper)              | unit            | ✅ OK |
| T4   | components (refactor)          | component                  | component       | ✅ OK |
| T5   | components + windows           | component                  | component       | ✅ OK |
| T6   | components/presentation        | component                  | component       | ✅ OK |
| T7   | components/presentation        | component                  | component       | ✅ OK |
| T8   | components/presentation        | component                  | component       | ✅ OK |
| T9   | components (mechanical sweep)  | component (regression)     | regression only | ✅ OK |
| T10  | docs + deletion only           | none                       | none            | ✅ OK |

**Note on the sweep task (T9):** Mechanical class-string replacement across 17 files. No new behavior, no new branches. The required coverage is "existing component tests still pass" plus the script gate. Splitting per-file would multiply task count by ~17 without improving safety. The `check-theme-tokens.ps1` script provides the binary pass/fail criterion.

---

## Task Granularity Check

| Task | Scope                                              | Status |
|------|----------------------------------------------------|--------|
| T1   | 1 filter + 1 error code + 2 tracing lines + tracing init | ✅ Granular |
| T2   | 1 handler refactor + 3 i18n keys + 3 tests         | ✅ Granular |
| T3   | 1 pure helper + 1 builder branch                   | ✅ Granular |
| T4   | 1 component extraction (pure refactor)             | ✅ Granular |
| T5   | 1 shell component + 1 helper module + OperatorApp swap | ✅ Granular |
| T6   | 1 component (LEFT pane)                            | ✅ Granular |
| T7   | 1 component (CENTER pane)                          | ✅ Granular |
| T8   | 1 component (RIGHT pane) + renderer h-screen audit | ⚠️ OK (audit bundled; touches the same set of renderer files the rest of P7 leaves alone) |
| T9   | 17-file mechanical sweep + script extension        | ⚠️ OK (script-gated) |
| T10  | Deletion + gate + docs                             | ✅ Granular |

---

## Commit Plan

1. `feat(presentation): P7-01 — enter_presentation monitor filter + observability`
2. `feat(operator): P7-01 — HomeSetBuilder error toast for Apresentar failures`
3. `feat(presentation): P7-02 — single-monitor always_on_top fullscreen`
4. `refactor(presentation): P7-08 — extract OverlayActionBar component`
5. `feat(presentation): P7-04 — OperatorPresentationLayout 3-pane shell + itemMeta helpers`
6. `feat(presentation): P7-07 — SetItemList LEFT pane with click-to-replace`
7. `feat(presentation): P7-05 — StrophesGrid wrapping thumbnail grid`
8. `feat(presentation): P7-06 — LivePreview hybrid render strategy`
9. `style(theme): P7-03 — zero-tolerance dark contrast sweep + check-theme-tokens expansion`
10. `chore(phase7): P7 — STATE/ROADMAP completion summary + remove PresentationNavigator`

---

## Resolved Deferred Questions (from design.md)

| Question                                                          | Resolution                                                                 | Section            |
|-------------------------------------------------------------------|----------------------------------------------------------------------------|--------------------|
| LIVE preview rendering strategy                                   | Hybrid: full-render for text/image/countdown/overlay; placeholder cards for video/iframe | design §5 → T8     |
| `OverlayDialogs` extraction                                       | Inline at each call site; extract only the toolbar (`OverlayActionBar`)    | design §6 → T4     |
| Tauri 2 `always_on_top` API                                       | `WebviewWindowBuilder::always_on_top(bool)` builder method (Tauri 2.11.2)  | design §4.2 → T3   |
| Phantom-monitor filter heuristic                                  | `width > 0 && height > 0` at enumeration; `no_monitors` error if all filtered out | design §4.1 → T1   |

---

## Open Risks (from design §10)

| Risk                                                                                          | Mitigation in tasks                                                |
|-----------------------------------------------------------------------------------------------|---------------------------------------------------------------------|
| `always_on_top` interferes with ALT+TAB on some Windows versions                              | T10 manual smoke ALT+TAB check; documented as PowerPoint parity     |
| `tracing::info!` output goes nowhere if no subscriber wired                                   | T1 verifies + initializes `tracing_subscriber` in `lib.rs` if absent |
| Renderer components rely on `h-screen` and break inside `LivePreview`'s `aspect-video` frame  | T8 audits + replaces `h-screen` → `h-full` as part of the same commit |
| Theme sweep accidentally changes intentional white-on-color in renderers                      | T9 explicit exemption list (11 paths); manual visual review at T10  |
| Deleted `PresentationNavigator` referenced from somewhere we missed                           | T10 grep-check + `tsc --noEmit` gate                                |
