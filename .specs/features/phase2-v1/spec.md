# Phase 2: V1 Spec — Media + Countdown + WebView + Backup + English

**Status:** Approved — 2026-05-19. Design at `.specs/features/phase2-v1/design.md`.
**Feature:** phase2-v1
**Last updated:** 2026-05-19
**Depends on:** Phase 1 MVP (closing — final Phase 1 sub-phases C/D bring set runtime, countdown groundwork, and media backgrounds into the codebase per `MEMORY.md`)

---

## Problem Statement

Phase 1 ships a usable lyrics-only Sunday-morning tool. Holyrics, in production use today, still wins on three operator workflows that Phase 1 deliberately deferred: image/video slides as standalone set items, a countdown clock before service starts, and a live camera/web feed embedded in a set. Phase 2 closes that feature gap so Trinity Lyrics can fully replace Holyrics for the church's weekly use. A secondary motivation is operational resilience (backup/restore so a re-install or a new machine takes minutes, not hours) and accessibility for the English-speaking volunteer rotation (Portuguese strings extracted to a real i18n layer with an English locale alongside pt-BR).

## Goals

- [ ] Operator can build and drive a service set composed of any mix of the five item types (`song`, `media`, `countdown`, `webview`, `blank`) end-to-end without touching Holyrics.
- [ ] Image and video media items render fullscreen on the presentation window with smooth transitions and no visible black frame between items.
- [ ] Video backgrounds loop seamlessly behind song lyrics, with text remaining legible (configurable scrim/contrast).
- [ ] Countdown timer is driven by a single Rust source of truth (Tokio ticker), survives presentation window restarts, and never drifts more than ±100 ms from wall clock over 60 minutes.
- [ ] Operator can embed an IP camera (MJPEG) or arbitrary URL (iframe) as a set item and switch to/from it in under 1 second.
- [ ] Full library (songs, sets, media files, settings) can be backed up to a single `.tlz` archive and restored on a fresh install with zero data loss.
- [ ] Every user-facing string in the operator UI is sourced from a locale file; switching between pt-BR and en-US is instant and persists across restarts.
- [ ] Used in a real Sunday service for at least four consecutive weeks before Phase 3 begins (project-level feedback gate from ROADMAP).

## Out of Scope

Captured here to prevent scope creep — these belong in Phase 3 or are out of v1 entirely.

| Feature | Reason |
|---|---|
| PPTX rendering (LibreOffice CLI) | Phase 3 — separate process, large surface area, deserves its own spec |
| Per-section background overrides | Phase 3 — background is per-song only in Phase 2 |
| Presenter notes | Phase 3 |
| Keyboard shortcut customization | Phase 3 — defaults only in Phase 2 |
| Service report / CCLI export | Phase 3 |
| Dark/light UI theme | Phase 3 |
| Auto-update | Phase 3 (Tauri updater plugin) |
| Crash reporting (Sentry opt-in) | Phase 3 |
| RTSP camera streaming | Out of v1 — requires transcoding; flagged below |
| MKV / AVI / MOV containers | Out of v1 — WebView2 does not support natively; reject at import with HandBrake guidance |
| Cloud sync / multi-device | Out of v1 entirely (per PROJECT.md) |
| Mobile / web deployment | Out of v1 entirely (per PROJECT.md) |
| Locales other than pt-BR + en-US | Out of v1 — i18n scaffolding supports more, no other locales translated |

---

## Resolved Open Questions

User decisions captured from the spec discussion on 2026-05-18:

| # | Question | Resolution |
|---|---|---|
| OQ-P2-01 | Treat in-progress code (countdown.rs, media.rs, set.rs, presentation.rs in `git status`) as Phase 1 or Phase 2? | Phase 1 finishing. Phase 2 spec assumes Phase 1 lands first; Phase 2 builds on top. |
| OQ-P2-02 | Phase 2 scope coverage? | All four themes in: media stack, countdown, WebView + unified set items, backup + i18n. |
| OQ-P2-03 | WebView/camera use case? | Both — operator picks iframe URL or MJPEG image source per set item (single set item type, two render modes). |
| OQ-P2-04 | Library backup — bundle media files? | Yes. Self-contained ZIP includes DB rows + settings + the full `media/` directory. |
| OQ-2 (carry-over) | Video thumbnail library | Resolve during design — three options: `video-rs`, spawn ffmpeg, placeholder thumbnail. Decision affects P2-03. |

---

## Requirements

Requirements grouped by area. All are P1 (Phase-2-MVP-critical) unless flagged otherwise. Each carries a unique ID `P2-NN` for traceability into `design.md`, `tasks.md`, and verification.

### Area A — Media foundation

#### P2-01: Media domain types + schema

