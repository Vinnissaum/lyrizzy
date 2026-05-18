# Phase 1: MVP Spec — Lyrics + Holyrics Import

**Status:** Draft — awaiting approval
**Feature:** phase1-mvp
**Last updated:** 2026-05-18
**Depends on:** Phase 0 skeleton (complete)

---

## Problem Statement

Phase 0 proved the Tauri + sqlx + asset:// integration points work. The app does nothing useful yet — no songs, no sets, no presentation. Phase 1 turns the skeleton into a usable Sunday-morning lyrics tool that replaces Holyrics for the church's primary use case: showing song lyrics on a second monitor during a service. Success means the app is run in a real Sunday service at least once.

## Goals

- [ ] Operator can build a service set of songs and drive a fullscreen presentation on a second monitor end-to-end without touching Holyrics.
- [ ] Existing Holyrics library (JSON export) imports cleanly with title, artist, and sectioned lyrics preserved.
- [ ] Search by song title or lyric body returns results in under 100 ms on a library of ~500 songs.
- [ ] Keyboard-first operator workflow — no required mouse interaction during a live service.
- [ ] Cold-start to ready-for-presentation in under 1 second (carry-over from PROJECT.md).

## Out of Scope

Captured here to prevent scope creep — these belong in Phase 2 or 3.

| Feature | Reason |
|---|---|
| Media library (images + video as set items) | Phase 2 |
| Video backgrounds for lyrics | Phase 2 |
| Countdown timer | Phase 2 |
| WebView / IP camera set items | Phase 2 |
| Library ZIP backup/restore | Phase 2 |
| English locale | Phase 2 (pt-BR hard-coded for MVP) |
| Per-section background overrides | Phase 3 |
| PPTX rendering | Phase 3 |
| Presenter notes | Phase 3 |
| Keyboard shortcut customization | Phase 3 (defaults only) |
| CCLI report export | Phase 3 |
| Auto-update | Phase 3 |
| Cloud sync, multi-device, mobile, web | Out of v1 entirely |

---

## Resolved Open Questions

| # | Question | Resolution |
|---|---|---|
| OQ-1 | Holyrics export format? | Resolved 2026-05-18 — top-level JSON array of song objects; each has `title`, `artist`, `lyrics.paragraphs[]` where each paragraph is `{number, description, text}`. See STATE.md B-1. |
| Structural | Single spec vs. per-feature? | Single phase-wide spec, mirroring Phase 0. |
| i18n | Library or hard-coded? | Hard-coded pt-BR strings. i18next deferred to Phase 2. |
| Empty `description` from Holyrics | How to label? | Auto-label by position: `Estrofe 1`, `Estrofe 2`, … User can rename later. |

---

## Requirements

Requirements grouped by area. All are P1 (MVP-critical) unless flagged otherwise. Each carries a unique ID `P1-NN` for traceability into `design.md`, `tasks.md`, and verification.

### Area A — Foundation

#### P1-01: Domain model types

Define the Rust domain types in `src-tauri/src/domain/` that the rest of Phase 1 operates on. These types are pure data — no I/O, no async, no business logic methods that touch the DB. TS mirrors live in `src/types/index.ts`.

**Acceptance criteria:**
1. WHEN the Rust crate compiles THEN `domain::song::{Song, SongSection, SectionType}` SHALL exist with `#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]` and `#[serde(rename_all = "camelCase")]`.
2. WHEN the Rust crate compiles THEN `domain::set::{ServiceSet, SetItem, SetItemType}` SHALL exist with the same derive attributes. `SetItemType` for Phase 1 supports only `Song` and `Blank` variants (other variants reserved for Phase 2).
3. WHEN the Rust crate compiles THEN `domain::presentation::{PresentationState, PresentationMode}` SHALL exist. `PresentationMode` is one of `Idle | Live | Blank | Frozen`. `PresentationState` carries `set: Option<ServiceSet>`, `current_item_index: usize`, `current_slide_index: usize`, `mode: PresentationMode`.
4. WHEN any domain type is serialized THEN field names SHALL appear camelCased on the wire (e.g. `currentSlideIndex`).
5. WHEN `src/types/index.ts` is read THEN it SHALL declare TypeScript interfaces that mirror every Rust domain type, with property names matching the camelCase wire format.

