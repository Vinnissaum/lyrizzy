# Phase 2: V1 Design

**Spec:** `.specs/features/phase2-v1/spec.md`
**Status:** Draft — awaiting approval
**Last updated:** 2026-05-19

---

## Codebase Discovery (informs the rest of the design)

Reading the current source surfaced facts that **partially contradict** the assumption in spec OQ-P2-01 that "Phase 1 done → Phase 2 builds on top fresh". The truth is more nuanced — there is significant Phase 1-D scaffolding already merged-or-staged, but several pieces are incomplete or incorrect for Phase 2 needs. The design treats this as the starting state rather than as Phase 2 work.

**Already in place** (lib.rs `invoke_handler!` line 89, plus modules):
- Set CRUD, song CRUD, presentation runtime, slide splitter, FTS5, Holyrics import — all complete.
- `media` table exists in `001_initial.sql` with `media_type`, `thumbnail_path`, `width`, `height`, `duration_ms`, `url`.
- `set_items` table accepts all 5 `item_type` values in schema (`song|media|countdown|webview|blank`) + columns `media_id`, `countdown_config` (JSON), `web_url`.
- `CountdownState`, command surface (`start_countdown`, `pause`, `reset`, `set_duration`, `get_state`), and a Tokio ticker task already exist.
- `import_media_file` and `set_background` commands exist.
- Frontend stores: `sets`, `presentation`, `countdown`, `library`. Components: `SetBuilder`, `SetList`, `CountdownPanel`, `SlideController`.

**Partial / incorrect for Phase 2 needs** (must be reworked):
- `domain::set::SetItemType` enum only has `Song | Blank` variants — schema is ahead of the domain. The TS mirror in `src/types/index.ts` carries `// TODO Phase 2` for the same reason.
- `domain::set::SetItem` has `song_id` but no `media_id`, `media_kind`, `countdown_config`, or `web_url`. The wire format doesn't carry the data the DB columns can hold.
- `CountdownState` lacks `mode`, `target_epoch_ms`, `message`, `end_behavior`. The ticker (`commands/countdown.rs` lines 8–29) **decrements `remaining_ms` by 1000 per tick** — this will drift versus wall clock and fails P2-10 criterion 6 (±100 ms over 60 min).
- `import_media_file` (`commands/media.rs` lines 9–38) copies the file to disk and returns an asset URL — but **does NOT insert a row in the `media` table**. There is no DB-backed media library yet.
- `set_background` writes a single global `background_path` (URL string) onto `PresentationState`. It carries no kind discrimination and no scrim opacity. Video background semantics require more state.
- `load_set_for_presentation` (`commands/presentation.rs` lines 67–80) has a non-exhaustive `match` on `SetItemType`. Adding three new variants will be a forcing function — the compiler will refuse to compile until each is handled.
- `addSetItem` API contract in `src/api/commands.ts` line 137 limits `itemType: 'song' | 'blank'`.

**Phase-1-deferred / new from scratch:**
- Video thumbnail generation, full `media` CRUD, media library UI.
- WebView set item (no scaffolding in the runtime or renderer).
- ZIP backup/restore (no module, no `zip` crate dependency yet).
- i18next setup; every UI string is currently hardcoded pt-BR per Phase 1 P1-15.

---

## Architecture Overview

Phase 2 keeps the Phase 1 architecture and extends it along three axes:

1. **Domain extension** — `SetItemType` grows from 2 → 5 variants; `SetItem` carries variant-specific config inline; `CountdownState` carries timer mode + drift-free fields; new `Media` and `MediaKind` types.
2. **A second long-lived backend task** — beyond the existing countdown Tokio task, no new background tasks are introduced in Phase 2 (CSS transitions, video playback, MJPEG render, iframe load are all browser-side).
3. **Two new vertical slices** — Media library (commands/services + UI screen) and Backup/restore (commands/services + UI screen) are net-new feature areas. i18next is a horizontal cross-cut.

```mermaid
graph TD
    subgraph Backend [Rust]
        AS[AppState<br/>presentation + countdown + slides] --> CT[Countdown ticker<br/>drift-free Tokio task]
        AS --> DB[(SQLite<br/>+ media + 003 migration)]
        DB -.media files.-> FS[(media_dir<br/>%APPDATA%)]
        FS --> AP[asset:// protocol]
        AS --> Cmds[Commands<br/>media | set | countdown | webview | backup]
        Cmds --> Svc[Services<br/>thumbnail | zip_archive | media_probe]
    end

    subgraph Operator [Operator window]
        OUI[React UI<br/>Library | Media | Sets | Settings | Backup]
        OS[Zustand stores<br/>+ media + locale]
        i18n[i18next provider]
        OUI --> i18n
        OS --> OUI
    end

    subgraph Presentation [Presentation window]
        PR[Stage renderer<br/>SongSlide | Image | Video | Countdown | WebView | Blank]
        Trans[Transition layer<br/>fade 200ms]
        PR --> Trans
    end

    Operator -->|invoke| Cmds
    Cmds -->|emit state_changed| Operator
    Cmds -->|emit state_changed| Presentation
    CT -.emit countdown_tick.-> Operator
    CT -.emit countdown_tick.-> Presentation
    AP -.asset://media/...|video src| Presentation
    AP -.asset://media/...|img src| Presentation
```