Define the Rust `domain::media::{Media, MediaKind}` type plus the supporting `media` table columns the rest of Phase 2 operates on. TS mirror in `src/types/index.ts`.

**Acceptance criteria:**
1. WHEN the Rust crate compiles THEN `domain::media::{Media, MediaKind}` SHALL exist with `#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]` and `#[serde(rename_all = "camelCase")]`. `MediaKind` is one of `Image | Video`.
2. WHEN migration `003_media_phase2.sql` runs THEN the `media` table SHALL include: `id TEXT PK`, `file_name TEXT NOT NULL`, `kind TEXT NOT NULL CHECK(kind IN ('image','video'))`, `mime_type TEXT NOT NULL`, `width INTEGER`, `height INTEGER`, `duration_ms INTEGER` (video only), `thumbnail_file TEXT` (video only), `byte_size INTEGER NOT NULL`, `created_at INTEGER NOT NULL`, `deleted_at INTEGER`.
3. WHEN a media row is serialized THEN field names SHALL be camelCase on the wire.
4. WHEN `src/types/index.ts` is read THEN `Media` and `MediaKind` SHALL mirror the Rust types.

**Notes:** Width / height / duration are best-effort metadata captured at import time. `thumbnail_file` is a sibling file in `media_dir` (e.g. `{id}.thumb.jpg`).

---

#### P2-02: Media CRUD commands

Tauri commands to import, list, rename, and soft-delete media files. Files live on disk under `media_dir`; DB rows index them. Imports copy the source file into `media_dir` (never reference it in place) so the library is self-contained.

**Acceptance criteria:**
1. WHEN the operator calls `importMedia(sourcePath)` THEN the backend SHALL validate the file extension (`png|jpg|jpeg|webp|gif|mp4|webm`), reject unsupported containers (MKV/AVI/MOV) with a pt-BR error suggesting HandBrake, copy the file to `media_dir/{uuid}.{ext}`, probe metadata (dimensions for images; dimensions + duration for videos), and insert a `media` row in a single transaction.
2. WHEN the operator calls `listMedia({ kind?, search?, limit?, offset? })` THEN the backend SHALL return paginated non-deleted media rows, sorted by `created_at` descending by default; `kind` filter narrows to image-only or video-only.
3. WHEN the operator calls `renameMedia(id, newFileName)` THEN the backend SHALL update `media.file_name` (display name only — the on-disk filename is not renamed) and update `updated_at`.
4. WHEN the operator calls `deleteMedia(id)` THEN the backend SHALL set `deleted_at` to current epoch ms. The on-disk file is NOT deleted in Phase 2 (manual purge is acceptable; see edge cases).
5. WHEN the operator calls `deleteMedia(id)` on a media row referenced by any non-deleted song background or set item THEN the command SHALL fail with a pt-BR error listing the referencing songs/sets ("Mídia em uso por: …").
6. WHEN any command fails THEN it SHALL return `Result<T, String>` with a Portuguese error message safe to surface.
7. WHEN media changes occur THEN `media_library_changed` (existing event from `CLAUDE.md`) SHALL be emitted to both windows.

**Notes:** Phase 1's `media` table (if present from earlier work) is migrated forward, not replaced. UUID v7 (already in use for songs).

---

#### P2-03: Video thumbnail generation

For every imported video, generate a single still frame at ~1 second offset and persist it as a JPEG sibling file. Thumbnails power the library grid and the set editor preview.

**Acceptance criteria:**
1. WHEN a video is imported via `importMedia` THEN a thumbnail SHALL be generated and its filename stored in `media.thumbnail_file`.
2. WHEN thumbnail generation fails (corrupt file, missing codec, command not found) THEN the import SHALL still succeed; `thumbnail_file` SHALL remain `NULL`; a warning SHALL be logged. UI falls back to a generic video icon.
3. WHEN the library UI requests a video thumbnail THEN the file SHALL be served via the existing `asset://` handler (`asset://media/{thumbnail_file}`).
4. WHEN `cargo test` runs THEN at least one integration test SHALL exercise thumbnail generation for a known-good fixture video and assert the JPEG file exists.

**Notes (design decision deferred):** three thumbnail strategies on the table — `video-rs` crate (heaviest, native), `Command::new("ffmpeg")` spawn (requires ffmpeg in PATH or bundled), or placeholder-only (no real thumbnail). The design phase decides; whichever path is chosen MUST be documented in `design.md` and a fallback path MUST exist when the backend dependency is unavailable.

---

### Area B — Media library UI

#### P2-04: Media library screen

A React screen lets the operator browse, filter, upload, rename, and delete media. Wired through `src/api/commands.ts`.

