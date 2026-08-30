# TDD - Trinity Lyrics v2

| Field          | Value                                                   |
| -------------- | ------------------------------------------------------- |
| Tech Lead      | @vinicius.braz                                          |
| Team           | Solo                                                    |
| Epic / Ticket  | —                                                       |
| Reference      | `docs/TDD.md` (v1 — Kotlin + Compose Multiplatform)    |
| Stack          | Rust + Tauri v2 + React + TypeScript                    |
| Status         | Proposed                                                |
| Created        | 2026-05-18                                              |
| Last Updated   | 2026-05-18                                              |

---

## Context

Trinity Lyrics is a Windows desktop application for church liturgical presentation. It manages a local library of song lyrics, organizes them into service sets, and drives a second monitor (projector/TV) with a fullscreen presentation window. The operator sees a control console; the congregation sees the projection.

Trinity Lyrics v1 was designed around Kotlin + Compose Multiplatform Desktop. That stack delivers a correct product but carries three structural costs: a JVM startup penalty (~3 s on HDD), a large installer (~120 MB driven by JCEF), and ~300 MB idle memory consumption. All three are attributable to the JVM and the bundled Chromium (JCEF) runtime.

v2 re-targets the **same product** — same UX, same features, same data model — on Rust + Tauri v2. Tauri provides a native Rust backend and uses the operating system's WebView (WebView2 on Windows 10/11, the Edge/Chromium engine already installed on every Windows 10 1803+ machine). The result: no bundled JVM, no bundled Chromium, dramatically smaller installer, and near-instant startup.

**Decision context:** The user evaluated Tauri in the original design session and chose Kotlin at that time. This document re-examines the tradeoffs with Tauri v2 (stable since October 2024) as a complete alternative.

---

## Problem Statement & Motivation

### Problems Being Solved

- **JVM startup penalty (~3 s on HDD):** Every service starts with a 3-second wait before the volunteer can do anything. On older hardware this stretches further.
  - Impact: Friction and anxiety for non-technical volunteers setting up before service.

- **Excessive installer size (~120 MB):** The installer bundles both a JVM and JCEF (a full Chromium distribution). This is disproportionate for a church utility.
  - Impact: Slow downloads on typical church network connections; perception of heavyweight software.

- **High idle memory (~300 MB):** JVM + JCEF overhead occupies significant memory even when not actively presenting.
  - Impact: Conflicts with other software running on the same machine (audio/visual tools, streaming software).

- **Unnecessary runtime dependency:** The JVM is not pre-installed on Windows. Users must install it separately or rely on the bundled JVM.
  - Impact: Installation complexity; version conflicts if machine already has a JVM.

### Why Now?

- Tauri v2 reached stable in October 2024 — mature enough for a production application.
- WebView2 is universally pre-installed on Windows 10 1803+ and Windows 11, eliminating the runtime bundling problem entirely.
- v1 validated the product concept; it is the right time to optimize the platform before the feature set grows further.

### Impact of NOT Solving

- **Technical:** v1's performance profile becomes the permanent baseline; future features compound the JVM overhead.
- **Volunteer experience:** Continued startup friction; one more barrier for hesitant non-technical volunteers.
- **Distribution:** A 120 MB installer grows larger with each feature cycle.

---

## Scope

### ✅ In Scope — MVP (Phase 1, ~6 weeks)

- Full song CRUD: create, edit, delete, tag, full-text search (FTS5)
- Section editor with drag-to-reorder (verse, chorus, bridge, etc.)
- Set builder: create named service sets, add songs, drag-to-reorder items
- Holyrics import wizard (JSON format)
- Plain-text import (`[Verse 1]` / `[Chorus]` format)
- Lyrics presentation with dual-monitor support
- Keyboard-first navigation: Space, arrows, B (blank), F (freeze), Esc, 1–9
- Solid color and static image slide backgrounds
- Font, size, color, and alignment settings
- Target monitor picker with preview
- Portuguese UI strings

### ✅ In Scope — V1 (Phase 2, ~6 weeks)

- Media library: import, thumbnail, organize images and MP4/WebM video
- Video backgrounds for lyrics slides
- Countdown timer with configurable end-action and color thresholds
- Web / IP camera viewer (`<iframe>` / `<img>` MJPEG in presentation window)
- Full set item types: song, media, countdown, webview, blank
- Library ZIP backup and restore
- Portuguese + English language option

### ❌ Out of Scope — MVP / V1

- Cloud storage or multi-device sync
- PPTX / slide rendering (deferred to Phase 3)
- RTSP camera streaming (HTTP cameras only)
- CCLI license reporting
- Multi-user collaboration or shared libraries
- Live streaming integration
- Audio mixing or video editing
- Mobile or web deployment

### 🔮 Future — Phase 3+

- PPTX rendering via LibreOffice CLI → slide images
- Per-section background overrides
- Presenter notes (operator-only per-slide panel)
- Keyboard shortcut customization (JSON config)
- Service report / CCLI prep export
- Auto-update (Tauri updater plugin)
- Dark/light UI theme toggle

---

## Technical Solution

### Technology Stack

| Layer              | Technology                                        | Version  |
| ------------------ | ------------------------------------------------- | -------- |
| Backend language   | Rust                                              | 1.82+    |
| Desktop shell      | Tauri                                             | 2.x      |
| Async runtime      | Tokio                                             | 1.x      |
| Serialization      | serde + serde_json                                | 1.x      |
| Database           | SQLite via sqlx                                   | 0.8.x    |
| Migrations         | sqlx migrate (built-in)                           | 0.8.x    |
| Frontend language  | TypeScript                                        | 5.x      |
| Frontend framework | React                                             | 18.x     |
| Build tool         | Vite                                              | 6.x      |
| CSS                | Tailwind CSS                                      | v4       |
| Frontend state     | Zustand                                           | 5.x      |
| HTTP client (Rust) | reqwest                                           | 0.12.x   |
| Video              | WebView2 HTML5 (MP4/WebM) + optional VLC fallback | —        |
| Testing (Rust)     | Rust built-in + tokio-test                        | —        |
| Testing (frontend) | Vitest + Testing Library                          | 2.x      |
| UI icons           | Lucide React                                      | latest   |
| Drag-and-drop      | dnd-kit                                           | 6.x      |

