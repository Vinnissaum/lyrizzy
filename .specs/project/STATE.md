# Trinity Lyrics v2 — State

**Last updated:** 2026-05-23
**Current phase:** Phase 7 complete (2026-05-23). All 8 P7-01..P7-08 requirements delivered.
**Previous phase:** Phase 6 complete (2026-05-22). All 9 P6 requirements done.

---

## Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| D-1 | Single `index.html` + `presentation.html` both load `src/main.tsx`; branch on `getCurrentWindow().label` | Simpler Vite config; no duplicated React setup | 2026-05-18 |
| D-2 | `Arc<RwLock<i32>>` for Phase 0 counter demo; migrate to `Arc<RwLock<PresentationState>>` in Phase 1 | Proves IPC pattern without premature complexity | 2026-05-18 |
| D-3 | asset:// protocol validates paths by checking canonical path starts with media_dir | Prevents path traversal; keeps handler simple | 2026-05-18 |
| D-4 | DB stored at `%APPDATA%\TrinityLyrics\database.db`; media at `%APPDATA%\TrinityLyrics\media\` | Standard Windows app data location | 2026-05-18 |
| D-5 | `sqlx::migrate!()` macro at Tauri setup — compile-time embed of migrations folder | Automatic, versioned, forward-only; no manual migration runner needed | 2026-05-18 |
| D-6 | Phase 2 video thumbnails: spawn ffmpeg/ffprobe (no bundling); placeholder fallback if not on PATH | Keeps installer < 15 MB; ffmpeg as optional runtime dep degrades gracefully | 2026-05-19 |
| D-7 | Phase 2 countdown ticker: drift-free wall-clock-target algorithm (compute `remaining = target - now()` each tick, not decrement) | Current Phase 1-D impl decrements by 1000 ms — drifts on OS sleep jitter. Wall-clock target meets spec ±100 ms/60 min | 2026-05-19 |
| D-8 | Phase 2 backup format: `.tlz` extension (ZIP internally) with media files bundled | Custom extension enables Windows file-association double-click restore; ZIP stays inspectable | 2026-05-19 |
| D-9 | Phase 2 backend error refactor: **one-shot first task** — migrate every Phase 1 command to `ErrorPayload { code, params }` before any other Phase 2 feature work. Reversed from initial incremental proposal on user confirmation. | Avoids dual error shapes accreting; clean codebase from day 1; estimated ~1 week of focused work | 2026-05-19 |
| D-10 | Phase 2 WebView sandbox: `allow-scripts allow-same-origin` on iframes | Required for most IP camera UIs and livestream embeds; trades surface area for compatibility | 2026-05-19 |
| D-13 | Tauri 2 CSP is **global-only** (verified by spike against `schema.tauri.app/config/2` 2026-05-19). Phase 2 uses a relaxed single global CSP; per-window scoping deferred to a future Tauri release. Runtime URL allowlist + iframe sandbox compensate. | Spike showed `WindowConfig` has no `security` field; original design assumed per-window support that does not exist | 2026-05-19 |
| D-11 | Phase 2 set-item type extension forces compiler-checked exhaustive `match`es everywhere (no `_` arms) | Compile-time guarantee that every dispatch site is reviewed when new variants added | 2026-05-19 |
| D-12 | Phase 2 per-song scrim opacity stored as `songs.scrim_opacity` TINYINT column (not JSON in `slide_config`) | Queryable + indexable; default 35%; per-song override in editor | 2026-05-19 |
| D-14 | Phase 3 ships 6 of 8 originally-roadmapped items; PPTX (bundled-LibreOffice strategy) and Sentry opt-in deferred to Phase 4 | PPTX adds ~150 MB to installer — deserves its own phase + signing review; Sentry's privacy-disclosure flow bundles naturally with the PPTX phase. Keeps Phase 3 focused on operator UX + ops infra. | 2026-05-20 |
| D-15 | ~~Phase 3 introduces a third WebviewWindow labeled `"stage"`~~ **Superseded by D-27** | — | 2026-05-20 |
| D-16 | Phase 3 CCLI play-counting is per-service-idempotent: insert one `song_plays` row per `(song_id, set_id, played_on DATE)` triggered when the set is started; duplicates within the same day are silently skipped | Matches what CCLI actually reports ("usage per service"); avoids double-counting if operator restarts the same set mid-service | 2026-05-20 |
| D-17 | Phase 3 auto-update uses Tauri updater plugin pointing at GitHub Releases `latest.json` manifest; public signing key embedded in app, private key stays out of repo via `.gitignore` | Free distribution channel, native Tauri support, no extra infra to maintain | 2026-05-20 |
| D-18 | Phase 3 dark/light theme scope is **operator window only** (presentation + stage stay content-driven) | Presentation backgrounds are author-controlled (song media); theme would either fight the content or be invisible. Operator chrome is the only ambiguous surface. | 2026-05-20 |
| D-19 | Phase 3 keyboard bindings move to a `key_bindings` JSON row in the existing `settings` key/value table (not a new table) | Reuses Phase 1/2 storage; single source of truth for bindings; trivial to back up/restore via existing settings export | 2026-05-20 |
| D-20 | Phase 4 presentation window auto-detects non-primary monitor and opens fullscreen; no manual monitor picker. `app.primary_monitor()` identifies primary; first non-primary gets fullscreen. Single-monitor fallback: 1280×720 windowed. | User confirmed 100% automatic behavior; WindowsScreen presentation row removed from settings. | 2026-05-20 |
| D-21 | Phase 4 uses a single fixed "Culto Dominical" set — no SetList; `get_or_create_default_set` command auto-creates on first run | Sunday workflow always uses one set; multi-set navigation is pure friction | 2026-05-20 |
| D-22 | Phase 4 overlay system: `PresentationState` gains `overlay: Option<OverlayState>` (Announcement/QuickMedia/QuickWebView variants). Overlay commands: `set_announcement_overlay`, `set_media_overlay`, `set_webview_overlay`, `clear_overlay`. Esc in presentation clears overlay before exiting idle. | Overlays must not modify the set — they're transient interruptions (offering image, camera, announcement) | 2026-05-20 |
| D-23 | Phase 4 design tokens: CSS custom properties in index.css (`--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-muted`, `--color-primary #19A4DD`, `--color-primary-hover #1494C5`). Tailwind v4 theme extends these. | Neutral gray dark mode (not blue-shifted Tailwind grays); consistent secondary color replaces scattered emerald-600/blue-600 | 2026-05-20 |
| D-24 | Phase 4 PPTX/PDF deferred to Phase 5; placeholder button shows "Em breve" tooltip | PDF via WebView2 iframe was considered but deferred to avoid scope creep in this phase | 2026-05-20 |
| D-25 | Phase 5 LibreOffice bundled silently (larger installer); path resolution order: bundled `soffice/program/soffice.exe` → `SOFFICE_PATH` env → PATH | User chose silent bundle ("always works") over PATH-only or optional install | 2026-05-21 |
| D-26 | Phase 5 Sentry crash reporting skipped entirely (not just deferred) | Out of scope per user decision 2026-05-21 | 2026-05-21 |
| D-27 | Phase 6 removes the Stage window (D-15 superseded): 3-window design (operator + presentation + stage) reverted to 2-window. Stage display replaced by `PresentationNavigator` embedded in the operator window. | Stage window added latency + complexity without clear gain for current workflow; in-operator navigator is always-visible and eliminates focus-switching | 2026-05-22 |
| D-28 | `open_presentation_window` replaced by `enter_presentation` / `exit_presentation` command pair. `enter_presentation` is idempotent (focus-only if window exists), guards against empty set, emits `presentation_lifecycle {phase: "entered"}`. `exit_presentation` resets state, clears overlay, emits `presentation_lifecycle {phase: "exited"}`. | Lifecycle events let operator window react to presentation state without polling; idempotency makes retry safe; empty-set guard gives user feedback before the window opens | 2026-05-22 |
| D-29 | Phase 7 single-monitor `Apresentar` uses `.always_on_top(true)` + `.fullscreen(true)`; multi-monitor branch (D-20) stays without `always_on_top` to avoid stealing focus from operator on primary. Phantom monitors (size 0×0) filtered at enumeration. | User confirmed PowerPoint-style single-screen behavior; previous P6-04 single-monitor fullscreen alone was invisible on user's machine (z-order issue) | 2026-05-22 |
| D-30 | Phase 7 replaces the linear `PresentationNavigator` with a Holyrics-style 3-pane `OperatorPresentationLayout`: LEFT = SET items list (~240px), CENTER = STROPHES wrapping grid (flex-1), RIGHT = LIVE preview (~320px). Clicking a non-active set item is REPLACE semantics (`goto_slide(itemIdx, 0)`), not overlay. Overlay system (Oferta/Câmera/Aviso/PDF from P4H) stays for transient layering. | User cited Holyrics as the reference; the long-vertical list grouping all items together was hard to scan. 3-pane mirrors Holyrics/OpenLP/ProPresenter ergonomics. Replace semantics for set-item clicks matches conventional slide software. | 2026-05-22 |
| D-31 | Phase 7 LIVE preview pane renders the projection state in-app (reuses the same renderer components used in the presentation window), NOT a screen capture (no DXGI / desktop duplication). Strategy choice (direct composition vs. CSS `transform: scale()`) deferred to design.md. | Screen-capture in WebView2 adds complexity with no correctness benefit — we already own the `PresentationState` that drives the projection, so re-rendering is always accurate | 2026-05-22 |
| D-32 | Monitor filter: `width > 0 && height > 0` applied at enumeration time; `presentation.no_monitors` error returned if all monitors are filtered out. | Phantom monitors with 0×0 size appeared on user's machine and were selected by the auto-pick logic, resulting in a silent invisible window | 2026-05-23 |
| D-33 | Single-monitor path uses `always_on_top(true)` + `fullscreen(true)` (PowerPoint browse-mode parity). Multi-monitor branch (D-20) keeps `always_on_top` off to avoid stealing focus from operator on primary. | Previous P6-04 single-monitor fullscreen alone was invisible on user's machine (z-order issue); always-on-top resolves it | 2026-05-23 |
| D-34 | LivePreview hybrid strategy: full render for text/image/countdown items; placeholder cards for video/iframe items (avoids double-mounting media in the same WebView). | Double-mounting `<video>` or `<iframe>` elements inside the preview pane caused audio bleed and janky seek; placeholder cards convey enough context without media side-effects | 2026-05-23 |
| D-35 | `OverlayDialogs` stay inline in `OperatorPresentationLayout`; only the toolbar action row is extracted as `<OverlayActionBar />` for reuse between `HomeSetBuilder` and the presentation layout. | Full dialog extraction would have required prop-drilling all overlay commands; toolbar-row extraction alone gives P4H HomeSetBuilder reuse without complexity overhead | 2026-05-23 |