**Notes:** Section `type` field intentionally matches the existing schema (verse|chorus|bridge|pre_chorus|outro|interlude|tag).

---

#### P1-02: Schema completion (migration 002)

The current migration `001_initial.sql` defines tables but the FTS trigger only inserts `title` and `artist` on song INSERT, with empty `body`. There is no UPDATE or DELETE trigger, and body never gets populated. Phase 1 needs full-text search to actually work.

**Acceptance criteria:**
1. WHEN the app starts THEN migration `002_fts_complete.sql` SHALL run and complete the FTS5 triggers so that `songs_fts.body` reflects the concatenation of all `song_sections.body` rows for the song, with sections joined by `\n\n`.
2. WHEN a song is inserted, updated, or deleted THEN the matching `songs_fts` row SHALL be kept in sync via triggers.
3. WHEN a song's sections are inserted, updated, or deleted THEN the parent song's `songs_fts.body` SHALL be re-derived (via triggers on `song_sections`).
4. WHEN migration 002 completes THEN existing FTS rows from the legacy trigger SHALL be backfilled with the correct body content (idempotent: a `DELETE FROM songs_fts; INSERT INTO songs_fts(rowid, title, artist, body) SELECT …` rebuild is acceptable).
5. WHEN `cargo test` runs THEN at least one integration test SHALL insert a song with sections and assert FTS5 returns the song for a lyric-only query (no title/artist match).

**Notes:** Trigger-on-sections cascade is more reliable than asking application code to remember to refresh FTS. Cost is one extra trigger fire per section write — acceptable for a library of hundreds of songs.

---

#### P1-03: slide_splitter — pure Rust service

A `services::slide_splitter` module splits a `SongSection` into one or more presentation slides, given a slide config (max lines, max chars per line). Pure function — no I/O, no async — and fully unit-tested. Frontend never re-implements this logic.

**Acceptance criteria:**
1. WHEN `slide_splitter::split(section: &SongSection, config: &SlideConfig) -> Vec<Slide>` is called THEN it SHALL return one or more `Slide` structs in order.
2. WHEN a section's body has lines separated by `\n` THEN the splitter SHALL group consecutive non-empty lines into slides up to `config.max_lines` lines per slide.
3. WHEN a single line exceeds `config.max_chars_per_line` THEN the splitter SHALL wrap on the nearest preceding whitespace; if none, hard-break at the limit.
4. WHEN a section has `repeat_count > 1` THEN the splitter SHALL emit the resulting slides `repeat_count` times in sequence.
5. WHEN a section body is empty or whitespace-only THEN the splitter SHALL return an empty `Vec` (no zero-content slides).
6. WHEN `cargo test` runs THEN unit tests SHALL cover: single-slide section, multi-slide split by line count, line wrapping, empty body, `repeat_count` > 1, mixed empty lines as paragraph separators.

**Notes (proposed defaults — confirm during design):**
- `SlideConfig::default()`: `max_lines = 4`, `max_chars_per_line = 60`. Tunable in settings (P1-14).
- A blank line inside a section body counts as a forced slide boundary (matches the Holyrics paragraph convention).
- `Slide` is a simple `Vec<String>` (one entry per line) plus `section_label` and `section_id` for renderer context.

---

### Area B — Song management

#### P1-04: Song CRUD commands

Tauri commands for creating, reading, updating, and deleting songs (and their sections). Soft delete via `songs.deleted_at`.