### Rationale: Tauri v2 vs. Kotlin + CMP

| Concern               | Kotlin + CMP (v1)           | Rust + Tauri v2                   |
| --------------------- | --------------------------- | --------------------------------- |
| Installer size        | ~120 MB (JCEF)              | ~12 MB (WebView2 is OS-provided)  |
| Cold startup          | ~3 s (JVM warmup)           | ~0.5 s                            |
| Idle memory           | ~300 MB                     | ~60–80 MB                         |
| Video codecs          | VLCJ (any VLC codec)        | H.264/WebM natively; VLC optional |
| WebView               | JCEF (bundled, ~80 MB)      | WebView2 (system Edge, 0 MB)      |
| IP cameras            | JCEF WebView                | Native HTML `<img>` / `<iframe>`  |
| Two-window IPC        | Zero (same JVM)             | ~1–2 ms (Tauri event)             |
| State sharing         | StateFlow singleton         | Arc\<RwLock\> + Tauri events      |

**WebView2 availability:** Windows 10 1803+ and Windows 11 ship WebView2 as a system component (like .NET). Every target machine already has it — no download, no bundling.

**IPC latency:** Tauri command round-trips average 1–2 ms on Windows. Slide advance latency (operator key → presentation update) is ~3–5 ms total — well under the 16 ms frame budget.

**Video strategy:** WebView2 (Edge engine) natively plays MP4 (H.264 + AAC) and WebM (VP8/VP9). Church video backgrounds are almost universally MP4. MKV/AVI are detected at import time and rejected with guidance.

---

## Architecture Overview

### Two-Window + Rust Backend

```
Tauri Process (Rust)
│
├── AppState (Arc<RwLock<PresentationState>>)   ← single source of truth
├── Database pool (sqlx SQLite)
├── Tauri command handlers
│     ├── presentation: advance_slide, toggle_blank, load_song, …
│     ├── library: search_songs, create_song, update_song, delete_song, …
│     ├── sets: create_set, add_item, reorder_items, …
│     ├── media: import_media, list_media, delete_media, …
│     ├── settings: get_setting, set_setting, list_monitors, …
│     └── import: parse_holyrics, parse_plain_text, confirm_import, …
│
├── WebviewWindow "operator" (primary monitor)
│     ├── React: library, set builder, presentation controls
│     ├── Listens: "state_changed" Tauri event
│     └── Invokes: Tauri commands on user action
│
└── WebviewWindow "presentation" (secondary monitor / projector)
      ├── React: slides, media, countdown, camera view
      ├── Listens: "state_changed" Tauri event
      └── Read-only: never invokes mutating commands
```

### Data Flow: Operator Advances Slide

```
Operator presses Space
  → React keydown handler in operator window
  → invoke("advance_slide")                   [Tauri IPC, ~1 ms]
  → Rust handler: state.write().advance()
  → app_handle.emit("state_changed", new_state)
  → Both windows: listen("state_changed") → Zustand store.setState()
  → React re-renders                          [~3–5 ms total]
```

**Core design principle:** The Rust `AppState.presentation` is the single source of truth. Frontend Zustand stores are projections. No window ever has stale state from its own mutations — all mutations go through Rust.

### Rust Backend Module Boundaries

```
src-tauri/src/
  lib.rs               — Tauri app setup, command registration, state init
  state.rs             — AppState struct, Arc<RwLock<PresentationState>>

  domain/
    song.rs            — Song, SongSection, SectionType, SlideConfig
    set.rs             — ServiceSet, SetItem, SetItemType
    presentation.rs    — PresentationState sealed enum
    media.rs           — MediaItem, MediaType
    slide.rs           — Slide, slide splitter algorithm
    countdown.rs       — CountdownConfig, CountdownEndAction

  db/
    mod.rs             — Pool<Sqlite> initialization, migration runner
    songs.rs           — song CRUD queries
    sets.rs            — set CRUD queries
    media.rs           — media record queries
    settings.rs        — key-value settings queries
    fts.rs             — FTS5 search query
    migrations/
      001_initial.sql

  commands/
    presentation.rs    — advance_slide, previous_slide, load_song, toggle_blank, …
    library.rs         — search_songs, create_song, update_song, delete_song, …
    sets.rs            — create_set, get_set, add_set_item, reorder_set_items, …
    media.rs           — import_media, list_media, generate_thumbnail, …
    settings.rs        — get_setting, set_setting, list_monitors, …
    import.rs          — parse_holyrics, parse_plain_text, confirm_import, …
    window.rs          — open_presentation_window, close_presentation_window, …

  services/
    slide_splitter.rs  — pure fn: split section body → Vec<Slide>
    countdown.rs       — countdown tick logic, Tokio interval task
    media_scanner.rs   — watched folder auto-sync
    thumbnail.rs       — image resize (image crate) and video frame extract
    holyrics_parser.rs — JSON deserializer for Holyrics export format

  protocol/
    asset.rs           — custom "asset://" protocol to serve local media files
```

### React Frontend Module Boundaries

