# Phase 4 — Home UX, Design System & Monitor Rework

**Created:** 2026-05-20  
**Status:** Specifying  
**Scope:** Large — crosses Rust backend, React frontend, design system, IPC

---

## Problem Statement

After 8 weeks of field use (Phase 3), three pain points surfaced:

1. **Operator friction** — the home screen is a set _list_ when there is always exactly one set. Every Sunday the operator navigates through an extra screen to reach the same fixed set.
2. **Presentation doesn't own the monitor** — the window opens as a floating desktop window instead of fullscreen on the second monitor, forcing a manual Alt+Enter (or settings dance) every service.
3. **Design is cosmetically broken** — the light theme is partial (dark remnants in multiple tabs), the dark mode has a blue cast instead of neutral gray, and the secondary color has no identity (scattered emerald/blue).

Secondary: the presentation window shows a strophe/section label (e.g. "VERSO 1") on screen, which the user wants removed — it leaks internal song structure to the congregation.

---

## Goals

- [ ] Operator opens the app → is immediately on the service set, ready to drag songs
- [ ] Clicking "Apresentar" opens the presentation fullscreen on the secondary monitor automatically (no configuration)
- [ ] Light and dark themes are visually complete — no component has hardcoded dark-only colors
- [ ] The dark mode palette is neutral gray; secondary/brand color is `#19A4DD` throughout
- [ ] Presentation window never shows strophe/section labels
- [ ] The home has one-click shortcuts for offering image, camera, and custom announcements that instantly overlay the current presentation

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| PPTX rendering | Installer size impact (~150 MB); deferred to Phase 5. Placeholder button in home shows "Em breve". |
| Multiple simultaneous overlays | Single overlay slot is sufficient for Sunday workflow |
| Stage window monitor auto-detect | Stage window is operator-discretionary; keep existing manual open button |
| Per-slide announcement (in-set item) | The quick overlay from home is sufficient; the full-overlay approach handles it |
| Removing Cronômetro/Backup/Mídia tabs | User workflow still uses these; only home view changes |

---

## User Stories

### P4H-01: Presentation window opens fullscreen on secondary monitor ⭐ MVP

**User Story:** As an operator, I want to click a single "Apresentar" button and have the presentation appear fullscreen on the projector (secondary monitor) automatically, so I never have to configure monitors or press Alt+Enter.

**Why P4H-01:** This is the #1 reported failure of Phase 3. Currently the window opens floating on the primary monitor. Core workflow blocker.

**Acceptance Criteria:**

1. WHEN the operator clicks "Apresentar" AND there are 2+ monitors THEN the presentation window SHALL open fullscreen on the non-primary monitor (the monitor that is not the primary/main display)
2. WHEN the operator clicks "Apresentar" AND there is only 1 monitor THEN the presentation window SHALL open as a 1280×720 windowed view on the same monitor
3. WHEN the presentation window is already open THEN clicking "Apresentar" SHALL focus the existing window (no duplicate)
4. WHEN the presentation window opens on a secondary monitor THEN it SHALL cover the full resolution of that monitor (no taskbar visible, no window chrome)
5. WHEN the presentation window is open THEN the `state_changed` event SHALL correctly reflect slide changes in real-time

**Implementation notes:**
- Rust `open_presentation_window` command: use `app.primary_monitor()` to identify primary; iterate `available_monitors()` to find the first non-primary; build with `.fullscreen(true).position(x, y).inner_size(w, h)` using physical-to-logical conversion already in `logical_placement()`
- Remove `monitor_index: Option<usize>` parameter (no longer manual)
- Remove `WindowsScreen` presentation-monitor row from settings (the stage row can stay as a simple "Open Stage Window" button)
- Remove `loadPersistedMonitor("window.presentation.monitor")` from OperatorApp

**Independent Test:** Connect a secondary monitor, click "Apresentar" — window should appear fullscreen on the secondary monitor without any configuration.

---

### P4H-02: Sets tab is the home screen — single fixed set ⭐ MVP

**User Story:** As an operator, I want to open the app and immediately see the service set without navigating through a list, because every Sunday there is always exactly one set.

**Why P4H-02:** Eliminates an unnecessary navigation step every service. The multi-set concept maps to no real workflow need.

**Acceptance Criteria:**

