# Plan: Presentation sync fix, Linux compat, paste-lyrics, per-song text casing

## Context

Four items for Trinity Lyrics v2 (Tauri 2.x, Rust + React/TS, SQLite):

1. **Presentation not updating** — the operator changes slides and Rust *does* emit
   `state_changed` with the full state, but the **presentation window screen** stays stale.
2. **Linux cross-platform** — developer just switched to Linux; produce a compatibility
   report plus low-risk fixes.
3. **Paste full lyrics** — a textarea where each blank-line-separated block becomes a
   strophe/section, for fast song creation.
4. **Per-song text casing** — a select + button to display lyrics as
   Normal / UPPERCASE / lowercase / Title Case, stored per song.

Confirmed decisions: casing is **per-song, stored in DB**, options **Normal/UPPER/lower/Title**;
paste **replaces all sections**; Linux item is **research doc + safe fixes**.

---

## Item 1 — Presentation window not reflecting state changes

### Root cause analysis

The Rust side is correct: `emit_state` in `src-tauri/src/commands/presentation.rs:88` sends the
**full** `PresentationState`, drops the write lock first, and `PresentationState` serializes as
camelCase (`domain/presentation.rs:29`). The frontend listener (`src/api/commands.ts:410`) and the
renderer (`src/windows/presentation/PresentationApp.tsx:144-273`) are also individually correct.
The break is in **subscription lifecycle**, with a second confirmed bug in overlays:

**Bug A — StrictMode async-guard race in the store (primary cause).**
`src/stores/presentation.ts:27-45`: `subscribe()` guards with `isSubscribed` and returns a no-op
when already subscribed; the cleanup is `async` and flips `isSubscribed=false` *then* unlistens.
Under React 18 `StrictMode` (active via `src/main.tsx:42`, and the app runs in `tauri dev`), the
mount→unmount→remount sequence interleaves so that: the 2nd mount calls `subscribe()` while
`isSubscribed` is still `true` (cleanup microtask hasn't run) → gets the no-op and registers **no**
listener; then the 1st cleanup microtask runs and unlistens the only real listener. Net result:
the presentation window has **no active `state_changed` listener**, so it shows the initial
hydrated slide and never updates. The operator window appears fine because it also sets state
directly from each command's return value (`next/prev/jumpToItem`), masking the same race.

**Bug B — overlay commands emit an empty payload (confirmed).**
`src-tauri/src/commands/overlay.rs` lines ~16/31/46/60 call `app.emit("state_changed", ())`
instead of the full state. When any overlay command fires, the presentation store does
`set({ state: null })`, blanking the screen until the next full-state emit. (`exit_presentation`
in `window.rs:226` already does it correctly — read back the snapshot and emit it.)

### Fix

- **Store subscription** (`src/stores/presentation.ts`): make the listener registration robust so a
  listener always remains active. Preferred approach: register the long-lived listeners **once at
  app startup** for the window's lifetime instead of inside a StrictMode-double-invoked effect.
  Concretely, keep a module-level `unlisten` ref; `subscribe()` registers the real listener exactly
  once and **never returns a no-op that can strand the listener**, and the React effect does not
  tear it down on unmount (windows live for the whole app session). Apply the same shape to
  `src/stores/countdown.ts` if it shares the pattern. Verify `PresentationApp.tsx:100-134` and
  `OperatorApp.tsx` cleanup no longer unlistens prematurely.
- **Overlay commands** (`src-tauri/src/commands/overlay.rs`): in all four commands, after mutating
  state, read back `state.presentation.read().await.clone()` (lock dropped) and
  `app.emit("state_changed", &snapshot)` — mirroring `exit_presentation` (`window.rs:226-228`).

### Verify
- `npm run tauri dev`, load a set, enter presentation on a 2nd monitor (or windowed), press
  Next/Prev on the operator → presentation screen advances in lockstep.
- Trigger an announcement/media/webview overlay → presentation shows the overlay (not black),
  then clear → returns to the slide.
- `cargo test --manifest-path src-tauri/Cargo.toml` and `npx vitest` stay green.

---

## Item 2 — Linux cross-platform compatibility (research doc + safe fixes)

Deliverable `docs/linux-compat.md` documenting risks + the fixes below.

### Safe code fixes
- **LibreOffice path** (`src-tauri/src/services/libreoffice.rs:10-41`): the bundled check is
  hardcoded to `soffice.exe` and PATH probe only tries `soffice`. Add Linux-aware resolution:
  bundled binary name via `#[cfg(windows)]` (`soffice.exe`) vs other (`soffice`), and after the
  `soffice` PATH probe, fall back to probing **`libreoffice`** (common on Debian/Ubuntu where
  `soffice` may be absent). Keep `SOFFICE_PATH` override. Add a unit test for the non-Windows name.
- **DB path comment** (`src-tauri/src/db/mod.rs:11-12`): correct the misleading `%APPDATA%`-only
  comment to note the platform-specific `app_data_dir()` locations (already correct at runtime).

### Documented (no code change unless trivial)
- **WebView codecs**: Windows uses WebView2 (H.264 MP4 OK); Linux uses WebKitGTK and needs system
  GStreamer plugins — H.264 MP4 may not play. Document: install `gstreamer1.0-libav` +
  `gstreamer1.0-plugins-{good,bad}`, and **prefer WebM/VP9** on Linux. Video is played in
  `src/components/presentation/MediaSlideRenderer.tsx` and `SongBackground.tsx`.
- **Build prerequisites (Linux)**: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `librsvg2-dev`,
  `build-essential`, plus the GStreamer plugins above; runtime `ffmpeg`/`ffprobe` and LibreOffice.
- **Monitor ordering** (`src-tauri/src/commands/window.rs:146-184`): note `available_monitors()`
  ordering varies on X11/Wayland; must be tested on real dual-monitor hardware.
- **asset:// protocol** (`src-tauri/src/protocol/asset.rs`): note the `http://asset.localhost/...`
  scheme is Tauri-normalized; verify media loads under WebKitGTK on Linux.
- **ffmpeg/ffprobe** (`media_probe.rs`, `thumbnail.rs`) resolve from PATH with `FFMPEG_PATH`/
  `FFPROBE_PATH` overrides — document install + that `check_ffprobe`/`check_libreoffice` should be
  called before import.

### Verify
`cargo test` green; manual: import a PPTX on Linux with only `libreoffice` in PATH (not `soffice`)
→ conversion still works; doc reviewed.

---

## Item 3 — Paste full lyrics (blank line = strophe), replace all sections

Reuse the existing, tested parser — **no new parsing logic, no DB/migration**.

- Backend already exposes `parse_plain_text_import` (`src-tauri/src/commands/song.rs`), wrapping
  `services::text_import::parse_plain_text` which splits on blank lines into sections and recognizes
  `[Refrão]`/`[Ponte]`/etc. labels. Frontend wrapper exists: `parsePlainTextImport` in
  `src/api/commands.ts`, returning `ParsedTextSection[]` (`src/types/index.ts`).
- **UI** (`src/components/library/SongEditor.tsx`): add a **"Colar letra completa"** button near
  the existing **"+ Add Section"** control (~line 612). It opens a textarea (modal or inline panel).
  On confirm: call `parsePlainTextImport(text)`, map results to `SectionDraft[]` via the existing
  `newSection`/draft shape (`SongEditor.tsx:260`, attach `dndId: nextDndId()`), and **replace**
  `sections` state. Show a confirm if there are existing non-empty sections (since this replaces).
- i18n: add the button/dialog strings to the locale files used by `useTranslation()`.

### Verify
`npx vitest` (mirror `PlainTextImport.test.tsx` style); manual: open editor, paste a multi-strophe
song with blank lines, confirm → one section per block, labels auto-assigned; Save → slides split
correctly in presentation.

---

## Item 4 — Per-song text casing (Normal / UPPERCASE / lowercase / Title Case)

Casing is applied during **slide generation in Rust** (honoring the invariant "all slide generation
is pure Rust"), so it always renders regardless of whether a song has a background/typography.

### Backend
- **Migration** `src-tauri/migrations/008_text_casing.sql` (mirror `007`): 
  `ALTER TABLE songs ADD COLUMN text_casing TEXT;` and the same on `song_sections`
  (section override optional; song-level is the requirement). Values: `normal`/`upper`/`lower`/`title`,
  NULL = normal.
- **Domain** (`src-tauri/src/domain/song.rs`): add `text_casing: Option<String>` to `Song` and
  `SongSection`. Add a `TextCasing` enum + `apply(&str) -> String` helper (Title Case = capitalize
  each whitespace-separated word; keep it ASCII-simple, Unicode-aware via `char` iteration).
- **Slide splitter** (`src-tauri/src/services/slide_splitter.rs`): add a `casing: TextCasing`
  parameter to `split()` and transform each display line after wrapping. Update callers.
- **Presentation builder** (`src-tauri/src/commands/presentation.rs:22-30` `sections_to_slides` and
  `load_set_for_presentation`): compute **effective casing = `section.text_casing` ?? song default**
  and pass it into `split()`. Fetch the song's `text_casing` alongside sections (extend
  `load_sections` or a small query) so the song-level default is available.
- **Commands/payloads** (`src-tauri/src/commands/song.rs`): add `text_casing` to `CreateSongPayload`
  + `SectionPayload`, and to the INSERT/SELECT/UPDATE for songs and sections.

### Frontend
- **Types** (`src/types/index.ts`): add `TextCasing = 'normal'|'upper'|'lower'|'title'`; add
  `textCasing?` to `Song`/`SongSection`. Add `textCasing?` to `CreateSongPayload`/`SectionPayload`
  in `src/api/commands.ts`.
- **Editor** (`src/components/library/SongEditor.tsx`): add a labeled **select** (the four options)
  in the song settings area (near the background/typography/`BackgroundEditor` block), included in
  the save payload. The "button" is the existing Save (the select applies on save); no separate
  apply round-trip needed since slides regenerate from the stored value on next presentation load.
- No presentation-renderer change required (text arrives already-cased in `slide.lines`).

### Verify
- Rust unit tests for `TextCasing::apply` (upper/lower/title/normal incl. accented chars) and a
  `slide_splitter` test asserting cased output.
- `npx vitest` for the editor select round-trip.
- Manual: set a song to UPPERCASE, present → slides render uppercase; switch to Title Case, reload
  set → updates. A second song left Normal is unaffected.

---

## Suggested sequencing
1. Item 1 (sync fix) — highest impact, smallest change.
2. Item 4 (casing) — migration + slide-gen + editor.
3. Item 3 (paste) — pure frontend, reuses parser.
4. Item 2 (Linux doc + fixes) — alongside, low risk.

Each lands as its own atomic commit; run `cargo test` + `npx vitest` before each.