```
src/
  main.tsx             — entry point; checks window label to mount correct view

  windows/
    operator/          — OperatorApp.tsx: library + set builder + controls
    presentation/      — PresentationApp.tsx: slide/media/countdown renderer

  components/
    library/           — SongList, SongEditor, TagBadge, SearchBar, SectionEditor
    setbuilder/        — SetList, SetItemCard (dnd-kit sortable), SetQueue
    presentation/      — SlideNavigator, CurrentSlidePreview, NextSlidePreview
    media/             — MediaGrid, MediaImportDialog, VideoPlayer
    countdown/         — CountdownDisplay, CountdownConfig
    settings/          — MonitorPicker, FontSettings, SlideLayoutSettings
    import/            — HolyricsImportWizard, ImportPreview
    common/            — Button, Dialog, Input, Tag, Spinner, EmptyState

  slides/              — fullscreen slide renderers (presentation window)
    LyricsSlide.tsx
    MediaSlide.tsx
    CountdownSlide.tsx
    WebViewSlide.tsx
    BlankSlide.tsx

  stores/
    presentationStore.ts   — Zustand: current PresentationState (event-driven)
    libraryStore.ts        — Zustand: song list, search results
    setStore.ts            — Zustand: current service set
    settingsStore.ts       — Zustand: app settings

  api/
    commands.ts        — typed invoke() wrappers for all Tauri commands
    events.ts          — typed listen() wrappers for all Tauri events

  hooks/
    useKeyboardShortcuts.ts
    usePresentationState.ts
    useCountdownTick.ts
```

---

## IPC Contract

All cross-boundary communication between the frontend and Rust backend uses Tauri commands (frontend → Rust) and Tauri events (Rust → frontend). No raw `invoke()` calls outside `src/api/commands.ts`.

### Tauri Commands

| Command                    | Parameters                              | Returns         | Description                              |
| -------------------------- | --------------------------------------- | --------------- | ---------------------------------------- |
| `advance_slide`            | —                                       | `void`          | Move to next slide in current song       |
| `previous_slide`           | —                                       | `void`          | Move to previous slide                   |
| `toggle_blank`             | —                                       | `void`          | Toggle blank screen on/off               |
| `toggle_freeze`            | —                                       | `void`          | Freeze/unfreeze the presentation display |
| `load_song`                | `song_id: string, config: SlideConfig`  | `void`          | Load a song into presentation state      |
| `stop_presentation`        | —                                       | `void`          | Return to Idle state                     |
| `jump_to_slide`            | `index: number`                         | `void`          | Jump to slide by absolute index          |
| `search_songs`             | `query: string`                         | `Song[]`        | Full-text search in library              |
| `create_song`              | `data: CreateSongDto`                   | `Song`          | Create new song                          |
| `update_song`              | `id: string, data: UpdateSongDto`       | `Song`          | Update existing song                     |
| `delete_song`              | `id: string`                            | `void`          | Soft-delete song (sets deleted_at)       |
| `create_set`               | `data: CreateSetDto`                    | `ServiceSet`    | Create new service set                   |
| `get_set`                  | `id: string`                            | `ServiceSet`    | Get set with all items                   |
| `add_set_item`             | `set_id: string, item: SetItemDto`      | `SetItem`       | Add item to set                          |
| `reorder_set_items`        | `set_id: string, ordered_ids: string[]` | `void`          | Reorder set items                        |
| `import_media`             | `path: string`                          | `MediaItem`     | Import file into media library           |
| `list_media`               | —                                       | `MediaItem[]`   | List all media items                     |
| `get_setting`              | `key: string`                           | `string \| null`| Get a setting value                      |
| `set_setting`              | `key: string, value: string`            | `void`          | Persist a setting                        |
| `list_monitors`            | —                                       | `MonitorInfo[]` | List available monitors with resolution  |
| `open_presentation_window` | `monitor_index: number`                 | `void`          | Open fullscreen window on target monitor |
| `close_presentation_window`| —                                       | `void`          | Close presentation window                |
| `parse_holyrics`           | `path: string`                          | `ImportPreview` | Parse Holyrics JSON, return preview      |
| `confirm_import`           | `songs: SongImportDto[]`                | `ImportResult`  | Persist imported songs                   |
| `start_countdown`          | `config: CountdownConfig`               | `void`          | Start Tokio countdown ticker             |
| `pause_countdown`          | —                                       | `void`          | Pause countdown                          |
| `reset_countdown`          | —                                       | `void`          | Reset countdown to total duration        |

### Tauri Events (Rust → All Windows)

| Event                    | Payload              | Description                                    |
| ------------------------ | -------------------- | ---------------------------------------------- |
| `state_changed`          | `PresentationState`  | Emitted on every presentation state mutation   |
| `countdown_tick`         | `{ remaining_ms: number }` | Emitted every 250 ms while countdown runs |
| `media_library_changed`  | —                    | Emitted after media import or delete           |

### Domain Types (IPC Contract)

These types are serialized as JSON across the Tauri IPC boundary. TypeScript mirrors must stay in sync with the Rust definitions.

```
PresentationState (tagged union, tag field: "type")
  | { type: "idle" }
  | { type: "blank" }
  | { type: "lyrics",    song, all_slides, current_slide_index, frozen, background }
  | { type: "media",     item, loop, background }
  | { type: "countdown", config, remaining_ms, paused }
  | { type: "webview",   url }

Song
  id, title, artist?, language, notes?, background_id?, slide_config?,
  source?, sections: SongSection[], tags: Tag[]

SongSection
  id, song_id, label, section_type: SectionType, body, sort_order, repeat_count

SectionType: verse | chorus | bridge | pre_chorus | outro | interlude | tag

Slide
  section_id, section_label, section_type, lines: string[],
  slide_index_in_section, total_slides_in_section

SlideConfig
  max_lines_per_slide, max_chars_per_line, font_family, font_size_base,
  text_color, text_align, background_color

ServiceSet
  id, name, service_date?, notes?, items: SetItem[]

SetItem
  id, set_id, item_type: SetItemType, song_id?, media_id?,
  countdown_config?, web_url?, sort_order, notes?

SetItemType: song | media | countdown | webview | blank

MediaItem
  id, file_name, media_type: image | video | url, url?,
  mime_type?, duration_ms?, width?, height?, thumbnail_path?, created_at

CountdownConfig
  total_ms, display_message, background, end_action: blank | advance,
  yellow_threshold_ms (default 60000), red_threshold_ms (default 10000)

MonitorInfo
  index, name, width, height, is_primary
```

