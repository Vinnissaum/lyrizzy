# Phase 3: V2 Design

**Spec:** `.specs/features/phase3-v2/spec.md`
**Status:** Draft — awaiting approval
**Last updated:** 2026-05-20

---

## Codebase Discovery (informs the rest of the design)

Reading the current source — post Phase 2 Phase J landing — surfaces facts that **partially contradict** assumptions in the spec ("Phase 3 builds on top of finished Phase 2"). The truth: several Phase 3 columns and fields already exist from Phase 1/2 because earlier schemas were drawn with Phase 3 in mind, while other expected pieces are entirely absent.

**Already in place** (no rework needed):
- `songs.ccli_number TEXT` and `songs.notes TEXT` exist in `001_initial.sql:7,10`. `Song` domain struct exposes both (`src-tauri/src/domain/song.rs:32,37`).
- `songs.background_id` FK to `media(id)` and `songs.scrim_opacity` (P2-08) — per-song background already wired through the runtime.
- `set_items.notes TEXT` exists (`001_initial.sql:73`). `SetItem.notes: Option<String>` already on the wire (`domain/set.rs:45,54`). **Spec P3-03 criterion 1 incorrectly implies this is new** — it isn't; only the **editor UI** (P3-04) and **renderer surfaces** (P3-05) are missing.
- Settings key/value table exists with `app.locale`, `presentation.transition_ms`, `presentation.reduce_motion` already seeded (`004_settings_locale.sql`). `get_setting`/`set_setting` commands and `useSettingsStore` already exist (`commands/settings.rs`, `stores/settings.ts`).
- Tauri's `available_monitors` + the presentation-window monitor picker (P1-14) work today (`commands/window.rs`). Pattern is reusable for the stage window.
- i18next is fully wired through both windows (Phase 2 I). `pt-BR.json` and `en-US.json` are populated; `useTranslation()` is the convention; locale changes propagate via `locale_changed` event.
- Backup/restore (`.tlz`) round-trips the whole DB. Any Phase 3 schema additions inherit forward-compatibility automatically because the exporter dumps every table to `data/*.json`.
- Tailwind v4 is the CSS layer (`@tailwindcss/vite` plugin in `vite.config.ts`). Dark-mode class strategy can be wired without a config file — Tailwind v4 reads `@source` and `@variant` from CSS.

**Missing entirely** (Phase 3 builds these from scratch):
- `song_sections.notes` and `song_sections.background_id` — the section table currently has only `label`, `type`, `body`, `sort_order`, `repeat_count` (`001_initial.sql:19-27`). `SongSection` Rust struct (`domain/song.rs:17`) has no notes / no background.
- `songs.author` and `songs.copyright` — spec P3-11 calls for these and they aren't present. `ccli_number` is.
- `song_plays` ledger table — does not exist; spec P3-13 creates it from scratch.
- **Keyboard shortcuts entirely** — `grep -rn keydown src/` returns no operator-window handlers. P1-10 (Phase 1 shortcuts) was deferred. Phase 3 P3-08..P3-10 must build the runtime dispatcher from zero rather than refactor an existing one. **The spec assumes a Phase 1/2 baseline of hard-coded shortcuts to migrate from — there is no such baseline.** Design treats this as "build dispatcher + persistence + UI in one cohesive pass."
- Tauri updater plugin (`tauri-plugin-updater` / `@tauri-apps/plugin-updater`) is not in `Cargo.toml` or `package.json`. Signing key infra does not exist.
- Stage display window — no third window plumbing.
- Dark-mode wiring: every operator-window component uses hard-coded `bg-gray-900 text-white` (Phase 2 chose a dark-ish baseline). A "dark theme" matches what's there today; a "light theme" is the actual deliverable that demands a regression sweep.

**Partial / repurpose-friendly:**
- Settings table is the right place for Phase 3's new keys (`key_bindings` JSON, `theme`, `last_update_check`, `ui.notes_panel_collapsed`) — D-19 already captured this.
- `media_picker` flow used by song editor (P2-04) and countdown editor (P2-20) can be reused unchanged for section background picker (P3-07).
- The `addSetItem`/`updateSetItem` notes column is already plumbed through commands and the wire — only the set-builder UI needs to surface it (P3-04).

---

## Architecture Overview

Phase 3 extends Phase 2 along four axes — none of them disruptive:

1. **One new window label** — `"stage"` joins `"operator"` and `"presentation"`. `main.tsx` already branches on `getCurrentWindow().label`; adding a third branch is a 3-line change.
2. **Two new pure-domain primitives** — `KeyBindings` (action enum + shortcut map) and `SongPlay` (ledger row). Both serialize to existing tables; no new long-lived backend tasks.
3. **One new cross-cutting concern** — theme. Tailwind v4's `dark:` variant + a single `<html class="dark">` toggle. Operator window only (D-18).
4. **One new external dependency** — Tauri updater plugin pointed at GitHub Releases. No new HTTP infra; the plugin owns the network surface.

```mermaid
graph TD
    subgraph Backend [Rust]
        AS[AppState<br/>+ Phase 3: no new long-running tasks]
        AS --> DB[(SQLite<br/>+ migration 005)]
        AS --> Cmds[Commands<br/>+ window.open_stage_window<br/>+ key_bindings get/set<br/>+ song_plays insert/list<br/>+ ccli_export<br/>+ theme/update_check settings]
        DB --> SP[(song_plays ledger)]
        DB --> KB[(settings.key_bindings JSON)]
        DB --> TH[(settings.theme)]
        Upd[tauri-plugin-updater] -.GitHub Releases latest.json.-> Cmds
    end

    subgraph Operator [Operator window — themable]
        OUI[Operator UI<br/>+ NotesPanel<br/>+ KeyBindingsScreen<br/>+ CCLIReportScreen<br/>+ ThemeToggle<br/>+ UpdateBanner]
        Disp[Runtime dispatcher<br/>builds Map&lt;KeyEvent, ActionId&gt;]
        OUI --> Disp
    end

    subgraph Presentation [Presentation window — content only]
        PR[Stage renderer<br/>unchanged from Phase 2<br/>+ section bg fallback chain]
    end

    subgraph StageWin [Stage window — NEW]
        SR[Stage renderer<br/>current+next preview<br/>notes panel<br/>clock / countdown]
    end

    Cmds -->|state_changed| Operator
    Cmds -->|state_changed| Presentation
    Cmds -->|state_changed| StageWin
    Cmds -.key_bindings_changed.-> Operator
```