---

## Blockers

| # | Blocker | Status | Notes |
|---|---------|--------|-------|
| B-1 | OQ-1: Holyrics export format unknown | Resolved 2026-05-18 | User supplied sample export. Format: top-level array of song objects; each song has `title`, `artist`, `lyrics.paragraphs[]` where each paragraph is `{number, description, text}`. `description` holds section labels (empty in samples — importer must auto-label or leave blank). `full_text` duplicates joined paragraphs (use paragraphs as source of truth). `order`/`arrangements`/`bpm`/`key`/`streaming` mostly empty stubs (drop for MVP). Holyrics `id` is a JS timestamp — generate our own PKs. |

---

## Open Questions

| # | Question | Status |
|---|----------|--------|
| OQ-1 | Holyrics exact JSON structure? | Resolved 2026-05-18 — see B-1 row |
| OQ-2 | Video thumbnail library: video-rs vs ffmpeg spawn vs placeholder | Deferred to Phase 2 |
| OQ-3 | Multi-window entry: single index.html vs separate HTML | Decided: single (D-1) |
| OQ-4 | Font rendering on projectors with older Windows | Needs hardware test in Phase 1 |

---

## Deferred Ideas

- ~~Per-section background overrides~~ → now P3-06/P3-07 in Phase 3 spec
- ~~Keyboard shortcut customization~~ → now P3-08/P3-09/P3-10 in Phase 3 spec
- Optional VLC fallback for MKV/AVI (Phase 2+ — still deferred)
- ~~PPTX rendering via bundled LibreOffice sidecar~~ → shipped in Phase 5
- Opt-in Sentry crash reporting (deferred from Phase 3 → Phase 5, skipped — out of scope per user decision 2026-05-21)
- Per-slide notes (Phase 4 candidate — per-section deemed sufficient for Phase 3)
- Auto-update beta channel (Phase 4 candidate — stable-only in v2)
- Key-binding scheme presets / "Holyrics-like" / "ProPresenter-like" bundles (Phase 4 candidate, P3 ships individual bindings only)