**Acceptance criteria:**
1. WHEN the operator opens "Mídia" THEN they SHALL see a grid of thumbnails (image thumbnail or generated video thumbnail) with file name, kind icon (image vs video), and size shown beneath each item.
2. WHEN the operator types in the search box THEN `listMedia({ search })` SHALL be debounced (~150 ms) and the grid SHALL update.
3. WHEN the operator clicks the kind filter (All / Imagens / Vídeos) THEN the grid SHALL filter accordingly.
4. WHEN the operator clicks a thumbnail THEN a detail panel/modal SHALL open with: large preview, file name (editable inline), dimensions, duration (videos), byte size, "Renomear", "Excluir", and "Usar como fundo de música…" actions.
5. WHEN the operator clicks "Excluir" THEN a confirmation dialog SHALL appear in pt-BR with the count of dependent references (e.g. "Esta mídia é usada por 3 músicas"). If references exist, the delete is rejected per P2-02 criterion 5.
6. WHEN no media exists (empty library) THEN an empty-state SHALL be shown with a CTA "Adicionar mídia".

---

#### P2-05: Media upload flow

Operator imports media via file dialog or drag-and-drop onto the library screen.

**Acceptance criteria:**
1. WHEN the operator clicks "Adicionar mídia" THEN `tauri-plugin-dialog` SHALL prompt with a multi-select file picker filtered to supported extensions.
2. WHEN the operator drags one or more files onto the library screen THEN the same import flow SHALL run.
3. WHEN multiple files are imported THEN the UI SHALL show per-file progress with success/failure indicators and a final summary toast ("3 importados, 1 ignorado").
4. WHEN a file exceeds 1 GB THEN the operator SHALL receive a confirmation dialog ("Arquivo grande (X MB) — importar mesmo assim?") before the copy begins.
5. WHEN a file with a duplicate `file_name` is imported THEN the system SHALL append a numeric suffix (e.g. `wallpaper (2).jpg`) automatically.
6. WHEN an unsupported container is dropped (MKV, AVI, MOV) THEN the wizard SHALL reject it with a pt-BR error: "Formato não suportado — converta para MP4 ou WebM (sugestão: HandBrake)."

---

### Area C — Media in presentation

#### P2-06: Image set item

Add an image media row as a standalone set item. When advanced to during a presentation, the image fills the presentation window.

**Acceptance criteria:**
1. WHEN the operator drags an image from the media library into the set THEN a `SetItem` of type `media` with `media_kind = 'image'` and `media_id = {uuid}` SHALL be appended.
2. WHEN the runtime advances onto an image set item THEN the presentation window SHALL display the image fullscreen with `object-fit: contain` over a black background.
3. WHEN the image fails to load (missing file, broken thumbnail) THEN the renderer SHALL fall back to pure black (no error overlay during a live service); a console warning is logged.
4. WHEN the operator advances past an image item THEN the runtime SHALL move to the next set item per P2-15.

**Notes:** Image items have exactly one "slide" — Advance from within the item moves to the next set item.

---

#### P2-07: Video set item

Add a video media row as a standalone set item. Plays once or loops based on item config.

**Acceptance criteria:**
1. WHEN the operator drags a video from the media library into the set THEN a `SetItem` of type `media` with `media_kind = 'video'`, `media_id = {uuid}`, and default `loop = false`, `mute = false`, `autoplay = true` SHALL be appended.
2. WHEN the runtime advances onto a video set item THEN the video SHALL begin playback via `<video src="asset://media/{file_name}" autoplay>` with controls hidden, no native browser chrome visible.
3. WHEN `loop = true` THEN the video SHALL loop until Advance is triggered; WHEN `loop = false` THEN reaching the end SHALL automatically advance to the next set item.
4. WHEN the operator triggers Blank while a video plays THEN playback SHALL pause AND the screen SHALL go black; unblanking SHALL resume from the paused position.
5. WHEN the operator presses Space mid-video THEN behavior SHALL match P2-15 (Advance moves to next set item; video does NOT respond to space as play/pause).
6. WHEN editing the set item THEN inline controls SHALL allow toggling `loop`, `mute`, and (for non-loop videos) `auto_advance_on_end`.

**Notes:** Audio handling — videos default to unmuted because they're often worship clips. The operator-window video preview is muted to avoid double audio.

---

#### P2-08: Video backgrounds for lyrics

Extend `songs.background_id` (Phase 1) to accept a video media. The presentation renderer composites lyrics on top of a looping video.

