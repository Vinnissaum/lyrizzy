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

---

## Phase 7: Presentation Rework (Holyrics-style operator, single-monitor fullscreen, dark contrast) — DONE

**Goal:** Make `Apresentar` reliably visible (diagnose silent-failure path), add single-monitor fullscreen-on-top mode, finish the dark-theme contrast sweep, and replace the long-vertical `PresentationNavigator` with a 3-pane Holyrics-style operator workspace (SET | STROPHES grid | LIVE preview).
**Completed:** 2026-05-23.
**Spec:** `.specs/features/phase7-presentation-rework/spec.md` (8 requirements P7-01..P7-08).
**Context:** `.specs/features/phase7-presentation-rework/context.md` (4 gray-area decisions resolved).

| ID | Requirement | Status |
|----|-------------|--------|
| P7-01 | Diagnose & fix silent `Apresentar` failure (toast on error, monitor filter, observability) | Done |
| P7-02 | Single-monitor `always_on_top` fullscreen presentation | Done |
| P7-03 | Finish dark-theme hardcoded-color sweep (zero hits in operator components) | Done |
| P7-04 | `OperatorPresentationLayout` — 3-pane Holyrics-style shell | Done |
| P7-05 | STROPHES pane — wrapping thumbnail grid (replaces vertical list) | Done |
| P7-06 | LIVE preview pane — rendered from `PresentationState`, not screen-captured | Done |
| P7-07 | SET pane — click-to-replace inter-item navigation | Done |
| P7-08 | Extract `<OverlayActionBar />` for reuse between home and presentation | Done |

**Deliverable:** `Apresentar` works on every hardware configuration with visible feedback; operator presentation surface mirrors Holyrics's three-pane workspace; dark theme passes a zero-tolerance contrast audit.

---

## Phase 8: Presentation Fix-ups + Background Presets — DONE

**Goal:** Fix eight accumulated UX issues: click-handler state-sync, ESC-freeze, countdown fallback, ESC label display, Windows asset URL scheme, background presets with typography control, and Apresentar button consolidation.  
**Completed:** 2026-05-23.  
**Spec:** `.specs/features/phase8-presentation-fixes/spec.md` (8 requirements P8-01..P8-08).

| ID | Requirement | Status |
|----|-------------|--------|
| P8-01 | Fix stale closure in StrophesGrid click handlers | Done |
| P8-02 | Fix stale closure in SetItemList click handlers | Done |
| P8-03 | Countdown no-config fallback message in presentation window | Done |
| P8-04 | ESC freeze — `exit_presentation` idempotency + state-before-close + frontend dedup | Done |
| P8-05 | ESC label (`Keycap` canonical labels + `exitPresentation` binding normaliser) | Done |
| P8-06 | Windows asset URL scheme (`asset://localhost` → `http://asset.localhost`) + `mediaUrl()` + thumb-pending UX | Done |
| P8-07 | Background presets (None/Preset/Media tabs, FontFamily/FontSize typography, migration 007) | Done |
| P8-08 | Apresentar button consolidation (`hidePresentButton` prop, unified handler, `set-player` removed) | Done |

**Deliverable:** All critical presentation-flow bugs fixed; background presets let operators choose black/white palette + font for any song or section without importing media.

---

## Phase 10: Stability Fixes — DONE

**Goal:** Fix three field-reported defects that undermine trust in the presentation flow: overlay-on-idle freeze with dead Esc, naïve author-parentheses double-wrapping, and the operator window vanishing mid-service. Plus window-lifecycle hardening + observability.
**Completed:** 2026-06-02.
**Spec:** `.specs/features/phase10-stability-fixes/spec.md` (6 requirements P10-01..P10-06).

| ID | Requirement | Status |
|----|-------------|--------|
| P10-01 | Overlay renders over idle (render-branch precedence: blank → overlay → idle → live) | Done |
| P10-02 | Esc always escapes from any mode + ~400ms local self-close fallback | Done |
| P10-03 | Smart author parentheses — backend `credit_line`/`is_balanced_wrapped` (idempotent) | Done |
| P10-04 | Smart author parentheses — frontend `creditLine` mirror + Vitest 1:1 | Done |
| P10-05 | Operator observability — panic hook + `on_window_event` logging | Done |
| P10-06 | Operator close → presentation close (no orphan); presentation-alone close leaves operator | Done |

**Deliverable:** No path leaves the projector frozen on "Aguardando" while an overlay is set; Esc reliably escapes from idle/live/blank/frozen/overlay; zero `((...))` or unstripped parens on title slides; window-close/panic events logged; operator close never orphans the presentation window.

---

## Phase 11: Operator Polish — DONE

**Goal:** Fix three field-reported operator-experience defects: announcement (Aviso) invisible over a blacked-out projector, sluggish operator-side selection highlight, and loose strophe preview cards with empty space below the 16:9 slide.
**Completed:** 2026-06-02.
**Spec:** `.specs/features/phase11-operator-polish/spec.md` (5 requirements P11-01..P11-05). Frontend-only — no Rust/schema/IPC change.

