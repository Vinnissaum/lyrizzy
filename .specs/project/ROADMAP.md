# Trinity Lyrics v2 — Roadmap

## Phase 0: Skeleton (Week 1–2) — DONE

**Goal:** Prove the hardest integration points before feature work.

| Task | Status |
|------|--------|
| Tauri scaffold + two-window setup | Done |
| Two-window IPC: counter demo via "state_changed" | Done |
| sqlx connected, migration running, SQLite working | Done |
| asset:// protocol serving local image | Done |
| MP4 video via asset:// in presentation window | Done |
| Tests green (cargo test + npx vitest) | Done |
| Polish: serde rename, canonicalize once, media dir pre-create | Done (T7–T9) |
| Polish: DB fail-fast + pool in AppState | Done (T10) |
| Polish: open_presentation_window command | Done (T11) |
| Polish: OperatorApp component test (Tauri API mocks) | Done (T12) |

**Deliverable:** Two-window skeleton that syncs a counter, plays video, serves local assets. *(Achieved; second window currently requires manual `tauri.conf.json` declaration — replaced by T11.)*

---

## Phase 1: MVP — Lyrics + Holyrics Import (Week 3–8) — DONE

**Goal:** Replace Holyrics for Sunday morning lyrics presentation.
**Spec:** `.specs/features/phase1-mvp/spec.md` (15 requirements P1-01..P1-15, drafted 2026-05-18)

| ID | Requirement | Status |
|----|-------------|--------|
| P1-01 | Domain types (Song, Section, ServiceSet, PresentationState) | Done |
| P1-02 | Schema completion: FTS triggers (migration 002) | Done |
| P1-03 | slide_splitter — pure Rust, fully unit-tested | Done |
| P1-04 | Song CRUD Tauri commands | Done |
| P1-05 | Song editor UI (React) | Done |
| P1-06 | dnd-kit section reorder in editor | Done |
| P1-07 | Full-text search (FTS5) | Done |
| P1-08 | Service set builder (songs + blank, dnd-kit sortable) | Done |
| P1-09 | Lyrics presentation runtime — advance/prev/blank/freeze | Done |
| P1-10 | Keyboard shortcuts (Space, arrows, B, F, Esc, 1–9) | Done (extended in P3-08..P3-10) |
| P1-11 | Solid color + static image backgrounds | Done |
| P1-12 | Plain-text import wizard | Done |
| P1-13 | Holyrics JSON import wizard (B-1 resolved 2026-05-18) | Done |
| P1-14 | Settings: font, slide layout, monitor picker | Done |
| P1-15 | Portuguese UI strings (hard-coded pt-BR) | Done |

**Deliverable:** App used in one real Sunday service.

---

## Phase 2: V1 — Media + Countdown + WebView (Week 9–14) — DONE

**Goal:** Full Holyrics feature parity minus PPTX.
**Spec:** `.specs/features/phase2-v1/spec.md` (20 requirements P2-01..P2-20, approved 2026-05-19)

| ID | Requirement | Status |
|----|-------------|--------|
| P2-01 | Media domain types + schema (migration 003) | Done |
| P2-02 | Media CRUD commands (import / list / rename / soft-delete) | Done |
| P2-03 | Video thumbnail generation | Done |
| P2-04 | Media library UI (grid, filter, detail panel) | Done |
| P2-05 | Media upload flow (file dialog + drag-drop) | Done |
| P2-06 | Image set item + fullscreen renderer | Done |
| P2-07 | Video set item (loop / mute / autoplay) | Done |
| P2-08 | Video backgrounds for lyrics (scrim opacity) | Done |
| P2-09 | CSS transitions between slides and items | Done |
| P2-10 | Countdown domain + Tokio backend ticker | Done |
| P2-11 | Countdown set item + editor controls | Done |
| P2-12 | Countdown presentation renderer | Done |
| P2-13 | WebView set item (iframe + MJPEG dual mode) | Done |
| P2-14 | CSP + sandbox rules for embedded content | Done |
| P2-15 | Five set item types unified in runtime | Done |
| P2-16 | Set editor handles all five types | Done |
| P2-17 | Library ZIP export (.tlz, includes media files) | Done |
| P2-18 | Library ZIP import — Replace + Merge modes | Done |
| P2-19 | i18next setup + locale extraction | Done |
| P2-20 | Language picker in settings (pt-BR / en-US) | Done |

**Deliverable:** Full V1 used weekly. 4-week feedback period.

---

## Phase 3: V2 — Stage Display + Notes + Section BG + Shortcuts + CCLI + Theme + Auto-Update (Week 15–22) — DONE

**Goal:** Polish V1 into a production-stable tool with on-stage talent support, operator quality-of-life, and a clean update path.
**Completed:** 2026-05-20. Field period: 2026-05-20 → 2026-07-15 (8 weeks).