**Acceptance criteria:**
1. WHEN the operator picks a video media in the song editor's "Fundo" picker THEN `songs.background_id` SHALL be set to that media ID; `media_kind` is implicit from the media row.
2. WHEN a song with a video background is presented THEN the presentation window SHALL render the lyrics layer on top of a `<video loop muted autoplay playsinline>` element sourced via `asset://`.
3. WHEN a video background fails to load THEN the renderer SHALL fall back to the global default background (per Phase 1 P1-11 criterion 4) with no error overlay.
4. WHEN the operator wants legibility on a busy video THEN a per-song "scrim opacity" slider (0–100%) SHALL apply a black overlay between the video and the lyrics (default 35%, persisted on the song).
5. WHEN the lyric slides advance within a song THEN the background video SHALL NOT restart — it plays continuously across the whole song.

**Notes:** Video backgrounds must be `loop muted` to avoid surprise audio. The mute is enforced at the renderer regardless of media settings.

---

#### P2-09: CSS transitions between slides and set items

Smooth visual transitions between slides (within an item) and between items (across types).

**Acceptance criteria:**
1. WHEN the runtime advances from one slide to another within the same song THEN the outgoing text SHALL crossfade to the incoming text over 150 ms.
2. WHEN the runtime advances from one set item to a different one THEN a 200 ms crossfade SHALL apply to the entire stage layer (background + content) — the operator does not see a flash of black between items unless the next item's background is also black.
3. WHEN transitions are in flight THEN repeated Advance keypresses SHALL queue (not interrupt) — the next state change applies after the current transition completes (max one queued).
4. WHEN the operator toggles Blank or Freeze THEN transitions SHALL NOT apply — those modes change instantaneously.
5. WHEN settings include a "Reduzir movimento" toggle (accessibility) AND it is ON THEN transitions SHALL be disabled (instant cut everywhere).

---

### Area D — Countdown timer

#### P2-10: Countdown domain + Tokio backend ticker

Single source of truth for countdown state lives in Rust. A Tokio task ticks once per second, emits `countdown_tick` events, and is robust to start/stop/pause/reset.

**Acceptance criteria:**
1. WHEN the Rust crate compiles THEN `domain::countdown::{Countdown, CountdownState}` SHALL exist with camelCase serialization. `CountdownState` includes `mode` (`Idle | Running | Paused | Finished`), `target_epoch_ms`, `remaining_ms`, `message: Option<String>`, `end_behavior: CountdownEndBehavior` (`HoldZero | Blackout | AdvanceSet`).
2. WHEN a countdown is started via `startCountdown(target_epoch_ms, message, end_behavior)` THEN a Tokio task SHALL emit `countdown_tick` at ~1 Hz with the current `remaining_ms`.
3. WHEN the countdown reaches zero THEN the ticker SHALL emit one final tick with `remaining_ms = 0`, set `mode = Finished`, and dispatch the configured `end_behavior` (hold at zero, blank the screen, or auto-advance the set).
4. WHEN the operator calls `pauseCountdown` THEN the ticker SHALL stop emitting and `remaining_ms` SHALL freeze at the current value; resume continues from there.
5. WHEN the operator calls `resetCountdown` THEN `mode = Idle`, `remaining_ms` restored to the configured initial duration, and the next start begins fresh.
6. WHEN drift is measured over a 60-minute countdown on the target hardware THEN total drift SHALL NOT exceed ±100 ms (the ticker computes from `target_epoch_ms - now`, not by accumulating ticks).
7. WHEN the presentation window restarts mid-countdown THEN reconnecting and reading `getCountdownState()` SHALL show the correct `remaining_ms` immediately, without waiting for the next tick.
8. WHEN any countdown mutation occurs THEN the write guard on `AppState.countdown` SHALL be dropped before `app.emit("countdown_tick", …)` (architectural invariant carried over from Phase 1).

**Notes:** Tick rate is 1 Hz (presentation displays seconds precision). Internal `remaining_ms` is computed from wall-clock difference each tick, not decremented — this is the drift-free strategy.

---

#### P2-11: Countdown set item + editor

A `countdown` set item type lets the operator schedule a countdown as part of the service flow (e.g. "Service starts in 10 minutes"). Configured in the set editor.

**Acceptance criteria:**
1. WHEN the operator picks "Adicionar contagem regressiva" in the set builder THEN a `SetItem` of type `countdown` SHALL be appended. Default config: duration = 10 min, message = `"O culto começa em…"`, end behavior = `HoldZero`, background = current global default.
2. WHEN the operator edits a countdown set item THEN inline controls SHALL allow setting: duration (mm:ss or hh:mm:ss), message text (pt-BR/en per current locale), end behavior (radio: hold zero / blank / advance), background media (optional video bg, otherwise solid color).
3. WHEN the runtime advances onto a countdown set item THEN it SHALL automatically `startCountdown` with the item's config; advancing past it SHALL stop the ticker.
4. WHEN the operator triggers Pause while on a countdown item (mapped to `P` key) THEN the countdown SHALL pause/resume.
5. WHEN target time is in the past at start (operator scheduled poorly) THEN the countdown SHALL show `00:00` immediately and trigger the configured end behavior without erroring.