1. WHEN the app launches for the first time THEN a set named "Culto Dominical" SHALL be auto-created
2. WHEN the app launches THEN the default view SHALL be the set builder for the single set (not a list)
3. WHEN the operator opens the app on a subsequent session THEN the same persistent set SHALL be shown (items preserved from last session unless cleared)
4. WHEN the operator clicks "Limpar" THEN all items in the set SHALL be removed AND a confirmation dialog SHALL be shown first
5. WHEN items are cleared THEN historical CCLI play records SHALL be preserved (not deleted)
6. The nav bar SHALL NOT have a "Conjuntos" (list) entry — the set builder IS the home

**Implementation notes:**
- Remove `SetList` from navigation; remove `"sets"` view and `"set-builder"` view distinction — there's only one home view
- `OperatorApp` default view: `"home"` (renders `HomeSetBuilder` which is the set builder for the fixed set)
- On init: call a new `get_or_create_default_set()` Rust command that returns the fixed set ID (creates "Culto Dominical" if `sets` table is empty)
- Store the fixed set ID in the Zustand library store so all components can access it without re-fetching
- Rename nav tab label: currently "Conjuntos" → use house icon or "Início"

**Independent Test:** Clear app data, launch — set builder is shown immediately with "Culto Dominical". Add songs, restart app — songs are still there.

---

### P4H-03: Light theme completion ⭐ MVP

**User Story:** As an operator running the app in light mode, I want every tab and panel to use the light theme colors consistently, with no dark gray/dark backgrounds leaking through.

**Why P4H-03:** Phase 3 shipped the theme toggle but only swept the outer chrome. Inner components (SetList, SetBuilder, BackupScreen, CountdownPanel, MediaLibrary, OperatorNotesPanel, CCLIReportScreen) still have hardcoded `bg-gray-800`, `text-white`, `border-gray-700`, `bg-gray-700` classes.

**Acceptance Criteria:**

1. WHEN the operator switches to light theme THEN ALL screens (home, biblioteca, cronômetro, mídia, backup, configurações) SHALL display with white/light gray backgrounds and dark text
2. WHEN in light theme THEN no component SHALL show a dark gray panel or dark border as background
3. WHEN in dark theme THEN all components SHALL display with neutral gray backgrounds (no blue-shifted grays)
4. WHEN the theme is changed THEN the change SHALL apply immediately without page reload

**Scope of files with hardcoded dark colors:**
- `SetList.tsx`: `bg-gray-800`, `border-gray-700`, `text-white`, `bg-gray-700`
- `SetBuilder.tsx`: same pattern
- `CountdownPanel.tsx`: check for hardcoded dark
- `BackupScreen.tsx`: check
- `MediaLibrary.tsx` / `MediaCard.tsx` / `MediaDetailPanel.tsx`: check
- `OperatorNotesPanel.tsx`: check
- `CCLIReportScreen.tsx`: check
- `SectionCard.tsx`: check (per-section notes area)
- `BlankItemNotesEditor.tsx`, `CountdownSetItemEditor.tsx`, `MediaSetItemEditor.tsx`, `WebViewSetItemEditor.tsx`: check

**Independent Test:** Toggle to light theme, navigate through every tab — zero dark backgrounds visible.

---

### P4H-04: Design system — neutral gray dark mode + #19A4DD secondary ⭐ MVP