**Acceptance criteria:**
1. WHEN the operator calls `createSong(payload)` THEN the backend SHALL insert a `songs` row + N `song_sections` rows in a single transaction and return the new `Song` with all sections.
2. WHEN the operator calls `updateSong(payload)` THEN the backend SHALL update the song header and replace its sections (delete + re-insert in transaction), preserving `created_at` and updating `updated_at`.
3. WHEN the operator calls `deleteSong(id)` THEN the backend SHALL set `deleted_at` to the current epoch ms (soft delete). Hard delete is out of scope for Phase 1.
4. WHEN the operator calls `listSongs({ search?, limit?, offset? })` THEN the backend SHALL return a paginated list of non-deleted songs, sorted by title ascending by default.
5. WHEN the operator calls `getSong(id)` THEN the backend SHALL return the song with all its sections in `sort_order`.
6. WHEN any of these commands fails (validation, DB error) THEN the command SHALL return a structured `Result<T, String>` with a human-readable Portuguese error message safe to surface to the user.
7. WHEN a `state_changed` event is emitted after any CRUD operation THEN both windows SHALL observe the change without polling.

**Notes:** IDs are server-side generated UUIDs (v7 preferred — time-ordered, indexable). Frontend never invents IDs.

---

#### P1-05: Song editor UI

A React editor screen lets the operator create or edit a song: title, artist, language, optional notes, optional background, and an ordered list of sections (each with type, label, body, optional repeat count). All wired through `src/api/commands.ts`.

**Acceptance criteria:**
1. WHEN the operator opens the song editor with no song selected THEN the form SHALL show empty fields and a default first section (`Estrofe 1`, type `verse`, empty body).
2. WHEN the operator opens the song editor with a song selected THEN the form SHALL be populated from `getSong(id)` and any unsaved edits SHALL be preserved if the user navigates within the editor.
3. WHEN the operator clicks "Salvar" THEN the editor SHALL call `createSong` or `updateSong` and on success show a confirmation toast and close (or reset) the editor.
4. WHEN the operator clicks "Excluir" on an existing song THEN the editor SHALL confirm via a dialog before calling `deleteSong`.
5. WHEN any required field (title, at least one non-empty section) is missing on save THEN the editor SHALL show inline validation errors and not call the backend.
6. WHEN the operator adds a section THEN it SHALL be appended with type defaulting to `verse` and label auto-suggested as the next `Estrofe N` / `Refrão N` based on type.

---

#### P1-06: dnd-kit section reordering

Inside the song editor, sections can be reordered by drag with `@dnd-kit/sortable`. The new order is reflected in `sort_order` on save.

**Acceptance criteria:**
1. WHEN the operator drags a section card by its handle THEN the list SHALL reorder live with a visible drop indicator.
2. WHEN the operator releases the drag THEN the new order SHALL persist in component state immediately; it is committed to the DB only on Save.
3. WHEN the operator reorders sections THEN keyboard accessibility (arrow keys to move focused item) SHALL work per dnd-kit defaults.
4. WHEN a song is saved after reorder THEN `song_sections.sort_order` values SHALL reflect the new order (0-indexed, dense).

---

#### P1-07: Full-text search (FTS5)

A search box in the song list filters songs by FTS5 query across title, artist, and body. Default ranking is FTS5 BM25.

**Acceptance criteria:**
1. WHEN the operator types in the search box THEN `listSongs({ search })` SHALL be called (debounced ~150 ms) and the list SHALL update with FTS5 matches.
2. WHEN the query is empty THEN the list SHALL show all non-deleted songs sorted by title.
3. WHEN the query matches lyric body text only (not title/artist) THEN the song SHALL appear in results.
4. WHEN the query is invalid FTS5 syntax (e.g. unbalanced quotes) THEN the backend SHALL fall back to a sanitized prefix-LIKE query rather than returning an error.
5. WHEN search returns multiple matches THEN they SHALL be ordered by BM25 relevance descending, ties broken by title ascending.
6. WHEN search runs against a library of 500 songs on the target hardware THEN p95 latency SHALL be ≤ 100 ms.

**Notes:** Result objects include the song row only — highlighted snippets are out of scope for MVP; the operator clicks the song to see context.