---

#### P2-12: Countdown presentation renderer

Fullscreen renderer for the countdown — large digits, optional background video, optional message.

**Acceptance criteria:**
1. WHEN the presentation window receives `countdown_tick` AND the active set item is countdown THEN large digits SHALL render in `mm:ss` (or `hh:mm:ss` if > 1 hour) centered on screen.
2. WHEN the configured `message` is non-empty THEN it SHALL display above the digits.
3. WHEN a video background is configured THEN it SHALL render behind the digits using the same renderer as P2-08 (loop, muted, scrim).
4. WHEN `remaining_ms <= 0` AND `end_behavior = HoldZero` THEN the screen SHALL continue to show `00:00` until manual advance.
5. WHEN font sizing on a 1080p display would clip the digits at the configured size THEN the renderer SHALL scale digits down to fit (CSS clamp or `vmin`-relative units).

---

### Area E — WebView / IP camera

#### P2-13: WebView set item (dual mode)

A `webview` set item type embeds either an arbitrary URL in a sandboxed iframe OR a single MJPEG-over-HTTP camera stream as an `<img>` element. Operator picks the mode per item.

**Acceptance criteria:**
1. WHEN the operator picks "Adicionar WebView/Câmera" in the set builder THEN a `SetItem` of type `webview` SHALL be appended with a mode picker (`iframe | mjpeg`).
2. WHEN mode = `iframe` THEN the operator SHALL enter a single URL (https only — http rejected with a warning). The renderer uses `<iframe src=… sandbox="allow-scripts allow-same-origin">`.
3. WHEN mode = `mjpeg` THEN the operator SHALL enter a URL (http or https) and optional credentials (basic auth). The renderer uses `<img src={mjpegUrl}>` with object-fit: contain.
4. WHEN the runtime advances onto a webview set item THEN the configured renderer SHALL mount; advancing past it SHALL unmount the renderer (no orphan network connections).
5. WHEN the URL fails to load (timeout 10 s, network error, 4xx/5xx) THEN the renderer SHALL show a black screen with a small pt-BR/en error in the corner ("Não foi possível carregar o conteúdo") — NOT a full error UI that disrupts the service.
6. WHEN the iframe URL is `http://` (not https) THEN the editor SHALL warn but allow saving if the operator confirms (some local cameras are http-only).
7. WHEN the operator triggers Blank while on a webview item THEN the screen SHALL black-out (the iframe/img keeps loading in the background; unblank reveals it instantly).

**Notes:** The CSP additions for asset:// MUST extend to allow `frame-src https: http:` and `img-src http: https:` ONLY for the presentation window — operator window keeps the stricter Phase 1 CSP.

---

#### P2-14: CSP and sandbox rules

Tighten the Content Security Policy so webview items work without weakening the rest of the app's posture.

**Acceptance criteria:**
1. WHEN `tauri.conf.json` is read THEN the presentation window SHALL have a dedicated CSP allowing `frame-src http: https:`, `img-src 'self' asset: data: http: https:`, and `media-src 'self' asset: blob:`.
2. WHEN the operator window loads THEN its CSP SHALL remain Phase 1's stricter policy (no remote framing, no http: image src) — webview items render only on the presentation window.
3. WHEN an iframe attempts to escape its sandbox (popup, top-level navigation) THEN the sandbox attribute SHALL block it; no permission prompt SHALL be shown to the operator.
4. WHEN a webview URL points to internal-LAN cameras (RFC1918 ranges) THEN it SHALL be allowed; no mixed-content blocking applies to the iframe layer.

---

### Area F — Unified set runtime

#### P2-15: Five set item types unified

`SetItemType` reaches its Phase 2 final shape — `Song | Media | Countdown | WebView | Blank`. The runtime, store, and renderer all handle each variant.

**Acceptance criteria:**
1. WHEN the Rust crate compiles THEN `SetItemType` SHALL include all five variants with camelCase serialization (`song | media | countdown | webView | blank`). TS mirror matches.
2. WHEN `domain::set::SetItem` is read THEN each variant SHALL carry the data it needs: `song_id` (song), `media_id + media_kind` (media), inline `CountdownConfig` (countdown), inline `WebViewConfig` (webview), no extra fields (blank).
3. WHEN the runtime is on item type X and Advance is triggered THEN type-specific behavior SHALL apply per the matrix:
   - `song`: advance slide; at last slide → next item
   - `media (image)`: → next item
   - `media (video, loop=false)`: → next item (manual override before auto-advance is allowed)
   - `media (video, loop=true)`: → next item (operator override; loop continues otherwise)
   - `countdown`: → next item (manual override)
   - `webview`: → next item
   - `blank`: → next item
