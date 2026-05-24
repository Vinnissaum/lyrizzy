# Phase 7 — Design

**Created:** 2026-05-22
**Status:** Drafted
**Spec:** [spec.md](spec.md) (8 requirements P7-01..P7-08)
**Context:** [context.md](context.md) (4 gray-area resolutions)
**Codebase:** Tauri 2.11.2, React 18, sqlx 0.8 (verified `Cargo.lock`)

---

## 1. Architectural Overview

Phase 7 reshapes the operator presentation surface without modifying:
- The Rust `PresentationState` shape (already carries `set`, `currentItemIndex`, `currentSlideIndex`, `mode`, `overlay`, `allSlidesPerItem`)
- The IPC contract (`state_changed`, `presentation_lifecycle`, `goto_slide`)
- The presentation window contents (`PresentationApp.tsx` stays as-is — see §5 on LIVE preview strategy)

Three things change:

1. **Backend window logic** (P7-01, P7-02): monitor enumeration filters phantom 0×0 displays; single-monitor branch adds `.always_on_top(true)`; instrumented with `tracing::info!`.

2. **Frontend presentation surface** (P7-04..P7-08): `PresentationNavigator` is replaced by `OperatorPresentationLayout`, a 3-pane container composed of `SetItemList`, `StrophesGrid`, and `LivePreview`. A shared `OverlayActionBar` toolbar sits above the layout (reused by `HomeSetBuilder`).

3. **Theme audit** (P7-03): mechanical sweep of 17 component files; deny-list script updated.

```
┌─────────────────────────────────────────────────────────────────────┐
│ OperatorApp                                                         │
│  ├── (header / navigation tabs — unchanged)                         │
│  └── <main>                                                         │
│       ├── if !isPresenting:                                         │
│       │     <HomeSetBuilder>                                        │
│       │       └── <OverlayActionBar showApresentar={true} />  ◄──┐  │
│       │                                                          │  │
│       └── if isPresenting:                                       │  │
│             <OperatorPresentationLayout>                         │  │
│              ├── <OverlayActionBar showApresentar={false} /> ◄───┘  │
│              └── <div grid grid-cols-[240px_1fr_320px]>             │
│                   ├── <SetItemList />        ◄── LEFT (P7-07)       │
│                   ├── <StrophesGrid />       ◄── CENTER (P7-05)     │
│                   └── <LivePreview />        ◄── RIGHT (P7-06)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Tree (frontend)

```
src/components/presentation/
├── OperatorPresentationLayout.tsx   [NEW] — composes the 3-pane shell
├── SetItemList.tsx                  [NEW] — LEFT pane (P7-07)
├── StrophesGrid.tsx                 [NEW] — CENTER pane (P7-05)
├── LivePreview.tsx                  [NEW] — RIGHT pane (P7-06)
├── OverlayActionBar.tsx             [NEW] — toolbar shared with home (P7-08)
├── itemMeta.ts                      [NEW] — shared `itemIcon()` + `itemLabel()` helpers
├── PresentationNavigator.tsx        [DELETE] after P7-04 lands
└── PresentationNavigator.test.tsx   [DELETE] after P7-04 lands
```

Touched files outside the new module:
- `src/windows/operator/OperatorApp.tsx` — swap `<PresentationNavigator />` for `<OperatorPresentationLayout />`
- `src/components/setbuilder/HomeSetBuilder.tsx` — replace inline overlay-bar JSX with `<OverlayActionBar />`; keep dialogs inline (see §6)
- `src-tauri/src/commands/window.rs` — P7-01 monitor filter, P7-02 `always_on_top`, observability `tracing::info!`
- `scripts/check-theme-tokens.ps1` — expand deny-list

---

## 3. Data Flow

All three new panes subscribe to the **same** `usePresentationStore` already mounted in `OperatorApp` — no new Tauri IPC, no extra subscriptions.

```
┌────────────────────────────────────────────────────────────────┐
│ Rust AppState.presentation (single source of truth)            │
│   ── emit("state_changed") on every mutation                   │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼ Tauri event
┌────────────────────────────────────────────────────────────────┐
│ usePresentationStore (Zustand projection — both windows)       │
│   state: { set, currentItemIndex, currentSlideIndex, mode,     │
│            overlay, allSlidesPerItem, background, ... }        │
└────────────────────────────────────────────────────────────────┘
        │             │                  │
        ▼             ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ SetItemList  │ │ StrophesGrid │ │ LivePreview  │
