# Phase 2: V1 Tasks — Media + Countdown + WebView + Backup + English

**Spec:** `.specs/features/phase2-v1/spec.md` (20 requirements P2-01..P2-20)
**Design:** `.specs/features/phase2-v1/design.md`
**Status:** Drafted 2026-05-19 — awaiting execution
**Last updated:** 2026-05-19

---

## Decisions adopted during task planning

These were resolved during spec + design (and the 2026-05-19 CSP spike). Cross-referenced to `STATE.md` entries D-6 through D-13.

| # | Decision | Adopted | Source |
|---|---|---|---|
| TD-1 | Video thumbnail strategy (P2-03) | Spawn `ffmpeg` / `ffprobe`; placeholder fallback if missing. No bundling. | STATE D-6 |
| TD-2 | Backend error refactor (P2-19) | **One-shot** — every Phase 1 command migrates to `ErrorPayload` before any Phase 2 feature work (Tasks T1–T4). | STATE D-9 |
| TD-3 | Tauri 2 per-window CSP (spike 2026-05-19) | **Not supported.** Use a relaxed global CSP + runtime URL allowlist + iframe sandbox. | STATE D-13 |
| TD-4 | Backup extension | `.tlz` (custom suffix, ZIP internally). | STATE D-8 |
| TD-5 | Default restore mode (P2-18) | Replace, with typed-confirmation ("Digite SUBSTITUIR"). Merge available. | spec OQ-P2-04 + design |
| TD-6 | Video bg scrim opacity (P2-08) | Per-song `songs.scrim_opacity` TINYINT column, default 35. | STATE D-12 |
| TD-7 | WebView iframe sandbox (P2-13) | `allow-scripts allow-same-origin`. | STATE D-10 |
| TD-8 | Video set item `loop` flag (P2-07) | Per-item, default false. | design |
| TD-9 | `auto_advance_on_end` (P2-07) | Default true (matches Holyrics). | design |
| TD-10 | Countdown algorithm (P2-10) | Drift-free wall-clock target (`remaining = target - now()` each tick). | STATE D-7 |
| TD-11 | `zip` crate version | `zip = "2"` (caret 2.x). | user 2026-05-19 |
| TD-12 | ffmpeg dependency docs | README install hint + UI placeholder note ("Instale ffmpeg para previews"). | user 2026-05-19 |
| TD-13 | `SetItemType` enum extension policy | All `match` sites must be exhaustive (no `_` arms) — compiler enforces every dispatch site is reviewed when variants change. | STATE D-11 |

---

## Execution Plan

### Phase 0 — Error refactor (T1 sequential entry, T2-T4 parallel)

```
T1 → (T2 ∥ T3 ∥ T4)
```

### Phase A — Phase 2 data model (parallel)

```
T1 → (T5 [P] ∥ T6 [P] ∥ T7 [P]) → T8 → T9
```

### Phase B — Media backend

```
T8 + T5 → (T10 [P] ∥ T11 [P]) → T12
```

### Phase C — Media library UI

```
T12 → T13 → T14
```

### Phase D — Media in presentation

```
T6 + T12 → T15 → (T16 [P] ∥ T17 [P]) → T18
```

### Phase E — Countdown

```
T7 → T19 → T20
```

### Phase F — WebView

```
T6 + T8 → T21 → (T22 [P] ∥ T23 [P])
T24 (independent — can start any time after T1)
```

### Phase G — Unified set editor

```
T15 + T20 + T21 → T25
```

### Phase H — Backup / restore

```
T8 → T26 → T27 → T28
```

### Phase I — i18n

```
T29 (independent) → T30 (after most UI tasks land) → T31
```

### Phase J — Cross-cutting / final

```
T12 → T32 (any time)
all tasks → T33 (final smoke test)
```

---

## Task Breakdown

---

### T1: ErrorPayload domain type + frontend normalizeError

**What:** Add `domain::error::ErrorPayload { code: String, params: HashMap<String, String> }` (Rust) and a `normalizeError` helper in `src/api/commands.ts` that accepts both legacy `string` and new `ErrorPayload` shapes during the migration window.
**Where:**
- `src-tauri/src/domain/error.rs` (create) — `ErrorPayload` struct + `From<String>` for the migration period (`From<String>` wraps as `{ code: "legacy", params: { "message": s } }`).
- `src-tauri/src/domain/mod.rs` (modify — `pub mod error;`)
- `src/types/index.ts` (modify — add `ErrorPayload` interface)
- `src/api/commands.ts` (modify — add `normalizeError(err: unknown): ErrorPayload` helper)
**Depends on:** None
**Requirement:** P2-19 (foundation)

**Done when:**
- [ ] `ErrorPayload` derives `Serialize, Deserialize, Clone, Debug` + `#[serde(rename_all = "camelCase")]`.
- [ ] `From<String> for ErrorPayload` exists with the `legacy` wrap so existing helpers can convert in one place.
- [ ] TS `ErrorPayload` matches: `{ code: string; params: Record<string, string> }`.
- [ ] `normalizeError` returns an `ErrorPayload` for any thrown invoke value.
- [ ] Rust unit test: `String::from("erro") → ErrorPayload` round-trips serde.
- [ ] `cargo test` green; `tsc --noEmit` clean.

**Tests:** unit (Rust serde round-trip)
**Gate:** quick
**Commit:** `feat(error): add ErrorPayload type and frontend normalizeError helper`

---

### T2: Migrate song + import commands to ErrorPayload [P]

**What:** Replace every `Result<T, String>` in `commands/song.rs` and `commands/import.rs` with `Result<T, ErrorPayload>`. Map existing pt-BR error strings to stable codes (`song.not_found`, `song.validation.title_required`, `import.invalid_json`, etc.) carrying their template params.
**Where:**
- `src-tauri/src/commands/song.rs` (modify — 8 commands)
- `src-tauri/src/commands/import.rs` (modify — 3 commands)
- `src-tauri/src/domain/error.rs` (modify — add `code` constants module or just string literals; pick consistent approach across T2/T3/T4)
- `src/api/commands.ts` (modify — typed error returns; callers catch as `ErrorPayload`)
- `src/i18n/locales/pt-BR.json` (create or extend in T29 — for now stash the codes as `errors.song.notFound`, etc., in a temporary `src/i18n/error-codes.ts` map to be moved into pt-BR.json by T30)
**Depends on:** T1
**Requirement:** P2-19