4. WHEN Previous is triggered THEN inverse navigation SHALL apply across all five types.
5. WHEN keyboard shortcut `1`-`9` is pressed THEN jumping to item N SHALL work uniformly regardless of type.

---

#### P2-16: Set editor handles all five types

Set editor UI accepts all five item types and presents an appropriate inline preview.

**Acceptance criteria:**
1. WHEN the operator opens a set in the editor THEN the item list SHALL render each item with a type-specific icon, a one-line summary (song title, media name, countdown duration, webview mode + truncated URL, blank "tela preta"), and reorder handle.
2. WHEN the operator clicks an item THEN an inline detail panel SHALL show the type-specific config (song header for songs, media preview for media, full countdown config for countdown, webview config for webview).
3. WHEN the operator drags items THEN reordering SHALL work uniformly across types (no type-vs-type restrictions).
4. WHEN duplicating an item THEN a "Duplicar" action SHALL copy the item below the original — useful for repeating countdowns or media items.
5. WHEN an item references a deleted song, media row, or invalid URL THEN the item SHALL render with a warning badge ("Referência inválida") and the runtime SHALL treat it as a `blank` item on encounter (no error).

---

### Area G — Backup / restore

#### P2-17: Library ZIP export

Export the entire library to a single `.tlz` (Trinity Lyrics Zip — `.zip` internally, custom extension) including DB rows, settings, and the full `media/` directory.

**Acceptance criteria:**
1. WHEN the operator triggers "Backup > Exportar biblioteca…" THEN a file save dialog SHALL prompt for the output `.tlz` path.
2. WHEN export runs THEN the archive SHALL contain: `manifest.json` (schema version, export date, app version, song/set/media counts), `data/songs.json`, `data/sections.json`, `data/sets.json`, `data/set_items.json`, `data/media.json`, `data/settings.json`, and `media/{file_name}` for every non-deleted media row.
3. WHEN the export writes the JSON files THEN they SHALL be derived from the live DB at a single snapshot (transaction-consistent read) — no torn state.
4. WHEN the archive is being written THEN progress SHALL be reported to the UI (percent complete, current file).
5. WHEN export completes THEN the UI SHALL show a summary toast with file path and total size; no further action required.
6. WHEN the export target path is invalid or write fails THEN a pt-BR error SHALL surface and any partial file SHALL be removed.
7. WHEN `cargo test` runs THEN an integration test SHALL export a fixture DB and assert the archive contains all expected entries with correct manifest contents.

**Notes:** Custom extension `.tlz` so Windows can be configured to open with Trinity Lyrics for one-click restore. ZIP compression level defaults to DEFLATE level 6 — balances size and CPU.

---

#### P2-18: Library ZIP import (restore)

Restore from a `.tlz` archive. Two modes — Replace (wipe current library and import) or Merge (keep existing, add only IDs not already present). Default is Replace because the typical use case is fresh-install restore.

**Acceptance criteria:**
1. WHEN the operator triggers "Backup > Importar biblioteca…" THEN a file open dialog SHALL accept `.tlz` files.
2. WHEN the archive parses THEN the operator SHALL see a summary screen — manifest fields (export date, source app version, item counts) — and pick mode: Substituir tudo (Replace) or Mesclar (Merge).
3. WHEN mode = Replace AND the operator confirms via a typed-confirmation dialog ("Digite SUBSTITUIR para continuar") THEN the existing library SHALL be wiped (soft-deleted rows hard-deleted, media files purged) and the archive contents SHALL replace it.
4. WHEN mode = Merge THEN every row whose ID does NOT already exist SHALL be inserted; existing IDs are skipped (no overwrite). Media files are copied into `media_dir` only if the destination file does not already exist.
5. WHEN restore completes THEN a summary SHALL show counts of imported / skipped / failed for each table type, plus a total elapsed time.
6. WHEN the archive's `manifest.json` schema version is newer than the app supports THEN restore SHALL refuse with a pt-BR error suggesting the operator update Trinity Lyrics.
7. WHEN restore is interrupted (mid-copy crash, disk full) THEN on next launch the app SHALL detect a partial restore (manifest flag file `.restore_in_progress`) and refuse to start until the operator either retries or aborts (cleanup procedure).
8. WHEN `cargo test` runs THEN integration tests SHALL cover: round-trip (export → import in fresh DB), merge with overlapping IDs, schema-version-mismatch refusal.

**Notes:** "Replace" is destructive — the typed-confirmation gate is mandatory. No accidental clobbering.

---

### Area H — Internationalization

#### P2-19: i18next setup + locale extraction

