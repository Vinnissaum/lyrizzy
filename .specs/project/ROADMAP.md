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

---

## Phase 14: Multi-Screen Launch, Live Lyrics Editing & Camera Stream Quality — DONE

**Goal:** Make a two-screen service start in one action with a configurable default and operator-named monitors; let a lyric error be corrected and re-projected without leaving presentation mode; let the camera view pull an operator-defined lighter stream profile so the degraded LAN leg stops starving the feed — without touching the 4K stream OBS/YouTube consumes; and rebrand the app icon.
**Completed:** 2026-08-11.
**Spec:** `.specs/features/phase14-multiscreen-liveedit-camera/spec.md` (32 requirements P14-01..P14-32, 32/32 implemented). Tasks: `.specs/features/phase14-multiscreen-liveedit-camera/tasks.md` (22 tasks, T1-T20 + T22, executed via parallel/sequential sub-agents).

| Group | Requirements | Scope |
|-------|--------------|-------|
| 14A — Multi-screen launch & naming | P14-01..P14-15 | Apresentar launch modal ("mirror all screens?"), three-value launch policy (ask / mirror-all / main-only, default ask), per-monitor names inherited by outputs |
| 14B — Live lyrics editing | P14-16..P14-23 | Edit the projected song in place, regenerate that item's slides, anchor position by section, preserve blank/frozen, never blank the projector |
| 14C — Camera stream profiles | P14-24..P14-30 | Two or more named stream profiles per camera item, operator-switchable mid-presentation, persisted per item |
| 14D — Icon rebranding | P14-31..P14-32 | Single-SVG-sourced L-as-music-note app icon, replacing all platform assets and both favicon surfaces |