---

## Lessons Learned

- **L-1:** Tauri 2 requires `use tauri::Emitter` in scope to call `app.emit()`, and `use tauri::Manager` for `app_handle.manage()`. Always import both in command files that emit events.
- **L-2:** `sqlx::migrate!()` macro path is relative to `CARGO_MANIFEST_DIR` (the `src-tauri/` folder), so `"./migrations"` not `"../migrations"`.
- **L-3:** Vitest requires `jsdom` as a separate dev dependency — not bundled with vitest itself.
- **L-4:** When testing canonical path containment, use two independent temp dirs. A file in the *parent* of `media/` could accidentally start_with `media/` if using the same `TempDir`.
- **L-5:** `http` crate must be added explicitly to `Cargo.toml` for the protocol handler; it is not re-exported from `tauri` in a usable way for custom handlers.
- **L-6:** Tauri 2 built-in `asset://` protocol requires `protocol-asset` feature. To use a custom media directory without that feature, register your own `asset` scheme via `register_uri_scheme_protocol`.

## Phase 7 Completion Summary (2026-05-23)

All 8 P7-01..P7-08 requirements delivered:

| Area | Tasks | Delivered |
|---|---|---|
| Monitor fix | P7-01 | `width > 0 && height > 0` filter at enumeration; toast on `enter_presentation` error (D-32) |
| Single-monitor fullscreen | P7-02 | `always_on_top(true)` + `fullscreen(true)` on single-monitor path (D-33); multi-monitor unchanged |
| Dark-theme sweep | P7-03 | Zero hardcoded color hits in operator components; `check-theme-tokens.ps1` deny-list updated |
| 3-pane shell | P7-04 | `OperatorPresentationLayout` — LEFT SET pane (~240 px) + CENTER STROPHES flex-1 + RIGHT LIVE preview (~320 px) |
| Strophes grid | P7-05 | `StrophesGrid` — wrapping thumbnail grid replaces vertical slide list |
| LIVE preview | P7-06 | `LivePreview` hybrid strategy: full render for text/image/countdown; placeholder cards for video/iframe (D-34) |
| SET pane | P7-07 | `SetItemList` — click-to-replace (`goto_slide(itemIdx, 0)`) inter-item navigation |
| OverlayActionBar | P7-08 | `<OverlayActionBar />` extracted; dialogs stay inline (D-35); reused in `HomeSetBuilder` |
| Cleanup | T10 | `PresentationNavigator` component + test deleted; `VideoDims` type alias added to fix clippy type_complexity |