Introduce `react-i18next`, extract every user-facing pt-BR string from existing components to `locales/pt-BR.json`, and add an equivalent `locales/en-US.json`. No string remains hard-coded in components.

**Acceptance criteria:**
1. WHEN `i18next` and `react-i18next` are added to `package.json` THEN they SHALL be configured at app entry with `pt-BR` as default and `en-US` as the alternate.
2. WHEN every existing UI component is read THEN no Portuguese (or English) literal SHALL be present in JSX — all strings SHALL come through `t('key.path')`.
3. WHEN locale JSON files are read THEN every key referenced from a component SHALL exist in BOTH `pt-BR.json` and `en-US.json`; a missing-key check SHALL run in CI (or at least as a pre-commit lint).
4. WHEN backend errors surface to the UI THEN their message keys (not pre-translated strings) SHALL be carried in `Result<T, ErrorPayload>` where `ErrorPayload { code: String, params: Record<String, String> }`. The frontend translates with the current locale.
5. WHEN dates and numbers are formatted THEN `Intl.DateTimeFormat` / `Intl.NumberFormat` SHALL be called with the current locale string ("pt-BR" or "en-US").

**Notes:** Backend error strings shift from "pt-BR sentences" (Phase 1) to structured codes + params. Phase 1's existing error sentences become the pt-BR translation of those codes. This is a larger refactor than it sounds — flagged in design.

---

#### P2-20: Language picker in settings

A "Idioma" dropdown in Settings lets the operator switch locale. Persists across restarts.

**Acceptance criteria:**
1. WHEN the operator opens "Configurações > Geral" THEN they SHALL see a "Idioma" dropdown with `Português (Brasil)` and `English` options, defaulting to the current persisted value (or system locale on first run, falling back to pt-BR).
2. WHEN the operator changes the value THEN the UI SHALL re-render in the new locale instantly (no app restart required) and the value SHALL persist via the `settings` table (key `app.locale`).
3. WHEN the presentation window is open and the locale changes THEN it SHALL re-render in the new locale on the next state event (no flash of mixed languages).
4. WHEN the locale is en-US THEN dates SHALL use US formatting (`MM/DD/YYYY`); when pt-BR, BR formatting (`DD/MM/YYYY`).
5. WHEN a translation key is missing in the active locale THEN the renderer SHALL fall back to the pt-BR string (never the raw key) and log a console warning.

---

## Edge Cases

Captured as forward-looking acceptance criteria — these are recurring failure modes the spec addresses.