Diagram is intentionally short; component-level interfaces are below.

---

## Code Reuse Analysis

### Existing components leveraged (no rewrite)

| Component | Location | How Phase 3 uses it |
|---|---|---|
| `WebviewWindowBuilder` + monitor index logic | `commands/window.rs:56-83` | `open_stage_window` is a near-clone of `open_presentation_window`. Refactor the monitor positioning into a private helper used by both. |
| `main.tsx` window-label dispatch | `src/main.tsx` | Add `'stage'` branch; lazy-import `StageApp` (parallel to `OperatorApp` / `PresentationApp`). |
| `useSettingsStore` + `getSetting`/`setSetting` | `commands/settings.rs`, `stores/settings.ts` | Reused for `theme`, `key_bindings`, `last_update_check`, `ui.notes_panel_collapsed`. No new store needed for one-off scalar settings; `key_bindings` gets its own store because it's queried hot on every keypress. |
| `MediaPicker` flow | `components/media/MediaLibrary.tsx` + song editor pattern | Section background picker reuses the existing media-picker modal; only the binding (`section.backgroundId` instead of `song.backgroundId`) differs. |
| `SongBackground.tsx` renderer | `src/components/presentation/SongBackground.tsx` | Receives an already-resolved `BackgroundInfo` from the runtime — the fallback chain (section → song → default) lives in Rust, so the renderer is unchanged. |
| `useTranslation()` + `t()` | i18next provider | Every new operator-window string is added under the existing pt-BR / en-US locale files. |
| `tauri-plugin-dialog` (save dialog) | already registered | CSV export uses it for the output path. |
| `set_items.notes` column + domain field | already on `SetItem` | Notes editor in set builder writes through existing `update_set_item` command. |
| `delete_media` references check | `commands/media.rs::get_media_references` | Extended to include `song_sections.background_id` (currently only checks `songs.background_id` + `set_items.media_id`). |

### Existing components extended

| Component | Location | Phase 3 changes |
|---|---|---|
| `domain::song::SongSection` | `src-tauri/src/domain/song.rs:17` | Add `notes: Option<String>` and `background_id: Option<String>`, both camelCase. |
| `domain::song::Song` | `src-tauri/src/domain/song.rs:30` | Add `author: Option<String>`, `copyright: Option<String>`. (`ccli_number` already exists.) |
| `domain::presentation::BackgroundInfo` resolution | `commands/presentation.rs` (P2-08 location) | Inject section → song → default fallback chain. Effective background is resolved per-slide, not per-set-item, because slides span sections. |
| Song editor (`SongEditor.tsx`) | `src/components/library/` | (a) "Direitos / Licença" collapsible section with three inputs; (b) per-section "Notas" + "Fundo" buttons via extended `SectionCard.tsx`. |
| Set builder set-item detail panel | `src/components/set/SetBuilder.tsx` | "Notas" textarea at the bottom of the inline editor for media / countdown / webview / blank items. (Song items already use song-level notes via `Song.notes`; spec implicitly excludes them at the set-item level since section-level notes serve the same purpose.) |
| FTS5 trigger | `migrations/002_fts_complete.sql` | Extend the songs_fts virtual table or trigger to include `author` (P3-11 criterion 4). |
| `delete_media` reference check | `commands/media.rs` | Cross-check `song_sections.background_id` in addition to `songs.background_id`. UI dialog string adds "Seções de músicas: N". |
| `OperatorApp.tsx` mount | `src/windows/operator/` | (a) theme bootstrap before first paint; (b) update-banner conditional render; (c) keyboard dispatcher install; (d) notes panel render slot. |
| Tailwind config | (none today — Tailwind v4 reads from CSS) | Add `@variant dark (&:is(.dark *));` (or equivalent v4 syntax) so the operator can flip a single `.dark` class on `<html>`. |
| Backup exporter | `services/archive.rs` | Inherits new tables/columns automatically — `data/song_sections.json` already dumps every column, `data/settings.json` already dumps every row, new `song_plays` table dumps the same way. Only addition: include `song_plays` in the export manifest counts. |

### Integration points

| System | Integration |
|---|---|
| Existing settings key/value table | New rows in migration 005: `key_bindings` (JSON), `theme` (`light`), `last_update_check` (epoch ms or empty). The JSON for `key_bindings` is the only "schema-shaped" settings value — design picks `serde_json::Value` parsing at read time so accidental corruption surfaces as a structured error, not a silent fallback to defaults. |
| Existing `song_sections` table | Migration 005 adds two columns; backfill stays NULL (acceptable per P3-03 criterion 5). |
| Existing `songs` table | Migration 005 adds two columns. FTS trigger touched to include `author`. |
| `set_items.notes` column | Already present — only UI work in Phase 3. |
| `media` table | `delete_media` references check extended to `song_sections.background_id`. No schema change. |
| GitHub Releases API | Tauri updater plugin's `endpoints` configuration. The plugin handles the HTTP + signature verification. We control the release pipeline (`scripts/release.sh` or GitHub Actions — covered in T17). |
| `tauri.conf.json` | New `plugins.updater` section with `pubkey` + `endpoints`. The `updater.active` flag gates the whole feature so a local dev build can disable it. |

### CONCERNS.md cross-check

- **CONCERN-7 (deadlock on emit)** — applies to every new command that mutates `PresentationState` or emits `state_changed`. The new commands in Phase 3 mostly emit no events (theme, key_bindings) or emit a brand-new event (`key_bindings_changed`). No new emit-while-holding-lock risk introduced.
- **CONCERN-3 (CSP)** — Phase 3 introduces no new CSP changes. Stage window inherits the global CSP from Phase 2 (D-13). Iframes are not used in the stage window.
- No new concerns introduced.

---

## Components

### Area A — Stage display window (P3-01, P3-02)

#### `commands::window::open_stage_window`

- **Purpose:** Idempotent third-window opener. Symmetric to `open_presentation_window`.
- **Location:** `src-tauri/src/commands/window.rs` (extended)
- **Interfaces:**
  - `open_stage_window(app, monitor_index: Option<usize>) -> Result<(), ErrorPayload>`
  - On invocation: focuses an existing window with label `"stage"` if present; otherwise builds a new `WebviewWindowBuilder` with label `"stage"`, URL `stage.html`, positioned per monitor index.
