# Phase 7 — Discovery Context

**Captured:** 2026-05-22
**Method:** Interactive Q&A during /tlc-spec-driven specify pass.

This document records the gray-area decisions surfaced during the specify phase. Each decision is referenced by requirement IDs in `spec.md`. If any decision is revisited, update this file AND the affected requirements.

---

## Q1 — Single-monitor behavior for `Apresentar`

**Question:** When `Apresentar` is clicked on a single-monitor PC, what behavior do you want?

**Options considered:**
- Fullscreen on top (toggleable) — borderless fullscreen covering operator; ALT+TAB returns
- Windowed preview only — small floating preview, no fullscreen takeover
- Block with warning — refuse to enter presentation without second monitor

**Decision:** **Fullscreen on top, toggleable**

**Rationale:** Matches PowerPoint single-screen slideshow ergonomics. The user explicitly wants rehearsal-on-laptop to "just work" without forcing a projector. Toggling via ALT+TAB / ESC gives the operator a clear exit path.

**Affects:** P7-02

**Implementation consequence:** `enter_presentation` adds `.always_on_top(true)` when `monitors.len() == 1`. The 2+ monitor branch must NOT set this (would steal focus from operator on primary).

---

## Q2 — Operator layout shape during presentation

**Question:** What should the operator screen look like during presentation?

**Options considered:**
- 3-pane: set list | strophes grid | live preview
- 2-pane: set list (left) | strophes grid (right) — no preview
- Holyrics 3-row: top toolbar | active grid | preview strip

**Decision:** **3-pane: SET | STROPHES | LIVE** (with the ASCII layout chosen in the preview)

**Rationale:** The user wants all three concerns visible simultaneously: where they are in the service, what they can switch to within the current item, and what the audience sees. The 3-pane vertical split matches how Holyrics, OpenLP, and ProPresenter lay out their operator surfaces — the user explicitly cited Holyrics as the reference.

**Affects:** P7-04, P7-05, P7-06, P7-07

**Implementation consequence:**
- Fixed proportions: LEFT 240px, CENTER flex-1, RIGHT 320px
- Below 1024px screen width, RIGHT collapses; below 720px LEFT can also collapse
- Each pane has a labeled header ("Conjunto" / "Estrofes — [item]" / "Ao vivo")

---

## Q3 — Inter-item click semantics

**Question:** When the user clicks a DIFFERENT set item (e.g. song 2 while song 1 is live), what should happen?

**Options considered:**
- Replace: song 1 leaves, song 2 becomes the live item
- Overlay: song 1 stays underneath, song 2 layers on top
- Hybrid: songs replace, media/web/counter overlay

**Decision:** **Replace** — the clicked item becomes the new active item; previous item leaves the projection

**Rationale:** Despite the user's wording ("should overlap"), the discussion clarified that "overlap" referred to overlay actions like Oferta/Câmera/Aviso (which already work that way). For inter-item navigation in the set, Replace is the conventional slide-software behavior — the operator is moving through a linear service, and stacking song-on-song is confusing.

**Affects:** P7-07

**Implementation consequence:**
- Click handler: `goto_slide(targetItemIdx, 0)` (existing command)
- Overlay actions (Oferta/Câmera/Aviso) remain via the `<OverlayActionBar />` toolbar — they handle the "layered transient" use case the user was reaching for
- The existing P4H overlay system is reused unchanged

---

## Q4 — Dark mode contrast fix scope

**Question:** What's the fix scope for the dark mode contrast issue?

**Options considered:**
- Audit & re-token every hardcoded color (full sweep)
- Lighten dark-mode background only (quick fix)
- Both — sweep AND lighten bg

**Decision:** **Audit & re-token every hardcoded color (zero-tolerance sweep)**

**Rationale:** The P6-03 attempt left 34 hardcoded color hits across 17 components. Lightening the background would mask but not fix the underlying tokenization gap; new components added later would re-introduce the bug. A complete sweep gated by an updated `check-theme-tokens.ps1` script prevents regression.

**Affects:** P7-03

**Implementation consequence:**
- Sweep replaces `text-black` → `text-fg`, `text-white` → `text-fg-on-primary` (button-on-primary contexts), `bg-white` → `bg-surface`
- Renderer components (Announcement/Countdown/QuickMedia/Slideshow/Webview) are EXEMPT — they intentionally draw on user-supplied media backgrounds and need fixed high-contrast white
- The `check-theme-tokens.ps1` deny-list is expanded with explicit exemption paths
- No background-color change in the dark theme (token values stand)

---

## Open Questions for Design Phase

These deferred to design.md (require code investigation before deciding):

1. **LIVE preview rendering strategy:** Direct component composition (re-mount renderers at small size) vs. CSS `transform: scale()` on a fixed-resolution root. Direct is simpler; scale() is safer for video content.
2. **`OverlayDialogs` extraction:** Whether to extract the camera-prompt / announcement-textarea / media-picker dialogs into a shared `<OverlayDialogs />` component or keep them inline in each parent. Depends on the actual duplication cost (read both call sites first).
3. **Tauri 2 `always_on_top` API:** Builder method `.always_on_top(true)` vs. post-build setter `.set_always_on_top(true)`. Verify via Context7 / Tauri 2 docs.
4. **Monitor filter heuristic for P7-01 AC 4:** Width=0 OR height=0 is the simple test; verify on Windows with various display configurations (asleep secondary, disconnected projector, virtual displays from third-party tools).