---

## Feature Specifications

### Lyrics Management

- **Song CRUD:** Tauri commands invoke sqlx queries on the SQLite DB. Results serialized as JSON over IPC.
- **Full-text search:** SQLite FTS5. Handler accepts a query string and returns `Vec<Song>`. Trigger-based index maintenance.
- **Section editor:** React component with dnd-kit for drag-to-reorder. Sort order persisted by invoking `reorder_set_items`.
- **Set builder:** dnd-kit sortable list. Reorder updates `sort_order` for all affected rows in a single transaction.

### Lyrics Presentation

**Slide generation (`services/slide_splitter.rs`):**
Pure Rust function — no I/O, no async. Splits a `SongSection` into `Vec<Slide>` by:
1. Split body on `\n` → raw lines
2. Word-wrap each raw line at `config.max_chars_per_line`
3. Accumulate display lines into slides; flush at `config.max_lines_per_slide`
4. Each section boundary always starts a new slide

Unit-tested exhaustively before any presenter work begins.

**Presentation state machine:** Sealed Rust enum in `domain/presentation.rs`. All mutations happen in command handlers under `state.write()`. Every mutation emits `state_changed` to both windows.

**Keyboard shortcuts (operator window):**

| Key             | Action                |
| --------------- | --------------------- |
| Space / →       | Advance slide         |
| ←               | Previous slide        |
| B               | Toggle blank          |
| F               | Toggle freeze         |
| Esc             | Stop presentation     |
| 1–9             | Jump to slide N       |

**Operator console during presentation:**
- Current slide (large preview)
- Next slide preview
- Section navigator (scrollable slide thumbnails)
- Set queue (upcoming items)
- Song progress indicator

**Typography:** Font family, size, color, alignment managed in `settingsStore`. Applied via CSS custom properties. Auto-fit font size computed in `useLayoutEffect` (measures container, shrinks until text fits).

**Background options:** Solid color, static image, or looping video — all rendered as CSS/HTML in the presentation window.

### Media Presentation

**Video in WebView2:**

| Format            | WebView2 Support     | Behavior                                       |
| ----------------- | -------------------- | ---------------------------------------------- |
| MP4 (H.264 + AAC) | Native               | `<video>` plays directly                       |
| WebM (VP8/VP9)    | Native               | `<video>` plays directly                       |
| MP4 (HEVC/H.265)  | Requires codec pack  | Warning dialog at import                       |
| MKV               | Requires codec       | Rejected at import with HandBrake guidance     |
| AVI               | Codec-dependent      | Rejected at import with guidance               |

**Local file access:** Custom `asset://` URI scheme registered at Tauri startup serves files from `%APPDATA%\TrinityLyrics\media\`. React `<video src="asset://media/filename.mp4">` resolves via the Rust protocol handler — no CORS, no server.

**Thumbnails:**
- Images: `image` crate → resize to 320×180 → save as WebP
- Videos (MP4): extract frame at 2 s using `video-rs`; fallback to placeholder icon

**Media library:** Operator designates a watched folder. Rust `media_scanner` uses the `notify` crate to watch for file changes and auto-syncs the DB.

### Countdown Timer

- Rust Tokio interval task spawned on `start_countdown` command
- Emits `countdown_tick` event every 250 ms with `remaining_ms`
- React `useCountdownTick` subscribes and updates the display
- Pause/resume/reset cancel or restart the interval
- Color threshold transitions at configurable yellow and red thresholds

### Web / IP Camera Viewer

Presentation window renders a camera URL directly in the WebView:
- MJPEG streams: `<img src="http://camera/mjpeg">` — native browser support
- Full camera UIs (DaHua, Hikvision): `<iframe sandbox="allow-same-origin allow-scripts">`
- Credentials in URL: `http://admin:pass@192.168.1.10` — known limitation, documented

### Holyrics Import (MVP)

- Parser in `services/holyrics_parser.rs` using `serde_json`
- Maps Holyrics paragraph `description` → `SectionType` (verse/chorus/bridge)
- Wizard flow: file picker → parse → preview ("Found 142 songs, 3 duplicates") → confirm → `insert_all()` with `source = "holyrics"`
- Duplicate detection: normalized `(title, artist)` pair (lowercase + trim)
- **Pre-condition:** Obtain a real Holyrics export file before coding the parser. Do not implement blind.

---

## Data Model

### SQLite Schema

```sql
-- migrations/001_initial.sql

CREATE TABLE songs (
  id             TEXT NOT NULL PRIMARY KEY,
  title          TEXT NOT NULL,
  artist         TEXT,
  ccli_number    TEXT,
  key_signature  TEXT,
  language       TEXT NOT NULL DEFAULT 'pt',
  notes          TEXT,
  background_id  TEXT REFERENCES media(id),
  slide_config   TEXT,   -- JSON: {maxLines, fontSize, fontFamily, textAlign, textColor}
  source         TEXT,   -- 'holyrics' for imported songs
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  deleted_at     INTEGER        -- soft delete (epoch ms)
);

CREATE TABLE song_sections (
  id           TEXT NOT NULL PRIMARY KEY,
  song_id      TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,   -- "Verse 1", "Chorus"
  type         TEXT NOT NULL,   -- verse|chorus|bridge|pre_chorus|outro|interlude|tag
  body         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL,
  repeat_count INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE tags (
  id    TEXT NOT NULL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  color TEXT
);

CREATE TABLE song_tags (
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (song_id, tag_id)
);

CREATE TABLE media (
  id             TEXT NOT NULL PRIMARY KEY,
  file_path      TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  media_type     TEXT NOT NULL,  -- image|video|url
  url            TEXT,
  mime_type      TEXT,
  duration_ms    INTEGER,
  width          INTEGER,
  height         INTEGER,
  thumbnail_path TEXT,
  created_at     INTEGER NOT NULL
);

CREATE TABLE sets (
  id           TEXT NOT NULL PRIMARY KEY,
  name         TEXT NOT NULL,
  service_date TEXT,  -- ISO date string
  notes        TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE set_items (
  id               TEXT NOT NULL PRIMARY KEY,
  set_id           TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  item_type        TEXT NOT NULL,  -- song|media|countdown|webview|blank
  song_id          TEXT REFERENCES songs(id),
  media_id         TEXT REFERENCES media(id),
  countdown_config TEXT,           -- JSON blob (CountdownConfig)
  web_url          TEXT,
  sort_order       INTEGER NOT NULL,
  notes            TEXT
);

CREATE TABLE settings (
  key   TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
);

-- Full-text search
CREATE VIRTUAL TABLE songs_fts USING fts5(
  title, artist, body,
  content='songs',
  content_rowid='rowid'
);

CREATE TRIGGER songs_fts_insert AFTER INSERT ON songs BEGIN
  INSERT INTO songs_fts(rowid, title, artist, body) VALUES (new.rowid, new.title, new.artist, '');
END;
```