**Key finding (14C):** the original request — "set the resolution on camera webview" — was analysed and **rejected as ineffective**. Packet loss and the monotonically growing latency both occur on the camera→PC leg, before Lyrizzy sees the stream (confirmed by the same degradation in the camera's own HTTP viewer). MediaMTX remuxes rather than transcodes, so a resolution control would require FFmpeg, which D-6 deliberately does not bundle. The implementable remedy is pulling the camera's lighter **sub-stream** — independent of the 4K main stream, so live quality is preserved. See the Root-Cause Analysis section of the spec (F-1..F-8).

**Gate at completion:** 546 Vitest tests (73 files, baseline 480 + 66 new), 327 Rust tests (baseline 307 + 20 new), `tsc --noEmit` clean, `cargo clippy -D warnings` clean, locale parity test green.

**Deliverable:** One click starts every screen; each screen is identified by name; a typo is fixed mid-song with no black frame and no lost position; the camera runs on a sub-stream with stable latency while OBS keeps 4K; the app icon reads as song and worship. See STATE.md Phase 14 completion summary for the manual-verification checklist still open (requires two monitors and a real camera).

---

## Phase 15: Free-Text Lyrics Editor, Live-Edit Refresh & Operator UX Fixes — DONE

**Goal:** Close three Phase 14 field defects (the strophes list ignores a live edit, monitor names need an app restart, the Aviso tab mislabels its text-size control), name the screens in the audio/mic configuration, replace the rejected Phase 14 icon with a Trinity-and-music mark, and reduce song registration to a single free-text lyrics box that is also what the operator gets mid-presentation.
**Completed:** 2026-08-11.
**Spec:** `.specs/features/phase15-freetext-lyrics-ux-fixes/spec.md` (22 requirements P15-01..P15-22, 22/22 implemented). Tasks: `.specs/features/phase15-freetext-lyrics-ux-fixes/tasks.md` (18 tasks, T1-T18, executed via parallel/sequential sub-agents).

| Group | Requirements | Scope |
|-------|--------------|-------|
| 15A — Live-edit strophes refresh | P15-01..P15-03 | `refresh_song_in_outputs` emits the regenerated `all_slides_per_item`; stored state stays slim; grid reflects add/remove/reorder across every occurrence |
| 15B — Screen names | P15-04..P15-07 | Monitor names in shared store state, propagating to all five surfaces with no restart; names shown on the audio/mic blocks |
| 15C — Aviso label | P15-08 | Announcement-scoped font-size label in both locales |
| 15D — Icon rebrand | P15-09..P15-10 | Triquetra with noteheads, existing palette, single-SVG-sourced asset set |
| 15E — Free-text lyrics editor | P15-11..P15-21 | One lyrics textarea, blank line = strophe, sections derived on save, exact round-trip, paste dialog + section controls removed, notes repointed to the song, content-keyed slide anchor (DD-1) |
| 15F — Release | P15-22 | Version bumped to 1.2.0 across five sources; tag push → signed draft release |

**Root causes traced before specifying** (spec § Root-Cause Analysis): RC-1 the emitted payload carries an empty `allSlidesPerItem` and the frontend reconciler carries the stale copy forward (`commands/presentation.rs:614-615`, `stores/presentation.ts:27-31`); RC-2 four consumers each cache names in a mount-time effect with no shared state or invalidation; RC-3 the Aviso tab reuses the Projeção translation key; RC-4 audio blocks are titled by index only. **F-1 (unreported):** `db_update_song` regenerates every section UUID on save, so the Phase 14 slide anchor never matches and position is held by index clamping — fixed by P15-19.

**User decisions:** GA-1 sections removed from the UI only, derived on save (D-68); GA-2 operator Notes panel repointed to song-level notes; GA-3 repeat count dropped from the UI, schema retained (D-70); GA-4 triquetra-with-noteheads icon (D-71).

**Design correction (DD-1):** the spec's proposed deterministic section-id anchor (`{song_id}-s{N}`) was rejected at design time — it mis-anchors on insertion, since every later id shifts down one. Shipped instead: a slide-content-keyed anchor (trimmed lines joined by `\n`, disambiguated by ordinal), which holds the right strophe on insert/delete and degrades safely to index clamping only when the current slide's own text changed.

**Gate at completion:** 599 Vitest tests (76 files, baseline 546 + 53 new), 335 Rust tests (baseline 327 + 8 new, 1 ignored), `tsc --noEmit` clean, `cargo clippy -D warnings` clean, locale parity test green.

**Deliverable:** A live-edit save refreshes the strophes grid everywhere the song is loaded, with position held by content even when strophes are inserted or removed above it; a monitor rename propagates to every surface (settings list, pickers, switcher, launch modal, audio blocks) with no restart; the Aviso tab has its own text-size label; song registration is one free-text lyrics box, blank-line-separated, exact round-trip on reopen; the app icon is a triquetra with noteheads. See STATE.md Phase 15 completion summary for the manual-verification checklist still open (requires two monitors, live presentation, and the `v1.2.0` tag push).

---

## Phase 16: Multi-Screen Focus Integrity, Simultaneous Control & Import/Naming Fixes — DONE

**Goal:** Stop another Windows app from drawing over a presenting screen on multi-monitor setups, and close four operator-comprehension gaps (set item named for the wrong colour, Simultânea toggle indistinguishable from a screen tab, single-song Holyrics export rejected, Stop silently killing one of two independent screens).
**Completed:** 2026-08-30. **Released:** `v1.3.0`.
**Spec:** `.specs/features/phase16-multiscreen-focus-import-ux/spec.md` (28 requirements P16-01..P16-28, 28/28 done).

**Root causes (spec § Root-Cause Analysis):** RC-1 `should_pin_on_top` returns `monitor_count == 1`, so no presentation window is topmost with 2+ monitors; RC-2 three strings name the `blank` set item by the wrong colour; RC-3 the screen tabs are hidden the moment mirror engages and the toggle's ON state is byte-identical to an active tab; RC-4 the Holyrics parser hard-fails on a bare object (single-song export); RC-5 Stop runs `exitPresentation(focusedOutput)` with an empty mirror fan-out, ending one screen with no prompt and no way back.

**Gate at completion:** 641 Vitest, 349 Rust (1 ignored), `tsc --noEmit` clean, `cargo clippy -D warnings` clean, theme-token lint clean.

---

## Phase 17: Set Switching, Countdown Identity & Sizing, Restore Integrity, Camera Simplification — TASKS READY

**Goal:** Fix a data-loss-class restore defect, give the countdown a name and size controls, make every service set reachable and switchable from Home, and rename/reduce the camera feature to the modes a camera can actually speak.
**Specified:** 2026-09-04. **Release target:** `v1.4.0`.
**Spec:** `.specs/features/phase17-sets-countdown-camera-restore/spec.md` (37 requirements P17-01..P17-37). **Design:** `design.md` · **Tasks:** `tasks.md` (30 tasks T1–T30, 37/37 requirements mapped). Execution not started.

| Group | Requirements | Scope |
|-------|--------------|-------|
| 17A — Countdown identity | P17-01..P17-05 | Operator-editable `CountdownConfig.name`, localized default, duration suffix and the fabricated `"10min"` literal removed |
| 17B — Countdown sizing | P17-06..P17-10, P17-37 | Per-item message/digit scale percentages over today's clamps (100% = `v1.3.0` exactly), mirrored through `CountdownState` for the takeover path |
| 17C — Restore integrity | P17-11..P17-18 | `song_plays` wiped ahead of `sets`, DB wipe before media deletion, working `abort_restore`, real error messages in both locales |
| 17D — Sets on Home | P17-19..P17-27 | Header set picker (switch / create / rename / delete), persisted selection, `song_plays` removed with a deleted set, unreachable `sets` views retired |
| 17E — Camera | P17-28..P17-35 | "WebView" → "Câmera", modes reduced to RTSP / MJPEG / web page, RTMP+SRT+multicast removed, profiles scoped to the modes that honour them |
| 17F — Release | P17-36 | Version bumped to `1.4.0`, tag push → signed draft release |

**Key finding (17C):** the "replace everything" restore failure is not in the archive format. `wipe_db` never deletes `song_plays`, whose `song_id`/`set_id` foreign keys carry no `ON DELETE` clause while sqlx turns `PRAGMA foreign_keys` ON by default — so `DELETE FROM sets` raises `FOREIGN KEY constraint failed` on any install that has ever presented a set. It fails *after* the media directory has already been emptied, and `abort_restore` (the recovery path offered at next launch) calls the same broken wipe. Merge mode works only because it never wipes. Reproduced against the real schema shape.

**Key finding (17E):** the RTMP mode maps to `Source::Pull` — MediaMTX dialling an RTMP *server* — while cameras push RTMP and the generated config disables every MediaMTX server except WebRTC, so the mode cannot work with a camera as built. Stream profiles were offered on all six modes but honoured only in `rtmp`/`rtsp`.

**Design finding (DD-1):** the launch-time silent re-arm (`OperatorApp.tsx:267`) drops `position` and `backgroundMediaId`, because `UpcomingScheduledCountdown` never carried them — the same countdown takes over centred when armed at launch and correctly placed when armed from the modal. Added as P17-37 while every arm/start call site is being touched for the scales.

**User decisions:** D-75 editable countdown name; D-76 per-item sizing as percentages of today's values; D-77 Home picker only, unreachable Sets screen retired; D-78 RTSP/MJPEG/web-page only, profiles scoped.