**User Story:** As an operator, I want the app to have a professional, polished appearance — dark mode in neutral gray tones (not blue), with a consistent blue accent color (#19A4DD) for primary actions.

**Why P4H-04:** Current dark mode uses Tailwind's default grays which have a slight blue cast. The secondary color is inconsistent (emerald-600 in some places, blue-600 in others). A coherent identity makes the app feel intentional.

**Acceptance Criteria:**

1. WHEN in dark mode THEN all background surfaces SHALL use neutral gray (no blue cast):
   - App background: `#111111` (near-black)
   - Panel/card surface: `#1C1C1C`
   - Elevated surface: `#252525`
   - Border: `#333333`
   - Muted text: `#888888`
2. WHEN in light mode THEN:
   - App background: `#F5F5F5`
   - Panel surface: `#FFFFFF`
   - Elevated: `#F0F0F0`
   - Border: `#E0E0E0`
   - Muted text: `#666666`
3. WHEN a primary action button is rendered THEN it SHALL use `#19A4DD` background with white text (hover: `#1494C5`)
4. WHEN a focus ring is shown THEN it SHALL use `#19A4DD`
5. ALL occurrences of `bg-emerald-600`, `bg-blue-600` (primary action contexts) SHALL be replaced with the new secondary color
6. WHEN the operator views the presentation window THEN it SHALL remain black-background (unaffected by theme)

**Implementation notes:**
- Define Tailwind CSS custom properties in `index.css`:
  ```css
  :root {
    --color-bg: #F5F5F5;
    --color-surface: #FFFFFF;
    --color-surface-2: #F0F0F0;
    --color-border: #E0E0E0;
    --color-muted: #666666;
    --color-primary: #19A4DD;
    --color-primary-hover: #1494C5;
  }
  .dark {
    --color-bg: #111111;
    --color-surface: #1C1C1C;
    --color-surface-2: #252525;
    --color-border: #333333;
    --color-muted: #888888;
  }
  ```
- In Tailwind v4, register these as theme tokens so they can be used as `bg-primary`, `border-border`, etc.
- Sweep all components for `bg-gray-900`, `bg-gray-800`, `bg-gray-700`, `border-gray-700`, `border-gray-600`, `text-gray-400`, `text-gray-500` and replace with semantic tokens
- `bg-emerald-600` / `hover:bg-emerald-500` → `bg-primary hover:bg-primary-hover`

**Independent Test:** Open app in both themes. All buttons with primary actions show #19A4DD. Dark mode has no blue-shifted surfaces.

---

### P4H-05: Remove strophe/section label from presentation ⭐ MVP

**User Story:** As an operator, I want the projection screen to show only the song lyrics without a "VERSO 1" / "CORO" label, because the congregation doesn't need to see internal song structure.

**Why P4H-05:** The section label leaks internal structure that is distracting and unnecessary for the audience.

**Acceptance Criteria:**

1. WHEN a song slide is shown on the presentation window THEN the section label (e.g. "VERSO 1", "CORO") SHALL NOT be displayed
2. WHEN a song slide is shown on the stage window THEN the section label SHALL still be displayed (it's useful for the musician)
3. WHEN a blank/empty slide is shown THEN the presentation remains a clean black screen

**Implementation notes:**
- `PresentationApp.tsx` → `SongSlide` component: remove the `sectionLabel` paragraph (`<p className="text-gray-400/60 text-xs uppercase tracking-widest mb-4">`)
- `StageRenderer.tsx`: keep the section label as-is

**Independent Test:** Load a multi-section song, advance slides — projection screen shows only lyrics lines with no section header.

---

### P4H-06: Home — drag songs from library to set ⭐ MVP

**User Story:** As an operator, I want to drag songs from a mini song list on the home screen directly into the service set, without navigating to the library first.

**Why P4H-06:** Current flow requires: Biblioteca → find song → go back to set → add song. Should be one drag gesture.

**Acceptance Criteria:**

1. WHEN the operator is on the home screen THEN a collapsible/sidebar song search panel SHALL be available (same screen, no navigation)
2. WHEN the operator types in the search panel THEN songs SHALL filter in real-time (FTS5 via existing `list_songs` with search)
3. WHEN the operator drags a song from the panel to the set list THEN the song SHALL be appended/inserted at the drop position
4. WHEN a song is successfully added THEN the set list SHALL update immediately
5. WHEN the set already contains that song THEN duplicate SHALL be allowed (multiple instances of same song in one service is valid)

**Implementation notes:**
- The home view is essentially a split-panel: left = set items (dnd-kit Sortable, already in SetBuilder), right = song search panel
- Extend SetBuilder with a collapsible "Adicionar música" sidebar panel
- Drag source: `useDraggable` from dnd-kit for song items in the panel
- Drop target: existing `DndContext` in SetBuilder's item list

**Independent Test:** Search for a song in the sidebar, drag it to the set list — it appears in the set.

---

### P4H-07: Home — overlay shortcuts (Oferta, Câmera, Aviso, PDF placeholder) ⭐ MVP

**User Story:** As an operator, I want quick-action buttons on the home screen to instantly overlay the presentation with an image (for offering), camera feed, or custom announcement, without modifying the service set.

**Why P4H-07:** These are recurring events in every service (offering collection, camera view) that don't belong in the set as items — they're transient overlays that interrupt and then return to the main presentation.

**Acceptance Criteria:**

1. WHEN the operator clicks "Oferta (Mídia)" THEN a media picker dialog SHALL open showing images from the media library
2. WHEN an image is selected from the picker THEN the presentation window SHALL immediately show that image (opening presentation first if not open) AND the overlay SHALL be set
3. WHEN the operator clicks "Câmera" AND a camera URL is configured in settings THEN the presentation window SHALL show the camera web view as an overlay
4. WHEN the operator clicks "Câmera" AND no camera URL is configured THEN a settings dialog SHALL prompt to enter the camera URL
5. WHEN the operator clicks "Aviso" THEN a text input dialog SHALL appear
6. WHEN the operator types text and confirms in the "Aviso" dialog THEN the presentation window SHALL show the announcement text centered on a black background (fullscreen)
7. WHEN any overlay is active THEN pressing Esc in the presentation window OR clicking "Fechar Overlay" in the operator window SHALL close the overlay and return to the previous set state
8. WHEN the operator clicks "PDF" THEN a disabled button SHALL show tooltip "Em breve — Phase 5"
9. WHEN the presentation window is not open THEN any overlay button SHALL auto-open it (using the same auto-monitor logic as P4H-01)

**Overlay system — backend (Rust):**
- Add `overlay: Option<OverlayState>` to `PresentationState`
- `OverlayState` enum: `Announcement { text: String }`, `QuickMedia { media_id: i64 }`, `QuickWebView { url: String }`
- New Tauri commands: `set_announcement_overlay(text: String)`, `set_media_overlay(media_id: i64)`, `set_webview_overlay(url: String)`, `clear_overlay()`
- All overlay commands emit `state_changed`
- The keyboard `Esc` action dispatches `exitPresentation` which calls `clear_overlay()` (in addition to existing idle logic)

**Overlay system — frontend:**
- `PresentationApp.tsx`: after resolving `mode`, check `state.overlay`; if present, render the overlay instead of the normal set content
- `AnnouncementRenderer`: black bg, white text centered, `font-size: clamp(1.5rem, 4vw, 3rem)`
- `QuickMediaRenderer`: reuse `MediaSlideRenderer` with the media item
- `QuickWebViewRenderer`: reuse `WebViewRenderer`

**Camera URL setting:**
- `SettingsScreen` adds a "URL da câmera" text field stored as `settings["camera.url"]`
- `useSettingsStore` adds `cameraUrl: string` field

**Independent Test (Aviso):** Home → Aviso → type "Pais, levem as crianças" → Confirmar → projection shows the text fullscreen → Esc closes it → projection returns to previous slide.

---

## Edge Cases

- WHEN `available_monitors()` returns an empty list THEN `open_presentation_window` SHALL fall back to default OS placement (no crash)
- WHEN the single default set is deleted from outside (direct DB edit) THEN on next launch a new "Culto Dominical" SHALL be auto-created
- WHEN "Limpar" is confirmed THEN the set items are removed but the set record itself is preserved (same set ID, no re-creation)
- WHEN an overlay is active AND the operator advances/retreats slides in the set THEN the set position SHALL update in the background (overlay doesn't block set navigation)
- WHEN the app is closed with an overlay active THEN on next launch the overlay SHALL be cleared (PresentationState resets to idle on init)
- WHEN in single-monitor mode THEN the presentation window is NOT fullscreen (to allow operator to see both windows)
- WHEN the theme changes THEN presentation and stage windows are NOT affected (they always use their own black bg)

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
|---------------|-------|----------|--------|
| P4H-01 | Auto-detect secondary monitor | P1 | Done |
| P4H-02 | Single fixed set as home | P1 | Done |
| P4H-03 | Light theme completion | P1 | Done |
| P4H-04 | Design system (gray dark + #19A4DD) | P1 | Done |
| P4H-05 | Remove strophe label from presentation | P1 | Done |
| P4H-06 | Drag songs to set from home | P1 | Done |
| P4H-07 | Overlay shortcuts (Oferta/Câmera/Aviso/PDF) | P1 | Done |
| P4H-07a | Overlay backend (PresentationState + commands) | P1 | Done |
| P4H-07b | AnnouncementRenderer frontend | P1 | Done |
| P4H-07c | QuickMedia overlay | P1 | Done |
| P4H-07d | Camera URL setting + WebView overlay | P1 | Done |
| P4H-07e | PDF placeholder button | P1 | Done |

**Coverage:** 12 requirements, all P1 (all needed for Sunday workflow)

---

## Success Criteria

- [ ] Operator can go from app launch → songs dragged → presenting fullscreen on projector in under 60 seconds
- [ ] Light theme passes a visual sweep: zero dark gray panels visible in any tab
- [ ] Dark theme surfaces are neutral gray (no blue cast) and secondary color is `#19A4DD`
- [ ] Overlay workflow: announcement visible on projector in under 10 seconds from clicking "Aviso"
- [ ] All existing Rust tests (109) and Vitest tests (74) remain green
- [ ] `tsc --noEmit` clean
