# Phase 9 — Presentation Fidelity & Operator UX Specification

## Problem Statement

The operator-facing previews (live preview pane, strophe thumbnails, song-editor
preview) render slides with an ad-hoc simplified layout that ignores the global
appearance settings (font size, screen position, margin, preset). What the
operator sees does **not** match what the projector shows, so configuration is
effectively invisible until it hits the live screen. On top of that, several
smaller UX defects accumulated: the language picker shows the wrong selected
value, the Aviso (warning) overlay leaves gray bars instead of filling the
slide, the title-slide author line is oversized, nav tabs look clickable while
presenting, set items can only be reordered with buttons, the strophe thumbnails
are cramped, and there is no automatic black slide between songs.

## Goals

- [ ] Operator previews are pixel-faithful to the projection for **every** item
      type (song, blank, countdown, media image, warning, slideshow).
- [ ] The settings the user configures (font, size, position, margin, preset,
      background) are honored identically in preview and projection.
- [ ] Fix the language-picker selected-value bug.
- [ ] Make the warning overlay fill the whole slide with its configured
      background.
- [ ] Improve operator ergonomics: editor preview pane, disabled tabs while
      presenting, drag-to-reorder set items, larger thumbnails, auto blackout
      after each song.

## Out of Scope

| Feature | Reason |
| --- | --- |
| New appearance settings beyond an announcement margin + blackout toggle | Phase 8 already shipped the appearance model; this phase only consumes it faithfully |
| Per-song font/position overrides | Appearance stays global (D-30 era decision); not requested |
| Screen-capture / DXGI live preview | D-31 stands — we re-render owned state, never capture |
| Video/iframe real playback inside previews | D-34 stands — previews use placeholder cards for video/web_view |
| Stage window return | Removed in D-27; not reintroduced |

---

## User Stories

### P9-01: Language picker reflects the active locale ⭐ MVP

**User Story**: As an operator, I want the Settings language dropdown to show the
language the app is actually running in, so I trust the setting.

**Why P1**: Data-integrity bug; user reported the app fully in English while the
picker showed "Português".

**Root cause**: `main.tsx` loads `app.locale` from the DB and calls
`i18next.changeLanguage()`, but never updates `useSettingsStore.locale`. The
`LanguagePicker` binds `<select value={locale}>` to that store field, which is
frozen at its `"pt-BR"` default.

**Acceptance Criteria**:
1. WHEN the app boots with a persisted `app.locale` THEN the Settings language
   dropdown SHALL display that locale as selected.
2. WHEN the app renders text THEN the rendered language SHALL match the dropdown
   selection at all times.
3. WHEN the user changes the language THEN both `i18next` and the settings store
   SHALL update and the choice SHALL persist across restarts.

**Independent Test**: Set `app.locale=en-US` in the DB, launch — UI is English
and the picker reads "English".

---

### P9-02: Faithful operator & live previews ⭐ MVP

**User Story**: As an operator, I want every preview surface to look exactly like
the projected slide, so I can trust what I'm about to show.

**Why P1**: Core complaint; spans all preview surfaces and all item types.

**Acceptance Criteria**:
1. WHEN a slide is previewed (live pane, strophe thumbnail, editor) THEN it SHALL
   apply the same font family, font size, screen position, margin, and preset/
   background as the projection.
2. WHEN the appearance settings change THEN all preview surfaces SHALL update
   live (existing `onSettingChanged` reload).
3. WHEN the item is a countdown, warning, media image, or slideshow THEN the
   preview SHALL render it with the same layout the projector uses (video and
   web_view keep placeholder cards per D-34).
4. WHEN the projection window renders a slide AND a preview renders the same
   slide THEN the two SHALL be visually identical up to scale.

**Independent Test**: Set position=bottom-right, margin=xl, size=xxl; confirm
live pane and projector match.

---

### P9-03: Warning overlay fills the whole slide

**User Story**: As an operator, I want the Aviso overlay to fully cover the
screen with its configured background, with no gray edges.

**Why P1**: Visible defect on the live screen during announcements.

**Root cause**: `AnnouncementRenderer` root is `h-full` (no full-viewport
coverage) with a fixed `p-16`; the configured background only paints the flex
area, leaving the app's gray surface showing.

**Acceptance Criteria**:
1. WHEN a warning overlay is shown THEN its configured background SHALL fill the
   entire slide area edge-to-edge.
2. WHEN the warning has little/no text THEN no gray (app-surface) area SHALL be
   visible.
3. WHEN a warning is shown THEN it SHALL honor the configured announcement
   position and margin (margin newly configurable, default `lg`).
4. WHEN previewed in the live pane THEN the warning SHALL render the same way as
   on the projector.

**Independent Test**: Preset preto-branco (black), short warning text — whole
slide is black, text positioned per setting.

---

### P9-04: Faithful song-editor preview pane

**User Story**: As an editor, I want a preview pane open by default on the right
of the song editor that shows how the whole song will look projected.

**Why P2**: High-value editing aid; depends on P9-02's shared renderer.

**Acceptance Criteria**:
1. WHEN the song editor opens THEN a preview pane SHALL be visible by default on
   the right.
2. WHEN the song editor preview renders THEN it SHALL show every slide of the
   song (title slide + all sections, split by the real splitter) as faithful
   thumbnails honoring all appearance settings.
3. WHEN the user edits text, casing, repeat, or background THEN the preview SHALL
   update.
4. WHEN the preview pane is shown THEN the legacy per-section inline Eye toggle
   SHALL be removed (superseded).