- WHEN the operator imports a 4K video larger than the screen resolution THEN the renderer SHALL still scale it correctly with `object-fit: contain`; no crash, no overflow.
- WHEN the operator imports a corrupt MP4 (truncated download) THEN metadata probe SHALL fail; the import SHALL be rejected with a pt-BR error; the partially-copied file SHALL be removed from `media_dir`.
- WHEN a video set item with `loop = false` is paused (via Blank) and then unblanked after the file's natural end time WHEN computed from playback SHALL hold the last frame, not auto-advance.
- WHEN the operator deletes a media file that is in use by a song background THEN delete is blocked (per P2-02 criterion 5); the operator must first detach the background or replace it.
- WHEN the countdown target is in the past on start (e.g. operator forgot to update next week's set) THEN it SHALL render `00:00` and trigger end_behavior; no negative time displayed.
- WHEN the operator presses Pause (`P`) outside of a countdown item THEN it SHALL be a no-op (not an error).
- WHEN the WebView URL is unreachable for the full duration the item is active THEN the renderer SHALL stay on the "Não foi possível carregar" message; advancing past the item SHALL still work normally.
- WHEN the MJPEG stream sends a malformed boundary mid-stream THEN the `<img>` may freeze on the last good frame; advancing past the item resolves it.
- WHEN backup is triggered with 50+ GB of media THEN the export SHALL still complete (no in-memory buffering of the whole archive); writes stream chunk-by-chunk to disk.
- WHEN restore encounters a media file in the archive that does NOT match its `media.json` row (mismatched size or missing) THEN the row SHALL be skipped and counted in "falhou"; restore continues.
- WHEN the operator switches locale during a live presentation THEN the operator window updates immediately, but presentation slides already rendered SHALL retain their current text until the next state change (avoids mid-service flicker).
- WHEN any en-US translation is missing THEN the app falls back to pt-BR for that string (per P2-20 criterion 5) — never renders a raw key like `setEditor.add.song`.
- WHEN two media imports run concurrently THEN UUIDs prevent file-name collision; the database transaction prevents partial rows.

---

## Requirement Traceability

| ID | Area | Phase | Status |
|---|---|---|---|
| P2-01 | A — Media foundation: domain + schema | Design | Pending |
| P2-02 | A — Media foundation: CRUD commands | Design | Pending |
| P2-03 | A — Media foundation: video thumbnails | Design | Pending |
| P2-04 | B — Media library: browse screen | Design | Pending |
| P2-05 | B — Media library: upload flow | Design | Pending |
| P2-06 | C — Media presentation: image set item | Design | Pending |
| P2-07 | C — Media presentation: video set item | Design | Pending |
| P2-08 | C — Media presentation: video backgrounds | Design | Pending |
| P2-09 | C — Media presentation: CSS transitions | Design | Pending |
| P2-10 | D — Countdown: domain + Tokio ticker | Design | Pending |
| P2-11 | D — Countdown: set item + editor | Design | Pending |
| P2-12 | D — Countdown: presentation renderer | Design | Pending |
| P2-13 | E — WebView: set item (dual mode) | Design | Pending |
| P2-14 | E — WebView: CSP + sandbox rules | Design | Pending |
| P2-15 | F — Set runtime: five item types unified | Design | Pending |
| P2-16 | F — Set runtime: editor handles all types | Design | Pending |
| P2-17 | G — Backup: ZIP export | Design | Pending |
| P2-18 | G — Backup: ZIP restore (replace + merge) | Design | Pending |
| P2-19 | H — i18n: setup + locale extraction | Design | Pending |
| P2-20 | H — i18n: language picker | Design | Pending |

**Coverage:** 20 total, 0 mapped to tasks yet, 20 pending design.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

---

## Success Criteria

Phase 2 is done when ALL of the following are true:

- [ ] A real Sunday-service set composed of all five item types (countdown → song with video bg → image → song → webview camera → blank → song) runs end-to-end on real hardware with the second monitor, no Holyrics fallback.
- [ ] Operator can browse, upload, rename, and delete media via the library UI; video thumbnails render correctly.
- [ ] Lyric song with a looped video background plays for ≥10 minutes with no visible restart of the background loop.
- [ ] Countdown drives a 30-minute pre-service timer with no drift > ±100 ms vs. wall clock; pause/resume/reset all work.
- [ ] A `.tlz` exported from machine A imports cleanly on a fresh install on machine B; round-trip preserves every song, set, media file, and setting.
- [ ] Locale switch between pt-BR and en-US is instant in both windows; no English string is hardcoded outside locale files.
- [ ] `cargo test` and `npx vitest run` both pass green; `tsc --noEmit` is clean; the app runs through a 4-week feedback period in real services before Phase 3 begins.

---

## Decisions still open (candidates for Discuss / Design)

These are gray areas with proposed defaults that the user should confirm or redirect before design begins:

1. **Video thumbnail strategy** (P2-03): proposed three options (`video-rs` crate / spawn ffmpeg / placeholder). Bundling ffmpeg adds ~30 MB to installer (versus PROJECT.md's < 15 MB goal). `video-rs` is pure-Rust but pulls heavy native deps. Placeholder-only is cheap but ugly. Design picks one — flagged here so the operator (you) can weigh installer size vs. UX.
2. **`.tlz` extension vs. plain `.zip`** (P2-17): custom extension enables file-association double-click restore on Windows, but a plain `.zip` is more universally inspectable. Proposed `.tlz`; alternative is `.zip` with a known internal manifest signature.
3. **Replace vs. Merge as default restore mode** (P2-18): proposed Replace (typical fresh-install use case). Alternative: Merge (safer for an operator who clicks the wrong button). Replace + typed-confirmation feels right but worth flagging.
4. **Backend error structure refactor** (P2-19): Phase 1 emits pt-BR sentences in `Result<T, String>`. Phase 2 needs structured `{ code, params }`. This is technically backward-incompatible — every command signature changes. Flag here so the design phase plans the migration carefully (can be done command-by-command with a transitional error type).
5. **Video background scrim default** (P2-08): proposed 35%. Worth testing on real worship backgrounds during design — may need to be per-background-image as a follow-up.
6. **WebView sandbox flags** (P2-13): `allow-scripts allow-same-origin` permits most camera UIs and embeds but also widens attack surface. Alternative: `allow-scripts` only (blocks same-origin storage, breaks some camera UIs). Confirm — depends on which real cameras you want to support.
7. **Loop control for video set items** (P2-07): proposed per-item `loop` flag. Alternative: rely on `loop = true` only for "looping background" semantics and disallow standalone looping videos (force operator to use a background instead). Proposed flexibility wins unless you'd rather constrain.
8. **`auto_advance_on_end` for non-loop videos** (P2-07): proposed default = true (matches Holyrics). Alternative: default false (operator must explicitly advance — safer in a live service). Lean toward true; flag for confirmation.

---