### Key Settings

```
presentation.monitor_index
presentation.default_background
presentation.font_family
presentation.font_size_base
presentation.slide_max_lines
presentation.transition_type
presentation.transition_ms
media.library_paths
ui.theme
ui.language
```

---

## State Management

| Layer               | Technology                                          | Scope                                         |
| ------------------- | --------------------------------------------------- | --------------------------------------------- |
| Presentation state  | `Arc<RwLock<PresentationState>>` in Rust            | Single source of truth in backend             |
| Frontend replica    | Zustand `presentationStore`                         | Per-window, kept in sync via Tauri events     |
| Library data        | sqlx queries → JSON over IPC                        | Persisted, fetched on demand or after mutation|
| App settings        | SQLite key-value + in-memory Rust cache             | Persisted, loaded at startup                  |
| UI-only state       | React `useState` / `useReducer`                     | Single component scope                        |

**Consistency guarantee:** Any mutation goes through a Tauri command → Rust updates → emits `state_changed` → both windows update. A window can never have stale state from its own mutations.

---

## Media Pipeline

### Import Flow

```
User selects file via Tauri dialog
  → import_media(path)
  → Validate extension: whitelist jpg, jpeg, png, webp, gif, mp4, webm
  → Non-whitelist: warning dialog, reject with format guidance
  → Copy to %APPDATA%\TrinityLyrics\media\{uuid}.{ext}
  → Generate thumbnail:
      Images: resize to 320×180 → save as thumbnail_{uuid}.webp
      Videos: extract frame at 2s via video-rs; placeholder on failure
  → INSERT into media table
  → Emit "media_library_changed" → operator window refreshes grid
```

### Local File Access

Custom `asset://` URI scheme registered at Tauri startup serves files from the media directory. React elements reference `asset://media/{filename}` — resolved by the Rust protocol handler with zero network overhead.

### Video Codec Strategy

| Format            | WebView2 Support    | Behavior                                       |
| ----------------- | ------------------- | ---------------------------------------------- |
| MP4 (H.264 + AAC) | Native              | `<video>` plays directly                       |
| WebM (VP8/VP9)    | Native              | `<video>` plays directly                       |
| MP4 (HEVC/H.265)  | Requires codec pack | Warning at import                              |
| MKV               | Requires codec      | Rejected at import with HandBrake guidance     |
| AVI               | Codec-dependent     | Rejected at import with guidance               |

---

## Persistence Strategy

**Paths:**
```
%APPDATA%\TrinityLyrics\database.db    (SQLite via sqlx)
%APPDATA%\TrinityLyrics\media\         (imported media files)
%APPDATA%\TrinityLyrics\thumbnails\    (WebP thumbnails)
%APPDATA%\TrinityLyrics\logs\          (application logs)
```

**Migrations:** sqlx `migrate!()` macro runs all pending `.sql` files at startup — automatic, versioned, forward-only.

**Backup/Export:** ZIP archive of `database.db` + `media/`. Implemented via Rust `zip` crate. Import merges by UUID with `(title, artist)` dedup fallback.

**Soft delete:** `deleted_at` column on songs. "Recently Deleted" view shows songs deleted within the last 30 days.

---

## Security Considerations

### Desktop Security Model

This is a single-user, fully offline desktop application. There is no user authentication, no network server, and no multi-tenant data. The threat model is limited accordingly.

| Area                      | Approach                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Local data at rest        | SQLite not encrypted — acceptable for church lyrics/media; no sensitive PII stored    |
| Media files               | Stored in `%APPDATA%` — OS-level user access control applies                          |
| Camera credentials in URL | Stored as plain text in `set_items.web_url` — known limitation, documented in UI     |
| No API keys or secrets    | App is fully local — no external service credentials required                         |
| IPC surface               | Tauri restricts frontend to declared commands only; all commands listed in `lib.rs`   |

### Asset Protocol Security

- The `asset://` protocol handler must validate paths to prevent path traversal attacks (e.g., `asset://../../Windows/System32`)
- Only serve files within `%APPDATA%\TrinityLyrics\media\` and `thumbnails\`
- Configure `security.csp` in `tauri.conf.json` to allow `asset://` and block arbitrary `file://` access

### Content Security Policy

