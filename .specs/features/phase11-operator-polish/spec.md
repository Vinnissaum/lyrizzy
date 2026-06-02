# Phase 11: Operator Polish — Announcement-over-Blackout, Latency, Preview Cropping — Specification

## Problem Statement

Three field-reported operator-experience defects undermine the live presentation flow:
1. While the projector is blacked out (F10 / "Apagar"), clicking **Aviso** (announcement) does nothing visible — the operator must manually lift blackout first, which is friction during a live service.
2. Switching between set items / strophes feels sluggish **on the operator screen** — the active-selection highlight lags the click. The projection itself is fine; the operator-side feedback is the problem.
3. The strophe preview cards (operator center pane) reserve empty space below the 16:9 slide thumbnail, making the grid look loose and wasting vertical space.

## Goals

- [ ] Announcement overlay renders **over** an active blackout; clearing the announcement leaves blackout intact (operator never has to toggle blackout to show/hide an Aviso).
- [ ] Operator active-selection feedback is perceptually immediate (< ~100 ms) when clicking a strophe or set item.
- [ ] Strophe preview cards tightly bound the 16:9 slide — zero empty space below — while preserving exact projection fidelity (preset, font, position, margin, scale).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Oferta (image) / Câmera (webView) overlays rendering over blackout | User decision: **announcement only** overlaps blackout. Oferta/Câmera keep current behavior (require lifting blackout first). |
| Backend change to `overlay.rs` flipping `mode` | D-40 invariant preserved: overlays stay mode-independent transient layers; clearing must restore the prior blackout. Fix is render-only. |
| Changing projection-window switching latency | User confirms projection feedback is already acceptable; only the operator-side render is slow. |
| Redesign of the 3-pane operator layout (D-30) | Only the strophe card bounding box changes; pane structure stays. |

---

## User Stories

### P1: Announcement overlaps blackout ⭐ MVP

**User Story**: As an operator running a blacked-out projector, I want clicking **Aviso** to show the announcement immediately over the blackout — and removing it to return to blackout — so that I don't have to manually toggle blackout around every announcement.

**Why P1**: Direct live-service friction; the current workaround (manually lift blackout, show aviso, re-apply blackout) is error-prone under pressure.

**Acceptance Criteria**:

1. WHEN the projection is in `blank` (blackout) mode AND the operator sets an announcement overlay THEN the presentation window SHALL render the announcement over the black background (announcement visible, not the bare blackout).
2. WHEN an announcement overlay is showing over blackout AND the operator clears the overlay THEN the presentation window SHALL return to solid-black blackout (mode stays `blank`; blackout is NOT auto-cleared).
3. WHEN the projection is in `blank` mode AND an announcement overlay is active THEN the operator **LIVE preview** pane SHALL mirror the same announcement-over-blackout composition.
4. WHEN an **Oferta (image)** or **Câmera (webView)** overlay is set while in `blank` mode THEN the system SHALL keep current behavior (blackout still wins for these types) — only announcement overlaps blackout.
5. WHEN no announcement overlay is set and mode is `blank` THEN the presentation window SHALL show solid black (unchanged from today).

**Independent Test**: Enter presentation, press F10 to blackout, click Aviso + confirm text → announcement appears over black on the projector and in LIVE preview; clear overlay → screen returns to black (blackout still on); press F10 → live content returns.

---

### P1: Instant operator selection feedback ⭐ MVP

**User Story**: As an operator, I want the active-slide/strophe highlight to move the instant I click, so the operator UI feels responsive even though the projection state round-trips through the backend.

**Why P1**: Perceived sluggishness erodes trust during a live service; clicks feel "dropped" until the highlight catches up.

**Acceptance Criteria**:

1. WHEN the operator clicks a strophe card in `StrophesGrid` THEN the active-selection indicator (ring/highlight) SHALL update within ~100 ms, before the backend `state_changed` round-trip completes (optimistic).
2. WHEN the operator clicks a set item in `SetItemList` THEN the active-item indicator SHALL update optimistically with the same timing.
3. WHEN the backend later emits a `state_changed` that differs from the optimistic guess THEN the operator UI SHALL reconcile to the authoritative backend state (backend remains source of truth per architecture invariant).
4. WHEN the optimistic state and the backend state agree THEN there SHALL be no visible flicker or double-jump in the highlight.
5. WHEN switching strophes THEN re-rendering the strophe grid SHALL NOT block the highlight update (unchanged thumbnails are not re-rendered / are memoized).

**Independent Test**: With the projector connected, rapidly click several strophe cards and set items; the operator highlight tracks each click with no perceptible lag, and never lands on a slide different from what the projector shows once settled.

---

### P1: Strophe preview cards crop to the slide ⭐ MVP

**User Story**: As an operator, I want each strophe preview card to be exactly the 16:9 slide with no empty space beneath it, so the grid reads cleanly and shows more strophes per screen.

**Why P1**: Visual clutter + wasted vertical space reported directly; cheap to fix.

**Acceptance Criteria**:

1. WHEN the strophe grid renders THEN each preview card's rectangle SHALL bound only the 16:9 slide thumbnail with no empty filler below it.
2. WHEN cards in a grid row have differing intrinsic heights for any reason THEN a card SHALL NOT stretch beyond its 16:9 content (no `align-items: stretch` growth).
3. WHEN a card is rendered THEN it SHALL preserve full projection fidelity — preset background, font family/size, screen position, margin, line spacing, bold level, and letterbox scaling — identical to today.
4. WHEN the active card is highlighted (ring) THEN the ring SHALL bound the slide tightly, with no gap between ring and thumbnail.

**Independent Test**: Open the operator presentation layout for a song with several strophes; every card is a tight 16:9 rectangle, the grid has no inconsistent vertical gaps, and a card's rendered slide is pixel-faithful to the projection (scaled).

---

## Edge Cases

- WHEN the operator presses **F10 (blackout)** while an announcement is already showing THEN mode becomes `blank` but the announcement still renders on top (overlay precedence) — the blackout becomes visible only after the overlay is cleared. (Accepted consequence of announcement-over-blackout; documented, not a bug.)
- WHEN an announcement is set while NOT blacked out (mode `live`/`idle`) THEN it renders over the live/idle content exactly as today (no regression).
- WHEN the operator clicks the currently-active strophe THEN the optimistic update SHALL be a no-op (no flicker).
- WHEN a `goToItem` call rejects (backend error) THEN the optimistic highlight SHALL reconcile back to the last authoritative state rather than stay on the failed target.
- WHEN the strophe grid is empty or the active item is not a song/slideshow THEN the existing placeholder states SHALL be unaffected.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| P11-01 | P1: Announcement overlaps blackout (presentation window render precedence) | T1 | Verified |
| P11-02 | P1: Announcement overlaps blackout (LIVE preview mirror) | T2 | Verified |
| P11-03 | P1: Instant operator feedback (optimistic highlight, StrophesGrid + SetItemList) | T3, T4, T5 | Verified |
| P11-04 | P1: Instant operator feedback (memoize/avoid full grid re-render) | T4 | Verified |
| P11-05 | P1: Strophe preview cards crop to 16:9 (no bottom empty space) | T4 | Verified |

**ID format:** `P11-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 5 total, 5 mapped to tasks, 5 Verified (implemented 2026-06-02).

---

## Success Criteria

- [ ] Operator can show/hide an announcement over a blacked-out projector without ever toggling blackout manually.
- [ ] Clearing an announcement over blackout always returns to black (blackout persists in all cases).
- [ ] Clicking strophes/set items moves the operator highlight with no perceptible lag.
- [ ] Strophe preview cards show zero empty space below the slide while remaining pixel-faithful to projection.
- [ ] No regression: announcement over live/idle, Oferta/Câmera over blackout, F10 toggle, and projection fidelity all behave as before.
- [ ] Gate green: `tsc --noEmit` clean, Vitest green, `cargo test` + `cargo clippy -D warnings` clean.

---

## Implementation Notes (grounding for Design/Execute)

These are leading hypotheses from code reading, to be confirmed in Design/Execute — **not** prescriptive.

- **P11-01/02 — render precedence.** `PresentationApp.tsx:192` returns the blackout `<div>` *before* the overlay check (`:197–215`); `LivePreview.tsx:77` does the same before its overlay block (`:89`). The fix is to let an **announcement** overlay take precedence over `blank` while keeping Oferta/Câmera below blackout. Because backend `overlay.rs` does NOT flip `mode` (D-40), clearing the overlay naturally restores the blackout render — no backend change needed. New precedence (announcement-scoped): `announcement-overlay → blank → other-overlay → idle → live/frozen`. Update the matching D-40 render-order comment.
- **P11-03/04 — optimistic + memo.** `StrophesGrid.onClick` (`:192–196`) and the `SetItemList` click handler await `goToItem`/`goToSlide` before the highlight (driven by `state.currentSlideIndex`) moves. Introduce an optimistic local selection that updates on click and reconciles when `state_changed` arrives (backend stays source of truth — architecture invariant). The full-grid re-render of `SlideCard` (each mounts a `SlideStage` with a `ResizeObserver`) on every state change is a likely cost amplifier — memoize `SlideCard` so only the previously- and newly-active cards re-render.
- **P11-05 — card bounding box.** `SlideCard` (`StrophesGrid.tsx:73–104`) is a `flex flex-col` button whose only child is the `aspect-video` thumbnail; the grid (`:178–181`) uses default `align-items: stretch`, so a button can grow taller than its 16:9 child → empty space below. Candidate fixes: grid `items-start` (align-items: start) and/or making the button itself the `aspect-video` element. Must not break the active `ring-2` or letterbox scaling (`SlideStage`).

---

## Open Decisions (resolved during Specify)

- **OD-1 (resolved):** Overlap scope = **announcement only**. Oferta/Câmera keep blackout-wins behavior. (User, 2026-06-02)
- **OD-2 (resolved):** Operator selection feedback = **optimistic** local highlight with backend reconciliation. (User, 2026-06-02)
</content>
</invoke>