│ reads:       │ │ reads:       │ │ reads:       │
│  set.items   │ │  allSlides…  │ │  ALL of it   │
│  currentItem │ │   [current   │ │ + mode       │
│   Index      │ │    ItemIdx]  │ │ + overlay    │
│ dispatches:  │ │  currentSlide│ │ dispatches:  │
│  goto_slide  │ │   Index      │ │  (none)      │
│   (idx, 0)   │ │ dispatches:  │ │              │
│              │ │  goto_slide  │ │              │
│              │ │   (cur, sIdx)│ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Re-render scope:** Zustand subscribers re-render on any field change. For performance, each pane uses a narrow selector via `usePresentationStore((s) => s.state?.currentItemIndex)` style — avoids re-rendering on unrelated changes (e.g. SetItemList does not re-render on `currentSlideIndex` change inside the active item).

---

## 4. Backend Changes (P7-01, P7-02)

### 4.1 Monitor filter (P7-01 AC 4)

In `src-tauri/src/commands/window.rs::enter_presentation`, after `app.available_monitors()`:

```rust
let monitors: Vec<Monitor> = monitors
    .into_iter()
    .filter(|m| {
        let s = m.size();
        s.width > 0 && s.height > 0
    })
    .collect();

if monitors.is_empty() {
    return Err(ErrorPayload::new("presentation.no_monitors"));
}
```

The new error code `"presentation.no_monitors"` is added to the frontend i18n: `pt-BR: "Nenhum monitor detectado"`.

### 4.2 `always_on_top` for single-monitor (P7-02)

After the existing `apply_monitor()` call:

```rust
let mut builder = apply_monitor(base, &monitors, secondary_idx);
if monitors.len() == 1 {
    builder = builder.always_on_top(true);
}
builder.fullscreen(true).build().map_err(...)?;
```

**API verified:** Tauri 2.11.2 ships `WebviewWindowBuilder::always_on_top(bool) -> Self` (stable since Tauri 1.x). No post-build fallback needed.

The 2+ monitor branch (where `secondary_idx` is `Some(_)`) deliberately does NOT set `always_on_top` — the projector window must not steal focus from the operator on the primary monitor.

### 4.3 Observability (P7-01 AC 5)

```rust
tracing::info!(
    monitors = monitors.len(),
    secondary_idx = ?secondary_idx,
    always_on_top = monitors.len() == 1,
    "enter_presentation: building window"
);
```

A second `tracing::info!("enter_presentation: emit lifecycle entered")` after the emit. Output flows to the existing tracing subscriber (Tauri dev console).

### 4.4 Toast surfacing (P7-01 AC 1, AC 6)

Frontend-only change. `HomeSetBuilder.handleApresentar`:

```tsx
const [errorToast, setErrorToast] = useState<string | null>(null);

const handleApresentar = async () => {
  if (!fixedSetId) return;
  try {
    const currentSet = await getSet(fixedSetId);
    if (currentSet.items.length === 0) {
      showEmptySetToast();
      return;
    }
    await loadSetForPresentation(fixedSetId);
    await enterPresentation();
  } catch (err) {
    const payload = err as { code?: string; params?: Record<string, string> };
    setErrorToast(t(`error.${payload.code ?? "unknown"}`, payload.params));
    setTimeout(() => setErrorToast(null), 5000);
  }
};
```

The toast JSX mirrors the existing `emptySetToast` (top-center, amber, auto-dismiss).

---

## 5. LIVE Preview Strategy (P7-06) — Resolved Deferred Question

### 5.1 The two-window problem

`PresentationApp` renders in the `"presentation"` window. `OperatorApp` (with `LivePreview`) renders in the `"operator"` window. If `LivePreview` directly mounts `<MediaSlideRenderer>` or `<WebViewRenderer>`, the video/iframe loads **twice** — wasting bandwidth, breaking single-stream IP cameras, and (for video) playing two audio streams.

### 5.2 Decision: Hybrid — full-fidelity for text, placeholder cards for media/iframe

```
┌─────────────────────┬──────────────────────────────┐
│ Content type        │ LivePreview strategy         │
├─────────────────────┼──────────────────────────────┤
│ Song / Blank slide  │ Full render at scale         │
│ Countdown           │ Full render (shares store)   │
│ Announcement        │ Full render at scale         │
│ Image (static)      │ Render <img> directly        │
│ Video (media)       │ Placeholder card with poster │
│ WebView (camera)    │ Placeholder card with URL    │
│ Slideshow (PNG)     │ Render the PNG <img>         │
│ Blackout mode       │ Solid black + "BLACKOUT" tag │
│ Frozen mode         │ Render slide + "CONGELADO"   │
└─────────────────────┴──────────────────────────────┘
```

