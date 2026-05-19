# Trinity Lyrics v2 — State

**Last updated:** 2026-05-19
**Current phase:** Phase 1 closing → Phase 2 V1 tasks drafted (2026-05-19). Spec + design + tasks at `.specs/features/phase2-v1/`. 33 atomic tasks across 10 phases (Phase 0: error refactor, Phases A–J: feature work + verification). Ready to execute.

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

- Per-section background overrides (Phase 3)
- Keyboard shortcut customization (Phase 3)
- Optional VLC fallback for MKV/AVI (Phase 2+)

---

## Lessons Learned

- **L-1:** Tauri 2 requires `use tauri::Emitter` in scope to call `app.emit()`, and `use tauri::Manager` for `app_handle.manage()`. Always import both in command files that emit events.
- **L-2:** `sqlx::migrate!()` macro path is relative to `CARGO_MANIFEST_DIR` (the `src-tauri/` folder), so `"./migrations"` not `"../migrations"`.
- **L-3:** Vitest requires `jsdom` as a separate dev dependency — not bundled with vitest itself.
- **L-4:** When testing canonical path containment, use two independent temp dirs. A file in the *parent* of `media/` could accidentally start_with `media/` if using the same `TempDir`.
- **L-5:** `http` crate must be added explicitly to `Cargo.toml` for the protocol handler; it is not re-exported from `tauri` in a usable way for custom handlers.
- **L-6:** Tauri 2 built-in `asset://` protocol requires `protocol-asset` feature. To use a custom media directory without that feature, register your own `asset` scheme via `register_uri_scheme_protocol`.

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