Configure in `tauri.conf.json`:
- Allow `asset://` for local media
- Allow `http://` and `https://` only for camera `<iframe>` / `<img>` sources
- Block `eval`, inline scripts (except where Vite's HMR requires it in dev)

### What NOT to Log

- Camera URLs containing credentials
- Any user-entered content that might contain passwords

---

## Testing Strategy

| Test Type                  | Scope                               | Coverage Target        | Tool                        |
| -------------------------- | ----------------------------------- | ---------------------- | --------------------------- |
| **Rust unit tests**        | Services, domain logic              | > 80% of services/     | `cargo test` (colocated)    |
| **Rust integration tests** | DB queries, migrations              | All critical paths     | `sqlx::test` (in-memory DB) |
| **Frontend unit tests**    | Stores, utilities, formatters       | > 70%                  | Vitest                      |
| **Component tests**        | React component behavior            | Critical components    | Vitest + Testing Library    |
| **Manual checklist**       | Full UX flows on physical hardware  | All MVP scenarios      | See Section 16              |

### Critical Rust Unit Test Scenarios

- `slide_splitter`: empty section, single-word lines, exactly at max_lines, over limit, CJK characters, repeat sections
- State transitions: advance past last slide, blank toggle, freeze, countdown tick, load_song clears previous state
- `holyrics_parser`: all section type mappings, duplicate detection, malformed JSON, empty paragraphs
- Countdown: tick accuracy, end-action trigger, pause/resume, reset

### Critical Rust Integration Test Scenarios (sqlx::test — in-memory SQLite)

- Song CRUD + FTS5 search results accuracy
- Set item creation and reorder
- Media import metadata persistence
- Settings get/set round-trip
- Migration runs cleanly on fresh DB

### Critical Frontend Component Test Scenarios

- Song library: search query filters results correctly
- Set builder: drag-to-reorder updates sort order
- Presentation controls: advance dispatches correct command
- Countdown display: correct color class at yellow/red thresholds

### Manual Test Checklist (before each release)

- Dual-monitor on physical hardware (extend display mode)
- MP4 video background plays without stutter at 1080p
- MKV import rejected gracefully with guidance dialog
- IP camera MJPEG stream via `<img src>`
- Fullscreen stability after monitor sleep/wake cycle
- VLC absent: warning shown, MP4 still works
- Holyrics import with a real export file (≥10 songs)
- 2-hour service simulation: 20 songs, 10 media items — memory stays < 200 MB

---

## Non-Functional Requirements

| Metric                | v1 Target (Kotlin) | v2 Target (Rust + Tauri) |
| --------------------- | ------------------ | ------------------------ |
| Cold startup          | < 3 s              | **< 1 s**                |
| Slide advance latency | < 16 ms            | < 16 ms (IPC adds ~2 ms) |
| Song search (5k songs)| < 100 ms           | **< 30 ms**              |
| Memory (idle)         | < 300 MB           | **< 80 MB**              |
| Memory (video active) | < 600 MB           | **< 200 MB**             |
| Installer size        | < 120 MB           | **< 15 MB**              |
| Offline operation     | 100%               | 100%                     |
| Windows support       | Win 10 1803+, Win 11| Win 10 1803+, Win 11    |

**WebView2 guarantee:** Every Windows 10 1803+ and Windows 11 machine ships WebView2. The app may bundle a WebView2 Evergreen Bootstrapper (~1 MB) as a fallback for rare edge-case machines.

---

## Monitoring & Observability

This is a desktop app — there is no production server to monitor. Observability focuses on local diagnostics and post-release issue reporting.

### Local Logging

- Structured logs written to `%APPDATA%\TrinityLyrics\logs\app.log`
- Log levels: `error`, `warn`, `info`, `debug`
- Rotate logs at 5 MB, keep last 3 files
- Log all Tauri command invocations at `debug` level
- Log all errors and panics at `error` level with context
- Never log camera URLs or any credential-containing strings

### Diagnostics Screen (Settings UI)

Expose in the Settings window:
- WebView2 version
- SQLite database file size
- Media library item count and total size
- App version and build date
- "Open logs folder" shortcut

### Key Metrics to Validate Manually (per release)

| Metric               | Target      | How to Measure                         |
| -------------------- | ----------- | -------------------------------------- |
| Cold startup time    | < 1 second  | Stopwatch from icon click to UI visible|
| Slide advance latency| < 16 ms     | Browser DevTools → Performance tab     |
| Search response time | < 30 ms     | DevTools Network/Performance panel     |
| Memory (idle)        | < 80 MB     | Windows Task Manager                   |
| Memory (video active)| < 200 MB    | Windows Task Manager                   |
| Installer size       | < 15 MB     | Build artifact inspection              |

### Future: Crash Reporting (Phase 3)

- Optional opt-in Sentry integration for crash reports
- Only collected with user consent
- No usage telemetry without explicit opt-in

---

## Rollback Plan

### Version Rollback Strategy

- **Release artifact:** Each GitHub Release includes the NSIS installer for that version
- **Rollback trigger:** Critical bug (crash on startup, data loss, dual-monitor failure) discovered after release
- **Steps:**
  1. Uninstall current version via Windows Add/Remove Programs
  2. Download previous version installer from GitHub Releases
  3. Install previous version
  4. Database and media files in `%APPDATA%` are preserved across uninstall/reinstall

### Database Migration Safety

All migrations must be:
- **Additive only for MVP:** New columns with defaults; no column drops; no table renames
- **Tested on staging:** Run migration against a copy of a real DB before release
- **Backward compatible for one version:** Allows downgrade without data loss

Migration rollback procedure:
1. Maintain a manual down-migration SQL file alongside each migration
2. Document schema version in `settings` table (`schema.version` key)
3. Run down-migration manually if rollback is needed after a migration

### Release Process

1. Run full manual test checklist on physical hardware
2. Build installer: `npm run tauri build`
3. Tag release: `git tag v{MAJOR}.{MINOR}.{PATCH}`
4. Upload installer to GitHub Releases with CHANGELOG entry
5. Verify installer size < 15 MB before publishing

---

## Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **RISK-1:** Dual-monitor window positioning — `available_monitors()` returns monitors in OS-dependent order | Medium | High | Show monitor preview with resolution labels in settings; persist last-used monitor index; allow manual drag as fallback |
| **RISK-2:** Outdated WebView2 on very old Windows 10 machines | Medium | Low | Bundle WebView2 Evergreen Bootstrapper in installer; Tauri NSIS template supports this |
| **RISK-3:** Church's video files are MKV/AVI — import rejection creates friction | Low | Medium | Import dialog shows HandBrake conversion instructions; provide "re-scan with VLC" option in V2 |
| **RISK-4:** IPC serialization overhead for large slide sets (~50 KB JSON per advance on 200-slide songs) | Low | Low | Acceptable at current scale; defer optimization to emit thin `slide_index_changed` event if profiling shows real bottleneck |
| **RISK-5:** Rust learning curve — ownership/lifetimes add implementation friction | Medium | Medium | Start with `Arc<Mutex<>>` everywhere; optimize to `RwLock` later; use Claude Code for Rust-specific patterns |
| **RISK-6:** Holyrics export format undocumented — parser may not match real files | High | Medium | Obtain a real export file before coding the parser; do not implement blind |

---

## Implementation Plan

### Phase 0: Skeleton (Week 1–2)

**Goal:** Prove the hardest integration points before feature work.

| Task                                   | Owner        | Status | Estimate |
| -------------------------------------- | ------------ | ------ | -------- |
| `create-tauri-app` scaffold (Rust + React + TS + Vite) | @vinicius | Done | 0.5d |
| Two-window setup: operator + presentation | @vinicius | Done | 1d |
| Tauri command → Rust state → event → both windows sync (counter demo) | @vinicius | TODO | 1d |
| sqlx connected, migration running, SQLite working | @vinicius | TODO | 1d |
| `asset://` protocol serving a local image to `<img>` in presentation window | @vinicius | TODO | 0.5d |
| `<video>` with MP4 via `asset://` playing in presentation window | @vinicius | TODO | 0.5d |
| Vitest green on hello-world test; `cargo test` green | @vinicius | TODO | 0.5d |

**Deliverable:** Two-window skeleton that syncs a counter, plays video, and serves local assets.

---

### Phase 1: MVP — Lyrics + Holyrics Import (Week 3–8)

**Goal:** Replace Holyrics for Sunday morning lyrics presentation.

| Task                                              | Owner        | Status | Estimate |
| ------------------------------------------------- | ------------ | ------ | -------- |
| `slide_splitter` — pure Rust, fully unit-tested   | @vinicius    | TODO   | 2d       |
| SQLite schema + initial migration                 | @vinicius    | Done   | 1d       |
| Song CRUD (Rust commands + React editor)          | @vinicius    | TODO   | 4d       |
| dnd-kit section reorder in editor                 | @vinicius    | TODO   | 1d       |
| Full-text search (FTS5)                           | @vinicius    | TODO   | 1d       |
| Set builder (songs only, dnd-kit sortable)        | @vinicius    | TODO   | 2d       |
| Lyrics presentation: load set, advance/prev/blank/freeze | @vinicius | TODO | 3d   |
| Keyboard shortcuts (Space, arrows, B, F, Esc, 1–9) | @vinicius  | TODO   | 1d       |
| Solid color and static image backgrounds          | @vinicius    | TODO   | 1d       |
| Plain-text import wizard                          | @vinicius    | TODO   | 1d       |
| Holyrics import wizard (requires real export file) | @vinicius   | TODO   | 2d       |
| Settings: font, slide layout, monitor picker      | @vinicius    | TODO   | 2d       |
| Portuguese UI strings                             | @vinicius    | TODO   | 1d       |

**Deliverable:** App used in one real Sunday service. Collect feedback.

---

### Phase 2: V1 — Media + Countdown + WebView (Week 9–14)

**Goal:** Full Holyrics feature parity minus PPTX.

| Task                                                   | Owner        | Status | Estimate |
| ------------------------------------------------------ | ------------ | ------ | -------- |
| Media library (images + MP4/WebM) with `asset://`      | @vinicius    | TODO   | 3d       |
| Image and video presentation with CSS transitions      | @vinicius    | TODO   | 2d       |
| Video backgrounds for lyrics                           | @vinicius    | TODO   | 1d       |
| Countdown timer with Tokio tick + optional video bg    | @vinicius    | TODO   | 2d       |
| Web/IP camera viewer (`<iframe>` / `<img>` MJPEG)      | @vinicius    | TODO   | 1d       |
| All set item types: song, media, countdown, webview, blank | @vinicius | TODO | 2d     |
| Library ZIP backup/restore                             | @vinicius    | TODO   | 2d       |
| English language option (i18next)                      | @vinicius    | TODO   | 1d       |

**Deliverable:** Full V1 used weekly. 4-week feedback period.

---

### Phase 3: V2 — Polish + Power Features (Week 15–22)

- PPTX rendering (LibreOffice CLI → slide images)
- Per-section background overrides
- Presenter notes (operator-only per-slide panel)
- Keyboard shortcut customization (JSON config)
- Service report / CCLI prep export
- Print set list (`window.print()`)
- Dark/light UI theme (Tailwind dark mode)
- Multiple set templates
- Auto-update (Tauri updater plugin)
- Optional crash reporting (opt-in Sentry)

---

## Success Metrics

| Metric                          | Target                     | How to Measure              |
| ------------------------------- | -------------------------- | --------------------------- |
| Cold startup time               | < 1 second                 | Stopwatch on 5-year-old PC  |
| Installer size                  | < 15 MB                    | Build artifact              |
| Idle memory                     | < 80 MB                    | Windows Task Manager        |
| First Sunday service deployment | Phase 1 complete           | Used in a real live service |
| Volunteer onboarding time       | < 30 min for a full service| Observed user session       |
| Slide advance latency           | < 16 ms                    | DevTools Performance panel  |
| Zero critical incidents         | 0 crashes per 4-week period| Log review after each Sunday|

---

## Open Questions

| # | Question | Context | Status | Decision Date |
|---|----------|---------|--------|---------------|
| OQ-1 | Holyrics export format — exact JSON structure? | Need a real export file before coding the parser. Do not implement blind. | 🔴 Open — blocker | TBD |
| OQ-2 | Video thumbnail extraction library | `video-rs` (pure Rust, good for MP4) vs. spawning optional `ffmpeg` vs. placeholder icon for all videos | 🔴 Open | TBD |
| OQ-3 | Multi-window entry point strategy | Single `index.html` branching on `getCurrentWindow().label` (simpler Vite config) vs. separate HTML files per window | 🟡 Leaning toward single entry | TBD |
| OQ-4 | Font rendering on projectors with older Windows | WebView2 uses Edge renderer; custom `@font-face` should work — needs test on real projector hardware | 🔴 Open — test needed | TBD |

---

## Critical Files for Implementation

Files that gate all downstream work — build these first:

| File | Why Critical |
|------|--------------|
| `src-tauri/src/lib.rs` | Tauri app setup, command registration, two-window lifecycle |
| `src-tauri/migrations/001_initial.sql` | Full schema; all modules derive from this |
| `src-tauri/src/state.rs` | AppState; all commands hold a reference to it |
| `src-tauri/src/domain/presentation.rs` | PresentationState enum; serialized across IPC |
| `src-tauri/src/services/slide_splitter.rs` | Core algorithm; unit-test exhaustively before building the presenter |
| `src-tauri/src/protocol/asset.rs` | Serves all local media; required for video and image slides |
| `src/api/commands.ts` | Typed IPC surface; defines the contract between frontend and Rust |
| `src/stores/presentationStore.ts` | Frontend state replica; both windows depend on it |
| `src-tauri/src/services/holyrics_parser.rs` | Requires real Holyrics export — do not code blind |

---

## MVP Sign-off Checklist

1. **Import:** Holyrics export with 10+ songs → all appear with correct sections and labels
2. **Set building:** Set with 3 songs + 1 countdown → correct order, persists on app restart
3. **Dual monitor:** `open_presentation_window(1)` → opens fullscreen on second monitor
4. **Lyrics:** Advance through song 1 → jump via navigator → blank → unblank → reach end of set
5. **Countdown:** 2-minute countdown → color class switches at 60 s (yellow) and 10 s (red) → end action triggers
6. **Keyboard:** Space, B, F, Esc, arrows — all work without mouse
7. **State sync:** No perceptible latency between operator action and presentation window update
8. **Memory:** Task Manager snapshot after 30-minute session shows no leak pattern (stable < 150 MB)

---

## Appendix A: Project Directory Structure

```
c:\git\lyrizzy\
  Cargo.toml                      ← workspace root
  package.json                    ← Vite + React + Tauri dev dependencies
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  index.html                      ← operator window entry
  presentation.html               ← presentation window entry
  docs/
    TDD-v2.md                     ← this file
  .specs/                         ← feature specifications (populated separately)

  src/                            ← React frontend
    main.tsx                      ← entry: branch by window label
    windows/
      operator/OperatorApp.tsx
      presentation/PresentationApp.tsx
    components/
      library/
      setbuilder/
      presentation/
      media/
      countdown/
      settings/
      import/
      common/
    slides/
      LyricsSlide.tsx
      MediaSlide.tsx
      CountdownSlide.tsx
      WebViewSlide.tsx
      BlankSlide.tsx
    stores/
      presentationStore.ts
      libraryStore.ts
      setStore.ts
      settingsStore.ts
    api/
      commands.ts
      events.ts
    types/
      index.ts                    ← TypeScript mirrors of Rust domain types

  src-tauri/
    Cargo.toml
    tauri.conf.json
    build.rs
    src/
      lib.rs
      state.rs
      domain/
        song.rs
        set.rs
        presentation.rs
        media.rs
        slide.rs
        countdown.rs
      db/
        mod.rs
        songs.rs
        sets.rs
        media.rs
        settings.rs
        fts.rs
      commands/
        presentation.rs
        library.rs
        sets.rs
        media.rs
        settings.rs
        import.rs
        window.rs
      services/
        slide_splitter.rs
        countdown.rs
        media_scanner.rs
        thumbnail.rs
        holyrics_parser.rs
      protocol/
        asset.rs
    migrations/
      001_initial.sql
    icons/                        ← app icons (generated by `tauri icon` command)
```

## Appendix B: CLAUDE.md Content for v2

```markdown
# Trinity Lyrics v2

## Stack (v2)
- Backend: Rust 1.82+, Tauri 2.x, sqlx 0.8.x, Tokio 1.x, serde 1.x
- Frontend: TypeScript 5.x, React 18.x, Vite 6.x, Tailwind CSS v4, Zustand 5.x
- Database: SQLite via sqlx; migrations in src-tauri/migrations/*.sql

## Commands
- Dev server: `npm run tauri dev`
- Build: `npm run tauri build`
- Rust tests: `cargo test --manifest-path src-tauri/Cargo.toml`
- Frontend tests: `npx vitest`
- Add migration: create src-tauri/migrations/00N_description.sql; sqlx runs it at startup

## IPC Contract
- All Tauri commands declared in commands/ and registered in lib.rs invoke_handler![]
- All frontend calls go through src/api/commands.ts — never raw invoke() outside this file
- Events emitted by Rust: "state_changed" (PresentationState), "media_library_changed", "countdown_tick"
- Both windows listen to ALL events

## Two-Window Pattern
- Operator window: label "operator", full UI, all commands
- Presentation window: label "presentation", opened on demand via open_presentation_window command
- Both windows mount the same React root (main.tsx); branch on getCurrentWindow().label
- Presentation window is read-only: never invokes mutating commands

## Architecture Invariants
- Rust AppState.presentation is the single source of truth — frontend stores are projections
- state.presentation.write().await must be dropped before calling app.emit() to avoid deadlock
- All slide generation is pure Rust (slide_splitter); no slide logic in the frontend

## Common Gotchas
- asset:// protocol: must be registered in tauri.conf.json security.csp AND in lib.rs
- asset:// handler: validate paths to prevent path traversal outside the media directory
- Monitor index ordering is OS-dependent — always test on real hardware with two monitors
- MP4/WebM work natively in WebView2; reject MKV/AVI at import with HandBrake guidance
- FTS5 trigger updates only title/artist; song body text not indexed in current schema
```