### 5.3 Sizing

Container: `<div class="aspect-video w-full bg-black rounded border border-border overflow-hidden">`. Inner content scales naturally via `clamp()` font sizes in existing renderers — they already use `vw/vmin` for fluid type, so a small container produces small text without `transform: scale()`.

For renderers that hardcode pixel sizes (none currently), we'd add `transform: scale(0.25)` with `transform-origin: top left`. The current code is all fluid, so no transform is needed.

### 5.4 Component shape

```tsx
// src/components/presentation/LivePreview.tsx
export const LivePreview: React.FC = () => {
  const { state } = usePresentationStore();
  const { media } = useMediaStore();
  if (!state) return <Placeholder label={t("presentation.preview.waiting")} />;

  if (state.mode === "blank") {
    return <FrameWithTag tag="BLACKOUT" black />;
  }
  if (state.overlay) {
    return <OverlayPreview overlay={state.overlay} media={media} />;
  }
  return <ContentPreview state={state} media={media} frozen={state.mode === "frozen"} />;
};
```

Internal `ContentPreview` mirrors the type-dispatch in `PresentationApp.tsx` lines 178–252, BUT:
- `media + kind === "video"` → render a `<div>` with a play icon + media name (no `<video>`)
- `web_view` → render a `<div>` with a globe icon + URL
- everything else → use the same renderer components as `PresentationApp`

**Risk:** if a renderer's CSS assumes `h-screen` (full viewport), it won't fit the preview frame. Mitigation: the new `<FrameWithTag>` wrapper applies `h-full` to its child and the existing renderers use `h-full` / `h-screen` interchangeably (verified for SongSlide, CountdownRenderer, AnnouncementRenderer). For `h-screen` cases, swap to `h-full` in the renderer (those changes are contained — same dark presentation contract).

### 5.5 Why not screen capture?

Considered and rejected: WebView2 has no built-in DXGI bridge; we'd need a Rust-side `screenshots` crate (`scrap`, `xcap`) polling at 5–15 FPS and shipping JPEG frames via IPC. Adds ~3 MB binary, native dependencies, and a constant CPU/RAM cost for zero correctness gain over rendering the known state. (D-31 in STATE.md documents this.)

---

## 6. `OverlayDialogs` Extraction — Resolved Deferred Question

**Question:** Extract the three overlay-trigger dialogs (Camera URL prompt, Announcement textarea, Media picker) into a shared component, or duplicate inline at both call sites?

**Decision:** **Inline at both call sites** (HomeSetBuilder keeps its dialogs; OperatorPresentationLayout writes its own equivalents).

**Reasoning:**
- The dialogs depend on parent-local state (`announcementText`, `tempCameraUrl`, etc.) and parent-local handlers (`handleConfirmCameraUrl` etc.)
- Extracting requires lifting that state into a context or threading 8–10 props through — adds more code than it removes
- The dialogs are visually identical between both call sites; the underlying commands (`setAnnouncementOverlay`, `setMediaOverlay`, `setWebviewOverlay`) are already shared
- Only the toolbar JSX is meaningfully duplicated (12 lines × 2 = 24 lines avoided), and that's what `OverlayActionBar` extracts

**What gets shared (`<OverlayActionBar />`):** only the button row.
**What stays inline:** the dialog JSX and the local state that backs it.

Re-evaluation trigger: if a 3rd consumer is added (e.g. a remote-control surface), revisit and extract `<OverlayDialogs />` then.

---

## 7. Theme Sweep (P7-03) — Mechanical Mapping

```
text-black             → text-fg
text-gray-900          → text-fg
text-gray-800          → text-muted   (use text-fg if it's primary copy)
text-white             → text-fg-on-primary  (when on a primary-color surface)
                       → text-fg              (when on a neutral surface in light mode)
bg-white               → bg-surface
bg-gray-700/800/900    → bg-surface-2 / bg-surface
border-gray-600/700    → border-border
bg-blue-500/600        → bg-primary
text-blue-{500,600}    → text-primary
```

**Exempt** (intentionally hardcoded white on user-content backgrounds):
- `src/windows/presentation/PresentationApp.tsx`
- `src/components/presentation/AnnouncementRenderer.tsx`
- `src/components/presentation/CountdownRenderer.tsx`
- `src/components/presentation/QuickMediaRenderer.tsx`
- `src/components/presentation/QuickWebViewRenderer.tsx`
- `src/components/presentation/SlideshowRenderer.tsx`
- `src/components/presentation/MediaSlideRenderer.tsx`
- `src/components/presentation/WebViewRenderer.tsx`
- Any new renderer added during Phase 7 (e.g. the `<FrameWithTag>` helper inside LivePreview MAY use hardcoded `text-white` / `bg-black` — these draw on user-content backdrops)