**Done when:**
- [ ] No `Result<T, String>` remains in the two files.
- [ ] Every error path has a stable code (snake-case nested by domain: `song.not_found`, `import.invalid_json`).
- [ ] Existing integration tests adapt; new test asserts at least one error returns an `ErrorPayload` with the right `code`.
- [ ] Frontend `try { … } catch (e) { const err = normalizeError(e); … }` pattern used at every call site touched.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` green.

**Tests:** integration (Rust — adapt existing tests to assert codes)
**Gate:** quick (cargo)
**Commit:** `refactor(errors): migrate song + import commands to ErrorPayload`

---

### T3: Migrate set + presentation commands to ErrorPayload [P]

**What:** Same as T2 for `commands/set.rs` (7 commands) and `commands/presentation.rs` (6 commands). Codes: `set.not_found`, `set.validation.*`, `presentation.no_set_loaded`, `presentation.index_out_of_bounds`, etc.
**Where:**
- `src-tauri/src/commands/set.rs` (modify)
- `src-tauri/src/commands/presentation.rs` (modify)
- `src/api/commands.ts` (modify — typed throws)
- `src/i18n/error-codes.ts` (modify — append codes)
**Depends on:** T1
**Requirement:** P2-19

**Done when:**
- [ ] Both files free of `Result<T, String>`.
- [ ] Existing tests adapt; integration test asserts e.g. `go_to_item(99)` returns `{ code: "presentation.index_out_of_bounds", params: { index: "99" } }`.
- [ ] `cargo test` green.

**Tests:** integration
**Gate:** quick
**Commit:** `refactor(errors): migrate set + presentation commands to ErrorPayload`

---

### T4: Migrate countdown + media + window + counter commands to ErrorPayload [P]

**What:** Same as T2 for `commands/countdown.rs`, `commands/media.rs`, `commands/window.rs`, `commands/counter.rs`. The counter command can be deleted entirely if Phase 1-D already removed it; otherwise migrate then delete in T19. Window commands surface monitor-not-found scenarios as `window.monitor_not_found`.
**Where:**
- `src-tauri/src/commands/countdown.rs` (modify — 5 commands; ticker internals untouched in this task)
- `src-tauri/src/commands/media.rs` (modify — 2 commands; will be rewritten in T12 but we still migrate signatures now)
- `src-tauri/src/commands/window.rs` (modify — 2 commands)
- `src-tauri/src/commands/counter.rs` (modify or delete; pick deletion if it's confirmed unused)
- `src/api/commands.ts` (modify)
- `src/i18n/error-codes.ts` (modify)
**Depends on:** T1
**Requirement:** P2-19

**Done when:**
- [ ] All four files free of `Result<T, String>`.
- [ ] If `counter.rs` is deleted, `lib.rs` `invoke_handler![]` no longer registers `increment_counter`; `src/utils/counter.ts` and its test removed.
- [ ] `cargo test` green; `npx vitest run` green (counter.test.ts removal handled).

**Tests:** integration + component (remove obsolete tests if counter deleted)
**Gate:** full
**Commit:** `refactor(errors): migrate countdown/media/window commands to ErrorPayload`

---

### T5: domain::media types [P]

**What:** Pure Rust types for media. `Media`, `MediaKind`, `MediaItemOptions`.
**Where:**
- `src-tauri/src/domain/media.rs` (create)
- `src-tauri/src/domain/mod.rs` (modify — `pub mod media;`)
- `src/types/index.ts` (modify — TS mirrors)
**Depends on:** T1
**Requirement:** P2-01

**Done when:**
- [ ] `MediaKind` is `Image | Video` (`#[serde(rename_all = "snake_case")]`).
- [ ] `Media` carries `id, file_name, display_name, kind, mime_type, width, height, duration_ms, thumbnail_file, byte_size, created_at, updated_at, deleted_at` with camelCase serde.
- [ ] `MediaItemOptions { loop_: bool, mute: bool, auto_advance_on_end: bool }` — note: Rust field name `loop_` because `loop` is reserved; serde renames to `loop`.
- [ ] Serde round-trip test asserts camelCase + correct `loop`/`autoAdvanceOnEnd` field names on the wire.
- [ ] `cargo test` green; `tsc --noEmit` clean.

**Tests:** unit (serde)
**Gate:** quick
**Commit:** `feat(domain): add Media, MediaKind, MediaItemOptions types`

---

### T6: domain::set extension to 5 variants [P]

**What:** Extend `SetItemType` to `Song | Media | Countdown | WebView | Blank`. Add variant-payload fields to `SetItem`: `media_id`, `media_kind`, `media_options`, `countdown_config`, `webview_config`. Add `WebViewMode` enum and `WebViewConfig` struct in the same file.
**Where:**
- `src-tauri/src/domain/set.rs` (modify)
- `src-tauri/src/domain/countdown.rs` (modify — add `CountdownConfig` struct used by SetItem)
- `src/types/index.ts` (modify)
- Every Rust file with `match item.item_type` will fail to compile after this — list expected breakage in the task PR; T15 / T17 / T22 fix them.
**Depends on:** T1
**Requirement:** P2-15, P2-13

