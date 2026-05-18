# Trinity Lyrics v2 — Roadmap

## Phase 0: Skeleton (Week 1–2) — CURRENT

**Goal:** Prove the hardest integration points before feature work.

| Task | Status |
|------|--------|
| Tauri scaffold + two-window setup | Done |
| Two-window IPC: counter demo via "state_changed" | TODO |
| sqlx connected, migration running, SQLite working | TODO |
| asset:// protocol serving local image | TODO |
| MP4 video via asset:// in presentation window | TODO |
| Tests green (cargo test + npx vitest) | TODO |

**Deliverable:** Two-window skeleton that syncs a counter, plays video, serves local assets.

---

## Phase 1: MVP — Lyrics + Holyrics Import (Week 3–8)

**Goal:** Replace Holyrics for Sunday morning lyrics presentation.

| Task | Status |
|------|--------|
| slide_splitter — pure Rust, fully unit-tested | TODO |
| SQLite schema + initial migration | Done |
| Song CRUD (Rust commands + React editor) | TODO |
| dnd-kit section reorder in editor | TODO |
| Full-text search (FTS5) | TODO |
| Set builder (songs only, dnd-kit sortable) | TODO |
| Lyrics presentation: load set, advance/prev/blank/freeze | TODO |
| Keyboard shortcuts (Space, arrows, B, F, Esc, 1–9) | TODO |
| Solid color + static image backgrounds | TODO |
| Plain-text import wizard | TODO |
| Holyrics import wizard (requires real export file) | TODO |
| Settings: font, slide layout, monitor picker | TODO |
| Portuguese UI strings | TODO |

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