- **Refactor:** extract `position_for_monitor(app, idx) -> Option<(f64,f64,f64,f64)>` into a private helper at `commands/window.rs` module-level so both window openers share it. No behavior change for `open_presentation_window`.
- **Reuses:** existing `available_monitors` + `WebviewWindowBuilder` pattern.

#### `stage.html` + `StageApp` mount

- **Purpose:** Entry HTML for the stage window plus the React app root.
- **Location:** `stage.html` (new — sibling to `presentation.html`) and `src/windows/stage/StageApp.tsx` (new).
- **Interfaces:**
  - `stage.html` loads `src/main.tsx` (same entry as the other two windows).
  - `main.tsx` branches: `if (label === 'stage') import('./windows/stage/StageApp').then(mount)`.
  - `StageApp` subscribes to `state_changed`, `countdown_tick`, `media_library_changed`, and `locale_changed` events. **Never invokes mutating commands** (read-only invariant).
- **Reuses:** Vite multi-page input config (`vite.config.ts`) already exposes `presentation.html`; adding `stage.html` is a one-line addition.

#### `StageRenderer` (current + next + notes + clock)

- **Purpose:** ProPresenter-style layout — top-left current preview, top-right next preview, notes panel below, clock bottom-right.
- **Location:** `src/components/stage/StageRenderer.tsx` (new)
- **Layout (CSS Grid):**
  ```
  ┌──────────────────────────┬──────────────────────────┐
  │  current slide (~40%)    │  next slide (~40%)        │
  │  scaled-down preview     │  scaled-down preview      │
  ├──────────────────────────┴──────────────────────────┤
  │  notes panel (large type, auto-scroll on overflow)   │
  │                                                       │
  │                                              ┌──────┐│
  │                                              │ clock││
  │                                              └──────┘│
  └──────────────────────────────────────────────────────┘
  ```
  - Previews use CSS `transform: scale(~0.4)` over the existing slide renderers wrapped in a fixed-aspect frame — **no separate video decoders** (per spec P3-02 notes).
  - Clock toggles between wall-clock (`HH:MM:SS`) and `remaining_ms` rendering based on whether the active item is a countdown.
- **Reuses:** `SlideRenderer` (the existing component that renders a song slide), wrapped in a scale container. `CountdownRenderer`'s digit-rendering helper can be shared via a small `useCountdownDigits(remainingMs)` hook.

#### `StageNotesPanel`

- **Purpose:** Render notes for the active section / set item in large type with auto-scroll.
- **Location:** `src/components/stage/StageNotesPanel.tsx` (new)
- **Interfaces:** props `{ text: string | null, locale: string }`. Empty → renders nothing (parent grid row collapses).
- **Implementation:** `white-space: pre-wrap`, `line-height: 1.4`, font-size `clamp(20px, 2.5vmin, 36px)`. Auto-scroll: `overflow-y: auto` with `scroll-behavior: smooth`; when new notes arrive, scroll resets to top.

#### Blank/Freeze indicator badge

- **Purpose:** Show on-stage talent what the projector is doing when the operator blanks/freezes.
- **Location:** `src/components/stage/StageBlankIndicator.tsx` (new) — small absolute-positioned badge top-right.
- **Wiring:** Reads `presentationState.mode` from store. `'blank'` → badge "Tela apagada" / "Screen blanked"; `'frozen'` → badge "Tela congelada" / "Screen frozen"; otherwise hidden.

#### "Janelas" settings sub-screen

- **Purpose:** Spec OQ #2 proposes a unified window-placement panel. Design picks this alternative — it scales better to "presentation + stage" without a second copy of the monitor picker.
- **Location:** `src/components/settings/WindowsScreen.tsx` (new) — replaces the existing presentation-monitor picker rendered inline in `OperatorApp.tsx`.
- **Interfaces:** Lists monitors; per-window dropdown sets the monitor and a "Abrir / Reabrir" action. Persists last-used monitor per window in settings (`window.presentation.monitor`, `window.stage.monitor`).
- **Migration impact:** The current monitor picker render in `OperatorApp.tsx` moves into this screen; the home view shows only the live runtime UI.

### Area B — Presenter notes (P3-03, P3-04, P3-05)

#### Domain extension

- `SongSection` gains `notes: Option<String>` and `background_id: Option<String>` (`domain/song.rs:17`). Both camelCase on the wire.
- `SetItem.notes` already exists — no domain change.

#### `SectionCard` editor extension

- **Location:** `src/components/library/SectionCard.tsx` (modified)
- **Interfaces:** Two new icon buttons next to the existing label/type pickers: 📝 Notas + 🖼 Fundo. Clicking Notas expands an inline textarea bound to the section's `notes`. Clicking Fundo opens the existing media picker scoped to images+videos.
- **Auto-grow textarea:** uses a small `<TextareaAutosize />`-style ref with `scrollHeight` measurement. Debounced save via the existing song-update flow (300 ms).
- **Empty-state collapse:** when `notes === null`, the textarea is collapsed; the icon button still shows. When non-empty, the textarea is expanded by default on next mount.

#### Set-item notes editor

- **Location:** `src/components/set/MediaSetItemEditor.tsx`, `CountdownSetItemEditor.tsx`, `WebViewSetItemEditor.tsx` (modified). Blank set items get a tiny editor — for blank items only the notes field is meaningful; design adds an inline notes textarea directly in `SetBuilder.tsx` when the selected blank item is active.
- **Interfaces:** `<NotesField value={item.notes} onChange={...} />` shared component at `src/components/common/NotesField.tsx` (new) used by all four editors. Same debounced save semantics.

#### `OperatorNotesPanel`