The diagram is intentionally short; component-level interfaces are below.

---

## Code Reuse Analysis

### Existing components leveraged (no rewrite)

| Component | Location | How Phase 2 uses it |
|---|---|---|
| `AppState` + `Arc<RwLock<…>>` pattern | `src-tauri/src/state.rs` | Add `media_dir` reference (already canonicalized in setup); no shape change required. |
| asset:// protocol handler | `src-tauri/src/protocol/asset.rs` | Reused for all new media URLs (images, videos, thumbnails). No changes — path-traversal validation already in place per CONCERN-3 fix. |
| `db::init_db` + `sqlx::migrate!()` | `src-tauri/src/db/mod.rs` (or equivalent) | Migration `003_media_phase2.sql` and `004_locale.sql` slot in unchanged. |
| `slide_splitter` | `src-tauri/src/services/slide_splitter.rs` | Untouched. Image/video/countdown/webview items don't go through it (they produce exactly one "pseudo-slide" each in `load_set_for_presentation`). |
| Presentation event flow (`state_changed`) | `commands/presentation.rs` | All five item types reuse it. No new event added. |
| `countdown_tick` event | existing | Repurposed — payload becomes the new `CountdownState` shape. Both windows already listen. |
| `tauri-plugin-dialog` | already registered in `lib.rs` line 32 | File picker for media import, ZIP export/import. |
| dnd-kit set reorder | `src/components/set/SetBuilder.tsx` | Reused for all five item types (no type discrimination at reorder time). |
| Frontend store pattern (Zustand + listen) | `src/stores/*.ts` | New `media` and `locale` stores follow the same shape. |

### Existing components extended (modified, not rewritten)

| Component | Location | Phase 2 changes |
|---|---|---|
| `domain::set::SetItemType` | `src-tauri/src/domain/set.rs:6` | Add `Media`, `Countdown`, `WebView` variants. Non-exhaustive `match`es in `load_set_for_presentation` and elsewhere become a compile-time forcing function. |
| `domain::set::SetItem` | `src-tauri/src/domain/set.rs:13` | Add `media_id: Option<String>`, `media_kind: Option<MediaKind>`, `countdown_config: Option<CountdownConfig>`, `webview_config: Option<WebViewConfig>`, `media_options: Option<MediaItemOptions>` (loop/mute/auto-advance). |
| `domain::countdown::CountdownState` | `src-tauri/src/domain/countdown.rs:5` | Replace with full Phase 2 shape (see Data Models). `is_running` becomes redundant with `mode` — remove. |
| `commands/countdown.rs::tick_countdown` | `src-tauri/src/commands/countdown.rs:8` | Rewrite to drift-free wall-clock-difference loop. `tokio::time::sleep` + `Instant::now()` comparison instead of decrementing. |
| `commands/media.rs::import_media_file` | `src-tauri/src/commands/media.rs:9` | Add metadata probe + thumbnail spawn + `INSERT INTO media`. Return a full `Media` row, not just the URL. |
| `commands/presentation.rs::load_set_for_presentation` | line 67 | Handle 5 item types; pseudo-slide (1-element vec) for non-song items so the existing slide-index machinery still works. |
| `addSetItem` API | `src/api/commands.ts:135` | Extend `itemType` union to 5 values + variant-specific optional payload fields. |
| Frontend `SetBuilder` | `src/components/set/SetBuilder.tsx` | Add 4 new "Adicionar…" buttons (Mídia / Contagem regressiva / WebView/Câmera / Em branco) and item-type-aware inline editors. |
| Frontend `SlideController` (presentation) | `src/components/presentation/SlideController.tsx` | Branch on `currentSetItem.itemType` to render the correct stage component. |
| CSP in `tauri.conf.json` | per CONCERN-3 (Phase 0 fix) | Add presentation-window CSP relaxations for `frame-src`, `media-src`, `img-src http: https:`. Operator-window CSP unchanged. |

### Integration points

| System | Integration |
|---|---|
| Existing `media` table | Already in 001. Migration 003 adds `byte_size`, `updated_at`, `deleted_at`, and renames `media_type` → `kind` (using SQLite `ALTER TABLE ... RENAME COLUMN` available since 3.25). Indexes: `(kind, deleted_at)`, `(file_name)`. |
| Existing `set_items` table | Already supports all 5 item types in `item_type` CHECK constraint. `media_id`, `countdown_config`, `web_url` columns already exist — domain just needs to use them. |
| Existing `settings` table | New keys: `app.locale`, `presentation.transition_ms`, `presentation.reduce_motion`. |
| `songs.background_id` | Already FK to `media(id)`. Phase 2 adds `songs.scrim_opacity` (TINYINT 0–100) via migration 003 — replaces the proposal to JSON-encode it in `slide_config`. |
| `tauri-plugin-shell` | Used for ffmpeg spawn in thumbnail generation (already registered). |
| `tauri-plugin-dialog` | Reused for ZIP export/import file pickers. |