---

### Area C — Set builder + Presentation

#### P1-08: Service set builder

Operator builds a named, dated service set by adding songs (and `Blank` separators) in order. Sets are persisted; the operator can save, reopen, and edit them between services.

**Acceptance criteria:**
1. WHEN the operator clicks "Novo conjunto" THEN a new in-memory set SHALL open with a default name `Culto — {today}` (pt-BR formatted date) and an empty item list.
2. WHEN the operator drags a song from the library list into the set THEN the song SHALL be appended as a `SetItem` of type `song` referencing the song id.
3. WHEN the operator drags items within the set list THEN the order SHALL change live (dnd-kit), with `sort_order` recomputed.
4. WHEN the operator removes an item from the set THEN it SHALL be removed from the in-memory set; persistence happens only on Save.
5. WHEN the operator clicks "Salvar conjunto" THEN `saveSet(payload)` SHALL upsert the set + items in a single transaction.
6. WHEN the operator clicks "Abrir conjunto" THEN a list of saved sets (sorted by `service_date` desc, then `updated_at` desc) SHALL be shown and selection loads it into the editor.
7. WHEN a `Blank` item is in the set THEN advancing onto it SHALL show a black screen on the presentation window with no text.

**Notes:** Set name and date are editable in the set header. `service_date` defaults to today's date.

---

#### P1-09: Lyrics presentation runtime

When the operator presses "Iniciar apresentação" on a set, the presentation window receives `PresentationState` and the operator drives advance / previous / blank / freeze. Both windows render the current slide; the operator console shows the current and next slide as previews.