- **Purpose:** Right-hand sidebar showing the current section's / set item's notes during runtime.
- **Location:** `src/components/presentation/OperatorNotesPanel.tsx` (new — adjacent to the existing slide preview)
- **Decision (resolves spec open Q #1):** Right-hand sidebar (~30% width, ~70% for the slide preview). Collapsible via a chevron toggle persisted in `settings.ui.notes_panel_collapsed`. Bottom-strip layout was considered but rejected because operators need the vertical real estate to read sermon outlines without scrolling.
- **Interfaces:** props-less; reads `presentationState.currentSection?.notes ?? currentSetItem.notes` via the presentation store.
- **Reuses:** `white-space: pre-wrap` styling shared with `StageNotesPanel`.

#### Privacy: notes never on the projector

- The presentation window's `SlideRenderer` and runtime state explicitly **do not include notes content** — the resolved per-slide payload passed to the projector renderer carries only what the audience must see. Notes are read off `currentSection` / `currentSetItem` via stores that exist only in the operator + stage windows.
- A unit/component test asserts that the presentation-window slide payload never contains the string from the notes field even if the section's notes are non-empty (defense-in-depth for P3-05 criterion 6).

### Area C — Per-section background overrides (P3-06, P3-07)

#### `BackgroundInfo` fallback resolver

- **Purpose:** Resolve the effective background for any given slide. Lives in Rust because the resolution touches `song_sections`, `songs`, and `settings.default_background_*` rows.
- **Location:** `src-tauri/src/services/background.rs` (new)
- **Interfaces:**
  - `pub fn resolve_for_slide(pool: &SqlitePool, song_id: &str, section_id: &str) -> Result<Option<BackgroundInfo>, sqlx::Error>` — checks section override (and that it points to a non-soft-deleted media), then song-level, then settings-default. Logs a `warn!` when a section override points at a deleted media id (P3-06 criterion 4) and continues to the next level of the chain.
  - `pub struct BackgroundInfo { media_kind, asset_url, scrim_opacity, restart_on_section_boundary }`. The `restart_on_section_boundary` flag distinguishes section-level (true) from song-level (false) backgrounds for the renderer (P3-06 criterion 6).
- **Reuses:** existing `media_dir` + asset URL builder. The scrim opacity stays per-song (no per-section scrim — section overrides inherit the song's scrim).

#### Renderer integration

- **Location:** `src/components/presentation/SongBackground.tsx` (extended)
- **Behavior:** When the runtime advances to a new slide and `BackgroundInfo.restart_on_section_boundary === true` AND the previous slide's `media_id` differs from the current's, the renderer remounts the `<video>` element (forces playback from 0) before applying the crossfade. When the two consecutive sections share the same `background_id`, the renderer keeps the current `<video>` mounted (no restart — see P3-06 criterion 6 + spec edge case "consecutive sections share same id").

#### `SectionCard` background picker

- **Location:** `src/components/library/SectionCard.tsx` (modified — see Area B for shared edit affordance)
- **Interfaces:**
  - 🖼 button → opens existing `MediaPicker` modal scoped to `kind ∈ {image, video}`. Selecting sets `section.background_id`; "Limpar" clears it.
  - Section list rendering: when `section.background_id !== null`, render a 24×14 thumbnail badge to the left of the section label.

#### Decision (spec open Q #3)

Adopt **restart on section boundary** for section-level video backgrounds. Worship-leader UX argument: a 30 s background on a 4 min song should restart per section so each section feels fresh; song-level backgrounds explicitly opt into the continuous-play behavior already in Phase 2.

### Area D — Keyboard shortcuts (P3-08, P3-09, P3-10)

#### Cold-start design (no existing shortcuts to migrate from)

The spec implicitly assumes a Phase 1/2 shortcut baseline exists ("move from hard-coded constants"). The discovery surfaced that **none exist** — P1-10 was deferred. The design treats Phase 3 as the first time runtime keyboard shortcuts ship. Defaults live in the migration SQL (single source of truth) and the operator runtime dispatcher consumes them on mount.

#### `domain::key_bindings`

- **Purpose:** Pure Rust types for the action enum + shortcut representation + key bindings map.
- **Location:** `src-tauri/src/domain/key_bindings.rs` (new)
- **Interfaces:**
  ```rust
  pub enum ActionId {
      AdvanceSlide, PreviousSlide, Blank, Freeze, ExitPresentation,
      JumpToItem1, JumpToItem2, JumpToItem3, JumpToItem4, JumpToItem5,
      JumpToItem6, JumpToItem7, JumpToItem8, JumpToItem9,
      CountdownPause, OpenPresentationWindow, FocusSearch,
  }
  pub struct Shortcut {
      pub key: String,    // KeyboardEvent.key — case-insensitive matched
      pub ctrl: bool,
      pub shift: bool,
      pub alt: bool,
  }
  pub struct KeyBindings {
      pub bindings: HashMap<ActionId, Vec<Shortcut>>,
  }
  ```
  - `KeyBindings::defaults()` returns the migration-seeded map.
  - `KeyBindings::validate(&self) -> Result<(), KeyBindingsValidationError>` enforces: every `ActionId` has ≥ 1 shortcut; no two distinct `ActionId`s share a `Shortcut`.
  - Both `ActionId` and `Shortcut` are camelCase-serialized; `Shortcut.key` follows `KeyboardEvent.key` semantics (the literal browser key string — "ArrowRight", " " for Space, etc.) so the operator-window dispatcher can compare directly.

#### `commands::key_bindings`

- **Purpose:** get/set/reset surface for the operator UI.
- **Location:** `src-tauri/src/commands/key_bindings.rs` (new)
- **Interfaces:**
  - `get_key_bindings() -> Result<KeyBindings, ErrorPayload>` — reads `settings.key_bindings`, falls back to defaults if missing.
  - `set_key_bindings(bindings: KeyBindings) -> Result<(), ErrorPayload>` — validates, persists, emits `key_bindings_changed` event.
  - `reset_key_bindings() -> Result<KeyBindings, ErrorPayload>` — writes defaults, emits, returns defaults.
- **Error codes:** `key_bindings.missing_action` (validate failure), `key_bindings.conflict { action_a, action_b }`, `key_bindings.invalid_shortcut` (modifier-only, empty key).

#### Runtime dispatcher

- **Location:** `src/runtime/keyboard.ts` (new)
- **Interfaces:**
  - `installKeyboardDispatcher(callbacks: ActionCallbacks): () => void` — attaches a `keydown` listener on `window`, builds a `Map<KeyEventSignature, ActionId>` from the persisted bindings, and dispatches to the matching callback.
  - `useKeyBindings()` hook returns the latest bindings (subscribes to `key_bindings_changed` event). The dispatcher reads through this hook so changes apply instantly.
  - Input blur semantics: `event.target instanceof HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement` → ignore (P3-10 criterion 4). `contenteditable` elements also ignored.
- **Action wiring:** Each `ActionId` maps to one of the existing commands (`nextSlide`, `prevSlide`, `setPresentationMode`, `goToItem(n)`, `pauseCountdown`, `openPresentationWindow`). Search focus dispatches a DOM event `'app:focus-search'` that the `SongList` listens for.
- **Presentation/stage focus forwarding (P3-10 criterion 5):** Both read-only windows listen for keydown and emit a Tauri event `forward_keydown { signature }` to the operator. The operator's dispatcher subscribes to this event and replays through the same action map. (Avoids the operator having to refocus to drive the show.)

#### `KeyBindingsScreen` (operator UI)

- **Location:** `src/components/settings/KeyBindingsScreen.tsx` (new)
- **Interfaces:**
  - Lists every `ActionId` in groups (Runtime / Set navigation / Misc). Each row shows the current shortcut(s) as keycap-styled tags.
  - "Editar" enters capture mode for the row — the next `keydown` is captured (modifiers + main key). Esc cancels; "Salvar" persists; conflict detection inline.
  - "Adicionar atalho" row per action allows multiple shortcuts per action (P3-09 criterion 6).
  - "Restaurar padrões" → confirm dialog → calls `reset_key_bindings`.

#### Default bindings (migration 005)

| ActionId | Default shortcut(s) |
|---|---|
| AdvanceSlide | Space, ArrowRight |
| PreviousSlide | ArrowLeft |
| Blank | b |
| Freeze | f |
| ExitPresentation | Escape |
| JumpToItem1..9 | 1..9 (no modifiers) |
| CountdownPause | p |
| OpenPresentationWindow | Ctrl+p |
| FocusSearch | Ctrl+f |

### Area E — Service report / CCLI export (P3-11..P3-14)

#### Schema additions

- Migration 005:
  - `ALTER TABLE songs ADD COLUMN copyright TEXT`
  - `ALTER TABLE songs ADD COLUMN author TEXT`
  - `CREATE TABLE song_plays ( id TEXT PRIMARY KEY, song_id TEXT NOT NULL REFERENCES songs(id), set_id TEXT NOT NULL REFERENCES sets(id), played_on TEXT NOT NULL, /* YYYY-MM-DD */ created_at INTEGER NOT NULL );` plus `CREATE UNIQUE INDEX idx_song_plays_unique ON song_plays(song_id, set_id, played_on);` enforcing per-day idempotency.
  - FTS5 update: extend the `songs_fts` trigger from migration 002 to insert `author` into the FTS body field alongside `title`/`artist`.

**Note on FK behavior** — songs use soft-delete in v2 (never hard-deleted). Design picks `NO ACTION` on the FK, accepting that a hypothetical hard-delete would error (which is correct — the ledger must remain consistent). If hard-delete ever ships, the migration that introduces it must also pick a strategy here.

#### Song editor — CCLI panel

- **Location:** `src/components/library/SongEditor.tsx` (modified)
- **Interfaces:** Collapsible "Direitos / Licença" panel below the existing sections list. Three inputs: "CCLI #", "Direitos autorais (©)", "Autor". Debounced save (300 ms) via the existing `updateSong` command. No validation beyond optional non-empty trim.

#### `services::play_counter`

- **Purpose:** Insert `song_plays` rows when a set is started.
- **Location:** `src-tauri/src/services/play_counter.rs` (new)
- **Interfaces:**
  - `pub async fn record_set_start(pool: &SqlitePool, set_id: &str) -> Result<usize, sqlx::Error>` — for every song-typed `set_item` in the set, attempts `INSERT OR IGNORE INTO song_plays (id, song_id, set_id, played_on, created_at) VALUES (uuid, ?, ?, current_date_local(), now_ms())`. Returns count of newly-inserted rows. The unique index makes the operation idempotent.
- **Wiring:** Called from the existing `load_set_for_presentation` command (which is what "Iniciar culto" maps to in the UI). The call happens **after** the DB transaction that loads the set, so a load failure doesn't write phantom plays.
- **Timezone (P3-13 criterion 4):** `played_on` is derived from the operator's local clock via `chrono::Local::today()` at the moment of recording. A set started at 23:55 records under that date, even if the slides advance past midnight.

#### `commands::reports::export_ccli_csv`

- **Purpose:** Operator-facing CSV exporter.
- **Location:** `src-tauri/src/commands/reports.rs` (new)
- **Interfaces:**
  - `export_ccli_csv(from: String, to: String, out_path: String) -> Result<ExportSummary, ErrorPayload>` — `from`/`to` are `YYYY-MM-DD`; queries `song_plays JOIN songs` filtered by `played_on BETWEEN ? AND ?`; writes UTF-8-with-BOM CSV.
  - `preview_ccli_export(from: String, to: String) -> Result<Vec<CcliRow>, ErrorPayload>` — returns the rows that would be exported, for the on-screen preview table.
- **CSV format:** `Data,Título,Autor,CCLI #,Direitos` (the exact column order from spec P3-14 criterion 3). Quoting follows RFC 4180 — fields containing commas, quotes, or newlines get wrapped in double quotes with internal quotes doubled. Empty fields are empty (not `null`).
- **Locale of headers:** ALWAYS Portuguese, since the CSV is consumed by the Brazilian CCLI affiliate's reporting site. The operator-window i18n choice doesn't change the file contents. Discussed and decided here, not in spec.

#### `CCLIReportScreen` (operator UI)

- **Location:** `src/components/reports/CCLIReportScreen.tsx` (new)
- **Interfaces:** Date-range picker (defaults: last 90 days). Preview table below. "Exportar CSV" button opens a save dialog; default file name `ccli-report-{from}-to-{to}.csv`.
- **Empty-range UX (P3-14 criterion 6):** Allow the export even when zero rows — the CSV still has the header line — and toast "Nenhum culto no período selecionado".
- **Decision (spec open Q #5):** No metadata-missing warning gate. Operators have other workflows that may want to export even when CCLI numbers are blank (research / preview). The CSV simply leaves those cells empty.

### Area F — Theme (P3-15, P3-16)

#### Tailwind v4 dark-mode wiring

- **Location:** Add `@variant dark (&:where(.dark, .dark *));` to the existing global CSS file (likely `src/index.css`).
- **Behavior:** Any class prefixed `dark:` activates when `.dark` is on `<html>` or an ancestor.

#### Theme bootstrap

- **Location:** `src/main.tsx` (modified — before any React mount)
- **Implementation:** Synchronously read `localStorage.getItem('trinity.theme')` (mirrors the persisted setting; updated on every change). Apply `.dark` to `<html>` if value is `"dark"`. **Persisting in `localStorage` in addition to the SQLite setting is intentional** — it avoids a flash-of-wrong-theme before the async `getSetting('theme')` resolves. The Rust setting remains the source of truth; localStorage is a synchronous cache.

#### `themeStore`

- **Location:** `src/stores/theme.ts` (new)
- **Interfaces:** `useThemeStore()` exposes `{ theme: 'light' | 'dark', setTheme(t) }`. `setTheme` writes both `localStorage` and the SQLite setting; toggles the `.dark` class on `<html>`.

#### `ThemeToggle` in settings

- **Location:** `src/components/settings/SettingsScreen.tsx` (modified — "Geral" panel)
- **Interfaces:** Two-option toggle "Claro" / "Escuro" wired to `themeStore.setTheme`.

#### Regression sweep

- Every operator-window component is audited for hard-coded color classes. The current baseline uses `bg-gray-900 text-white` (dark) liberally — the **light theme** is the work. Each component receives a paired `light:bg-white light:text-gray-900` (or equivalent Tailwind dark/light tokens via CSS custom properties) class.
- A small "themes look right" component test mounts each top-level screen twice — once in each theme — and asserts no element computes a contrast ratio below 4.5:1 against its background (using a tiny color-contrast helper; the test gates only on a sample of 5 known troublesome components, not every leaf).

### Area G — Auto-update (P3-17, P3-18)

#### Plugin integration

- **Dependencies:**
  - `Cargo.toml`: `tauri-plugin-updater = "2"`
  - `package.json`: `@tauri-apps/plugin-updater = "^2"`
- **Tauri config (`tauri.conf.json`):**
  ```jsonc
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": ["https://github.com/<owner>/<repo>/releases/latest/download/latest.json"],
      "dialog": false,            // we render our own UI
      "pubkey": "<embedded public key contents>"
    }
  }
  ```
  `dialog: false` keeps the Tauri-default updater UI off — Phase 3 ships its own non-blocking banner (P3-18).

#### Signing key infrastructure

- **Generation:** Maintainer runs `npm run tauri signer generate -- -w ~/.trinity-tauri-private-key` once, never commits the private key. Public key contents are pasted into `tauri.conf.json.plugins.updater.pubkey`.
- **`.gitignore`:** add `*.tauri-private-key`, `*.key` (defensive).
- **Build pipeline:** Either GitHub Actions or a local `scripts/release.ps1` (Windows-first) that:
  1. Increments version in `package.json` + `src-tauri/tauri.conf.json`.
  2. Runs `npm run tauri build`.
  3. Signs the installer with the private key (`tauri signer sign`).
  4. Builds `latest.json` containing `{ version, notes, pub_date, platforms: { "windows-x86_64": { url, signature } } }`.
  5. Creates a draft GitHub Release, uploads the installer + `latest.json`.
- **Decision (P3-17 notes):** Pipeline lands as `docs/release.md` + `scripts/release.ps1`. CI automation is Phase 4 territory; v2 stays manual to keep the maintainer in control.

#### `commands::updates`

- **Purpose:** Thin wrappers around the plugin so the UI doesn't have to import plugin types directly.
- **Location:** `src-tauri/src/commands/updates.rs` (new)
- **Interfaces:**
  - `check_for_updates(force: bool) -> Result<Option<UpdateInfo>, ErrorPayload>` — debounced via `settings.last_update_check` unless `force` is true. Returns `None` when no update is available or the check is skipped.
  - `apply_update_and_restart() -> Result<(), ErrorPayload>` — invokes the plugin's download + verify + install flow. On success, calls `app.restart()`. On signature mismatch, returns `update.signature_invalid`.

#### `UpdateBanner` + `UpdateDialog`

- **Locations:**
  - `src/components/system/UpdateBanner.tsx` (new — non-blocking strip at the top of the operator window)
  - `src/components/system/UpdateDialog.tsx` (new — release notes + apply button)
- **Behavior:**
  - On `OperatorApp` mount, call `checkForUpdates(false)`. If `UpdateInfo` returned, show banner.
  - "Mais tarde" sets a session-only flag (in `themeStore`-style memo, not persisted) hiding the banner until the next launch.
  - "Atualizar" opens dialog with notes + `apply_update_and_restart` button.

#### Update-check frequency

- **Decision (spec open Q #7):** Keep 24 h. `settings.last_update_check` is touched on every attempt regardless of outcome (P3-18 criterion 6 + edge case "manifest unreachable 7+ launches"). Offline failures are silent.

### Area H — Window placement (cross-cutting)

The new `WindowsScreen.tsx` settings panel (Area A) owns operator + presentation + stage monitor placement. Spec open Q #2 settled here in favor of the unified screen.

---

## Data Models

### Domain additions (Rust)

```rust
// src-tauri/src/domain/song.rs (extended)
pub struct SongSection {
    pub id: String,
    pub song_id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub section_type: SectionType,
    pub body: String,
    pub sort_order: i32,
    pub repeat_count: i32,
    pub notes: Option<String>,            // NEW
    pub background_id: Option<String>,    // NEW
}
pub struct Song {
    // ... existing fields ...
    pub author: Option<String>,           // NEW
    pub copyright: Option<String>,        // NEW
}

// src-tauri/src/domain/key_bindings.rs (new)
pub enum ActionId { /* 18 variants — see Area D */ }
pub struct Shortcut { pub key: String, pub ctrl: bool, pub shift: bool, pub alt: bool }
pub struct KeyBindings { pub bindings: HashMap<ActionId, Vec<Shortcut>> }

// src-tauri/src/domain/song_play.rs (new)
pub struct SongPlay {
    pub id: String,
    pub song_id: String,
    pub set_id: String,
    pub played_on: String,    // YYYY-MM-DD
    pub created_at: i64,
}

// src-tauri/src/domain/update.rs (new)
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
}

// src-tauri/src/domain/background.rs (new — moved from inline use in commands)
pub struct BackgroundInfo {
    pub media_kind: MediaKind,
    pub asset_url: String,
    pub scrim_opacity: u8,
    pub restart_on_section_boundary: bool,
}
```

### TypeScript mirrors

`src/types/index.ts` adds `ActionId`, `Shortcut`, `KeyBindings`, `SongPlay`, `UpdateInfo`, `BackgroundInfo`. `Song.author`, `Song.copyright`, `SongSection.notes`, `SongSection.backgroundId` are added to existing interfaces.

### Database migration `005_phase3.sql`

```sql
-- Section-level notes + background
ALTER TABLE song_sections ADD COLUMN notes TEXT;
ALTER TABLE song_sections ADD COLUMN background_id TEXT REFERENCES media(id) ON DELETE SET NULL;

-- CCLI metadata
ALTER TABLE songs ADD COLUMN author TEXT;
ALTER TABLE songs ADD COLUMN copyright TEXT;

-- Play ledger
CREATE TABLE song_plays (
  id          TEXT NOT NULL PRIMARY KEY,
  song_id     TEXT NOT NULL REFERENCES songs(id),
  set_id      TEXT NOT NULL REFERENCES sets(id),
  played_on   TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_song_plays_unique ON song_plays(song_id, set_id, played_on);
CREATE INDEX idx_song_plays_played_on ON song_plays(played_on);

-- FTS update: include author in the indexed body
DROP TRIGGER IF EXISTS songs_fts_insert;
DROP TRIGGER IF EXISTS songs_fts_update;
-- (recreate triggers concatenating title || ' ' || coalesce(artist,'') || ' ' || coalesce(author,'')
--  into the FTS 'body' column — see migration file for full SQL)

-- Settings rows
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('theme', 'light'),
  ('key_bindings', '<JSON of default bindings — see Area D>'),
  ('last_update_check', ''),
  ('ui.notes_panel_collapsed', 'false'),
  ('window.presentation.monitor', ''),
  ('window.stage.monitor', '');
```

---

## Error Handling Strategy

| Scenario | Handling | User impact |
|---|---|---|
| Stage window open on single-monitor system | `open_stage_window` builds a windowed (non-fullscreen) instance on monitor 0 with title bar visible | No error; operator drags it where they want; pos persisted on close |
| Section background points at deleted media | `resolve_for_slide` logs `warn!`, falls through to song-level, returns that | Renderer never sees the broken id; no operator-facing toast |
| Key-binding save with conflict | `set_key_bindings` returns `key_bindings.conflict { action_a, action_b }` | UI shows inline conflict message; save disabled until resolved |
| Key-binding capture receives only modifier | `Shortcut::validate()` rejects with `key_bindings.invalid_shortcut` | Capture stays open with hint "Inclua uma tecla principal" |
| Concurrent set start (two operators click) | DB unique constraint silently dedupes | Both operators see the same final ledger; no observable error |
| CSV export with zero rows | Empty result set + header line; toast "Nenhum culto no período selecionado" | Operator sees the empty file and the toast — intended (P3-14 criterion 6) |
| Update check while offline | Plugin error caught; `last_update_check` still touched | Silent. No toast (P3-18 criterion 7) |
| Update signature mismatch | `apply_update_and_restart` returns `update.signature_invalid` | Dialog shows pt-BR/en error; app stays on current version |
| Update download interrupted | Plugin error caught; partial download cleaned up by plugin | Toast "Falha ao baixar — tente novamente"; current version unaffected |
| Theme switch mid-edit | DOM class flips; no React state lost | Operator sees colors update; in-flight textarea content preserved |
| Migration 005 runs against fresh DB | `INSERT OR IGNORE` on settings + `ALTER TABLE` on empty tables | No-op semantics; works identically to a forward migration |
| Restore .tlz from pre-Phase-3 backup | sqlx::migrate runs 005 after Replace; all new columns default NULL / defaults; settings rows seeded if missing | Operator sees the same data plus the new defaults |

---

## Tech Decisions (resolving the 8 spec open questions + new ones)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Notes panel placement (open Q #1) | Right-hand sidebar, ~30% width, collapsible, persisted in `settings.ui.notes_panel_collapsed`. | Operators need vertical real estate to scroll long sermon outlines; horizontal-strip would waste sidebar but cap reading area. |
| 2 | Stage display monitor UX (open Q #2) | Introduce a unified `WindowsScreen` settings panel that owns presentation + stage placement. Refactors out the inline monitor picker in `OperatorApp.tsx`. | Scales cleanly to N windows; consolidates "where do my windows go" into one mental model. |
| 3 | Section background restart vs continue (open Q #3) | **Restart on section boundary** when `section.background_id` is set. Song-level background continues to span sections as today. | Section-level override carries intent "this section is visually different"; restarting communicates that intent. Discussed in Area C. |
| 4 | Shortcut scheme presets (open Q #4) | **Deferred to Phase 4.** Phase 3 ships per-action binding only. | Spec already classified — flagged here for completeness. |
| 5 | CCLI metadata enforcement (open Q #5) | Optional, no warning gate at export time. | Operators have legitimate "preview the report" workflows. The empty cell is the signal — no UX friction needed. |
| 6 | Auto-update channel (open Q #6) | Single stable channel; out of scope for v2. | Confirmed; matches spec "Out of Scope". |
| 7 | Update-check frequency (open Q #7) | 24 hours. | Quieter than every-launch; faster than weekly; matches Tauri-updater's typical cadence guidance. |
| 8 | Dark-mode default for new users (open Q #8) | `"light"` per spec; **do not** read `prefers-color-scheme`. | Predictable default. Most church-booth operators run dark anyway and will flip it; OS-following adds an edge case we'd have to debug. |
| 9 | Cold-start keyboard shortcuts (new) | Treat Phase 3 as the first delivery of runtime keyboard shortcuts. Defaults live in migration 005 SQL; runtime dispatcher built from scratch. | Discovery showed P1-10 was never built. Spec wording "move from hard-coded constants" is moot; design adjusts. |
| 10 | Notes editor table-name correction (new) | Migration 005 adds columns to `song_sections` (actual table) not `sections` (spec wording). Domain field `SongSection.notes`. | Spec P3-03 criterion 1 says "sections table" — the real schema name is `song_sections`. Design picks the actual name. |
| 11 | FK behavior on song_plays (new) | `NO ACTION` for `song_plays.song_id` and `song_plays.set_id`. | Songs are soft-deleted in v2 (never hard); ledger consistency matters. If hard-delete ever ships, that future migration revisits this. |
| 12 | CSV header locale (new) | CSV headers are **always Portuguese** regardless of operator-window locale. | CSV target is the Brazilian CCLI affiliate; their import expects the Portuguese column names. Operator-window i18n choice doesn't change file output. |
| 13 | Theme persistence layering (new) | Persist theme in SQLite settings (source of truth) **and** mirror to `localStorage` for synchronous flash-free bootstrap. | Avoids flash-of-wrong-theme on first paint. SQLite write is async; the synchronous `localStorage` read happens before React mounts. |
| 14 | Release pipeline scope (new) | `docs/release.md` + `scripts/release.ps1` (manual maintainer-run script). No GitHub Actions in v2. | Maintainer wants direct control; CI is Phase 4-shaped work. |
| 15 | Set-item notes for `song` items (new) | `SetItem.notes` exists on every item type. The spec doesn't surface a notes editor for song set items because section-level notes are richer. **The column is left untouched for songs** — operators wanting a "song-level note" use `Song.notes` instead. | Cleaner mental model: per-section for songs, per-item for everything else. |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Tauri updater plugin and signing key generation are new infra; if the maintainer's first signed release has a key mismatch, every shipped client refuses to update. | First release is dry-run: build a fake 0.0.0 → 0.0.1 update and run it against a local install before publishing v2.0.0. Documented in `docs/release.md`. |
| Keyboard dispatcher conflicts with Tauri menu accelerators / OS shortcuts. | Default bindings explicitly avoid Tauri menu mnemonics (which is empty by default). Ctrl+F and Ctrl+P are the only meta-keyed defaults; both safe on Windows. Conflict UI in `KeyBindingsScreen` warns if the user picks a known-OS-blocked combo. |
| Light theme regression sweep slips — a single hard-coded `text-white` makes the screen unusable. | Lint pass (`eslint-plugin-tailwindcss` or a small grep-based linter) flags any utility class using `text-white` / `bg-gray-9XX` outside an explicit allowlist. Component theme test (Area F) samples 5 top-level screens. |
| `song_plays` ledger drift if "Iniciar culto" is invoked from an unexpected code path. | Insertion is centralized in `record_set_start`; only `load_set_for_presentation` calls it. Integration test asserts no other code path inserts into `song_plays`. |
| Stage window's `transform: scale()` preview drifts visually when the projector resolution differs from the stage monitor's. | Wrap the scaled preview in a fixed `1920×1080` virtual frame, then scale to fit; the visual fidelity matches projector, not stage monitor. |
| Update plugin downloads installer to a temp path that's antivirus-quarantined. | Plugin's verification + restart cycle returns an error; banner shows the operator a "Tente novamente" action. Same retry behavior as any other update failure. |
| Section background restart on every keypress between two sections sharing a media id (operator advances rapidly). | Renderer compares `currentBackground.assetUrl` to previous; same URL → no remount. Tested with a unit. |
| Public key string in `tauri.conf.json` is committed — if maintainer's key is ever rotated, every released app needs a re-sign + emergency push. | Document key rotation in `docs/release.md`. Pin v2.x to one key; rotation is a v3 concern. |

---

## Open items — propose to resolve before tasks

The following points came up during design. **Each has a proposed default that the user can confirm or redirect before `tasks.md` is finalized.**

1. **Stage window default behavior on close.** Propose: closing the stage window persists its monitor index. Reopening lands on the same monitor. The window does NOT auto-open on app launch even if it was open last time — operator must explicitly reopen each session. (Open-on-launch invites accidents.)
2. **Set-item notes for `song` items.** Propose: hide the notes editor for song set items in the set builder (section-level notes are the right place). Otherwise we'd have two notes fields per song with unclear precedence.
3. **`KeyBindings` JSON shape in settings table.** Propose: store as a JSON-stringified `KeyBindings` value in the existing `settings.key_bindings` row. Validate on read; on parse error, log a warn and fall back to defaults rather than failing the app startup.
4. **CCLI CSV row dedup option.** Propose: NO dedup — one row per `song_plays` row even if the same song appears twice in the date range (matches CCLI's "Usage per service" semantics, spec P3-14 criterion 4 already aligns).
5. **Light-theme baseline color scheme.** Propose: white background, near-black text (`text-gray-900`), accent emerald (matches the current `bg-emerald-700` runtime indicator). No custom palette — Tailwind tokens only.
6. **Release pipeline location.** Propose: `scripts/release.ps1` for Windows-host maintainer + `docs/release.md` with manual checklist. No CI/GitHub Actions in v2.
7. **`tauri-plugin-updater` version pin.** Propose: `^2.0` to track minor updates; lockfile keeps reproducible builds.
8. **`song_plays` "Iniciar culto" wiring.** Propose: insert ledger rows from `load_set_for_presentation`. If a future refactor splits "load set" from "start service" (currently the same command), the insert moves with the latter.

---

## Confirm before Tasks

Design phase artifacts:
- 1 new SQL migration (`005_phase3.sql`).
- 5 new domain modules (`key_bindings`, `song_play`, `update`, `background`, and minor extensions to `song`).
- 3 new services (`background`, `play_counter`, `release-pipeline-as-script`).
- 4 new command modules (`key_bindings`, `reports`, `updates`, and extensions to `window` + `media` + `presentation`).
- 1 new window entry (`stage.html` + `StageApp`) — third React root for the stage display.
- ~14 new React components + 1 new store (`theme`) + extensions to `SongEditor`, `SectionCard`, `SetBuilder`, `SettingsScreen`, `OperatorApp`.
- 2 new Cargo deps (`tauri-plugin-updater`, `chrono` if not already pulled in — verify before tasks).
- 1 new npm dep (`@tauri-apps/plugin-updater`).
- Tailwind v4 dark-mode wiring + a light-theme regression sweep across every operator-window component.
- New `docs/release.md` + `scripts/release.ps1` (signing + publish playbook).

If this design matches your intent, next is `tasks.md` — breaking the above into ~30–40 atomic tasks with verification criteria, dependencies, and parallel-execution flags.