**Done when:**
- [ ] `SetItemType` has all 5 variants with snake_case serde (`webView` → `web_view`? — verify against existing schema's `set_items.item_type` CHECK constraint values; design specified `webView` on wire which means Rust enum variant `WebView` + `#[serde(rename_all = "camelCase")]` would produce `webView`. SQL stores `webview` lowercase. The serde rename for this enum stays `snake_case` for SQL-friendliness; TS string union is `'web_view'`. Document the mismatch with schema if any — migration 003 can normalize).
- [ ] `SetItem` carries `Option<>` payload fields for each variant; existing `song_id` stays.
- [ ] `WebViewMode { Iframe, Mjpeg }` + `WebViewConfig { mode, url, basic_auth_user, basic_auth_pass }`.
- [ ] `CountdownConfig { duration_ms, message, end_behavior }`.
- [ ] Serde round-trip tests for each new shape (one combined test is fine).
- [ ] Compiler errors at downstream `match` sites listed in PR — expected fallout, not a regression.
- [ ] `cargo build` succeeds for `domain` crate (downstream callers may still fail until T15 etc.).

**Tests:** unit (serde)
**Gate:** quick (cargo build of domain only — full cargo test will fail until T15)
**Commit:** `feat(domain): extend SetItemType to 5 variants with payload fields`

---

### T7: domain::countdown rewrite [P]

**What:** Replace `CountdownState` with the Phase 2 shape. Add `CountdownMode` and `CountdownEndBehavior` enums. Remove the old `is_running` field (replaced by `mode == Running`).
**Where:**
- `src-tauri/src/domain/countdown.rs` (modify — large rewrite)
- `src/types/index.ts` (modify — `CountdownState` shape + new enums)
- `src-tauri/src/state.rs` (modify — `CountdownState::default()` may need `mode: Idle` etc.)
- `src/stores/countdown.ts` (modify — adapt to new shape; consumers in `CountdownPanel.tsx` will break and are fixed in T20)
**Depends on:** T1
**Requirement:** P2-10

**Done when:**
- [ ] `CountdownMode { Idle, Running, Paused, Finished }` + `CountdownEndBehavior { HoldZero, Blackout, AdvanceSet }`.
- [ ] `CountdownState { mode, duration_ms, remaining_ms, target_epoch_ms: Option<u64>, message: Option<String>, end_behavior }`.
- [ ] `Default` impl: mode=Idle, target=None, message=None, end_behavior=HoldZero.
- [ ] Serde round-trip test asserts camelCase wire shape.
- [ ] `commands/countdown.rs` ticker still compiles (it's rewritten in T19; for this task it just needs to keep compiling — wrap the old logic in `#[allow(unused)]` or stub).
- [ ] `cargo test` green; `tsc --noEmit` clean.

**Tests:** unit (serde)
**Gate:** quick
**Commit:** `feat(domain): rewrite CountdownState with mode + drift-free fields`

---

### T8: Migration 003 — media + scrim + set_items columns

**What:** SQL migration adding the Phase 2 columns to existing tables. Idempotent (uses `ALTER TABLE ... ADD COLUMN`; no destructive drops).
**Where:**
- `src-tauri/migrations/003_media_phase2.sql` (create)
- `src-tauri/tests/migrations.rs` (create if not exists — or extend) — integration test that runs 001→002→003 in sequence against a temp DB and asserts the new columns exist with expected defaults.
**Depends on:** T5 (column shapes match domain), T6 (set_items.webview_config + media_options columns), T7 (no schema impact but enforces ordering of foundation tasks)
**Requirement:** P2-01, P2-08, P2-13, P2-15

**Done when:**
- [ ] Migration runs the SQL block from `design.md` (rename `media.media_type` → `kind`; add `display_name`, `byte_size`, `updated_at`, `deleted_at`; add indexes on `(kind, deleted_at)` and `(file_name)`; backfill `display_name = file_name`).
- [ ] Adds `songs.scrim_opacity INTEGER NOT NULL DEFAULT 35` (TD-6).
- [ ] Adds `set_items.webview_config TEXT` and `set_items.media_options TEXT`.
- [ ] Existing `media.url` column left alone (design accepts the dead column).
- [ ] Test confirms the migration is idempotent: running twice doesn't error (sqlx tracks this automatically but the test asserts schema state after one fresh run).
- [ ] Test confirms a song row's `scrim_opacity` defaults to 35 after migration.
- [ ] `cargo test` green.

**Tests:** integration (Rust, temp DB)
**Gate:** quick
**Commit:** `feat(db): migration 003 — Phase 2 media + scrim + set_items columns`

---

### T9: Migration 004 — settings defaults for locale + transitions

**What:** Seed initial settings rows for locale, transition_ms, reduce_motion. `INSERT OR IGNORE` so existing values are preserved if a user later overwrites them.
**Where:**
- `src-tauri/migrations/004_settings_locale.sql` (create)
- `src-tauri/tests/migrations.rs` (modify — assert new settings rows exist after migration)
**Depends on:** T8 (just for sequence)
**Requirement:** P2-09, P2-19, P2-20

**Done when:**
- [ ] Migration inserts `('app.locale', 'pt-BR')`, `('presentation.transition_ms', '200')`, `('presentation.reduce_motion', 'false')` with `INSERT OR IGNORE`.
- [ ] Test asserts all three rows exist after migration; running migration twice does not duplicate them.
- [ ] `cargo test` green.

**Tests:** integration
**Gate:** quick
**Commit:** `feat(db): migration 004 — seed locale + transition settings`

---

### T10: services::media_probe [P]

**What:** Pure-ish service to extract metadata from a media file before insert. Images via `image` crate header read (cheap). Videos via `ffprobe` spawn with graceful fallback.
**Where:**
- `src-tauri/src/services/media_probe.rs` (create)
- `src-tauri/src/services/mod.rs` (modify — `pub mod media_probe;`)
- `src-tauri/Cargo.toml` (modify — add `image = { version = "0.25", default-features = false, features = ["png","jpeg","webp","gif"] }`)
**Depends on:** T5
**Requirement:** P2-01, P2-02

**Done when:**
- [ ] `pub fn probe(path: &Path, kind: MediaKind) -> Result<MediaMetadata, ProbeError>`.
- [ ] `MediaMetadata { width, height, duration_ms, mime_type, byte_size }`.
- [ ] Image probe reads only headers (no full decode) — verified by test that probes a 4K image and returns dimensions in < 10 ms.
- [ ] Video probe spawns `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration:format=duration -of default=noprint_wrappers=1 -i <path>`.
- [ ] Missing ffprobe → `ProbeError::ToolMissing`; caller (T12) catches and falls back to defaults (1920×1080, duration=None).
- [ ] Unit tests cover: PNG image, JPEG image, MP4 with both ffprobe-present and ffprobe-missing (mocked via env-var indirection).
- [ ] `cargo test` green.

**Tests:** unit (Rust)
**Gate:** quick
**Commit:** `feat(services): add media_probe for image headers + ffprobe spawn`

---

### T11: services::thumbnail [P]

**What:** Spawn `ffmpeg` to extract a 200×113 JPEG thumbnail at the 1-second mark of a video. Graceful fallback when ffmpeg is missing.
**Where:**
- `src-tauri/src/services/thumbnail.rs` (create)
- `src-tauri/src/services/mod.rs` (modify — `pub mod thumbnail;`)
**Depends on:** T5
**Requirement:** P2-03

**Done when:**
- [ ] `pub async fn generate(input: &Path, output: &Path) -> Result<(), ThumbnailError>`.
- [ ] Command: `ffmpeg -y -ss 00:00:01 -i {input} -frames:v 1 -vf scale=200:-2 -q:v 4 {output}` via `tokio::process::Command`.
- [ ] Missing ffmpeg → `ThumbnailError::ToolMissing`.
- [ ] Other ffmpeg errors → `ThumbnailError::Failed { stderr_excerpt }`.
- [ ] Unit test (gated `#[ignore]` since CI may not have ffmpeg): generates a thumbnail for a tiny fixture video and asserts the output file exists and is a JPEG (magic bytes `FF D8`).
- [ ] Always-on unit test asserts the `ToolMissing` path via PATH manipulation.
- [ ] `cargo test` green (including the `ToolMissing` branch).

**Tests:** unit (Rust)
**Gate:** quick
**Commit:** `feat(services): add ffmpeg-spawn thumbnail generator with fallback`

---

### T12: commands::media rewrite — full CRUD + references

**What:** Replace the minimal Phase 1 `import_media_file` with a full media CRUD surface: `importMedia`, `listMedia`, `renameMedia`, `deleteMedia`, `getMediaReferences`. Imports now write a `media` row (current code only copies the file). Deletes block when references exist.
**Where:**
- `src-tauri/src/commands/media.rs` (rewrite — old commands replaced with new shape; `set_background` is removed in favor of per-song background_id resolution in T17)
- `src-tauri/src/db/media.rs` (create) — `db_insert_media`, `db_list_media`, `db_rename_media`, `db_soft_delete_media`, `db_count_references`
- `src-tauri/src/db/mod.rs` (modify — `pub mod media;`)
- `src-tauri/src/lib.rs` (modify — register `import_media`, `list_media`, `rename_media`, `delete_media`, `get_media_references`; remove old `import_media_file` + `set_background`)
- `src/api/commands.ts` (modify — replace `importMediaFile` + `setBackground` with new wrappers; emit `media_library_changed` event listener exported)
- `src-tauri/Cargo.toml` (modify if needed — `uuid` already present from Phase 1)
**Depends on:** T8, T10, T11, T4 (error refactor done so new commands use `ErrorPayload`)
**Requirement:** P2-02

**Done when:**
- [ ] `importMedia` validates extension (`png|jpg|jpeg|webp|gif|mp4|webm`), rejects others with `media.unsupported_container` carrying `{ ext }`.
- [ ] Copy → probe → thumbnail (if video) → INSERT into `media` table — all in a transaction (the file copy happens before the transaction; rollback on insert failure deletes the orphan file).
- [ ] File-name collision: append `(2)`, `(3)`, etc. — on-disk filename is `{uuid}.{ext}`, but `display_name` is collision-suffixed.
- [ ] `listMedia({ kind?, search?, limit?, offset? })` returns non-deleted rows; `kind` filter narrows to `image|video`; `search` does prefix-LIKE on `display_name`.
- [ ] `renameMedia(id, displayName)` updates only the display name; `updated_at` refreshed.
- [ ] `deleteMedia(id)` checks references: any non-deleted song with `background_id = id`, any `set_items` with `media_id = id`. If references exist, return `media.in_use` with `{ songCount, setItemCount }` params. Otherwise soft-delete.
- [ ] `getMediaReferences(id)` returns `{ songs: [{id, title}], setItems: [{setId, setName, itemId}] }` for the UI confirm dialog.
- [ ] `media_library_changed` event emitted after every mutation; write guard dropped before emit (CLAUDE.md invariant doesn't apply since AppState.media doesn't exist — the event payload is `()`).
- [ ] Integration tests for each command (4 commands × 1 happy + 1 error path each = ~8 tests).
- [ ] `cargo test` + `npx vitest run` green.

**Tests:** integration (Rust, temp DB)
**Gate:** full
**Commit:** `feat(media): full CRUD commands with metadata probe and references check`

---

### T13: stores/media.ts — Zustand store

**What:** Frontend store mirroring the backend media list. Subscribes to `media_library_changed` to refresh.
**Where:**
- `src/stores/media.ts` (create) — `{ media, isLoading, filter, search, refresh, setFilter, setSearch }`
- `src/api/commands.ts` (modify — export `onMediaLibraryChanged(cb)` listener wrapper)
**Depends on:** T12
**Requirement:** P2-04

**Done when:**
- [ ] Store loads `listMedia({})` on subscribe; debounces `setSearch` 150ms.
- [ ] `media_library_changed` listener triggers `refresh()`.
- [ ] Unit test: mock `listMedia`, assert state populated; mock event emit, assert refresh called.
- [ ] `npx vitest run` green; `tsc --noEmit` clean.

**Tests:** unit (Vitest with Tauri API mocks)
**Gate:** quick
**Commit:** `feat(media): add media Zustand store with library_changed listener`

---

### T14: MediaLibrary screen + upload dropzone + detail panel

**What:** Operator screen for media management. Grid view with thumbnail/icon, filter chips (All/Imagens/Vídeos), search, upload, click-to-detail, delete with reference dialog.
**Where:**
- `src/components/media/MediaLibrary.tsx` (create)
- `src/components/media/MediaCard.tsx` (create) — single grid cell
- `src/components/media/MediaUploadDropzone.tsx` (create) — drag-drop + click-to-pick wrapper
- `src/components/media/MediaDetailPanel.tsx` (create) — slide-in panel or modal
- `src/components/common/ConfirmDialog.tsx` (reuse from Phase 1) — used for delete reference confirmation
- `src/windows/operator/OperatorApp.tsx` (modify — add "Mídia" route entry)
**Depends on:** T13
**Requirement:** P2-04, P2-05

**Done when:**
- [ ] Grid renders thumbnail (or video icon fallback) + display name + kind icon + byte_size formatted ("1.2 MB").
- [ ] Filter chips toggle the `kind` param; search box debounced.
- [ ] Empty-state CTA "Adicionar mídia" calls dropzone click handler.
- [ ] Dropzone accepts drag-drop AND click-to-pick via `@tauri-apps/plugin-dialog` (multi-select).
- [ ] Per-file progress + final summary toast (`"3 importadas, 1 ignorada"`).
- [ ] >1 GB file shows confirm dialog before import.
- [ ] Detail panel shows preview, dimensions, duration, file size; "Renomear" inline edit; "Excluir" runs `getMediaReferences` first to decide flow (block with code/params shown, or soft-delete on confirm).
- [ ] Component tests: empty state, populated grid, filter toggle, delete flow with references, delete flow without.
- [ ] `npx vitest run` green.

**Tests:** component (multiple files in one task — UI feature unit)
**Gate:** full (cargo + vitest)
**Commit:** `feat(media): media library screen with upload, filter, detail, delete`

---

### T15: Runtime handles all 5 set item types (pseudo-slide pattern)

**What:** Rewrite the `match item.item_type` in `commands/presentation.rs::load_set_for_presentation` so all 5 variants are handled exhaustively (TD-13). Non-song items emit exactly one pseudo-slide so the existing `current_slide_index` machinery works without special cases.
**Where:**
- `src-tauri/src/commands/presentation.rs` (modify — `load_set_for_presentation`, `resolve_current_slide`)
- `src-tauri/src/domain/slide.rs` (modify if needed — add a `Slide::pseudo(label: &str)` helper)
- Any other Rust file the compiler flags as having a non-exhaustive `match` on `SetItemType` (T6's expected breakage).
**Depends on:** T6, T12, T8
**Requirement:** P2-15

**Done when:**
- [ ] `load_set_for_presentation` handles `Song | Media | Countdown | WebView | Blank` exhaustively (no `_` arm).
- [ ] `Media` → fetches `Media` row, sets `media_kind` on a pseudo-slide, count = 1.
- [ ] `Countdown` → reads `countdown_config` from the set item, count = 1.
- [ ] `WebView` → reads `webview_config`, count = 1.
- [ ] `Blank` → count = 1 (existing behavior preserved).
- [ ] All other `match` sites on `SetItemType` (from T6's expected breakage list) are made exhaustive.
- [ ] Integration test builds a set with one of each type, calls `load_set_for_presentation`, asserts `item_slide_counts == [N, 1, 1, 1, 1]` (where N is the song's slide count).
- [ ] `cargo test` green.

**Tests:** integration
**Gate:** quick
**Commit:** `feat(presentation): exhaustive 5-variant set item handling with pseudo-slides`

---

### T16: MediaSlideRenderer (image + video) [P]

**What:** Presentation-window component that renders an image or video fullscreen with `object-fit: contain` over black. For videos, respects `MediaItemOptions { loop, mute, auto_advance_on_end }`. On video `ended` event (when loop=false && autoAdvanceOnEnd=true), dispatches `nextSlide()`.
**Where:**
- `src/components/presentation/MediaSlideRenderer.tsx` (create)
- `src/windows/presentation/PresentationApp.tsx` (modify — dispatch by `currentSetItem.itemType`)
**Depends on:** T15
**Requirement:** P2-06, P2-07

**Done when:**
- [ ] Image branch: `<img src="asset://media/{file_name}" />` with `object-fit: contain`, black bg.
- [ ] Video branch: `<video src="asset://media/{file_name}" autoplay playsinline {loop} {muted} />` with no controls visible.
- [ ] `onEnded` (only fired when loop=false): if `autoAdvanceOnEnd === true`, calls `nextSlide()`.
- [ ] Blank toggle while video playing pauses + unblanks resumes from paused position.
- [ ] Component tests: image renders, video renders, autoAdvance fires on ended, blank/unblank preserves play position (use a mocked video element).
- [ ] `npx vitest run` green.

**Tests:** component
**Gate:** quick
**Commit:** `feat(presentation): MediaSlideRenderer for image + video set items`

---

### T17: Per-song video/image background with scrim opacity [P]

**What:** Replace the global `PresentationState.background_path` mechanism with per-song background resolution. When advancing into a song item, the runtime resolves the song's `background_id` to a `Media` row and includes it in the broadcast state. The renderer composites a `<video loop muted>` or `<img>` layer + a black scrim layer + the slide text.
**Where:**
- `src-tauri/src/commands/presentation.rs` (modify — `load_set_for_presentation` and item-advance paths emit `background` info per song)
- `src-tauri/src/domain/presentation.rs` (modify — replace `background_path: Option<String>` with `background: Option<BackgroundInfo>` where `BackgroundInfo { media_kind: MediaKind, asset_url: String, scrim_opacity: u8 }`)
- `src/components/presentation/SongBackground.tsx` (create) — two stacked CSS layers
- `src/components/presentation/SlideRenderer.tsx` (modify — embed `SongBackground` underneath the lyric text)
- `src/components/library/BackgroundPicker.tsx` (modify — allow picking video media; add scrim opacity slider 0–100)
- `src/components/library/SongEditor.tsx` (modify — pass `scrim_opacity` to update payload)
- `src/api/commands.ts` (modify — `UpdateSongPayload` adds `scrimOpacity?: number`)
**Depends on:** T15, T8
**Requirement:** P2-08

**Done when:**
- [ ] Song with image bg: `<img>` + scrim layer + text composited correctly.
- [ ] Song with video bg: `<video loop muted autoplay playsinline>` continues playing across slide changes within the same song (does NOT restart).
- [ ] When advancing from one song to another with a different bg, the `<video>` element resets cleanly (test for memory leaks — set unmount listener).
- [ ] Background failure (404 from asset) → falls back to global default (settings) without error overlay.
- [ ] Scrim slider in editor lets operator set 0–100; default 35; persisted via `songs.scrim_opacity`.
- [ ] Component tests for `SongBackground`: renders image, renders video, scrim layer applied with correct opacity.
- [ ] Integration test: song with `background_id` set, `load_set_for_presentation` returns `BackgroundInfo` carrying the resolved asset URL.

**Tests:** component + integration
**Gate:** full
**Commit:** `feat(presentation): per-song video/image backgrounds with scrim opacity`

---

### T18: TransitionStage — 200ms crossfade with queueing

**What:** Two-layer stage that crossfades on state change. CSS `transition: opacity 200ms`. A small one-slot queue ensures rapid keypresses don't strobe. Reduce-motion setting disables transitions (instant cut).
**Where:**
- `src/components/presentation/TransitionStage.tsx` (create)
- `src/windows/presentation/PresentationApp.tsx` (modify — wrap the active slide renderer in `TransitionStage`)
- `src/stores/settings.ts` (create if not exists, or extend) — exposes `reduceMotion: boolean` and `transitionMs: number` loaded from settings table
- `src/api/commands.ts` (modify — `getSettings()` wrapper; or reuse existing if present)
**Depends on:** T16, T17, T9
**Requirement:** P2-09

**Done when:**
- [ ] Crossfade between slides within a song: 150ms (per spec). Crossfade between set items: 200ms.
- [ ] Rapid Advance keypresses (3 in quick succession): only the last is rendered after the current transition completes; the middle ones are dropped. Verified by a unit test that asserts the rendered slide is the latest, not the middle.
- [ ] `reduceMotion === true` → transition-duration becomes 0ms (instant).
- [ ] Blank and Freeze toggles bypass transitions (instant).
- [ ] Component test for queue logic with mocked timers.

**Tests:** component
**Gate:** quick
**Commit:** `feat(presentation): TransitionStage with crossfade + reduce-motion support`

---

### T19: Drift-free countdown ticker rewrite

**What:** Rewrite `commands/countdown.rs::tick_countdown` to use a wall-clock target instead of decrementing. Computes `remaining = target - now()` each tick. Implements `mode` transitions (Idle/Running/Paused/Finished) and end_behavior dispatch (HoldZero/Blackout/AdvanceSet). Drift bounded by one tick (~1 s) regardless of OS scheduling jitter.
**Where:**
- `src-tauri/src/commands/countdown.rs` (rewrite — ticker, all 5 commands adapted to new state shape; commands now take `CountdownConfig`-shaped inputs where applicable)
- `src-tauri/src/state.rs` (no change — `countdown_task: Arc<Mutex<Option<AbortHandle>>>` already exists from Phase 1-D)
- `src/api/commands.ts` (modify — `startCountdown({ durationMs, message?, endBehavior? })` signature; tick payload uses new state shape from T7)
**Depends on:** T7
**Requirement:** P2-10

**Done when:**
- [ ] `start_countdown` accepts duration + optional message + end_behavior; records `target_epoch_ms = now_ms() + duration_ms` and sets `mode = Running`.
- [ ] Ticker loop: computes `remaining = max(0, target - now())` each iteration; sleeps `min(1000, time_until_next_second_boundary)`; emits `countdown_tick` with updated state; exits when `remaining == 0`.
- [ ] When `remaining == 0`: dispatches `end_behavior` — `HoldZero` sets `mode = Finished` and stays at zero; `Blackout` invokes `set_presentation_mode(Blank)`; `AdvanceSet` invokes `next_slide()`.
- [ ] `pause_countdown` freezes `remaining_ms` (recomputed from current target), aborts the task, sets `mode = Paused`.
- [ ] `reset_countdown` clears target, sets `remaining_ms = duration_ms`, `mode = Idle`.
- [ ] Integration test: start a 3-second countdown, sleep 1.5s, assert `remaining_ms` is between 1400 and 1600 (allows scheduler jitter); start a 60-min logical countdown with a mocked clock that advances faster, assert drift < 100ms.
- [ ] Window restart simulation: after a `start`, drop and recreate the listener; `get_countdown_state` returns correct `remaining_ms` immediately.

**Tests:** integration (Rust)
**Gate:** quick
**Commit:** `feat(countdown): drift-free wall-clock-target ticker with mode + end-behavior`

---

### T20: Countdown set item editor + presentation renderer

**What:** Operator-side editor for countdown set items (inline in SetBuilder); presentation-side fullscreen renderer with digits + optional video bg + message. Feature-coupled in one task because neither ships without the other.
**Where:**
- `src/components/set/CountdownSetItemEditor.tsx` (create) — inline editor: duration (mm:ss/hh:mm:ss input), message text, end-behavior radio, optional background media picker
- `src/components/presentation/CountdownRenderer.tsx` (create) — fullscreen digits + optional `<video>` bg + message
- `src/components/common/MediaPicker.tsx` (create) — shared media picker used by song editor (T17) too; if it already exists from T17 reuse it
- `src/components/set/SetBuilder.tsx` (modify — dispatch to editor based on `selectedItem.itemType === 'countdown'`)
- `src/windows/presentation/PresentationApp.tsx` (modify — render `CountdownRenderer` when current item is countdown)
- `src/stores/countdown.ts` (modify — adapt to new state shape from T7)
**Depends on:** T19, T6, T17 (for MediaPicker shared component if not extracted earlier)
**Requirement:** P2-11, P2-12

**Done when:**
- [ ] Editor inputs: mm:ss / hh:mm:ss duration (validates format), message text (200 char max), end-behavior radio.
- [ ] Optional background media picker (filtered to videos) sets `countdown_config.background_media_id` — design notes this lives on the set item, not on the countdown domain config; verify with the design + adjust schema if needed (likely `media_options` JSON column covers it; or extend `CountdownConfig`).
- [ ] Editor changes update local set state; saved with the rest of the set.
- [ ] Presentation renderer: large `mm:ss` digits centered (uses `clamp(4rem, 30vmin, 18rem)` font-size).
- [ ] If `message` set, renders above the digits.
- [ ] If background_media_id set, renders `<video>` background loop muted underneath.
- [ ] `remaining_ms === 0 && end_behavior === HoldZero` stays at `00:00`.
- [ ] Component tests for both editor and renderer; integration test driving the runtime with a countdown set item (10s duration, assert final tick at 0 triggers configured end behavior).

**Tests:** component + integration
**Gate:** full
**Commit:** `feat(countdown): set item editor + presentation renderer for countdowns`

---

### T21: WebViewConfig persistence + set item wiring

**What:** Wire `set_items.webview_config` JSON column to the domain `WebViewConfig`. Set CRUD commands (`add_set_item`, `update_set`) accept the new payload and persist it. Reading back returns a typed `WebViewConfig`.
**Where:**
- `src-tauri/src/commands/set.rs` (modify — `db_load_set` deserializes `webview_config` JSON; `add_set_item` / `update_set` serialize it; integration tests round-trip)
- `src-tauri/src/db/set.rs` (modify if separated; otherwise inline in commands/set.rs)
- `src/api/commands.ts` (modify — `AddSetItemPayload` extended to accept all 5 types + variant payload fields; specifically `webViewConfig?: WebViewConfig`)
**Depends on:** T6, T8
**Requirement:** P2-13, P2-16

**Done when:**
- [ ] `add_set_item({ setId, itemType: 'web_view', webViewConfig: { mode, url, basicAuthUser?, basicAuthPass? } })` inserts a row with the JSON column populated.
- [ ] `get_set(id)` returns the set with the `webview_config` deserialized into the `SetItem.webview_config` field.
- [ ] Invalid `mode` value or malformed URL → error code `set.invalid_webview_config`.
- [ ] Integration test: add a webview item, fetch it back, assert round-trip.
- [ ] `cargo test` green.

**Tests:** integration
**Gate:** quick
**Commit:** `feat(set): persist WebViewConfig on set items via JSON column`

---

### T22: WebViewRenderer (iframe + MJPEG dual mode) [P]

**What:** Presentation-window component that renders an iframe or MJPEG `<img>` based on `webview_config.mode`. 10s load timeout; on failure shows black + small error in corner. Runtime URL allowlist (no `file:`, `javascript:`, `data:` schemes).
**Where:**
- `src/components/presentation/WebViewRenderer.tsx` (create)
- `src/utils/urlAllowlist.ts` (create) — `isUrlAllowed(url: string): { ok: boolean; reason?: string }`
- `src/windows/presentation/PresentationApp.tsx` (modify — render WebViewRenderer when current item is webview)
**Depends on:** T21
**Requirement:** P2-13

**Done when:**
- [ ] Iframe mode: `<iframe src={url} sandbox="allow-scripts allow-same-origin" />` (TD-7).
- [ ] MJPEG mode: `<img src={url} />` with `object-fit: contain`; basic-auth credentials passed as `https://user:pass@host/path` if provided (Chromium accepts inline auth for `<img>`).
- [ ] 10s load-timeout: `Promise.race([loadPromise, timeout])`; on timeout or 4xx/5xx → render error overlay ("Não foi possível carregar o conteúdo").
- [ ] URL allowlist rejects `file:`, `javascript:`, `data:`, `vbscript:` schemes → error overlay.
- [ ] Component unmounts cleanly on advance — no zombie network connections (verified by mocked `fetch` call counts in test).
- [ ] Component tests: iframe render, MJPEG render, load timeout, allowlist rejection.

**Tests:** component
**Gate:** quick
**Commit:** `feat(presentation): WebViewRenderer with iframe + MJPEG modes and URL allowlist`

---

### T23: WebView set item editor UI [P]

**What:** Operator-side editor for webview set items. Mode picker (iframe/MJPEG), URL input with scheme validation, optional basic-auth fields for MJPEG, http-not-https warning with confirm-anyway.
**Where:**
- `src/components/set/WebViewSetItemEditor.tsx` (create)
- `src/components/set/SetBuilder.tsx` (modify — dispatch to editor when `itemType === 'web_view'`)
**Depends on:** T21
**Requirement:** P2-13, P2-16

**Done when:**
- [ ] Mode radio: `Iframe` / `MJPEG (câmera)`.
- [ ] URL input with scheme prefix dropdown ([http://, https://]); http for iframe warns inline ("Conexões http podem ser bloqueadas").
- [ ] Basic-auth fields visible only when mode = MJPEG.
- [ ] Save validates URL parses (`URL()` constructor); rejects file:/data:/javascript: schemes inline.
- [ ] Component tests: mode toggle, validation, save with iframe, save with MJPEG + auth.

**Tests:** component
**Gate:** quick
**Commit:** `feat(set): WebView set item editor with mode picker and URL validation`

---

### T24: Global CSP relaxation in tauri.conf.json

**What:** Tauri 2 has no per-window CSP (TD-3). Update the global CSP in `tauri.conf.json` to allow `frame-src`, `img-src` from `http: https:`, and `media-src` for `asset:` + `blob:`. Both windows inherit this; the operator window is constrained by code conventions (no `<iframe src={user_input}>` outside the webview set item editor — which is operator-only).
**Where:**
- `src-tauri/tauri.conf.json` (modify — `app.security.csp`)
**Depends on:** T1 (nothing else; can run any time)
**Requirement:** P2-14

**Done when:**
- [ ] CSP becomes: `default-src 'self'; img-src 'self' asset: data: http: https:; media-src 'self' asset: blob: http: https:; frame-src http: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src ipc: http://ipc.localhost`.
- [ ] App still starts and the operator UI renders (manual check: `npm run tauri dev`).
- [ ] WebView item with a real https iframe loads (manual hardware test in T33).
- [ ] No new unit/integration tests required; config-only.

**Tests:** none
**Gate:** build (manual `npm run tauri dev` startup verification)
**Commit:** `chore(security): relax global CSP for WebView item support`

---

### T25: SetBuilder extension — 4 new add-item buttons + dispatch

**What:** Extend `SetBuilder.tsx` so all 5 item types are creatable. Add "Adicionar mídia", "Adicionar contagem regressiva", "Adicionar WebView/Câmera", and re-confirm "Adicionar tela preta" works. Items render type-icon + one-line summary + edit affordance; selected item shows the right inline editor.
**Where:**
- `src/components/set/SetBuilder.tsx` (modify — buttons + selected-item dispatcher)
- `src/components/set/SetItemRow.tsx` (create) — replaces inline item row code with a per-type summary + icon
- `src/components/set/MediaSetItemEditor.tsx` (create) — inline editor: pick media + toggle loop/mute/autoAdvance
- `src/api/commands.ts` (modify — `AddSetItemPayload` now accepts the union of all 5 types + payload variants; extend `UpdateSetItemPayload` if needed for editing payload after add)
**Depends on:** T15, T20, T21 (so countdown + webview editor components already exist for dispatch), T14 (so MediaPicker is available)
**Requirement:** P2-16

**Done when:**
- [ ] Four "Adicionar …" buttons present. Each appends a new set item with sensible defaults.
- [ ] Item row shows type icon (Music/Image-Video/Timer/Globe/Square), title summary, and a chevron to expand the inline editor.
- [ ] Reorder via dnd-kit works across heterogeneous types (no type-vs-type restriction).
- [ ] Duplicate action ("Duplicar") copies the selected item; new ids generated; `sort_order` adjusts.
- [ ] Invalid references (song deleted, media deleted) render a warning badge "Referência inválida" — runtime treats as Blank per T15.
- [ ] Component tests for: each "Adicionar" button, duplicate action, mixed-type reorder.

**Tests:** component
**Gate:** full
**Commit:** `feat(set): unified set editor with all 5 item types and inline editors`

---

### T26: services::archive::export + zip crate

**What:** Add the `zip` crate and a streaming exporter that writes `manifest.json`, `data/*.json`, and `media/*` into a `.tlz` archive. The JSON dump runs inside a single SQLite read transaction; media-file copies happen after the transaction closes.
**Where:**
- `src-tauri/Cargo.toml` (modify — `zip = "2"` per TD-11)
- `src-tauri/src/services/archive.rs` (create)
- `src-tauri/src/services/mod.rs` (modify — `pub mod archive;`)
**Depends on:** T8 (final schema)
**Requirement:** P2-17

**Done when:**
- [ ] `pub async fn export(pool: &SqlitePool, media_dir: &Path, out_path: &Path, progress: impl FnMut(ExportProgress)) -> Result<ExportSummary, ArchiveError>`.
- [ ] `manifest.json`: `{ schemaVersion: 1, exportedAt, appVersion, counts: { songs, sections, sets, setItems, media, settings } }`.
- [ ] `data/songs.json`, `data/sections.json`, `data/sets.json`, `data/set_items.json`, `data/media.json`, `data/settings.json` — all dumped as JSON arrays from a single read transaction.
- [ ] `media/{file_name}` — every non-deleted media row's file copied into the archive at chunked-streaming pace (no full-file in-memory).
- [ ] Progress callback fires every 1% or every 1 MB written, whichever is more frequent.
- [ ] Integration test: seed a fixture DB with 3 songs + 2 sets + 2 media files, run export, unzip and assert structure + manifest counts.

**Tests:** integration
**Gate:** quick
**Commit:** `feat(backup): streaming export to .tlz archive`

---

### T27: services::archive::import (Replace + Merge modes)

**What:** Read a `.tlz`, validate manifest, dispatch to Replace or Merge logic. Replace wipes the DB (and `media_dir`) then loads; Merge inserts rows whose ids don't already exist and copies media files that don't exist in `media_dir`.
**Where:**
- `src-tauri/src/services/archive.rs` (modify — add `import` function + `ImportMode { Replace, Merge }` + `ImportSummary`)
**Depends on:** T26
**Requirement:** P2-18

**Done when:**
- [ ] `inspect_archive(path) -> Result<ArchiveInspection, ArchiveError>` opens the manifest and returns `{ schemaVersion, exportedAt, appVersion, counts }` without modifying anything.
- [ ] `schemaVersion` newer than app supports → `ArchiveError::SchemaTooNew { archive_version, app_version }`.
- [ ] Replace mode: writes `.restore_in_progress` flag file in `media_dir`; truncates all Phase 2 tables; deletes all files in `media_dir` except the flag; inserts archive contents; copies media files; removes flag.
- [ ] Merge mode: for each row in the archive, `INSERT OR IGNORE` (so existing ids are kept); for each media file, copy only if destination does not exist.
- [ ] Per-table `imported / skipped / failed` counts in `ImportSummary`.
- [ ] Corrupt media file (size mismatch vs `media.json` row) is skipped + counted as failed.
- [ ] Integration tests: round-trip (export → import in fresh DB, assert all data present), merge with overlapping ids, schema-version-mismatch refusal.

**Tests:** integration
**Gate:** quick
**Commit:** `feat(backup): import .tlz archives with Replace + Merge modes`

---

### T28: commands::backup + BackupScreen UI + restore-in-progress detection

**What:** Tauri command surface for backup + operator UI screen. Plus startup check in `lib.rs::setup()` for `.restore_in_progress` flag.
**Where:**
- `src-tauri/src/commands/backup.rs` (create) — `export_library`, `inspect_archive`, `restore_library` commands; emits `backup_progress` events.
- `src-tauri/src/commands/mod.rs` (modify — `pub mod backup;`)
- `src-tauri/src/lib.rs` (modify — register commands; add `.restore_in_progress` check inside `setup()` and emit a `restore_in_progress_detected` event for the frontend modal to surface).
- `src/components/backup/BackupScreen.tsx` (create) — two cards: Exportar / Importar.
- `src/components/backup/RestoreInProgressDialog.tsx` (create) — modal that blocks app use until operator clicks Retry or Abort.
- `src/api/commands.ts` (modify — `exportLibrary`, `inspectArchive`, `restoreLibrary`, `onBackupProgress`, `onRestoreInProgressDetected` wrappers).
- `src/windows/operator/OperatorApp.tsx` (modify — "Backup" route entry + RestoreInProgressDialog mount).
**Depends on:** T27
**Requirement:** P2-17, P2-18

**Done when:**
- [ ] `export_library(outPath)` — picks file via dialog if not provided, emits progress, returns summary.
- [ ] `inspect_archive(inPath)` — manifest dump shown in confirm screen before restore.
- [ ] `restore_library(inPath, mode)` — Replace requires the operator to type "SUBSTITUIR" in a text field before the button enables.
- [ ] On app startup, if `.restore_in_progress` exists in `media_dir`, the operator sees a modal: "Restauração interrompida — tentar novamente ou cancelar (apaga o estado parcial)".
- [ ] Cancel button deletes the flag + everything in `media_dir/` AND truncates all tables (back to fresh-install state). Confirm dialog before doing so.
- [ ] Component tests for the typed-confirmation gate + restore-in-progress modal.
- [ ] Integration tests for the three new commands.

**Tests:** integration + component
**Gate:** full
**Commit:** `feat(backup): commands + UI + restore-in-progress detection`

---

### T29: i18next setup + locale scaffolding

**What:** Install `i18next` + `react-i18next`, configure at app entry, create `locales/pt-BR.json` (extracted in T30) and `locales/en-US.json` (translations added in T30).
**Where:**
- `package.json` (modify — add `i18next` + `react-i18next`)
- `src/i18n/index.ts` (create) — initialization, default locale, fallback chain
- `src/i18n/locales/pt-BR.json` (create — empty `{}` skeleton; populated by T30)
- `src/i18n/locales/en-US.json` (create — empty `{}` skeleton)
- `src/main.tsx` (modify — import `./i18n` before any component renders)
**Depends on:** T9 (settings rows exist for `app.locale`)
**Requirement:** P2-19

**Done when:**
- [ ] `i18next` initialized with `pt-BR` as default, `en-US` as fallback target.
- [ ] App still renders (smoke test: `npx vitest run` against existing component tests passes — they should keep working with hardcoded strings until T30 extracts them).
- [ ] Locale is loaded from `getSettings('app.locale')` at boot; falls back to pt-BR.
- [ ] No actual translation yet — pt-BR.json and en-US.json are empty objects.

**Tests:** smoke (run existing tests)
**Gate:** quick
**Commit:** `chore(i18n): install i18next and add locale scaffolding`

---

### T30: Locale extraction (pt-BR + en-US) across all UI

**What:** Move every user-facing Portuguese literal in every operator-window component to `pt-BR.json` and add the corresponding `en-US.json` entry. Replace every literal with `t('key')`. Audit the operator UI files only (presentation window has minimal UI text — covered by the same pass).
**Where:**
- Every file under `src/components/` (modify)
- Every file under `src/windows/` (modify)
- `src/i18n/locales/pt-BR.json` (modify — populate)
- `src/i18n/locales/en-US.json` (modify — populate with translations)
- `src/utils/format.ts` (create) — `formatDate(d, locale)` + `formatNumber(n, locale)` using `Intl.*` with the active locale.
**Depends on:** T14, T20, T23, T25, T28, T29 (most UI tasks done so we don't churn locale files mid-stream)
**Requirement:** P2-19

**Done when:**
- [ ] No JSX string literal in operator-window components matches a Portuguese word (audit via grep). All strings come through `t('key')`.
- [ ] `pt-BR.json` and `en-US.json` have the same key set (verified by a small CI/test script — added in this task).
- [ ] Dates and numbers use `Intl.DateTimeFormat(locale)` / `Intl.NumberFormat(locale)`.
- [ ] Backend error codes (`song.not_found`, `media.in_use`, etc.) get a `errors.song.notFound` translation key with `{{params}}` interpolation.
- [ ] All component tests pass with mocked `t` (returning the key) or with the real i18next provider in `pt-BR` mode.

**Tests:** component (existing tests adapt) + a new key-completeness test (`tests/i18n/key-completeness.test.ts`)
**Gate:** full
**Commit:** `feat(i18n): extract every user-facing string to locale files`

---

### T31: Language picker + locale_changed event

**What:** Add a "Idioma" dropdown to the existing Settings screen. Changing the value persists via `settings` table, calls `i18next.changeLanguage`, and emits a `locale_changed` event for the presentation window to re-render.
**Where:**
- `src-tauri/src/commands/settings.rs` (modify — `set_setting` emits `locale_changed` when key === 'app.locale'; or add a dedicated `set_locale(locale)` command)
- `src/components/settings/LanguagePicker.tsx` (create)
- `src/components/settings/SettingsScreen.tsx` (modify — add picker in "Geral" group)
- `src/api/commands.ts` (modify — `onLocaleChanged` listener wrapper)
- `src/windows/presentation/PresentationApp.tsx` (modify — `onLocaleChanged` triggers re-render via i18next.changeLanguage)
**Depends on:** T30
**Requirement:** P2-20

**Done when:**
- [ ] Picker offers `Português (Brasil)` and `English`. Default is the persisted value or pt-BR.
- [ ] Changing locale: operator window re-renders instantly; presentation window re-renders on receipt of `locale_changed`.
- [ ] Persisted across restarts.
- [ ] Dates re-format (DD/MM/YYYY ↔ MM/DD/YYYY).
- [ ] Missing en-US key → falls back to pt-BR string + console warn (already handled by i18next config in T29).
- [ ] Component test: change locale, assert `i18next.changeLanguage` called and `setSetting` invoked.

**Tests:** component
**Gate:** quick
**Commit:** `feat(i18n): language picker in settings with locale_changed event`

---

### T32: README ffmpeg install hint + UI placeholder note

**What:** Document ffmpeg as an optional runtime dependency in the README. Add a small dismissible banner in the Media Library when ffmpeg is detected as missing (no thumbnails generated for any imported video).
**Where:**
- `README.md` (modify — add "Optional dependencies" section pointing at `winget install --id Gyan.FFmpeg` / `choco install ffmpeg` / `brew install ffmpeg`)
- `src-tauri/src/commands/system.rs` (create) — `check_ffmpeg() -> bool` command (spawns `ffmpeg -version`; returns true if exit 0).
- `src-tauri/src/commands/mod.rs` (modify — `pub mod system;`)
- `src-tauri/src/lib.rs` (modify — register `check_ffmpeg`)
- `src/components/media/MediaLibrary.tsx` (modify — call `checkFfmpeg` on mount; if false, show a one-time dismissible banner: "Instale ffmpeg para previews de vídeo")
- `src/api/commands.ts` (modify — `checkFfmpeg` wrapper)
**Depends on:** T14
**Requirement:** P2-03 (acknowledgement)

**Done when:**
- [ ] README has the new section.
- [ ] `checkFfmpeg` returns true when ffmpeg is installed, false otherwise.
- [ ] Banner shows on missing-ffmpeg + persists dismissal via `settings.ui.ffmpeg_banner_dismissed = true`.
- [ ] Integration test for `check_ffmpeg` (`#[ignore]`-gated for the success branch since CI may not have ffmpeg; always-on for the missing-ffmpeg branch via PATH manipulation).

**Tests:** integration + component
**Gate:** quick
**Commit:** `docs(media): document ffmpeg dependency + add detection banner`

---

### T33: Phase 2 final smoke test — 5-item set on real hardware + ZIP round-trip

**What:** End-to-end manual verification on real hardware. Builds a set of all 5 item types, runs it through, exports + restores the library, swaps locale mid-test. Captures findings in `STATE.md` under "Phase 2 Completion Summary". Kicks off the 4-week field period.
**Where:**
- `.specs/features/phase2-v1/VERIFICATION.md` (create) — checklist + findings
- `.specs/project/STATE.md` (modify — add "Phase 2 Completion Summary" section)
- `.specs/project/ROADMAP.md` (modify — mark Phase 2 items as Done)
**Depends on:** All previous tasks
**Requirement:** All P2-01..P2-20

**Done when:**
- [ ] Manual run: build a set with 1 countdown (5 min) → 1 lyric song with video bg → 1 image media → 1 lyric song → 1 webview camera (any real https stream or a local mock) → 1 blank → 1 lyric song. Drive end-to-end with keyboard only.
- [ ] Export library to `.tlz`; verify file appears in target dir; size ≈ sum of media bytes + manifest.
- [ ] On a fresh DB (delete `%APPDATA%\TrinityLyrics\database.db` and `media/`), restore the `.tlz`; verify all songs/sets/media reappear; drive the same set through; identical behavior.
- [ ] Swap locale to en-US mid-test (between two set items); confirm operator UI changes instantly; presentation re-renders on next slide change.
- [ ] `cargo test` + `npx vitest run` + `tsc --noEmit` all green.
- [ ] `npm run tauri build` produces an installer ≤ 25 MB (relaxed from 15 MB if ffmpeg is bundled; still 15 MB if not — TD-1).
- [ ] STATE.md updated; ROADMAP entries flipped to Done.

**Tests:** manual (hardware)
**Gate:** full (cargo + vitest + tsc + tauri build) + manual signoff
**Commit:** `chore(phase2): verification pass and Phase 2 completion summary`

---

## Parallel Execution Map

```
Phase 0 (error refactor):
  T1 → (T2 [P] ∥ T3 [P] ∥ T4 [P])

Phase A (data model):
  T1 → (T5 [P] ∥ T6 [P] ∥ T7 [P]) → T8 → T9

Phase B (media backend):
  T8 → (T10 [P] ∥ T11 [P]) → T12

Phase C (media UI):
  T12 → T13 → T14

Phase D (media in presentation):
  T6 + T12 → T15 → (T16 [P] ∥ T17 [P]) → T18

Phase E (countdown):
  T7 → T19 → T20

Phase F (WebView):
  T6 + T8 → T21 → (T22 [P] ∥ T23 [P])
  T24 — independent after T1

Phase G (unified editor):
  T15 + T20 + T21 → T25

Phase H (backup):
  T8 → T26 → T27 → T28

Phase I (i18n):
  T9 → T29
  T14 + T20 + T23 + T25 + T28 → T30 → T31

Phase J (cross-cutting / final):
  T14 → T32
  ALL → T33
```

**Parallelism notes:**
- `[P]` tasks within a phase share no mutable state (separate files, separate components).
- Rust `cargo test` is parallel-safe; Vitest is parallel-safe per file. Both per TESTING.md Parallelism Assessment.
- T2/T3/T4 each touch a non-overlapping set of `commands/*.rs` files — true parallel safety.
- T22/T23 touch the same `SetBuilder.tsx` import surface but write different files; safe.
- T16/T17 both modify `SlideRenderer.tsx` indirectly via render dispatch — coordinate by structuring T17's edits within `SongBackground.tsx` and T16's within `MediaSlideRenderer.tsx`, with `PresentationApp.tsx` dispatch lines added once and committed in T15.

---

## Granularity Check

| Task | Scope | Atomic? |
|---|---|---|
| T1: ErrorPayload + normalizeError | 4 files, 1 contract | ✓ |
| T2: song + import migration | 2 cmd files (~11 commands) | ✓ Cohesive |
| T3: set + presentation migration | 2 cmd files (~13 commands) | ✓ Cohesive |
| T4: countdown/media/window/counter migration | 4 cmd files | ✓ Cohesive |
| T5: domain::media | 3 files | ✓ |
| T6: domain::set extension | 3 files | ✓ One enum extension |
| T7: domain::countdown rewrite | 4 files | ✓ |
| T8: Migration 003 | 1 SQL + 1 test | ✓ |
| T9: Migration 004 | 1 SQL + 1 test | ✓ |
| T10: media_probe | 1 service file | ✓ |
| T11: thumbnail | 1 service file | ✓ |
| T12: media commands rewrite | 1 cmd + 1 db + 1 lib edit | ✓ Single bounded surface |
| T13: stores/media | 1 store | ✓ |
| T14: MediaLibrary UI | 5 files | ✓ Single screen feature |
| T15: 5-variant exhaustive runtime | 1 cmd + ripple sites | ✓ One match-site sweep |
| T16: MediaSlideRenderer | 1 component | ✓ |
| T17: per-song background + scrim | 6 files | ✓ Single feature |
| T18: TransitionStage | 3 files | ✓ |
| T19: drift-free ticker | 1 cmd | ✓ |
| T20: countdown editor + renderer | 5 files | ✓ Feature-coupled |
| T21: WebView persistence | 2 files | ✓ |
| T22: WebViewRenderer | 3 files | ✓ |
| T23: WebView editor UI | 2 files | ✓ |
| T24: CSP relaxation | 1 file (config) | ✓ |
| T25: SetBuilder extension | 4 files | ✓ Single feature |
| T26: archive::export | 2 files + 1 dep | ✓ |
| T27: archive::import | 1 file | ✓ |
| T28: backup commands + UI + recovery | 7 files | ✓ Feature-coupled |
| T29: i18next setup | 4 files | ✓ |
| T30: locale extraction | Every UI file + 3 i18n files | ✓ One sweeping refactor |
| T31: language picker | 4 files | ✓ |
| T32: ffmpeg docs + banner | 5 files | ✓ |
| T33: smoke test + completion | 3 docs | ✓ Verification |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | Phase 0 start | OK |
| T2 [P] | T1 | After T1 | OK |
| T3 [P] | T1 | After T1 | OK |
| T4 [P] | T1 | After T1 | OK |
| T5 [P] | T1 | After T1 | OK |
| T6 [P] | T1 | After T1 | OK |
| T7 [P] | T1 | After T1 | OK |
| T8 | T5, T6, T7 | After Phase A parallel | OK |
| T9 | T8 | After T8 | OK |
| T10 [P] | T5 | Phase B parallel after T8 | OK |
| T11 [P] | T5 | Phase B parallel after T8 | OK |
| T12 | T8, T10, T11, T4 | After T10/T11 | OK |
| T13 | T12 | After T12 | OK |
| T14 | T13 | After T13 | OK |
| T15 | T6, T12, T8 | After T6 + T12 | OK |
| T16 [P] | T15 | After T15 | OK |
| T17 [P] | T15, T8 | After T15 | OK |
| T18 | T16, T17, T9 | After T16 + T17 | OK |
| T19 | T7 | After T7 | OK |
| T20 | T19, T6, T17 | After T19 (+ T17 for MediaPicker) | OK |
| T21 | T6, T8 | After T8 | OK |
| T22 [P] | T21 | After T21 | OK |
| T23 [P] | T21 | After T21 | OK |
| T24 | T1 | Independent after T1 | OK |
| T25 | T15, T20, T21 | After Phases D, E, F | OK |
| T26 | T8 | After T8 | OK |
| T27 | T26 | After T26 | OK |
| T28 | T27 | After T27 | OK |
| T29 | T9 | After T9 | OK |
| T30 | T14, T20, T23, T25, T28 | After most UI | OK |
| T31 | T30 | After T30 | OK |
| T32 | T14 | After T14 | OK |
| T33 | All | Final | OK |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | domain | unit (serde) | unit | OK |
| T2 | commands | integration | integration | OK |
| T3 | commands | integration | integration | OK |
| T4 | commands | integration | integration | OK |
| T5 | domain | unit | unit | OK |
| T6 | domain | unit | unit | OK |
| T7 | domain | unit | unit | OK |
| T8 | migration | integration | integration | OK |
| T9 | migration | integration | integration | OK |
| T10 | services | unit | unit | OK |
| T11 | services | unit | unit | OK |
| T12 | commands + db | integration | integration | OK |
| T13 | stores | unit | unit | OK |
| T14 | components | component | component | OK |
| T15 | commands | integration | integration | OK |
| T16 | components | component | component | OK |
| T17 | components + commands | component + integration | component + integration | OK |
| T18 | components | component | component | OK |
| T19 | commands | integration | integration | OK |
| T20 | components + commands | component + integration | component + integration | OK |
| T21 | commands | integration | integration | OK |
| T22 | components | component | component | OK |
| T23 | components | component | component | OK |
| T24 | config | none | none | OK (config-only; build gate) |
| T25 | components | component | component | OK |
| T26 | services | integration | integration | OK |
| T27 | services | integration | integration | OK |
| T28 | commands + components | integration + component | integration + component | OK |
| T29 | i18n config | smoke | smoke | OK |
| T30 | components + i18n | component + custom (key-completeness) | component + custom | OK |
| T31 | components + commands | component | component | OK |
| T32 | commands + components | integration + component | integration + component | OK |
| T33 | verification | manual | manual | OK |

---

## Requirement → Task Map

| Requirement | Task(s) |
|---|---|
| P2-01 Media domain + schema | T5, T8 |
| P2-02 Media CRUD commands | T12 |
| P2-03 Video thumbnails | T11 (+ T32 docs/banner) |
| P2-04 Media library UI | T14 |
| P2-05 Media upload flow | T14 |
| P2-06 Image set item | T15, T16 |
| P2-07 Video set item | T15, T16 |
| P2-08 Video backgrounds for lyrics | T17 |
| P2-09 CSS transitions | T18 |
| P2-10 Countdown ticker (drift-free) | T19 |
| P2-11 Countdown set item + editor | T20 |
| P2-12 Countdown renderer | T20 |
| P2-13 WebView set item | T21, T22, T23 |
| P2-14 CSP rules | T24 |
| P2-15 5 set item types unified | T6, T15 |
| P2-16 Set editor handles all types | T21, T23, T25 |
| P2-17 ZIP export | T26, T28 |
| P2-18 ZIP import (Replace + Merge) | T27, T28 |
| P2-19 i18next setup + extraction | T1, T2, T3, T4 (error codes), T29, T30 |
| P2-20 Language picker | T31 |
| (cross-cutting verification) | T33 |

**Coverage:** 20 / 20 requirements mapped. 33 tasks total. T1–T4 (error refactor) + T24 (CSP) + T32 (ffmpeg docs) + T33 (verification) = 7 supporting tasks; T5–T31 = 26 feature tasks across 20 requirements.

---

## MCPs and Skills (per task — to be confirmed)

For each task during Execute, use:
- **MCP:** filesystem (always), `tauri-plugin-dialog` for file pickers
- **Skill:** `mermaid-studio` if any task needs an extra diagram; `codenavi` for any deep code exploration during T15 (the match-site sweep)

No external MCPs needed — this is fully offline desktop work.