**Acceptance criteria:**
1. WHEN the operator clicks "Iniciar apresentação" THEN if no presentation window exists, `open_presentation_window` SHALL be invoked and the set SHALL be loaded into `AppState.presentation`. `state_changed` is emitted.
2. WHEN the runtime is active and the operator triggers Advance THEN the backend SHALL move to the next slide of the current item; if the current item has no next slide, move to the next set item; if no next set item, the runtime ends (mode = `Idle`).
3. WHEN the operator triggers Previous THEN the inverse SHALL apply (previous slide → previous item's last slide → no-op at start).
4. WHEN the operator triggers Blank THEN `mode` SHALL toggle between `Blank` and the previous mode. Blank renders pure black on the presentation window.
5. WHEN the operator triggers Freeze THEN `mode` SHALL toggle between `Frozen` and the previous mode. Frozen keeps the presentation slide as-is while the operator continues to navigate in the console without affecting the audience view (operator-only preview moves).
6. WHEN the operator closes the presentation window THEN the runtime SHALL end gracefully (mode = `Idle`, set unloaded from `AppState.presentation`).
7. WHEN any of the above mutations occurs THEN the write guard on `AppState.presentation` SHALL be dropped before `app.emit("state_changed", …)` (architectural invariant).
8. WHEN both windows are listening THEN they SHALL stay in sync after every state change with no polling.

**Notes:** Freeze semantics — operator-side index advances while presentation-side renders the frozen slide. Implementation detail: presentation window listens for state_changed and only renders if `mode != Frozen` (or renders the snapshot taken at the moment freeze started).

---

#### P1-10: Keyboard shortcuts

The runtime is keyboard-first. The operator window has global key bindings. Bindings are hard-coded for MVP (customization is Phase 3).

**Acceptance criteria:**
1. WHEN the operator window has focus and presentation is `Live` or `Frozen` THEN the following keys SHALL trigger their actions: `Space` or `→` = Advance, `←` = Previous, `B` = Blank toggle, `F` = Freeze toggle, `Esc` = End presentation (closes presentation window), `1`-`9` = Jump to set item N (1-indexed).
2. WHEN the operator types in a text input or textarea THEN the global shortcuts SHALL NOT fire.
3. WHEN the presentation window has focus THEN the same shortcuts SHALL also work (both windows listen).
4. WHEN no presentation is active THEN none of the runtime shortcuts SHALL do anything (they are no-ops, not errors).

**Notes:** A help overlay listing shortcuts (triggered by `?`) is a nice-to-have stretch — flagged P2-within-Phase-1.

---

#### P1-11: Backgrounds — solid color and static image

Each song can specify a background: either a solid color (hex) or a static image referenced via `media.id`. The presentation renderer composites lyrics over the background.

**Acceptance criteria:**
1. WHEN a song has no background configured THEN the presentation SHALL fall back to the global default background from settings (solid black by default).
2. WHEN a song has a solid-color background THEN that color SHALL fill the presentation window behind the lyrics.
3. WHEN a song has a static image background (PNG/JPG/WebP) THEN the image SHALL be served via `asset://media/{file_name}` and rendered as a CSS `background-image` with `cover` sizing.
4. WHEN the background image is missing or fails to load THEN the renderer SHALL fall back to the global default (no error overlay during a live service).
5. WHEN the operator picks a background in the song editor THEN it SHALL be persisted as `songs.background_id` (image) or `songs.slide_config` JSON `bgColor` field (solid color).

**Notes:** Image upload UI in MVP is a "Choose file…" dialog (uses `tauri-plugin-dialog`) that copies the file into `media_dir` and inserts a `media` row. Full media library UI is Phase 2.

---

### Area D — Import wizards

#### P1-12: Plain-text import wizard

A wizard lets the operator paste raw lyrics text and convert it to a Song with auto-split sections. Sections are split on blank lines.

**Acceptance criteria:**
1. WHEN the operator opens "Importar > Texto simples" THEN a wizard SHALL show fields for title, artist (optional), and a large textarea for the lyrics body.
2. WHEN the operator pastes text and clicks "Pré-visualizar" THEN the wizard SHALL split the text on `\n\n` (blank line) into sections, label them `Estrofe 1`, `Estrofe 2`, … and show a preview of section cards.
3. WHEN a section first line is wrapped in `[brackets]` (e.g. `[Refrão]`) THEN the wizard SHALL use that label and strip the bracket line from the body. Recognized labels: `[Estrofe]`, `[Refrão]`, `[Ponte]`, `[Intro]`, `[Final]`, `[Pré-refrão]`, case-insensitive. Each maps to the matching `SectionType`.
4. WHEN the operator edits a section in the preview (label, type, body) THEN those edits SHALL be reflected on confirm.
5. WHEN the operator clicks "Importar" THEN a Song SHALL be created via `createSong` and the wizard SHALL close, navigating to the new song in the editor.

---

#### P1-13: Holyrics JSON import wizard

A wizard imports songs from a Holyrics JSON export file. Format is the array-of-songs structure resolved in B-1 (see STATE.md).

**Acceptance criteria:**
1. WHEN the operator opens "Importar > Holyrics" THEN the wizard SHALL prompt for a file via `tauri-plugin-dialog` filtered to `.json`.
2. WHEN the selected file parses as a top-level JSON array THEN the wizard SHALL show a list of detected songs (title + artist) with per-row checkboxes (all checked by default).
3. WHEN the file is invalid JSON or not the expected shape THEN the wizard SHALL show a Portuguese error message identifying the failure mode (e.g. "Arquivo não é um JSON válido", "Estrutura não reconhecida — esperado um array de músicas").
4. WHEN the operator confirms "Importar selecionadas" THEN for each checked song, the backend SHALL:
   - Generate a new UUID (do NOT reuse the Holyrics `id`).
   - Create a `Song` with `title`, `artist`, `language = 'pt'`, `source = 'holyrics'`.
   - Convert each `lyrics.paragraphs[]` entry into a `SongSection`:
     - `body` = paragraph `text` (preserve internal `\n`).
     - `label` = paragraph `description` if non-empty, else auto-label as `Estrofe N` where N is the 1-indexed paragraph number.
     - `type` = `verse` for MVP (heuristic detection deferred).
     - `sort_order` = paragraph `number` - 1 (0-indexed).
     - `repeat_count` = 1 (Holyrics doesn't model this in the sample).
5. WHEN import completes THEN the wizard SHALL show a summary (`X músicas importadas, Y ignoradas`) and offer a "Ver biblioteca" button.
6. WHEN a song with the same `title` and `artist` already exists in the library THEN the wizard SHALL flag it as a duplicate in the preview list and skip it by default (the operator can override with a "Importar mesmo assim" checkbox per row).
7. WHEN any per-song import fails THEN the failure SHALL be logged in the summary; remaining songs SHALL continue importing (per-song transaction).

**Notes:** `full_text` is ignored in favor of `paragraphs` per B-1 resolution. `streaming`, `bpm`, `key`, `arrangements`, `order` fields are dropped for MVP — they may return in Phase 3.

---

### Area E — Cross-cutting

#### P1-14: Settings — font, slide layout, monitor picker

A settings screen exposes global presentation preferences. Settings persist via the `settings` table (key/value JSON).

**Acceptance criteria:**
1. WHEN the operator opens "Configurações" THEN they SHALL see grouped controls for: presentation font family + size, default background color, default `max_lines` and `max_chars_per_line` (slide splitter), and a monitor picker.
2. WHEN the operator changes the font family THEN preview text in the settings screen SHALL update live, and on save the value SHALL be written to `settings` (key `presentation.font_family`).
3. WHEN the operator changes the monitor picker THEN saved value SHALL be the OS-reported monitor index. On next "Iniciar apresentação", the presentation window SHALL be positioned on that monitor (resolved via Tauri's monitor APIs).
4. WHEN only one monitor is detected THEN the picker SHALL show the single monitor and a hint "Conecte um segundo monitor para apresentação dupla" but still allow saving.
5. WHEN settings are saved THEN values SHALL be loaded at app startup into `AppState` and made available to the runtime.

**Notes:** Monitor index ordering is OS-dependent — flagged in CLAUDE.md as a real-hardware test risk. The settings UI MUST display the monitor's reported name and resolution alongside the index so the operator can identify it visually.

---

#### P1-15: Portuguese UI strings

All user-facing strings in the operator UI are written in Brazilian Portuguese, hard-coded directly in components. No i18n library, no translation keys.

**Acceptance criteria:**
1. WHEN the operator uses any screen in the app THEN every button label, heading, placeholder, tooltip, error message, and toast SHALL render in pt-BR.
2. WHEN a runtime error surfaces to the user (via toast or dialog) THEN its message SHALL be a Portuguese sentence (never a raw Rust/JS stack trace or English `sqlx` error).
3. WHEN dates are displayed THEN they SHALL use pt-BR formatting (`Intl.DateTimeFormat('pt-BR')`).
4. WHEN numbers are displayed THEN they SHALL use pt-BR formatting (comma as decimal separator where applicable).

**Notes:** Adding English (Phase 2) means introducing i18next and extracting these strings to locale files. Phase 1 keeps it simple.

---

## Edge Cases

Captured as forward-looking acceptance criteria — these are recurring failure modes the spec must address.

- WHEN the library is empty (first launch, post-install, no imports yet) THEN the song list SHALL show an empty-state with two CTAs: "Importar do Holyrics" and "Criar música manualmente".
- WHEN the operator presses Advance on the very last slide of the last set item THEN the presentation SHALL end gracefully (mode = `Idle`), NOT loop, NOT error.
- WHEN the operator imports a Holyrics file with 0 songs (empty array) THEN the wizard SHALL show "Nenhuma música encontrada no arquivo" and close.
- WHEN a Holyrics song has a `title` with only whitespace THEN the import SHALL skip it and count it in the "ignoradas" tally with a reason.
- WHEN a song has zero sections (all deleted) THEN save SHALL fail validation with a pt-BR error.
- WHEN the operator deletes a song that is referenced by a saved set THEN the soft delete SHALL succeed; the set's reference becomes a "música removida" placeholder in the set list and SHALL render as `Blank` if encountered during presentation.
- WHEN two monitors are configured but the second is disconnected at the moment "Iniciar apresentação" is pressed THEN the presentation window SHALL open on the primary monitor with a warning toast.
- WHEN the operator's keyboard is set to a non-English layout AND uses `1`–`9` THEN the digit shortcuts SHALL still work (keyboard event `code === 'Digit1'`, not `key`).

---

## Requirement Traceability

| ID | Story / Area | Phase | Status |
|---|---|---|---|
| P1-01 | A — Foundation: domain types | Design | Pending |
| P1-02 | A — Foundation: FTS migration 002 | Design | Pending |
| P1-03 | A — Foundation: slide_splitter | Design | Pending |
| P1-04 | B — Song mgmt: CRUD commands | Design | Pending |
| P1-05 | B — Song mgmt: editor UI | Design | Pending |
| P1-06 | B — Song mgmt: dnd-kit reorder | Design | Pending |
| P1-07 | B — Song mgmt: FTS search | Design | Pending |
| P1-08 | C — Set + presentation: set builder | Design | Pending |
| P1-09 | C — Set + presentation: runtime | Design | Pending |
| P1-10 | C — Set + presentation: shortcuts | Design | Pending |
| P1-11 | C — Set + presentation: backgrounds | Design | Pending |
| P1-12 | D — Import: plain-text wizard | Design | Pending |
| P1-13 | D — Import: Holyrics wizard | Design | Pending |
| P1-14 | E — Cross-cutting: settings | Design | Pending |
| P1-15 | E — Cross-cutting: pt-BR strings | Design | Pending |

**Coverage:** 15 total, 0 mapped to tasks yet, 15 pending design.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

---

## Success Criteria

Phase 1 is done when ALL of the following are true:

- [ ] The Holyrics export the user provided imports cleanly, with all songs and sections preserved.
- [ ] The operator can create a new song manually, edit and reorder its sections, and save without errors.
- [ ] Search returns results matching title, artist, OR lyric body in under 100 ms on a 500-song library.
- [ ] A 5-song set can be built, saved, reopened, and presented end-to-end using only the keyboard once the presentation starts.
- [ ] The presentation window renders correctly on a real second monitor (test on actual hardware, two displays).
- [ ] Blank and Freeze behave per spec under live use.
- [ ] All user-facing strings are in Brazilian Portuguese.
- [ ] `cargo test` and `npx vitest run` both pass green; `tsc --noEmit` is clean.
- [ ] The app is used in one real Sunday service. (Project-level goal from PROJECT.md.)

---

## Decisions still open (candidates for Discuss / Design)

These are gray areas I've proposed defaults for, but each could go differently. Flag any you want to revisit before design:

1. **slide_splitter defaults** (P1-03): proposed `max_lines = 4`, `max_chars_per_line = 60`. Holyrics-typical. Reasonable? Tunable in settings (P1-14).
2. **Section type heuristic on Holyrics import** (P1-13): proposed `type = verse` always. Alternative: detect repeated paragraphs as `chorus`. Smarter but error-prone — I deferred it.
3. **Freeze semantics** (P1-09): proposed "operator advances internal index, presentation stays put; on un-freeze the presentation jumps to operator's current slide". Alternative: "freeze locks both — operator can't navigate either". The proposed model is more useful but more complex.
4. **Duplicate detection on import** (P1-13): proposed title+artist match. Could be title-only, or normalized (case-insensitive, whitespace-collapsed) match. Normalized is probably safer — confirm?
5. **Set item deletion** (edge case): proposed soft-delete preserves saved sets via placeholder. Alternative: cascade-delete from sets too (cleaner but loses history). Soft delete with placeholder feels right but adds renderer complexity.
6. **`?` shortcut for help overlay** (P1-10 notes): include as P2-within-Phase-1, or punt to Phase 3?