| ID | Requirement | Status |
|----|-------------|--------|
| P3-01 | Stage display window plumbing (3rd WebviewWindow, label "stage") | Done |
| P3-02 | Stage display renderer — current+next slide + notes + clock | Done |
| P3-03 | Notes domain + schema (per-section + per-set-item) | Done |
| P3-04 | Notes editor UI (song editor + set builder) | Done |
| P3-05 | Notes rendered in operator panel + stage display | Done |
| P3-06 | Section background column + fallback semantics | Done |
| P3-07 | Section editor UI for background picker | Done |
| P3-08 | Keyboard shortcut bindings storage | Done |
| P3-09 | Shortcuts settings UI (rebind, conflict detection, restore defaults) | Done |
| P3-10 | Runtime shortcut dispatcher reads from settings | Done |
| P3-11 | Songs schema additions (ccli_number, copyright, author) | Done |
| P3-12 | Song editor exposes CCLI fields | Done |
| P3-13 | Play-counting service (per service, idempotent per day) | Done |
| P3-14 | CCLI CSV export UI + command | Done |
| P3-15 | Theme setting + Tailwind v4 dark mode wiring | Done |
| P3-16 | Theme picker in settings (light / dark) | Done |
| P3-17 | Tauri updater plugin + GitHub Releases signing infra | Done |
| P3-18 | Update flow UI (24h check, non-blocking banner, manual check) | Done |

**Deliverable:** Production-stable V2 used weekly. 8-week feedback period before Phase 4.

**Deferred to Phase 5 (renumbered from Phase 4, per 2026-05-20 spec discussion):**
- PPTX rendering (bundled LibreOffice sidecar — heavier installer impact, deserves its own phase)
- Opt-in Sentry crash reporting (privacy disclosure flow bundled with PPTX phase)

---

## Phase 4: Home UX, Design System & Monitor Rework — DONE

**Goal:** Eliminate the remaining friction from weekly Sunday service workflow.  
**Completed:** 2026-05-21.  
**Spec:** `.specs/features/phase4-home-ux/spec.md` (12 requirements P4H-01..P4H-07e, drafted 2026-05-20)

| ID | Requirement | Status |
|----|-------------|--------|
| P4H-01 | Auto-detect secondary monitor — fullscreen on non-primary | Done |
| P4H-02 | Single fixed set ("Culto Dominical") as home screen | Done |
| P4H-03 | Light theme completion across all tabs/components | Done |
| P4H-04 | Design system: neutral gray dark mode + #19A4DD secondary | Done |
| P4H-05 | Remove strophe/section label from presentation window | Done |
| P4H-06 | Drag songs to set directly from home (split-panel) | Done |
| P4H-07a | Overlay backend: OverlayState in PresentationState + commands | Done |
| P4H-07b | AnnouncementRenderer (fullscreen custom text overlay) | Done |
| P4H-07c | Quick media overlay shortcut (Oferta) | Done |
| P4H-07d | Camera URL setting + WebView overlay shortcut | Done |
| P4H-07e | PDF/PPTX placeholder button ("Em breve") | Done |

**Deliverable:** App opens directly to service set, presentation goes fullscreen on projector automatically, full theme + design polish. Song sidebar with drag-to-add and overlay shortcuts (Oferta/Câmera/Aviso) on home screen.

---

## Phase 5: PPTX/PDF Rendering (LibreOffice Sidecar) — DONE

**Goal:** Import PPTX and PDF files as set items; navigate slide-by-slide like songs.  
**Completed:** 2026-05-21.  
**Spec:** `.specs/features/phase5-pptx/spec.md` (8 requirements P5-01..P5-08)

| ID | Requirement | Status |
|----|-------------|--------|
| P5-01 | `Presentation` MediaKind + `slide_count` column | Done |
| P5-02 | `SlideShow` SetItemType + serialization | Done |
| P5-03 | `libreoffice` service — path resolution + headless PNG conversion | Done |
| P5-04 | `import_presentation` Tauri command + `conversion_progress` event | Done |
| P5-05 | `load_set_for_presentation` — SlideShow pseudo-slides | Done |
| P5-06 | `SlideshowRenderer` presentation component | Done |
| P5-07 | `SlideshowSetItemEditor` + SetBuilder add-presentation button | Done |
| P5-08 | HomeSetBuilder PDF/PPTX import button wired | Done |

**Deliverable:** PPTX and PDF files importable as set items; slides advance via normal prev/next controls; `LibreOfficeBanner` warns if LibreOffice not found.

---

## Phase 6: Corrections & Polish — DONE

**Goal:** Fix critical UX gaps, complete dark/light theme parity, add PowerPoint-style in-operator presentation navigator.  
**Completed:** 2026-05-22.  
**Spec:** `.specs/features/phase6-corrections/spec.md` (9 requirements P6-01..P6-09, drafted 2026-05-21)

| ID | Requirement | Status |
|----|-------------|--------|
| P6-01 | `--color-fg` / `--color-fg-on-primary` tokens + NotesField + textbox sweep | Done |
| P6-02 | Operator surfaces sweep + extend `check-theme-tokens.ps1` deny-list | Done |
| P6-03 | Dark theme contrast fix + native input `color-scheme` | Done |
| P6-04 | `enter_presentation` / `exit_presentation` + "Apresentar" button + OperatorApp routing + lifecycle subscription | Done |
| P6-05 | `PresentationNavigator` — scrollable per-slide jump list with current highlight | Done |
| P6-06 | Hardcoded ESC (exits presentation) + F10 (toggles blackout) in both windows | Done |
| P6-07 | Remove redundant "Open Presentation Window" toolbar button | Done |
| P6-08 | Remove Stage window subsystem (3-window → 2-window) | Done |
| P6-09 | `CountdownTarget` enum (`Duration` \| `FixedTime`) + `CountdownSetItemEditor` mode toggle | Done |

**Deliverable:** Fully theme-consistent operator UI in light and dark mode, PowerPoint-style in-operator slide navigator with click-to-jump, countdown fixed-time mode, ESC/F10 keyboard parity.