**Test results at completion:** 141 Rust unit tests, 124 Vitest tests — all passing. `tsc --noEmit` clean. `cargo clippy -D warnings` clean. `check-theme-tokens.ps1` exits 0.

---

## Phase 6 Completion Summary (2026-05-22)

All 9 P6-01..P6-09 requirements delivered:

| Area | Tasks | Delivered |
|---|---|---|
| Stage removal | T1 | Stage window subsystem deleted; 3-window → 2-window architecture |
| Button cleanup | T2 | Redundant "Open Presentation Window" toolbar button removed |
| Presentation mode | T3, T4 | `enter_presentation`/`exit_presentation` backend + "Apresentar" button + OperatorApp routing + lifecycle subscription |
| Navigator | T5 | `PresentationNavigator` — scrollable per-slide list, click-to-jump, auto-scroll, current highlight |
| Keyboard | T6 | ESC exits presentation, F10 toggles blackout (hardcoded, both windows), read-only rows in KeyBindingsScreen |
| Token sweep | T7 | `--color-fg` + `--color-fg-on-primary` tokens; NotesField + textbox sweep |
| Surface sweep | T8, T9 | Full operator surfaces → semantic tokens; `check-theme-tokens.ps1` deny-list extended; dark contrast fixed |
| Countdown | T10, T11 | `CountdownTarget` enum (`Duration` \| `FixedTime`); backward-compat serde; `CountdownSetItemEditor` mode toggle + `<input type="time">` |

**Test results at completion:** 175 Rust unit tests, 104 Vitest tests — all passing. `tsc --noEmit` clean. `check-theme-tokens.ps1` exits 0.

---

## Phase 4 Completion Summary (2026-05-21)

All 12 P4H-01..P4H-07e requirements delivered:

| Area | Tasks | Delivered |
|---|---|---|
| Theme tokens | T1–T7 | CSS custom props in `index.css` (`--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-muted`, `--color-primary #19A4DD`); full semantic token sweep across all tabs/components |
| Auto-monitor | T8, T12 | `open_presentation_window` auto-picks first non-primary monitor + fullscreen; manual picker removed from operator UI |
| Single-set home | T9, T13 | `get_or_create_default_set` command; `HomeSetBuilder` replaces Conjuntos as starting view |
| Overlay backend | T10 | `OverlayState` (Announcement/QuickMedia/QuickWebView) in `PresentationState`; 4 commands: `set_announcement_overlay`, `set_media_overlay`, `set_webview_overlay`, `clear_overlay` |
| Remove section label | T11 | Strophe label removed from `PresentationApp` `SongSlide` |
| Overlay renderers | T14–T16 | `AnnouncementRenderer`, `QuickMediaRenderer`, `QuickWebViewRenderer` |
| Overlay wiring | T17 | `PresentationApp` overlay branch (after blank guard, before set content); Esc clears overlay first |
| Home shortcuts | T18–T20 | "Limpar" with confirmation; drag-from-library song sidebar; Oferta/Câmera/Aviso/PDF overlay buttons |

**Test results at completion:** 124 Rust unit tests, 86 Vitest tests — all passing. `tsc --noEmit` clean.

---

## Phase 5 Completion Summary (2026-05-21)

All 8 P5-01..P5-08 requirements delivered:

| Area | Tasks | Delivered |
|---|---|---|
| Data model | T1 | `Presentation` MediaKind, `slide_count` column, migration 006 |
| Domain | T2 | `SlideShow` SetItemType, `Slide::pseudo_slideshow(index)` |
| Backend service | T3 | `libreoffice.rs`: soffice path resolution (bundled → env → PATH), headless PNG conversion, canonical rename to `slide_NNN.png` |
| Backend command | T4 | `import_presentation` command, `check_libreoffice`, `conversion_progress` event |
| Runtime | T5 | `load_set_for_presentation` generates N pseudo-slides for SlideShow items |
| Presentation | T6 | `SlideshowRenderer` (asset URL with padded index), `SlideshowSetItemEditor` (thumbnail + slide count), SetBuilder "+ Apresentação" button, HomeSetBuilder PDF button wired |
| Tests | T7 | 10 new Vitest tests (SlideshowRenderer ×3, LibreOfficeBanner ×4, SlideshowSetItemEditor ×3) |

**Test results at completion:** 124 Rust unit tests, 96 Vitest tests — all passing. `tsc --noEmit` clean.

**Decision:** Sentry crash reporting (originally bundled with Phase 5) skipped entirely per user decision.

---

## Phase 3 Completion Summary (2026-05-20)

All 18 P3-01..P3-18 requirements delivered:

| Phase | Tasks | Delivered |
|---|---|---|
| 3A — Stage window | T4-T7 | `open_stage_window`, `StageApp`, `StageRenderer` (current+next+notes+clock), `WindowsScreen` |
| 3B — Notes | T8-T12 | Per-section notes (SectionCard), per-set-item notes, OperatorNotesPanel, StageNotesPanel |
| 3C — Section BG | T13-T16 | Background resolver service, SectionCard picker, restart-on-boundary semantics, delete check |
| 3D — Shortcuts | T17-T20 | `key_bindings` domain+commands, TS dispatcher, KeyBindingsScreen, window forwarding |
| 3E — CCLI | T21-T24 | Song editor Direitos panel, `play_counter` service, CSV export command, CCLIReportScreen |
| 3F — Theme | T25-T27 | Tailwind dark variant, theme store + bootstrap, ThemeToggle, light-mode regression sweep |
| 3G — Auto-update | T28-T30 | `tauri-plugin-updater`, check/apply commands (24h debounce), UpdateBanner+Dialog |
| 3H — Cross-cutting | T31-T32 | i18n extraction sweep, STATE/ROADMAP update |

**Test results at completion:** 109 Rust unit tests, 74 Vitest tests — all passing. `tsc --noEmit` clean.

**Field period:** 8 weeks from 2026-05-20 → 2026-07-15. No non-critical merges during field period.

---

## Phase 0 Completion Summary

All 5 Phase 0 goals delivered:
1. Two-window IPC demo: `increment_counter` command + `state_changed` event working
2. sqlx + SQLite: pool connected, `sqlx::migrate!()` running `001_initial.sql` at startup
3. asset:// protocol: registered in lib.rs + tauri.conf.json CSP; path traversal protected
4. MP4 via asset://: `<video src="asset://media/test.mp4">` in PresentationApp
5. Tests green: 9 Rust tests + 3 Vitest tests passing

---

## Preferences

- (none recorded yet)
