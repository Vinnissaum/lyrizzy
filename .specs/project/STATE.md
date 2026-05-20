# Trinity Lyrics v2 — State

**Last updated:** 2026-05-20
**Current phase:** Phase 3 V2 implementation complete (2026-05-20). All 18 requirements P3-01..P3-18 delivered across phases 3A-3H. Entering 8-week field period starting 2026-05-20. Phase 4 (PPTX + Sentry) deferred.

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
| D-15 | Phase 3 introduces a third WebviewWindow labeled `"stage"` (ProPresenter-style layout: current slide + next slide + notes + clock) | On-stage talent has had no monitor preview through Phase 1/2 — the single biggest operator-vs-talent pain point. Window is opt-in and non-fatal if absent. | 2026-05-20 |
| D-16 | Phase 3 CCLI play-counting is per-service-idempotent: insert one `song_plays` row per `(song_id, set_id, played_on DATE)` triggered when the set is started; duplicates within the same day are silently skipped | Matches what CCLI actually reports ("usage per service"); avoids double-counting if operator restarts the same set mid-service | 2026-05-20 |
| D-17 | Phase 3 auto-update uses Tauri updater plugin pointing at GitHub Releases `latest.json` manifest; public signing key embedded in app, private key stays out of repo via `.gitignore` | Free distribution channel, native Tauri support, no extra infra to maintain | 2026-05-20 |
| D-18 | Phase 3 dark/light theme scope is **operator window only** (presentation + stage stay content-driven) | Presentation backgrounds are author-controlled (song media); theme would either fight the content or be invisible. Operator chrome is the only ambiguous surface. | 2026-05-20 |
| D-19 | Phase 3 keyboard bindings move to a `key_bindings` JSON row in the existing `settings` key/value table (not a new table) | Reuses Phase 1/2 storage; single source of truth for bindings; trivial to back up/restore via existing settings export | 2026-05-20 |

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
- PPTX rendering via bundled LibreOffice sidecar (deferred from Phase 3 → Phase 4, see D-14)
- Opt-in Sentry crash reporting (deferred from Phase 3 → Phase 4, see D-14)
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