| ID | Requirement | Status |
|----|-------------|--------|
| P11-01 | Announcement overlay renders over blackout in the projection window (render precedence: announcement → blank → other-overlay → idle → live) | Done |
| P11-02 | LIVE preview mirrors announcement-over-blackout; Oferta/Câmera still lose to blackout | Done |
| P11-03 | Optimistic operator selection — instant strophe/set-item highlight, reconciled to backend `state_changed` | Done |
| P11-04 | Memoized `SlideCard` (stable `appearance`/`onSelect`) so the full strophe grid does not re-render per state change | Done |
| P11-05 | Strophe preview cards crop tightly to 16:9 (aspect-ratio on outer button + grid `items-start`), no empty space below | Done |

---

## Phase 13: Auto-Update & Release Pipeline — DONE

**Goal:** Fix the auto-updater actively reporting "up to date" when the check silently failed (placeholder pubkey + `OWNER/REPO` endpoint), replace the v1-era manual sign/upload release ritual with a tag-push → GitHub Actions → signed draft release pipeline, and give the About panel a real button with visible download progress instead of a muted text link and a frozen-looking install.
**Completed:** 2026-07-23.
**Spec:** `.specs/features/phase13-auto-update-release/spec.md` (29 requirements P13-01..P13-29). Verified independently per phase — see `.specs/features/phase13-auto-update-release/validation.md` for the Phase 3 (frontend) report.

| ID | Requirement | Status |
|----|-------------|--------|
| P13-01 | `bundle.createUpdaterArtifacts: true` so `tauri build` emits `.sig` files | Done |
| P13-02 | Real `plugins.updater.endpoints` + generated `pubkey` (placeholder removed) | Done |
| P13-03 | `plugins.updater.windows.installMode: "passive"` | Done |
| P13-04 | `scripts/bump-version.mjs` writes all 5 version sources, touches no dependency pin | Done |
| P13-05 | `bump-version.mjs` rejects a malformed version, writes nothing | Done |
| P13-06 | `verify-version` CI job fails before any build if tag and the 4 files disagree | Done |
| P13-07 | `tauri-apps/tauri-action@v1` on `windows-latest` + `ubuntu-24.04`, `releaseDraft`/`uploadUpdaterJson`/`updaterJsonPreferNsis` | Done |
| P13-08 | `permissions: contents: write`, per-tag `concurrency` group, no `pull_request` trigger | Done |
| P13-09 | Draft release contains both signed bundles + two-platform `latest.json` | Manual verification in progress (throwaway `v0.1.1` tag pushed 2026-07-23; see `tasks.md` §Manual Verification) |
| P13-10 | `check_for_updates` returns discriminated `UpdateCheckResult`, never maps a failure to success | Done |
| P13-11 | Builder/check errors map to `update.not_configured` / `update.check_failed` with detail | Done |
| P13-12 | `last_update_check` written only on a completed check, never on failure | Done |
| P13-13 | Manual check error → About panel shows the error code with `text-danger` | Done |
| P13-14 | Launch check error/skipped → no banner, dialog, toast, or error anywhere | Done |
| P13-15 | 30s check timeout, surfaces as `update.check_failed` | Done |
| P13-16 | About tab shows `Lyrizzy` + running version via `get_app_version` | Done |
| P13-17 | Update control is a real bordered button, not a muted text link | Done |
| P13-18 | In-flight manual check: disabled + spinner + "Checking…"; settles → re-enabled | Done |
| P13-19 | `upToDate` renders inline; the `fixed top-4 right-4` floating toast removed | Done |
| P13-20 | `updateAvailable` opens `UpdateDialog` with the returned info | Done |
| P13-21 | Every new string added to both `en-US` and `pt-BR`, parity-guarded by a test | Done |
| P13-22 | `apply_update_and_restart` emits `update_progress` on first chunk, throttled ≤250ms, plus a final emit | Done |
| P13-23 | Determinate bar + integer % when `total` known; indeterminate, never `NaN`, when unknown | Done |
| P13-24 | Download-complete → installing state (UI half); full install+restart | UI verified; end-to-end install+restart pending manual verification |
| P13-25 | Concurrent apply → `update.already_in_progress`, no second download started | Done |
| P13-26 | Download/install failure → error shown, both buttons re-enabled, `signature_invalid` stays distinct | Done |
| P13-27 | `docs/release.md` documents the tag-push flow, v2 env var names, both secrets, D-50 fork-PR reasoning | Done |
| P13-28 | `scripts/release.ps1` updated to v2 env names, re-scoped as an explicit local emergency fallback | Done |
| P13-29 | `tracing` records check outcome + install failure code; `update_progress` documented in `CLAUDE.md` | Done |

**Deliverable:** Pushing a `v*` tag builds, signs, and stages a draft two-platform release with no manual signing step; "Check for updates" never claims to be up to date when the check actually failed; the About panel has a real button with inline results; a multi-minute install shows a live progress bar instead of looking frozen. P13-09 and the full P13-24 end-to-end leg close on the manual checklist in `tasks.md`, not by local gate.

**Deliverable:** Operator shows/hides an Aviso over a blacked-out projector without ever toggling blackout (clearing restores black); strophe/set-item highlight moves the instant you click; strophe cards are tight 16:9 rectangles, pixel-faithful to projection.