The `check-theme-tokens.ps1` script gets an updated deny-list:

```powershell
$Deny = @(
    'text-black\b',
    'text-gray-(800|900)\b',
    'text-white\b',
    'bg-white\b',
    'bg-gray-(700|800|900)\b',
    'border-gray-(600|700)\b',
    'bg-blue-(500|600)\b',
    'text-blue-(500|600)\b'
)
$ExemptPaths = @(
    'src/windows/presentation/*',
    'src/components/presentation/AnnouncementRenderer.tsx',
    'src/components/presentation/CountdownRenderer.tsx',
    'src/components/presentation/QuickMediaRenderer.tsx',
    'src/components/presentation/QuickWebViewRenderer.tsx',
    'src/components/presentation/SlideshowRenderer.tsx',
    'src/components/presentation/MediaSlideRenderer.tsx',
    'src/components/presentation/WebViewRenderer.tsx',
    'src/components/presentation/LivePreview.tsx',
    'src/components/presentation/SongBackground.tsx',
    'src/components/presentation/TransitionStage.tsx'
)
```

Verify the script exits 0 after the sweep AND each exempt path is justified.

---

## 8. Component Contracts

### 8.1 `OperatorPresentationLayout`

```ts
// props: none
// renders: <OverlayActionBar /> + 3-pane grid
// behavior: subscribes to usePresentationStore; renders empty-state if !state.set
```

### 8.2 `SetItemList`

```ts
interface Props {
  // none — reads everything from store
}
// renders: vertical list of all set items with icon + label
// on row click (non-active): goToItem(itemIdx, 0)
// active row: highlighted with ring-primary + ▶ indicator
```

### 8.3 `StrophesGrid`

```ts
interface Props {
  // none — reads activeItem from store, slides from allSlidesPerItem[currentItemIndex]
}
// for song/slideshow: wrapping grid of slide cards
// for other types: single info card with item description + "Próximo →" hint
```

### 8.4 `LivePreview`

```ts
interface Props {
  // none — reads everything from store
}
// renders: aspect-video framed preview matching current projection
// special states: BLACKOUT tag, CONGELADO tag, overlay
// media/iframe substituted with placeholder cards (see §5.2)
```