### CONCERNS.md cross-check

- **CONCERN-7 (deadlock on emit)** — still applies; every new command MUST drop the `RwLock` write guard before `app.emit()`. The drift-free countdown ticker holds the lock for `<1 ms` per tick — well within safe bounds, but the existing pattern of `let snapshot = { let mut s = ...; s.clone() };` is preserved.
- **CONCERN-3 (CSP null)** — was fixed in Phase 0. Phase 2 P2-14 tightens it further with per-window policies.
- CONCERNS-1/2/4/5/6 are all closed by now (Phase 0/1 deliverables). No new concerns are introduced by this design beyond those flagged in "Risks & Mitigations" below.

---

## Components

### Area A — Media foundation

#### `domain::media`

- **Purpose:** Pure Rust types for media rows + the discriminated kind enum.
- **Location:** `src-tauri/src/domain/media.rs` (new)
- **Interfaces:**
  - `pub enum MediaKind { Image, Video }` — `#[serde(rename_all = "snake_case")]`.
  - `pub struct Media { id, file_name, display_name, kind, mime_type, width, height, duration_ms, thumbnail_file, byte_size, created_at, updated_at, deleted_at }` — camelCase serialize.
  - `pub struct MediaItemOptions { loop_, mute, auto_advance_on_end }` — set-item-scoped overrides.
- **Reuses:** Same serde derive pattern as `Song`, `ServiceSet`. UUID generation already used in `import_media_file`.

#### `services::media_probe`

