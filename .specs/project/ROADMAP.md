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

## Phase 1: MVP — Lyrics + Holyrics Import (Week 3–8) — CURRENT

**Goal:** Replace Holyrics for Sunday morning lyrics presentation.
**Spec:** `.specs/features/phase1-mvp/spec.md` (15 requirements P1-01..P1-15, drafted 2026-05-18)

| ID | Requirement | Status |
|----|-------------|--------|
| P1-01 | Domain types (Song, Section, ServiceSet, PresentationState) | Pending design |
| P1-02 | Schema completion: FTS triggers (migration 002) | Pending design |
| P1-03 | slide_splitter — pure Rust, fully unit-tested | Pending design |
| P1-04 | Song CRUD Tauri commands | Pending design |
| P1-05 | Song editor UI (React) | Pending design |
| P1-06 | dnd-kit section reorder in editor | Pending design |
| P1-07 | Full-text search (FTS5) | Pending design |
| P1-08 | Service set builder (songs + blank, dnd-kit sortable) | Pending design |
| P1-09 | Lyrics presentation runtime — advance/prev/blank/freeze | Pending design |
| P1-10 | Keyboard shortcuts (Space, arrows, B, F, Esc, 1–9) | Pending design |
| P1-11 | Solid color + static image backgrounds | Pending design |
| P1-12 | Plain-text import wizard | Pending design |
| P1-13 | Holyrics JSON import wizard (B-1 resolved 2026-05-18) | Pending design |
| P1-14 | Settings: font, slide layout, monitor picker | Pending design |
| P1-15 | Portuguese UI strings (hard-coded pt-BR) | Pending design |

**Deliverable:** App used in one real Sunday service.

---

## Phase 2: V1 — Media + Countdown + WebView (Week 9–14)

**Goal:** Full Holyrics feature parity minus PPTX.

| Task | Status |
|------|--------|
| Media library (images + MP4/WebM) with asset:// | TODO |
| Image and video presentation with CSS transitions | TODO |
| Video backgrounds for lyrics | TODO |
| Countdown timer with Tokio tick + optional video bg | TODO |
| Web/IP camera viewer (<iframe>/<img> MJPEG) | TODO |
| All set item types: song, media, countdown, webview, blank | TODO |
| Library ZIP backup/restore | TODO |
| English language option (i18next) | TODO |

**Deliverable:** Full V1 used weekly. 4-week feedback period.

---

## Phase 3: V2 — Polish + Power Features (Week 15–22)

- PPTX rendering (LibreOffice CLI)
- Per-section background overrides
- Presenter notes
- Keyboard shortcut customization
- Service report / CCLI prep export
- Dark/light UI theme
- Auto-update (Tauri updater plugin)
- Optional crash reporting (opt-in Sentry)