**Independent Test**: Open a multi-section song; right pane lists title + all
section slides matching projection layout.

---

### P9-05: Title-slide author line smaller than title

**User Story**: As an operator, I want the author/credit line on the intro slide
to be clearly smaller than the title, sharing its color.

**Why P2**: Visual polish; author currently equals body size (one notch under
title) and reads too large.

**Acceptance Criteria**:
1. WHEN the title slide renders THEN the author line SHALL be smaller than the
   title line (one notch below the configured body size).
2. WHEN the title slide renders THEN the author SHALL use the title's color
   (de-emphasized via opacity), not a different hue.
3. WHEN rendered in any preview THEN the same proportion SHALL hold.

**Independent Test**: Title slide shows title large, author visibly smaller, same
color family.

---

### P9-06: Disable nav tabs while presenting

**User Story**: As an operator, I want the top nav tabs to visibly indicate they
are unavailable while a presentation is live, so I'm not confused when they do
nothing.

**Why P2**: UX clarity; behavior is already correct, only the affordance is
missing.

**Acceptance Criteria**:
1. WHEN a presentation is live/blank/frozen THEN the Home/Library/Media/Backup/
   Settings tabs SHALL appear disabled (muted, not-allowed cursor).
2. WHEN a tab is disabled THEN clicking it SHALL do nothing.
3. WHEN the presentation exits THEN the tabs SHALL return to normal.

**Independent Test**: Enter presentation — tabs grey out and ignore clicks; exit
— tabs restored.

---

### P9-07: Drag-to-reorder set items

**User Story**: As an operator, I want to drag set items to reorder them, not
only use the up/down arrows.

**Why P2**: Faster set building; dnd-kit already a dependency (used by
SectionCard).

**Acceptance Criteria**:
1. WHEN the user drags a set item row THEN the list SHALL reorder visually.
2. WHEN the drag drops THEN the new order SHALL persist via the existing
   `reorder_set_items` command.
3. WHEN reordered THEN the up/down arrow controls SHALL remain functional
   (kept for accessibility).
4. WHEN a presentation is live THEN reordering follows existing edit rules (no
   new constraint introduced).

**Independent Test**: Drag item 3 above item 1; reload set — order persisted.

---

### P9-08: Larger, faithful strophe thumbnails

**User Story**: As an operator, I want the strophe thumbnails to be bigger and
better laid out so they fill the available space and are easy to read.

**Why P2**: Readability; current cards are small text-only tiles.

**Acceptance Criteria**:
1. WHEN the strophes grid renders THEN each thumbnail SHALL be a faithful 16:9
   slide preview (P9-02 renderer) with a section-label badge.
2. WHEN the grid renders THEN thumbnails SHALL be larger and better fill the
   center pane than the current ~160px tiles.
3. WHEN a thumbnail is active THEN it SHALL keep the current highlight + auto
   scroll-into-view behavior.

**Independent Test**: Open a song in presentation; strophe grid shows large
faithful thumbnails.

---

### P9-09: Default blackout slide after each song

**User Story**: As an operator, I want a black slide automatically after the last
slide of each song so advancing past a song goes dark before the next item.

**Why P2**: Common worship-flow need; should be default-on but disableable.

**Acceptance Criteria**:
1. WHEN a set is loaded AND the blackout setting is enabled (default ON) THEN a
   navigable black slide SHALL be appended after the last slide of every Song
   item.
2. WHEN the operator advances onto the blackout slide THEN the projection SHALL
   show solid black with no text.
3. WHEN the operator advances past the blackout slide THEN it SHALL move to the
   first slide of the next item.
4. WHEN the setting is disabled in Settings THEN no blackout slides SHALL be
   inserted.
5. WHEN the blackout slide appears in the strophes grid THEN it SHALL be shown as
   a black thumbnail labeled accordingly.

**Independent Test**: Two-song set with setting ON — each song ends on a black
slide; toggling the setting off removes them after reload.

---

## Edge Cases

- WHEN a projector is not 16:9 THEN the shared stage SHALL letterbox with the
  preset background color filling the bars (fidelity preserved over edge-fill).
- WHEN a song has no sections (empty) THEN it still gets a title slide (if
  enabled) + blackout slide (if enabled).
- WHEN `app.locale` is missing/corrupt THEN the picker SHALL fall back to the
  default locale without error.
- WHEN a set has zero items THEN no blackout slide is added and previews show the
  empty state.
- WHEN dragging is interrupted (drop outside list) THEN order SHALL remain
  unchanged.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| P9-01 | Language picker | Design | Pending |
| P9-02 | Faithful previews | Design | Pending |
| P9-03 | Warning overlay fill | Design | Pending |
| P9-04 | Editor preview pane | Design | Pending |
| P9-05 | Author line size | Design | Pending |
| P9-06 | Disable tabs presenting | Design | Pending |
| P9-07 | Drag-reorder set items | Design | Pending |
| P9-08 | Larger thumbnails | Design | Pending |
| P9-09 | Blackout after song | Design | Pending |

**Coverage:** 9 total, 0 mapped to tasks (tasks phase pending).

---

## Success Criteria

- [ ] Side-by-side, a previewed slide and its projection are visually identical
      up to scale for every item type.
- [ ] Language picker always matches the rendered language.
- [ ] Warning overlay shows zero gray edges on any preset.
- [ ] Set items reorder by drag and persist.
- [ ] Blackout-after-song defaults on and is toggleable.
- [ ] `tsc --noEmit`, `cargo test`, `cargo clippy -D warnings`, and Vitest all
      green; no regressions in existing presentation tests.
</content>
</invoke>