- **Purpose:** Extract dimensions / duration / mime-type from a freshly-imported file before insert.
- **Location:** `src-tauri/src/services/media_probe.rs` (new)
- **Interfaces:**
  - `pub fn probe(path: &Path, kind: MediaKind) -> Result<MediaMetadata, ProbeError>`
  - Image path: read header via `image` crate (cheap — only opens file headers, doesn't decode the full image). Image crate already pulls minimal deps if `default-features = false, features = ["png","jpeg","webp"]`.
  - Video path: spawn `ffprobe` (sibling of ffmpeg) with `-v error -select_streams v:0 -show_entries stream=width,height,duration -of default=noprint_wrappers=1`. If ffprobe is not available, return `ProbeError::ToolMissing` and let the caller fall back to default metadata (`width = 1920, height = 1080, duration_ms = None`).
- **Reuses:** Same `Command::new` pattern used elsewhere; tauri-plugin-shell.

#### `services::thumbnail`

- **Purpose:** Generate a JPEG thumbnail for video at ~1 s offset.
- **Location:** `src-tauri/src/services/thumbnail.rs` (new)
- **Interfaces:**
  - `pub async fn generate(input: &Path, output: &Path) -> Result<(), ThumbnailError>`
  - Spawns `ffmpeg -ss 00:00:01 -i {input} -frames:v 1 -q:v 4 {output}`. 200×113 (16:9) target; ffmpeg picks the right scale automatically with `-vf scale=200:-2`.
  - Returns `ThumbnailError::ToolMissing` if ffmpeg not on PATH — caller leaves `thumbnail_file = NULL` and UI falls back to a generic icon.
- **Decision (resolves P2-03 gray area):** spawn ffmpeg, no bundling. See Tech Decisions below.

#### `commands::media`

- **Purpose:** Tauri command surface for media import, list, rename, delete.
- **Location:** `src-tauri/src/commands/media.rs` (existing — extended)
- **Interfaces:**
  - `import_media(payload: ImportMediaPayload) -> Result<Media, ErrorPayload>`
  - `list_media(params: ListMediaParams) -> Result<Vec<Media>, ErrorPayload>`
  - `rename_media(id: String, display_name: String) -> Result<Media, ErrorPayload>`
  - `delete_media(id: String) -> Result<(), ErrorPayload>` (rejects if referenced; lists references in the error params)
  - `get_media_references(id: String) -> Result<MediaReferences, ErrorPayload>` (returns `{ songs: Vec<{id,title}>, setItems: Vec<{setId,setName,itemId}> }` for the confirm dialog)
- **Reuses:** Existing `media_dir`, asset URL builder, UUID gen.
- **Note:** The old `import_media_file` is repurposed as the inner copy step; the new `import_media` orchestrates probe → thumbnail → DB insert → return Media. Backwards compatibility is not preserved (Phase 1 wasn't shipped externally).

### Area B — Media library UI

#### `MediaLibrary` (screen)

- **Purpose:** Grid of media items with filter / search / detail / delete / use-as-background.
- **Location:** `src/components/media/MediaLibrary.tsx` (new)
- **Interfaces:** props-less screen wired through `useMediaStore` and `api/commands`.
- **Reuses:** Phase 1's `SongList` filter/search debounce pattern (150 ms). Empty-state pattern from `EmptyState.tsx`.

#### `MediaUploadDropzone`

- **Purpose:** Drag-drop file accept + click-to-pick fallback.
- **Location:** `src/components/media/MediaUploadDropzone.tsx` (new)
- **Interfaces:** `<MediaUploadDropzone onImport={fn} />`. Uses `tauri-plugin-dialog` for click flow and HTML5 drag-drop API for drop flow.
- **Reuses:** Phase 1's import-wizard frame pattern (`ImportWizardFrame.tsx`) for the progress-and-summary UX.

#### `MediaDetailPanel`

- **Purpose:** Inline panel/modal showing one media's metadata + actions.
- **Location:** `src/components/media/MediaDetailPanel.tsx` (new)
- **Reuses:** `ConfirmDialog.tsx` for the "Excluir" flow.

#### `stores/media.ts`

- **Purpose:** Zustand store mirroring backend media list; listens to `media_library_changed`.
- **Location:** `src/stores/media.ts` (new)
- **Reuses:** Same store-shape and listen-pattern as `stores/library.ts`.

### Area C — Media in presentation

#### `MediaSlideRenderer` (image + video)

- **Purpose:** Renders an image or video fullscreen with `object-fit: contain`.
- **Location:** `src/components/presentation/MediaSlideRenderer.tsx` (new)
- **Interfaces:**
  - Props: `{ kind: MediaKind, assetUrl: string, options?: MediaItemOptions }`.
  - For video: `<video autoplay {loop} {muted} playsinline>`; on `ended` event, if `options.autoAdvanceOnEnd && !loop`, dispatch `nextSlide()`.
- **Reuses:** asset:// URL pattern from `set_background`.

#### Background overlay (per-song)

- **Purpose:** Renders a video or image background behind lyric slides with optional black scrim.
- **Location:** `src/components/presentation/SongBackground.tsx` (new)
- **Interfaces:** Props `{ song: Song, media: Media | null, scrimOpacity: number }`.
- **Implementation:** Two stacked layers — `<video loop muted autoplay>` (or `<img>`) at z-0 covering the stage, then `<div>` with `background: black; opacity: {scrimOpacity}%` at z-1, then slide text at z-2. CSS-only; no Canvas.

#### Transition manager

- **Purpose:** 200 ms crossfade between slides/items; queue one keypress, drop the rest.
- **Location:** `src/components/presentation/TransitionStage.tsx` (new)
- **Implementation:** Two stacked stages (current + previous) with CSS `transition: opacity 200ms`. Crossfade on state change. A small useRef-backed queue (max 1) handles rapid Advance keys.
- **Reduce-motion:** Reads `settings.presentation.reduce_motion`; when true, `transition-duration` is set to 0 ms (instant cut).

### Area D — Countdown timer

#### `domain::countdown` (rewrite)

- **Purpose:** New shape covering mode, end behavior, and target time.
- **Location:** `src-tauri/src/domain/countdown.rs` (extended)
- **New shape:**
  ```rust
  pub enum CountdownMode { Idle, Running, Paused, Finished }
  pub enum CountdownEndBehavior { HoldZero, Blackout, AdvanceSet }
  pub struct CountdownState {
      pub mode: CountdownMode,
      pub duration_ms: u64,
      pub remaining_ms: u64,
      pub target_epoch_ms: Option<u64>,  // wall-clock target while Running
      pub message: Option<String>,
      pub end_behavior: CountdownEndBehavior,
  }
  ```
- **Migration:** Phase 1's TS store reads `is_running`; Phase 2 changes that to `mode === 'running'`. Frontend store + `CountdownPanel.tsx` adapt.

#### `commands::countdown` (drift-free rewrite)

- **Purpose:** Wall-clock-difference ticker; survives presentation window restart.
- **Location:** `src-tauri/src/commands/countdown.rs` (modified)
- **Algorithm:**
  - `start_countdown` records `target_epoch_ms = now() + remaining_ms`.
  - The Tokio task sleeps `min(1000, time_until_next_second_boundary)`, then:
    1. Reads `target_epoch_ms` from state.
    2. Computes `remaining_ms = max(0, target - now())`.
    3. Updates state and emits `countdown_tick`.
    4. If `remaining_ms == 0`, dispatches the configured `end_behavior` and exits.
  - **Drift:** total drift ≤ 1 tick because each tick computes from wall clock, not accumulating sleep error.
- **Reuses:** Existing abort-handle pattern (`countdown_task: Arc<Mutex<Option<AbortHandle>>>` already in `AppState`).
- **End-behavior dispatch:**
  - `HoldZero`: stay at `00:00`, `mode = Finished`. No further action.
  - `Blackout`: call `set_presentation_mode(PresentationMode::Blank)`.
  - `AdvanceSet`: call `next_slide()` (which advances past the countdown set item).

#### Countdown set item editor + presentation renderer

- **Operator:** Inline panel inside `SetBuilder` when the selected item is `countdown`. Fields: duration (mm:ss input), message text, end behavior radio, optional background media picker. Reuses `MediaPicker` from Area B.
- **Presentation:** `CountdownRenderer.tsx` (new). Subscribes to `onCountdownTick`. Renders `mm:ss` (or `hh:mm:ss`) with `clamp(4rem, 30vmin, 18rem)` font sizing. Optional video bg uses the same `SongBackground` component (reuse).

### Area E — WebView / camera

#### `domain::webview_config`

- **Purpose:** Configuration for a webview set item, including mode + URL + auth.
- **Location:** `src-tauri/src/domain/set.rs` (extended)
- **Shape:**
  ```rust
  pub enum WebViewMode { Iframe, Mjpeg }
  pub struct WebViewConfig {
      pub mode: WebViewMode,
      pub url: String,
      pub basic_auth_user: Option<String>,  // mjpeg only
      pub basic_auth_pass: Option<String>,  // mjpeg only — stored as plaintext in JSON; flagged in risks
  }
  ```
- **Persistence:** Stored as JSON in `set_items.countdown_config` column? No — that column is countdown-specific. The schema already has `set_items.web_url TEXT` — we extend it to a JSON column or add a parallel `set_items.webview_config TEXT` JSON column (migration 003). Decision: **add `webview_config TEXT`** for symmetry with `countdown_config`. The existing `web_url` column is unused and can be dropped or repurposed; design keeps it dropped (migration 003).

#### `WebViewRenderer`

- **Purpose:** Renders an iframe or MJPEG `<img>` in the presentation window based on mode.
- **Location:** `src/components/presentation/WebViewRenderer.tsx` (new)
- **Sandbox:** Iframe receives `sandbox="allow-scripts allow-same-origin"`. Sees Tech Decisions for the rationale + alternative.
- **Failure handling:** 10 s timeout via `Promise.race` against `load` event; on failure, render a black panel with a small pt-BR/en error in a corner.
- **Lifecycle:** Mounted only while the runtime is on the webview set item; unmounted on advance so no zombie network connections.

#### CSP changes (P2-14) — REVISED after 2026-05-19 spike

**Spike result:** Tauri 2 does **not** support per-window CSP. The `WindowConfig` schema has no `security` field; CSP is global-only via `app.security.csp`. Per-window scoping is not achievable in v2 via configuration.

**Revised approach — single relaxed global CSP:**
- `tauri.conf.json` `app.security.csp` becomes:
  - `default-src 'self'`
  - `img-src 'self' asset: data: http: https:`
  - `media-src 'self' asset: blob: http: https:`
  - `frame-src http: https:`
  - `script-src 'self'`
  - `style-src 'self' 'unsafe-inline'`
  - `connect-src ipc: http://ipc.localhost`
- Both windows inherit the same CSP. The operator window technically *could* render iframes/remote images, but no UI affordance exposes that capability.
- **Security narrative:** the operator types the WebView URL — that's the trust boundary. Operator-window React code is the only producer of remote content and we control what it loads. Iframe sandbox attributes (`allow-scripts allow-same-origin`) on the WebView item add a second layer.

**Mitigation moved to runtime, not config:**
- A small URL allowlist in the WebView renderer rejects `file:`, `javascript:`, `data:` schemes regardless of CSP.
- Operator-window components MUST NOT use `<iframe src={…}>` with operator-supplied input outside the WebView set item editor.

**Open question for future Tauri release:** if Tauri 3 (or a v2 minor) adds per-window CSP support, revisit and tighten the operator window.

### Area F — Unified set runtime

#### `SetItemType` exhaustive handling

- **Forcing function:** Adding `Media`, `Countdown`, `WebView` to the enum breaks the existing `match` in `commands/presentation.rs:67`. The design embraces this — exhaustive `match` is preferred over `_ => …` so every site that handles set items must explicitly choose behavior for the new variants.
- **Pseudo-slide pattern:** Each non-song item generates exactly ONE `Slide` (with empty `lines` and a synthetic `section_label`). This keeps `current_slide_index` always valid, lets `next_slide` / `prev_slide` advance with the same code path, and avoids a special-case `current_set_item_index_only` mode.
- **Renderer dispatch:** The presentation window inspects `presentationState.set.items[currentItemIndex].itemType` and renders the matching component. The `currentSlide` field carries slide content for songs only; for other types it's ignored.

#### Set editor (operator)

- **`SetBuilder.tsx` extension:** Add 4 buttons ("Adicionar mídia", "Adicionar contagem regressiva", "Adicionar WebView/Câmera", "Tela preta"). Item rows render a type-icon + summary + edit action. Inline editors per type live in their own files: `MediaSetItemEditor.tsx`, `CountdownSetItemEditor.tsx`, `WebViewSetItemEditor.tsx`.

### Area G — Backup / restore

#### `services::archive` (new module)

- **Purpose:** Streaming ZIP build + parse.
- **Location:** `src-tauri/src/services/archive.rs` (new)
- **Dependencies:** Add `zip = "2"` to `Cargo.toml`. The crate streams chunks — no in-memory buffering of the whole archive. Cross-platform (also matters for future macOS port).
- **Interfaces:**
  - `pub async fn export(pool: &SqlitePool, media_dir: &Path, out_path: &Path, progress: impl Fn(ExportProgress)) -> Result<ExportSummary, ArchiveError>`
  - `pub async fn import(in_path: &Path, mode: ImportMode, pool: &SqlitePool, media_dir: &Path, progress: impl Fn(ImportProgress)) -> Result<ImportSummary, ArchiveError>`
- **Archive layout:**
  ```
  manifest.json     {schemaVersion, exportedAt, appVersion, counts}
  data/songs.json
  data/sections.json
  data/sets.json
  data/set_items.json
  data/media.json
  data/settings.json
  media/{file_name}
  ```
- **Transaction-consistent read:** The export wraps the JSON-row dumps in a single read transaction (`BEGIN; … COMMIT;`). Media file copies happen after the transaction closes — files are immutable once imported, so no torn state.
- **`.restore_in_progress` flag:** Written to `media_dir/.restore_in_progress` before clobbering anything in Replace mode; deleted on success. App startup checks for it (in `lib.rs setup()`) and prompts the operator to retry or abort.

#### `commands::backup`

- **Purpose:** Operator-facing commands wrapping `services::archive`.
- **Location:** `src-tauri/src/commands/backup.rs` (new)
- **Interfaces:**
  - `export_library(out_path: String) -> Result<ExportSummary, ErrorPayload>` — emits `backup_progress` events.
  - `inspect_archive(in_path: String) -> Result<ArchiveInspection, ErrorPayload>` — parses manifest, returns counts without restoring.
  - `restore_library(in_path: String, mode: ImportMode) -> Result<ImportSummary, ErrorPayload>` — emits `backup_progress` events.

#### Backup UI

- **Operator screen:** `src/components/backup/BackupScreen.tsx` (new) — two cards: "Exportar biblioteca" and "Importar biblioteca". The import card shows a typed-confirmation step for Replace mode.

### Area H — Internationalization

#### i18next setup

- **Location:** `src/i18n/` (new directory). `index.ts` (init), `locales/pt-BR.json`, `locales/en-US.json`.
- **Provider:** Mounted in `main.tsx` once per app load (both windows). Lazy-loads the en-US locale only when selected — pt-BR bundled.
- **Key format:** Flat dotted keys grouped by component (`songEditor.title.label`, `library.searchPlaceholder`). No nested namespaces — keeps lookups predictable.

#### Backend error structure

- **`domain::error::ErrorPayload`** — `{ code: String, params: HashMap<String, String> }`.
- **Migration strategy** (resolves Tech Decision #4): every command's return type changes incrementally. New commands written for Phase 2 use `ErrorPayload` directly; existing Phase 1 commands continue returning `Result<T, String>` until touched. The frontend `commands.ts` normalizes both:
  ```ts
  function normalize(err: string | ErrorPayload): ErrorPayload {
    return typeof err === 'string' ? { code: 'legacy', params: { message: err } } : err
  }
  ```
- The `legacy` code's pt-BR translation is `"{{message}}"` (passthrough); en-US is the same. This is acknowledged technical debt; cleanup happens in Phase 3 or as commands are otherwise touched.

#### Language picker

- **Location:** Existing settings screen (Phase 1 P1-14). Add one `<select>` for `app.locale`. Persists via the existing `settings` table.
- **Reactivity:** `i18next.changeLanguage(value)` causes all `useTranslation()` hooks to re-render. Presentation window receives the locale change via a new event `locale_changed` (cheap — no need to overload `state_changed`).

---

## Data Models

### Domain additions (Rust)

```rust
// src-tauri/src/domain/media.rs (new)
pub enum MediaKind { Image, Video }
pub struct Media {
  pub id: String,
  pub file_name: String,        // on-disk filename (uuid.ext)
  pub display_name: String,     // operator-editable name shown in UI
  pub kind: MediaKind,
  pub mime_type: String,
  pub width: Option<i32>,
  pub height: Option<i32>,
  pub duration_ms: Option<i64>, // video only
  pub thumbnail_file: Option<String>,
  pub byte_size: i64,
  pub created_at: i64,
  pub updated_at: i64,
  pub deleted_at: Option<i64>,
}
pub struct MediaItemOptions {
  pub loop_: bool,
  pub mute: bool,
  pub auto_advance_on_end: bool,
}

// src-tauri/src/domain/countdown.rs (extended)
pub enum CountdownMode { Idle, Running, Paused, Finished }
pub enum CountdownEndBehavior { HoldZero, Blackout, AdvanceSet }
pub struct CountdownState { /* see Area D */ }
pub struct CountdownConfig {
  pub duration_ms: u64,
  pub message: Option<String>,
  pub end_behavior: CountdownEndBehavior,
}

// src-tauri/src/domain/set.rs (extended)
pub enum SetItemType { Song, Media, Countdown, WebView, Blank }
pub enum WebViewMode { Iframe, Mjpeg }
pub struct WebViewConfig {
  pub mode: WebViewMode,
  pub url: String,
  pub basic_auth_user: Option<String>,
  pub basic_auth_pass: Option<String>,
}
pub struct SetItem {
  pub id: String,
  pub set_id: String,
  pub item_type: SetItemType,
  pub sort_order: i32,
  pub notes: Option<String>,
  // variant payloads
  pub song_id: Option<String>,
  pub media_id: Option<String>,
  pub media_kind: Option<MediaKind>,           // denormalized for cheap dispatch
  pub media_options: Option<MediaItemOptions>,
  pub countdown_config: Option<CountdownConfig>,
  pub webview_config: Option<WebViewConfig>,
}
```

### TypeScript mirrors

`src/types/index.ts` adds `MediaKind`, `Media`, `MediaItemOptions`, `CountdownMode`, `CountdownEndBehavior`, `CountdownConfig`, `WebViewMode`, `WebViewConfig`. `SetItem` extends with the same optional fields.

### Database migration `003_media_phase2.sql`

```sql
-- Rename + extend the existing media table
ALTER TABLE media RENAME COLUMN media_type TO kind;
ALTER TABLE media ADD COLUMN display_name TEXT;
ALTER TABLE media ADD COLUMN byte_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN deleted_at INTEGER;
UPDATE media SET display_name = file_name WHERE display_name IS NULL;

CREATE INDEX IF NOT EXISTS media_kind_idx ON media(kind, deleted_at);
CREATE INDEX IF NOT EXISTS media_filename_idx ON media(file_name);

-- Per-song scrim overlay (0–100). Replaces the JSON-encoded proposal in spec.
ALTER TABLE songs ADD COLUMN scrim_opacity INTEGER NOT NULL DEFAULT 35;

-- Webview config per set item (parallels existing countdown_config)
ALTER TABLE set_items ADD COLUMN webview_config TEXT;
ALTER TABLE set_items ADD COLUMN media_options TEXT;   -- JSON: {loop, mute, autoAdvanceOnEnd}

-- The unused 'url' column on media (Phase 0 holdover) is left in place;
-- dropping requires SQLite table-recreate dance. Not worth it.
```

### Database migration `004_locale.sql`

```sql
-- Default locale row; the settings screen can overwrite.
INSERT OR IGNORE INTO settings(key, value) VALUES ('app.locale', 'pt-BR');
INSERT OR IGNORE INTO settings(key, value) VALUES ('presentation.transition_ms', '200');
INSERT OR IGNORE INTO settings(key, value) VALUES ('presentation.reduce_motion', 'false');
```

---

## Error Handling Strategy

| Scenario | Handling | User Impact |
|---|---|---|
| Unsupported video container at import (MKV/AVI/MOV) | `import_media` returns `{ code: "media.unsupported_container", params: { ext } }` | pt-BR error toast: "Formato `.{{ext}}` não suportado — converta para MP4 ou WebM (HandBrake)." |
| ffmpeg not on PATH (thumbnail) | Warning logged; `thumbnail_file` stays NULL | Library grid shows generic video icon; no operator-facing error. |
| ffprobe not on PATH (metadata) | Defaults applied (1920×1080, duration=NULL) | Operator may see "Dimensões: desconhecidas" in detail; non-blocking. |
| Media delete with references | `delete_media` returns `{ code: "media.in_use", params: { songs, setItems } }` | Confirmation dialog lists the references; delete is blocked. |
| Set item references deleted song/media | Runtime treats the item as `Blank` | Audience sees black; operator sees a warning badge. |
| Countdown started with `remaining_ms == 0` (target in past) | Renderer shows `00:00`, end-behavior fires immediately | No error; expected per spec. |
| WebView URL fails to load (10 s timeout, 4xx/5xx, network) | Renderer shows black + small pt-BR/en text | No full-screen error; live service stays composed. |
| ZIP export: out-of-disk-space mid-write | Partial file is removed; `{ code: "backup.disk_full" }` | pt-BR error dialog. |
| ZIP import: corrupt archive | `inspect_archive` fails; restore not initiated | pt-BR error: "Arquivo de backup inválido ou corrompido." |
| ZIP import: newer schemaVersion | `{ code: "backup.schema_too_new", params: { archive_version, app_version } }` | pt-BR error suggests updating Trinity Lyrics. |
| ZIP import interrupted | `.restore_in_progress` file detected at startup | Modal blocks app use until operator retries or aborts. |
| i18n missing key in en-US | Falls back to pt-BR string + console warn | No visible breakage. |
| Locale change mid-presentation | Operator window re-renders immediately; presentation slide re-renders on next state event | No mid-service flicker. |

---

## Tech Decisions (resolving the 8 spec gray areas)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Video thumbnail strategy (P2-03) | Spawn `ffmpeg` (and `ffprobe` for metadata). Do NOT bundle. Placeholder fallback when tool is missing. | PROJECT.md targets < 15 MB installer. Bundling ffmpeg adds ~30 MB and pulls in licensing complexity. `video-rs` pulls native FFmpeg deps anyway. Spawn keeps installer tiny; the fallback path is well-defined; we document "Para previews de vídeo, instale ffmpeg via choco/winget" in the README. |
| 2 | `.tlz` extension vs `.zip` | Custom `.tlz` (still a ZIP internally). | Enables Windows file-association double-click restore. Power users can still unzip with 7-Zip — the format is just ZIP with a custom suffix. |
| 3 | Default restore mode (P2-18) | Replace, with typed-confirmation gate. | Matches the dominant use case (fresh install / new machine). Typed confirm prevents accidental clobbering. Merge available as the alternate choice. |
| 4 | Backend error refactor (P2-19) | **One-shot:** every Phase 1 command migrates to `ErrorPayload { code, params }` as the first Phase 2 task before any other feature work begins. (Reversed from initial proposal after user confirmation 2026-05-19.) | Avoids the slow accretion of dual error shapes and the "legacy" passthrough hack. Estimated ~1 week of focused work touching ~12 commands. Keeps the codebase consistent and means every Phase 2 command can rely on structured errors from the start. |
| 5 | Video bg scrim default (P2-08) | 35% per-song via `songs.scrim_opacity` column (TINYINT 0–100). | Real worship videos test well at 30–40% — split the difference. Column (not JSON in `slide_config`) keeps it queryable + indexable if needed later. |
| 6 | WebView sandbox flags (P2-13) | `sandbox="allow-scripts allow-same-origin"` for the iframe. | Required for most IP camera UIs and modern embeds (livestream players check origin). Trades wider attack surface for compatibility. Note in user docs: "Use only trusted URLs as WebView items." |
| 7 | Video loop flag (P2-07) | Per-item `loop` boolean on `MediaItemOptions`, default false. | Operator may genuinely want a looping standalone video (e.g. ambient transition). Forcing them to use the song-background path instead would be awkward. |
| 8 | `auto_advance_on_end` (P2-07) | Default true. | Matches Holyrics behavior. Most operators expect a non-loop video to release control on end. Configurable per item if they want manual handoff. |

**Plus one new decision surfaced during design:**

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 9 | Drift-free countdown algorithm | Wall-clock target + `Instant::now()` comparison each tick, NOT decrement-by-elapsed. | Current implementation in `commands/countdown.rs:18` decrements by a fixed 1000 ms per tick — drift is bounded only by `tokio::time::sleep` accuracy, which is OS-dependent and worse under load. Wall-clock target produces drift bounded by one tick (sub-second). Meets spec P2-10 criterion 6 (±100 ms over 60 min) easily. |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `SetItemType` enum extension cascades into many `match` sites and silently breaks downstream code. | Embrace it. Compiler enforces exhaustive `match` everywhere — refuses to compile until handled. List the affected files in `tasks.md` so they're verified during execution. |
| ffmpeg spawn fails on the operator's machine (no PATH). | Documented installation hint; placeholder thumbnails; library still functional. Not a hard dependency. |
| MJPEG basic-auth password stored plaintext in `set_items.webview_config` JSON. | Out of scope for v1 — the DB file is local-user-only at `%APPDATA%` (filesystem ACL). Note in user docs. Phase 3 can encrypt at rest. |
| WebView2 sandbox bypass via `allow-same-origin` + malicious URL. | Audit boundary: spec says operator types the URL. We trust the operator. Mitigation: hard-code denylist for `file:///`, `javascript:`, `data:` schemes. |
| `zip` crate streams but the SQLite read transaction holds DB locks during JSON dumps — a long export blocks writers. | The JSON dump phase is < 1 second for libraries up to ~10k songs. Acceptable. Media-file copy phase (which is the slow part) happens AFTER the transaction closes. |
| `.restore_in_progress` flag persists across crashes — operator stuck. | Modal includes "Cancelar restauração" button that deletes the flag and the partially-written `media/` files. |
| Locale switch causes pt-BR/en-US mixed render briefly. | i18next handles re-render synchronously for the operator window; presentation window updates on next `state_changed`. Not a service-disrupting issue. |
| `media.url` column from Phase 1 schema becomes truly dead. | Leave it. SQLite column drops require table recreation — not worth the migration cost for one unused column. |

---

## Open items — resolved 2026-05-19

All four pre-tasks questions are decided:

1. **ffmpeg dependency docs** — README installation hint + UI placeholder note when ffmpeg is missing ("Instale ffmpeg para previews de vídeo"). No dedicated docs page; no first-run check.
2. **Tauri 2 per-window CSP** — spiked 2026-05-19. **Not supported.** Design revised to use a relaxed global CSP (see Area E above). Runtime URL allowlist + iframe sandbox provide the security layering instead.
3. **`zip` crate version** — `zip = "2"` (caret 2.x).
4. **Backend error refactor** — **One-shot first task.** Phase 2 begins with a refactor task migrating every Phase 1 command from `Result<T, String>` to `Result<T, ErrorPayload>`. No legacy passthrough; the codebase stays consistent.

---

## Confirm before Tasks

Design phase artifacts:
- 4 new domain modules (`media`, extended `set`, extended `countdown`, new `error`)
- 2 new services (`media_probe`, `thumbnail`, `archive`)
- 4 new command modules (`media` extended, `countdown` rewritten, `webview`/`backup` new)
- ~10 new React components + 1 new store + i18n scaffolding
- 2 new SQL migrations (003, 004)
- 1 new Cargo dep (`zip = "2"`); 1 optional binary dep (ffmpeg, runtime-checked)

If this design matches your intent, next is `tasks.md` — breaking the above into ~30–40 atomic tasks with verification criteria, dependencies, and parallel-execution flags.