### 8.5 `OverlayActionBar`

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
// renders: toolbar row (Apresentar? | Clear Overlay (if active) | Oferta | Câmera | Aviso | PDF)
// styling: matches existing HomeSetBuilder toolbar (px-3 py-2 border-b border-border)
```

### 8.6 `itemMeta.ts`

```ts
export function itemIcon(item: SetItem): string;
export function itemLabel(
  item: SetItem,
  songs: Song[],
  media: MediaItem[]
): string;
```

Pure helpers extracted from current `PresentationNavigator.tsx` lines 9–18 and 79–113.

---

## 9. Test Plan

### 9.1 Rust tests (new)

- `enter_presentation`: phantom-monitor filter — given `vec![Monitor{0×0}, Monitor{1920×1080}]`, only the second survives
- `enter_presentation`: `no_monitors` error when filter yields empty
- `enter_presentation`: `always_on_top=true` on single-monitor branch (test via the existing `apply_monitor` pure-function pattern — extract `should_pin_on_top(monitor_count: usize) -> bool` for testability)

### 9.2 Vitest (new)

- `OperatorPresentationLayout.test.tsx`: renders 3 panes with labeled headers given a populated state
- `SetItemList.test.tsx`: highlights active item; click on non-active dispatches `goto_slide(itemIdx, 0)`; click on active is a no-op
- `StrophesGrid.test.tsx`: renders N cards for an N-slide song; click on card N dispatches `goto_slide(currentItemIndex, N)`; empty state when slides=[]; single info card for countdown/webview
- `LivePreview.test.tsx`: renders song text in dark mode; renders BLACKOUT tag when `mode='blank'`; renders placeholder card for video; renders overlay when `overlay` is present
- `OverlayActionBar.test.tsx`: snapshot in both `showApresentarButton` modes; clicking each button invokes the right handler
- `HomeSetBuilder.test.tsx` (update): toast appears when `enterPresentation` rejects

### 9.3 Tests to delete

- `PresentationNavigator.test.tsx` — entire file deleted after `OperatorPresentationLayout` lands

### 9.4 Manual smoke tests (UAT)

1. Single-monitor: Apresentar → fullscreen-on-top → ALT+TAB → operator visible → ESC → both restored
2. Two-monitor: Apresentar → fullscreen on secondary → operator on primary (no `always_on_top`)
3. No monitors: simulate via debugger → toast "Nenhum monitor detectado"
4. Empty set: Apresentar → "Adicione itens" toast
5. During presentation: click Song 2 in SET pane → STROPHES retargets, projection switches
6. During presentation: click Oferta → overlay appears in both projection AND LIVE pane
7. Dark theme: navigate every operator tab → no near-black-on-near-black text
8. Run `scripts/check-theme-tokens.ps1` → exit 0

---

## 10. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `always_on_top` interferes with browser dev tools / ALT+TAB on some Windows versions | Medium | Low — only affects dev workflow | Document in design.md; user can ESC to dismiss |
| `tracing::info!` output goes nowhere if no subscriber wired | Low | Low — observability gap | Verify the existing tracing subscriber in `lib.rs::setup`; add one if missing |
| LIVE preview text overflow / wrong scaling on extreme aspect ratios | Medium | Low — visual glitch | The renderers already use fluid `clamp()`; cap min font in preview via container queries if needed |
| Renderer components rely on `h-screen` and break inside `LivePreview`'s `aspect-video` container | Medium | Medium — visual glitch | Audit each renderer during P7-06; replace `h-screen` with `h-full` |
| Two `usePresentationStore` subscribers (operator + presentation windows) cause divergence | Low | High — state desync | Both already subscribe to the same `state_changed` event; this is the existing Phase 1+ pattern, proven stable |
| `goto_slide(itemIdx, 0)` on non-song items doesn't behave the same as today's slide-jump | Low | Medium — broken navigation | Verify in `src-tauri/src/commands/presentation.rs`; existing `jumpToItem` shortcut already uses this exact call (operator keyboard 1–9) |
| Theme sweep accidentally changes intentional white-on-color in renderers | Medium | Medium — projection looks wrong | Strict exemption list + manual visual review of the presentation window after sweep |
| The deleted `PresentationNavigator` is referenced from somewhere we missed | Low | Low — build error | `tsc --noEmit` catches it; grep for `PresentationNavigator` before delete |

---

## 11. Out of Scope (re-confirmed)

The spec's "Out of Scope" list stands. Two design-time additions:
- **No new IPC commands.** All three panes use existing `goto_slide` / `set_mode` / `set_*_overlay` / `clear_overlay`.
- **No schema changes.** No migrations.
- **No new Rust dependencies.** `tracing` already exists in the workspace; `always_on_top` is core Tauri 2.

---

## 12. Resolved Deferred Questions

| # | Question | Resolution | Section |
|---|---|---|---|
| 1 | LIVE preview rendering strategy | Hybrid: full-render for text/image/countdown/overlay; placeholder cards for video/iframe | §5 |
| 2 | `OverlayDialogs` extraction | Keep dialogs inline at each call site; extract only the toolbar (`OverlayActionBar`) | §6 |
| 3 | Tauri 2 `always_on_top` API | `WebviewWindowBuilder::always_on_top(bool)` builder method (verified Tauri 2.11.2) | §4.2 |
| 4 | Phantom-monitor filter heuristic | `width > 0 && height > 0` at enumeration; explicit `no_monitors` error if all filtered out | §4.1 |

---

## 13. Implementation Order — refined from spec.md

1. **P7-01 (backend half)** — monitor filter + observability + frontend toast wiring → unblock diagnosis of the user's "click-does-nothing" report
2. **P7-02** — `always_on_top` single-monitor branch (small addition on top of P7-01's window code)
3. **P7-08** — extract `<OverlayActionBar />` (pure refactor; verifies the toolbar still works in home before reusing it elsewhere)
4. **P7-04** — `OperatorPresentationLayout` shell + swap-in at `OperatorApp` (renders empty children while children are stubbed)
5. **P7-07** — `SetItemList` (simplest pane; proves the data subscription pattern)
6. **P7-05** — `StrophesGrid` (depends on P7-04 for slot, P7-07 for click-to-replace integration)
7. **P7-06** — `LivePreview` (most complex; depends on auditing each renderer for `h-full` compatibility)
8. **P7-03** — theme sweep (independent; safe to parallelize with any of the above)
9. **Cleanup** — delete `PresentationNavigator.tsx` + test; verify `tsc --noEmit` + `cargo clippy` + vitest + cargo test all green

Each task lands as its own atomic commit. The implementation order is the same as the task ordering in `tasks.md` (not yet created).
