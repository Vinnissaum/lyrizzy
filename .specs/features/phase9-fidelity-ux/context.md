# Phase 9 — Fidelity & UX Context

**Gathered:** 2026-05-30
**Spec:** `.specs/features/phase9-fidelity-ux/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Make every operator-facing preview render identically to the projection by
routing all slide rendering through one shared scalable stage, and resolve a
batch of presentation/operator UX defects (language picker, warning overlay,
editor preview, title author size, presenting tabs, drag reorder, thumbnail
size, blackout-after-song). No new appearance dimensions beyond an announcement
margin and a blackout-after-song toggle.

---

## Implementation Decisions

### Fidelity architecture (P9-02, P9-04, P9-08)
- **Single shared renderer.** Extract one scalable `SlideStage` + `SlideContent`
  that `PresentationApp`, `LivePreview`, `StrophesGrid`, and the song-editor
  preview all render through. One source of truth for projection composition;
  larger refactor accepted for guaranteed fidelity.
- Build on the existing faithful approach already in `SlideChip` (fixed
  1280×720 virtual stage, `transform: scale()` to fit), promoted to the shared
  component and extended to all item types.

### Blackout after song (P9-09)
- Insert a navigable black slide **after the last slide of every Song item**.
- Gated by a **Settings toggle, default ON** (`presentation.blackout_after_song`).
- The blackout slide renders solid black with no text, independent of preset.

### Song-editor preview (P9-04)
- Right-side preview pane, **open by default**, showing the **whole song** —
  title slide + every section's slides — as faithful thumbnails.
- Replaces the per-section inline Eye toggle (removed).

### Warning overlay (P9-03)
- Render through the shared stage so the configured background fills the entire
  slide (no gray edges).
- Add a configurable announcement **margin** (default `lg`); honor the existing
  announcement position.

### Presenting tabs (P9-06)
- **Disable** (grey, not-allowed cursor) the nav tabs while presenting — keep
  them visible rather than hiding, so the layout is stable.

### Drag reorder (P9-07)
- Add dnd-kit drag-to-reorder to the set item list; **keep** the up/down arrow
  buttons as an accessible fallback. Persist via existing `reorder_set_items`.

### Agent's Discretion
- Exact author-line size on the title slide: render **one notch below the
  configured body size** (title stays one notch above body), keeping the title's
  color de-emphasized by opacity. Tune if it still reads large on hardware.
- Strophe thumbnail target size / grid min-column width (aim noticeably larger
  than the current 160px; ~220–260px) and badge styling.
- Non-16:9 projector handling: letterbox with preset background filling the bars.

---

## Specific References

- "Holyrics-style" operator ergonomics remain the north star for the 3-pane
  layout (D-30); thumbnails should read like Holyrics/ProPresenter slide tiles.
- Reuse the `SectionCard` dnd-kit sortable pattern for set-item reordering.

---

## Deferred Ideas

- Per-song or per-section appearance overrides (stays global this phase).
- Configurable blackout color / fade-to-black transition (solid black only now).
- Drag-reorder of song sections already exists; no change requested.
</content>
