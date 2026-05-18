# Phase 1: MVP Tasks — Lyrics + Holyrics Import

**Spec:** `.specs/features/phase1-mvp/spec.md` (15 requirements P1-01..P1-15)
**Status:** Drafted 2026-05-18 — awaiting execution
**Last updated:** 2026-05-18

---

## Decisions adopted during task planning

Resolved from the spec's "Decisions still open" list so tasks can proceed without ambiguity. Revisit in design if any of these are wrong.

| # | Decision | Adopted | Notes |
|---|---|---|---|
| TD-1 | slide_splitter defaults (P1-03) | `max_lines = 4`, `max_chars_per_line = 60` | Tunable in settings (P1-14). |
| TD-2 | Holyrics section type heuristic (P1-13) | All sections as `verse` | Smarter detection deferred to Phase 3. |
| TD-3 | Freeze semantics (P1-09) | Operator-side index advances; presentation-side renders the frozen snapshot until un-freeze, then jumps to operator's current slide | The "more useful but more complex" model from the spec. |
| TD-4 | Duplicate detection on Holyrics import (P1-13) | Normalized title+artist (lowercase, collapsed whitespace) | Safer than raw equality. |
| TD-5 | Set item deletion when song is soft-deleted | Set retains the reference; renderer treats it as `Blank` with a placeholder label `"(música removida)"` in the set list | Preserves set history. |
| TD-6 | `?` help overlay shortcut (P1-10 notes) | **Punted to Phase 3** | Keeps Phase 1 scope tight. |

---

## Execution Plan

### Phase A: Foundation (mostly parallel)

```
T1 [P] (domain types)         T2 [P] (FTS migration 002)
            ↓
         T3 (slide_splitter — needs SongSection from T1)
```

### Phase B: Song management

```
T1 + T2 → T4 (song CRUD commands)
           ↓
   ┌───────┼────────┐
   T5 [P]  T6 [P]   T14 [P]   T15 [P]
 library  editor    text-import  holyrics-import
           ↓
          T7 (dnd-kit reorder)
```

### Phase C: Sets + Presentation runtime

```
T4 → T8 (set CRUD commands)
        ↓
   ┌────┴─────┐
   T9         T10 (PresentationState + runtime commands; needs T1, T3, T8)
 set builder UI    ↓
   └────┬─────┘    T11 (presentation window slide renderer + operator preview)
        ↓               ↓
                       T12 (keyboard shortcuts)
                       T13 (backgrounds — needs T6 editor + T11 renderer)
```

### Phase D: Cross-cutting

```
T10 → T16 (settings — needs presentation runtime for monitor picker)
all UI tasks → T17 (pt-BR audit, final pass)
```

---

## Task Breakdown

---

### T1: Domain model types (Rust + TS mirrors) [P]

**What:** Add Rust domain types and TypeScript mirrors that the rest of Phase 1 operates on. Pure data — no I/O, no async, no DB-touching methods.
**Where:**
- `src-tauri/src/domain/song.rs` (create) — `Song`, `SongSection`, `SectionType`
- `src-tauri/src/domain/set.rs` (create) — `ServiceSet`, `SetItem`, `SetItemType`
- `src-tauri/src/domain/presentation.rs` (create) — `PresentationState`, `PresentationMode`
- `src-tauri/src/domain/slide.rs` (create) — `Slide`, `SlideConfig` (used by T3)
- `src-tauri/src/domain/mod.rs` (modify — uncomment the submodule declarations)
- `src/types/index.ts` (create) — TS interfaces mirroring every Rust domain type
**Depends on:** None
**Requirement:** P1-01

**Done when:**
- [ ] All Rust types derive `Serialize, Deserialize, Clone, Debug, PartialEq` and carry `#[serde(rename_all = "camelCase")]`.
- [ ] `SectionType` is an enum with `Verse|Chorus|Bridge|PreChorus|Outro|Interlude|Tag`, serialized as `verse|chorus|bridge|pre_chorus|outro|interlude|tag` to match the existing SQL schema (use `#[serde(rename_all = "snake_case")]` on the enum).
- [ ] `SetItemType` for Phase 1 has only `Song` and `Blank` variants (others reserved for Phase 2 — left as a `TODO` comment).
- [ ] `PresentationMode` is `Idle|Live|Blank|Frozen`.
- [ ] `PresentationState` carries `set: Option<ServiceSet>`, `current_item_index: usize`, `current_slide_index: usize`, `mode: PresentationMode`.
- [ ] `src/types/index.ts` declares matching TS interfaces with camelCase property names; types are exported.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` green; `tsc --noEmit` clean.

**Tests:** unit — a single Rust test that round-trips each top-level type through `serde_json::to_string` / `from_str` and asserts camelCase field names appear on the wire.
**Gate:** quick (cargo + tsc)
**Commit:** `feat(domain): add Song, ServiceSet, PresentationState types with TS mirrors`

---

### T2: FTS migration 002 — complete triggers and rebuild [P]

**What:** Add migration `002_fts_complete.sql` that fixes the half-wired FTS5 setup from migration 001. INSERT/UPDATE/DELETE triggers on `songs` and on `song_sections` keep `songs_fts.body` in sync with the concatenated section bodies. Backfill existing rows.
**Where:**
- `src-tauri/migrations/002_fts_complete.sql` (create)
- `src-tauri/tests/fts.rs` (create) — integration test that opens an in-memory or temp-dir SQLite, runs migrations, inserts a song + sections, queries FTS by lyric-only body text, asserts the song is returned.
**Depends on:** None
**Requirement:** P1-02

**Done when:**
- [ ] Migration drops the legacy `songs_fts_insert` trigger from 001 and creates the full trigger set: `songs_ai/au/ad` on `songs`, and `song_sections_ai/au/ad` on `song_sections`, each re-deriving the parent song's `songs_fts.body` as the `\n\n`-joined `body` of its sections in `sort_order`.
- [ ] Migration rebuilds existing FTS rows once (`DELETE FROM songs_fts; INSERT INTO songs_fts(rowid, title, artist, body) SELECT s.rowid, s.title, s.artist, COALESCE(...joined sections..., '') FROM songs s WHERE s.deleted_at IS NULL;`).
- [ ] Integration test inserts a song with a section whose body contains a unique phrase (e.g. `"o tronco mais alto da floresta"`), queries `MATCH 'tronco'`, and asserts the song's id is returned.
- [ ] `cargo test` green.
- [ ] `npm run tauri dev` starts and logs both migrations running cleanly the first time, and is a no-op on subsequent runs.

**Tests:** integration (Rust, against a temp SQLite file)
**Gate:** quick (cargo test)
**Commit:** `feat(db): complete FTS5 triggers and backfill in migration 002`

---

### T3: slide_splitter pure service

**What:** Implement `services::slide_splitter::split(section, config) -> Vec<Slide>`. Pure function — no I/O, no async. Fully unit-tested per the six cases in the spec.
**Where:**
- `src-tauri/src/services/slide_splitter.rs` (create)
- `src-tauri/src/services/mod.rs` (modify — uncomment `pub mod slide_splitter;`)
**Depends on:** T1 (uses `SongSection`, `Slide`, `SlideConfig` types)
**Requirement:** P1-03

**Done when:**
- [ ] `split(section: &SongSection, config: &SlideConfig) -> Vec<Slide>` exists and is `pub`.
- [ ] Groups consecutive non-empty lines into slides up to `config.max_lines` lines per slide.
- [ ] A blank line inside the body forces a slide boundary (Holyrics paragraph convention).
- [ ] Lines exceeding `config.max_chars_per_line` wrap on the nearest preceding whitespace; if none, hard-break at the limit.
- [ ] `repeat_count > 1` emits the resulting slides `repeat_count` times in sequence.
- [ ] Empty or whitespace-only body returns `vec![]`.
- [ ] `SlideConfig::default()` returns `max_lines = 4`, `max_chars_per_line = 60` (TD-1).
- [ ] Unit tests cover: single-slide, multi-slide by line count, line wrapping (both whitespace and hard-break), empty body, `repeat_count > 1`, mixed blank lines as paragraph separators. ≥ 6 distinct test cases.
- [ ] `cargo test` green.

**Tests:** unit (Rust)
**Gate:** quick (cargo test)
**Commit:** `feat(services): add pure slide_splitter with unit tests`

---

### T4: Song CRUD Tauri commands

**What:** Backend `createSong`, `updateSong`, `deleteSong` (soft), `listSongs`, `getSong`. Soft delete via `songs.deleted_at`. UUIDv7 ids generated server-side. All write paths are single transactions. Errors return human-readable pt-BR messages.
**Where:**
- `src-tauri/src/commands/song.rs` (create)
- `src-tauri/src/commands/mod.rs` (modify — `pub mod song;`)
- `src-tauri/src/lib.rs` (modify — register `create_song, update_song, delete_song, list_songs, get_song` in `invoke_handler![]`)
- `src-tauri/Cargo.toml` (modify — add `uuid = { version = "1", features = ["v7", "serde"] }` if not present)
- `src/api/commands.ts` (modify — export `createSong, updateSong, deleteSong, listSongs, getSong` wrappers, typed against `src/types/index.ts`)
**Depends on:** T1 (types), T2 (FTS triggers are in place so writes keep FTS sane)
**Requirement:** P1-04

**Done when:**
- [ ] `createSong` inserts the `songs` row + N `song_sections` rows in a single `sqlx` transaction; returns the new `Song` with all sections.
- [ ] `updateSong` updates the song header, deletes all existing sections, re-inserts from the payload — all in one transaction. `created_at` preserved; `updated_at` set to `now_ms()`.
- [ ] `deleteSong(id)` sets `deleted_at = now_ms()` and returns `Ok(())`. Hard delete is not implemented.
- [ ] `listSongs({ search?: string, limit?: u32, offset?: u32 })` returns a `Vec<Song>` of non-deleted songs, sorted by title ASC. **`search` is consumed by T8 (P1-07) — for T4 the parameter is accepted and ignored (or implemented as a stub LIKE on title) so the signature is stable.**
- [ ] `getSong(id)` returns the song with all its sections in `sort_order`.
- [ ] Errors are mapped to Portuguese strings ("Música não encontrada", "Falha ao salvar música: ...", etc.) before returning `Result<T, String>`.
- [ ] `state_changed` is emitted after each mutation (payload TBD by T10; for T4 use a placeholder `MediaLibraryChanged`-style event or just `songs_changed`). The write guard MUST be dropped before `emit` (architectural invariant).
- [ ] At least one Rust integration test per command exercising the temp-DB harness from T2.
- [ ] Frontend wrappers in `src/api/commands.ts` are typed; **no raw `invoke()` calls outside this file** (CLAUDE.md invariant).

**Tests:** integration (Rust, temp DB) — one per command
**Gate:** quick (cargo test)
**Commit:** `feat(songs): add CRUD commands with transactional writes and pt-BR errors`

---

### T5: Library screen — list + empty state [P]

**What:** React screen that lists all non-deleted songs. Empty-state shows two CTAs ("Importar do Holyrics", "Criar música manualmente"). Search box is wired but the FTS behavior is delivered in T8 — for T5 it calls `listSongs({ search })` and trusts the backend.
**Where:**
- `src/components/library/SongList.tsx` (create)
- `src/components/library/EmptyState.tsx` (create)
- `src/components/library/SongListItem.tsx` (create)
- `src/windows/operator/OperatorApp.tsx` (modify — mount the library screen as the operator's home view; remove the Phase 0 counter UI)
- `src/stores/library.ts` (create) — Zustand store: `{ songs, isLoading, search, setSearch, refresh }`
**Depends on:** T4
**Requirement:** P1-05 (list portion), edge cases (empty library)

**Done when:**
- [ ] Library screen renders all songs returned by `listSongs({})`. Each row shows title, artist (if present), and section count.
- [ ] Empty state renders when `songs.length === 0` with both CTAs as `<button>` elements (wired to no-op handlers — T14/T15/T6 implement the routes).
- [ ] Search input is present and bound to `library.setSearch`; typing debounces 150ms then calls `listSongs({ search })`.
- [ ] OperatorApp no longer shows the Phase 0 counter — Phase 0 demo code (`<button>Open Presentation Window</button>` stays, counter button is gone; the test in `OperatorApp.test.tsx` updates accordingly).
- [ ] Component test: renders 0-song state, asserts both CTAs visible; renders with 2 mock songs (via mocked `invoke`), asserts both rows visible.
- [ ] `npx vitest run` green; `tsc --noEmit` clean.

**Tests:** component (Vitest + Testing Library with Tauri API mocks, modeled on existing `OperatorApp.test.tsx`)
**Gate:** quick (vitest + tsc)
**Commit:** `feat(library): add song list screen with empty state and search input`

---

### T6: Song editor UI [P]

**What:** React form to create or edit a song: title, artist, language, notes, ordered sections (label, type, body, repeat_count). Wired through `src/api/commands.ts`. Includes Save / Delete confirmation. Background picker is added in T13.
**Where:**
- `src/components/library/SongEditor.tsx` (create)
- `src/components/library/SectionCard.tsx` (create) — a single section row (used by T7 for drag handle wiring)
- `src/components/common/ConfirmDialog.tsx` (create) — used for delete confirmation; reused later
- `src/windows/operator/OperatorApp.tsx` (modify — route between Library and Editor; simple state-based router is fine for MVP)
- `src/stores/library.ts` (modify — add `editingSongId: string | null`, `openEditor(id?)`, `closeEditor()`)
**Depends on:** T4
**Requirement:** P1-05

**Done when:**
- [ ] Opening the editor with no id shows empty fields and a default first section `Estrofe 1`, type `verse`, empty body.
- [ ] Opening with an id calls `getSong(id)` and populates the form. Unsaved edits persist while navigating within the editor (kept in component state, not lost on internal nav).
- [ ] "Salvar" calls `createSong` or `updateSong`, shows a success toast (pt-BR — "Música salva"), then closes the editor (returns to library list which is refreshed).
- [ ] "Excluir" opens `ConfirmDialog` ("Excluir esta música? Esta ação pode ser desfeita."); on confirm calls `deleteSong`, toasts, closes.
- [ ] Validation: title required (non-whitespace), at least one section with non-empty body required. Inline pt-BR error messages; Save button disabled until valid.
- [ ] "Adicionar seção" appends a section with type `verse` and an auto-suggested label (`Estrofe N` for verse, `Refrão N` for chorus, etc., based on the count of existing sections of that type).
- [ ] Component test asserts: empty form renders with default section, validation blocks save, populated form calls `updateSong`, delete confirmation flow calls `deleteSong`.

**Tests:** component (Vitest + Testing Library)
**Gate:** quick (vitest + tsc)
**Commit:** `feat(songs): add song editor with validation and confirm-delete flow`

---

### T7: dnd-kit section reorder

**What:** Wrap the section list in `@dnd-kit/sortable`'s `SortableContext`. Each `SectionCard` exposes a drag handle. New order persists to component state immediately; commits to DB only on Save (per spec).
**Where:**
- `src/components/library/SongEditor.tsx` (modify — wrap sections in `DndContext` + `SortableContext`)
- `src/components/library/SectionCard.tsx` (modify — use `useSortable`, render drag handle with `<GripVertical>` icon)
- `package.json` (modify — add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` if not present)
**Depends on:** T6
**Requirement:** P1-06

**Done when:**
- [ ] Dragging by the handle reorders visibly with a drop indicator.
- [ ] Release commits the new order to local state.
- [ ] Arrow-key reorder works (dnd-kit `KeyboardSensor` defaults — pick up with Space, move with arrows, drop with Space).
- [ ] On save, `song_sections.sort_order` reflects the new order (0-indexed, dense). Verified by reopening the song and asserting order persists.
- [ ] Component test: render editor with 3 sections, simulate keyboard reorder (down arrow on focused handle), assert new order in DOM and in the payload passed to `updateSong`.

**Tests:** component
**Gate:** quick (vitest + tsc)
**Commit:** `feat(songs): add dnd-kit section reordering inside song editor`

---

### T8: FTS search — backend search + result ordering

**What:** Implement `listSongs({ search })` against FTS5 with BM25 ordering. Sanitize invalid FTS5 syntax and fall back to a prefix-LIKE query. Wire the operator search box from T5 to actually return ranked matches.
**Where:**
- `src-tauri/src/commands/song.rs` (modify — replace stub search with real FTS5 query)
- `src-tauri/src/services/fts_query.rs` (create) — `sanitize(input: &str) -> Sanitized { Fts5(String) | Like(String) }`
- `src-tauri/src/services/mod.rs` (modify — `pub mod fts_query;`)
- `src/components/library/SongList.tsx` (modify — already calls `listSongs({ search })`; no changes expected unless the result shape changed)
**Depends on:** T4, T2

**Requirement:** P1-07

**Done when:**
- [ ] Non-empty `search` runs `SELECT s.* FROM songs s JOIN songs_fts ON songs_fts.rowid = s.rowid WHERE songs_fts MATCH ? AND s.deleted_at IS NULL ORDER BY bm25(songs_fts), s.title;`.
- [ ] Empty `search` returns all non-deleted songs sorted by title ASC.
- [ ] Lyric-only matches (the body contains the term but the title/artist do not) appear in results.
- [ ] Invalid FTS5 input (e.g. `"unbalanced) quote`) is caught: `fts_query::sanitize` detects unbalanced quotes/parens and downgrades to a `LIKE '%term%'` against title/artist/body.
- [ ] Integration test in `src-tauri/tests/fts.rs` (extend T2's): seeds 3 songs, searches by a body-only term, asserts the right song returns; searches by an invalid query, asserts no error and a sensible result.
- [ ] **Perf note:** measure p95 latency against a 500-song seed and document it in the task PR description (target ≤ 100 ms per spec). If the bench file is too heavy for the test harness, leave it as a manual measurement gated by a `#[ignore]` test.

**Tests:** integration (Rust, temp DB)
**Gate:** quick (cargo test)
**Commit:** `feat(search): implement FTS5 song search with BM25 ranking and LIKE fallback`

---

### T9: Set CRUD commands

**What:** Backend `createSet`, `updateSet`, `deleteSet`, `listSets`, `getSet`. Upsert pattern: `saveSet(payload)` calls into create or update based on whether the id exists. Set name defaults to `"Culto — {today}"` only on the frontend (T10) — backend just stores what it receives.
**Where:**
- `src-tauri/src/commands/set.rs` (create)
- `src-tauri/src/commands/mod.rs` (modify — `pub mod set;`)
- `src-tauri/src/lib.rs` (modify — register set commands in `invoke_handler![]`)
- `src/api/commands.ts` (modify — export `saveSet, deleteSet, listSets, getSet`)
**Depends on:** T1, T4 (set items reference songs by id; validation needs songs to exist)
**Requirement:** P1-08 (backend portion)

**Done when:**
- [ ] `saveSet(payload)` upserts the `sets` row and replaces `set_items` (delete + re-insert) in one transaction; returns the saved `ServiceSet` with items.
- [ ] `deleteSet(id)` hard-deletes the set (no soft delete for sets in Phase 1). `set_items` cascade per the existing FK.
- [ ] `listSets()` returns sets sorted by `service_date` DESC NULLS LAST, then `updated_at` DESC.
- [ ] `getSet(id)` returns the set with items in `sort_order`.
- [ ] Items that reference a song where `songs.deleted_at IS NOT NULL` still load — the frontend renders them as "(música removida)" per TD-5; backend does NOT filter them out.
- [ ] `state_changed` (or a `sets_changed` placeholder) emitted on each mutation; write guard dropped before emit.
- [ ] Integration tests: create set with 2 song items + 1 blank, reload, assert order and types; update with reordered items, reload, assert; reference a soft-deleted song, assert item still loads.

**Tests:** integration (Rust, temp DB)
**Gate:** quick (cargo test)
**Commit:** `feat(sets): add set CRUD commands with item upsert in transaction`

---

### T10: PresentationState in AppState + runtime commands

**What:** Replace the Phase 0 `counter: Arc<RwLock<i32>>` with `presentation: Arc<RwLock<PresentationState>>`. Add commands `startPresentation(setId)`, `advanceSlide()`, `previousSlide()`, `toggleBlank()`, `toggleFreeze()`, `endPresentation()`, `jumpToItem(index)`. All mutations drop the write guard before emitting `state_changed`.
**Where:**
- `src-tauri/src/state.rs` (modify — swap counter for `presentation: Arc<RwLock<PresentationState>>`; keep `db` field as-is)
- `src-tauri/src/commands/presentation.rs` (create) — the runtime commands
- `src-tauri/src/commands/counter.rs` (delete — Phase 0 demo retired; keep the `StateChangedPayload` struct or replace with a new `PresentationStatePayload`)
- `src-tauri/src/commands/mod.rs` (modify — remove counter, add presentation)
- `src-tauri/src/commands/window.rs` (modify — `open_presentation_window` now also takes an optional `position_on_monitor` arg, defaulting to settings-derived value; integrates with T16)
- `src-tauri/src/lib.rs` (modify — drop counter from `invoke_handler![]`, add presentation commands)
- `src/api/commands.ts` (modify — remove `incrementCounter`, add `startPresentation, advanceSlide, previousSlide, toggleBlank, toggleFreeze, endPresentation, jumpToItem`)
**Depends on:** T1, T3, T9
**Requirement:** P1-09 (backend portion)

**Done when:**
- [ ] `AppState.presentation` is the single source of truth; `current_item_index`, `current_slide_index`, and `mode` evolve only through these commands.
- [ ] Advance moves to the next slide of the current item; if exhausted, advances `current_item_index` and resets `current_slide_index = 0`. If past the last item, sets `mode = Idle` and clears `set` to `None` (runtime ends).
- [ ] Previous mirrors Advance (previous slide → previous item's last slide → no-op at start).
- [ ] Blank toggles `mode` between `Blank` and the previously-active mode (a `previous_mode` field on `PresentationState` may be needed; or recompute by checking `set.is_some()`).
- [ ] Freeze per TD-3: presentation window stashes a snapshot of `(item_index, slide_index)` at the moment freeze flips on; operator continues to mutate state; on un-freeze, the snapshot is dropped and the presentation jumps to the current operator slide. Implementation detail: the snapshot lives in `PresentationState.frozen_at: Option<(usize, usize)>` and is set/cleared by `toggleFreeze`.
- [ ] On window-close of the presentation window, the runtime ends (`mode = Idle`, set unloaded). Detect via a window event listener in `lib.rs` setup.
- [ ] EVERY mutation path: acquire write guard → mutate → drop guard → `app.emit("state_changed", &snapshot)`.
- [ ] Slides for the current item are computed via `slide_splitter::split(section, &config)` for each section in order, where `config` is loaded from settings (T16) or `SlideConfig::default()` if unset.
- [ ] Phase 0 counter demo fully retired — no leftover `incrementCounter` reachable from the frontend.
- [ ] Integration tests: build a `ServiceSet` in memory, drive a full advance/previous cycle through 3 items × 2 slides each, assert end-of-runtime behavior; blank toggle round-trip; freeze toggle round-trip with snapshot.

**Tests:** integration (Rust) — drive commands against an `AppState` directly without a running Tauri runtime; emit calls can be stubbed by extracting the mutation logic into a `presentation::engine` module with `advance(state: &mut PresentationState, ...)` pure functions.
**Gate:** full (cargo test + vitest — vitest will start failing on the old counter test until T5/T11 land; that's OK if T10 is followed promptly)
**Commit:** `feat(presentation): replace counter with PresentationState and runtime commands`

---

### T11: Presentation window slide renderer + operator preview console

**What:** The presentation window subscribes to `state_changed` and renders the current slide (or solid black for `Blank`, or its frozen snapshot for `Frozen`). The operator window adds a "Run" console showing current and next slide previews, plus runtime control buttons.
**Where:**
- `src/windows/presentation/PresentationApp.tsx` (modify — remove Phase 0 counter / test video; subscribe to `state_changed`; render slide via `SlideRenderer`)
- `src/components/presentation/SlideRenderer.tsx` (create) — given `PresentationState` + `Slide`, renders one slide with default font/size from settings
- `src/components/presentation/RunConsole.tsx` (create) — operator-side console: shows current/next slide previews, runtime buttons (Advance / Previous / Blank / Freeze / End), and current item title
- `src/windows/operator/OperatorApp.tsx` (modify — route to RunConsole when `presentation.set.is_some()`, otherwise show Library)
- `src/stores/presentation.ts` (create) — Zustand store: projection of the Rust `PresentationState`, updated by the `state_changed` event listener; never mutated directly from the frontend
- `src/main.tsx` (verify the window-label branch still works)
**Depends on:** T10
**Requirement:** P1-09 (frontend portion)

**Done when:**
- [ ] Both windows mount a single `state_changed` listener at app boot (registered once, cleaned up on unmount). Listener updates `src/stores/presentation.ts`.
- [ ] Presentation window renders the current slide centered, default font Inter, default color white on black. Falls back to a black screen when `set` is `None` or `mode == Blank`.
- [ ] When `mode == Frozen`, the presentation window renders the slide pointed to by `state.frozen_at` (not the live `current_*` indices).
- [ ] Operator's `RunConsole` shows current slide preview (large) and next slide preview (small), plus the 5 runtime buttons. Buttons call the T10 commands.
- [ ] Operator returns to Library when `endPresentation` runs.
- [ ] Component tests for `SlideRenderer`: renders a slide with N lines, renders black on Blank, renders the frozen slide when frozen.
- [ ] Manual verification: two-window run with a 2-song set, advance through both with mouse, blank toggle, freeze toggle.

**Tests:** component (Vitest + Testing Library); manual for two-window verification
**Gate:** full (cargo + vitest)
**Commit:** `feat(presentation): add slide renderer and operator run console`

---

### T12: Keyboard shortcuts

**What:** Global key bindings on both windows. Hard-coded; ignored when focus is on a text input or textarea. Uses `event.code` (not `event.key`) for digits per the spec edge case.
**Where:**
- `src/hooks/usePresentationShortcuts.ts` (create) — adds and removes a `keydown` listener on `window`; calls T10 command wrappers
- `src/windows/operator/OperatorApp.tsx` (modify — mount the hook unconditionally; the hook itself checks runtime state)
- `src/windows/presentation/PresentationApp.tsx` (modify — same)
**Depends on:** T11
**Requirement:** P1-10

**Done when:**
- [ ] Hook handles: `Space`/`ArrowRight` → advance, `ArrowLeft` → previous, `KeyB` → toggle blank, `KeyF` → toggle freeze, `Escape` → endPresentation, `Digit1`..`Digit9` → jumpToItem(N-1).
- [ ] Hook uses `event.code` for digits (so non-English layouts still work — spec edge case).
- [ ] Hook detects focused text input: skips dispatch when `document.activeElement` is `<input>`, `<textarea>`, or `contenteditable`.
- [ ] Hook is a no-op when `presentation.set === null` or `presentation.mode === Idle`.
- [ ] Component test: mount hook, dispatch synthetic keyboard events, assert the matching mock command was called.
- [ ] Manual verification: drive a full set with only the keyboard.

**Tests:** component (synthetic keyboard events) + manual
**Gate:** quick (vitest + tsc)
**Commit:** `feat(presentation): add keyboard shortcuts for runtime control`

---

### T13: Backgrounds — solid color + static image

**What:** Background picker in the song editor (solid hex or pick image from disk). Image picker uses `tauri-plugin-dialog`, copies the chosen file into `media_dir`, inserts a `media` row, sets `songs.background_id`. Presentation renderer composites lyrics over the background.
**Where:**
- `src-tauri/src/commands/media.rs` (create) — `importMediaFile(srcPath) -> Media`: copy file into `media_dir`, insert media row, return record
- `src-tauri/src/commands/mod.rs` (modify — `pub mod media;`)
- `src-tauri/src/lib.rs` (modify — register `import_media_file` in `invoke_handler![]`)
- `src/api/commands.ts` (modify — export `importMediaFile`)
- `src/components/library/BackgroundPicker.tsx` (create) — radio group: "Nenhum" / "Cor sólida" / "Imagem"; color input for solid; "Escolher arquivo…" for image (uses `@tauri-apps/plugin-dialog`)
- `src/components/library/SongEditor.tsx` (modify — embed `BackgroundPicker` and persist into `song.background_id` or `song.slideConfig.bgColor`)
- `src/components/presentation/SlideRenderer.tsx` (modify — render background under the slide text; solid via CSS background-color, image via `<div style={{ backgroundImage: 'url(asset://media/...)' }}>`)
**Depends on:** T6, T11
**Requirement:** P1-11

**Done when:**
- [ ] Songs with no background fall back to the global default (solid black until T16 wires settings, then settings-derived).
- [ ] Solid color background renders behind lyrics.
- [ ] Image background loaded via `asset://media/{file_name}` renders with `background-size: cover`.
- [ ] Failed image load (404 from asset handler, broken asset) falls back to the default — no error overlay during runtime.
- [ ] `importMediaFile` validates extension (PNG/JPG/WebP only for backgrounds in Phase 1) and rejects others with a pt-BR error.
- [ ] Picker test: render editor, choose a color, assert payload includes `slideConfig.bgColor`; mock `importMediaFile` to return a media row, choose image, assert payload includes `background_id`.

**Tests:** component (UI) + integration (Rust, for `importMediaFile`)
**Gate:** full (cargo + vitest)
**Commit:** `feat(songs): add solid color and image background picker with media import`

---

### T14: Set builder UI

**What:** React screen to build/edit a service set. Drag songs from the library list into the set, reorder with dnd-kit, save via T9. Name defaults to `"Culto — {today}"` (pt-BR formatted).
**Where:**
- `src/components/setbuilder/SetBuilder.tsx` (create) — main screen: library drag source on the left, set items on the right
- `src/components/setbuilder/SetItemCard.tsx` (create) — single set item (song or blank); uses `useSortable`
- `src/components/setbuilder/SetList.tsx` (create) — list of saved sets, sorted per spec
- `src/stores/setbuilder.ts` (create) — editing-set state: items, dirty flag, save handler
- `src/windows/operator/OperatorApp.tsx` (modify — add "Conjuntos" route)
**Depends on:** T9, T5

**Requirement:** P1-08 (frontend portion)

**Done when:**
- [ ] "Novo conjunto" opens an editor with default name `"Culto — DD/MM/AAAA"` (pt-BR via `Intl.DateTimeFormat('pt-BR')`).
- [ ] Drag from library list into set list appends a `song` item.
- [ ] "Adicionar blank" button appends a `blank` item.
- [ ] dnd-kit reorder within the set list works (mouse + keyboard).
- [ ] Remove button on each item removes it from local state.
- [ ] "Salvar conjunto" calls `saveSet`; on success, toasts and stays on the editor with `dirty = false`.
- [ ] "Abrir conjunto" shows `listSets()` results in the spec's sort order; clicking loads via `getSet`.
- [ ] Set list renders items referencing soft-deleted songs as `"(música removida)"` per TD-5; advancing onto such an item in T10 is treated as `Blank` automatically (already covered by T10 since the renderer falls back).
- [ ] Component tests for: new set name default, drag-append (simulate with dnd-kit kit-test-utils or direct state mutation in tests), save round-trip.

**Tests:** component + integration with mocked commands
**Gate:** full (cargo + vitest)
**Commit:** `feat(sets): add set builder UI with drag-from-library and dnd-kit reorder`

---

### T15: Plain-text import wizard [P]

**What:** Wizard that turns pasted lyrics into a Song with auto-split sections. Splits on blank lines; bracket-prefixed first lines (`[Refrão]`, etc.) set the section label/type.
**Where:**
- `src/components/import/PlainTextImport.tsx` (create)
- `src-tauri/src/services/text_import.rs` (create) — `parse_plain_text(input: &str) -> Vec<ParsedSection>` (pure Rust; reused for testability)
- `src-tauri/src/services/mod.rs` (modify — `pub mod text_import;`)
- `src/components/import/ImportWizardFrame.tsx` (create) — shared wizard chrome reused by T15 + T16 (next/back/cancel + step indicator)
- `src/windows/operator/OperatorApp.tsx` (modify — wire "Importar > Texto simples" entry)
**Depends on:** T4, T6 (navigate to editor after import)
**Requirement:** P1-12

**Done when:**
- [ ] Wizard step 1: title + optional artist + textarea.
- [ ] Step 2 "Pré-visualizar": shows section cards parsed via `parse_plain_text`. Bracket labels: `[Estrofe]`, `[Refrão]`, `[Ponte]`, `[Intro]`, `[Final]`, `[Pré-refrão]` (case-insensitive) map to `verse|chorus|bridge|intro|outro|pre_chorus`. Anything else (e.g. unknown bracket) is kept as the label with type `verse`.
- [ ] Editable preview: label, type, and body can all be changed in place before importing.
- [ ] "Importar" calls `createSong`; on success closes the wizard and navigates to the new song in the editor.
- [ ] Rust unit tests for `parse_plain_text`: blank-line split, bracket recognition (all six labels), case insensitivity, no-bracket fallback, empty input.

**Tests:** unit (Rust parser) + component (wizard flow with mocked commands)
**Gate:** quick (cargo + vitest)
**Commit:** `feat(import): add plain-text import wizard with bracket-section parser`

---

### T16: Holyrics JSON import wizard [P]

**What:** Wizard that imports songs from a Holyrics JSON export. Parses the array-of-songs structure (B-1 in STATE.md). Detects duplicates by normalized title+artist (TD-4). Skips them by default with a per-row override.
**Where:**
- `src/components/import/HolyricsImport.tsx` (create)
- `src-tauri/src/services/holyrics_parser.rs` (create) — `parse(json: &str) -> Result<Vec<ParsedHolyricsSong>, HolyricsError>`; pure Rust
- `src-tauri/src/commands/import.rs` (create) — `importHolyricsBatch(payload: Vec<HolyricsSongPayload>) -> ImportReport`
- `src-tauri/src/commands/mod.rs` (modify — `pub mod import;`)
- `src-tauri/src/lib.rs` (modify — register `import_holyrics_batch`)
- `src-tauri/src/services/mod.rs` (modify — `pub mod holyrics_parser;`)
- `src/api/commands.ts` (modify — export `importHolyricsBatch`)
- `.specs/features/phase1-mvp/fixtures/holyrics_sample.json` (add — small fixture for tests; use a redacted slice of the user-supplied export if available)
**Depends on:** T4
**Requirement:** P1-13

**Done when:**
- [ ] Wizard opens a `.json`-filtered file picker via `@tauri-apps/plugin-dialog`.
- [ ] Parser handles the resolved B-1 shape: top-level array of `{ title, artist, lyrics: { paragraphs: [{ number, description, text }] } }`. `full_text` ignored. `streaming`, `bpm`, `key`, `arrangements`, `order` dropped silently.
- [ ] Invalid JSON shows `"Arquivo não é um JSON válido"`; unexpected shape shows `"Estrutura não reconhecida — esperado um array de músicas"`.
- [ ] Empty array shows `"Nenhuma música encontrada no arquivo"` and closes.
- [ ] Preview list: per-row checkbox (all checked by default), with duplicate rows visually flagged (`(duplicada — desmarcada)`) and unchecked by default. A "Importar mesmo assim" per-row override re-checks them.
- [ ] On confirm, `importHolyricsBatch` runs each song in its own transaction. Per-song failures are logged in the returned `ImportReport { imported, skipped, failed: Vec<{ title, reason }> }`. Wizard shows a summary `"X músicas importadas, Y ignoradas, Z falharam"` and a "Ver biblioteca" button.
- [ ] Whitespace-only titles → skipped with reason `"título vazio"`.
- [ ] Holyrics ids ignored — backend generates UUIDv7s.
- [ ] Each paragraph becomes a `SongSection`: `body = text`, `label = description if non-empty else "Estrofe {number}"`, `type = verse` (TD-2), `sort_order = number - 1`, `repeat_count = 1`.
- [ ] Normalized duplicate detection (TD-4): lowercase both title and artist, collapse whitespace, compare against `songs` table at the moment "Importar selecionadas" runs.
- [ ] Rust unit tests for `holyrics_parser`: valid sample, invalid JSON, wrong shape, empty array, paragraph with empty `description`.
- [ ] Integration test for `importHolyricsBatch`: 3-song fixture, one with a duplicate title, asserts `ImportReport` counts.

**Tests:** unit (parser) + integration (import command) + component (wizard flow with mocked commands)
**Gate:** full (cargo + vitest)
**Commit:** `feat(import): add Holyrics JSON import wizard with duplicate detection`

---

### T17: Settings — font, slide layout, monitor picker

**What:** Settings screen + backend persistence. Stores values in the existing `settings` table as key/value JSON. Monitor picker uses Tauri's monitor APIs and persists the chosen index; `open_presentation_window` from T10 reads it.
**Where:**
- `src-tauri/src/commands/settings.rs` (create) — `getSettings()`, `setSetting(key, value)`, `listMonitors() -> Vec<MonitorInfo>`
- `src-tauri/src/commands/mod.rs` (modify — `pub mod settings;`)
- `src-tauri/src/lib.rs` (modify — register settings commands; load settings into `AppState` at startup; pass monitor index to `open_presentation_window`)
- `src-tauri/src/state.rs` (modify — add `settings: Arc<RwLock<AppSettings>>` snapshot; or read-through to DB on each access — pick one, document in the task PR)
- `src/components/settings/SettingsScreen.tsx` (create)
- `src/components/settings/MonitorPicker.tsx` (create) — shows reported name + resolution alongside the index
- `src/api/commands.ts` (modify — export settings commands)
**Depends on:** T10 (settings drive the runtime), T3 (`SlideConfig::default` defines the defaults)
**Requirement:** P1-14

**Done when:**
- [ ] Settings screen renders grouped controls: presentation font family + size, default background color, default `max_lines` + `max_chars_per_line`, monitor picker.
- [ ] Font family change updates a live preview block on the screen.
- [ ] Monitor picker lists all monitors with index + name + resolution. If only one is detected, shows the hint `"Conecte um segundo monitor para apresentação dupla"` but still saves.
- [ ] Saved monitor index drives `open_presentation_window` positioning. If the saved monitor is no longer present at runtime, fall back to the primary monitor and show a toast `"Monitor não detectado — exibindo na tela principal"`.
- [ ] Settings persist across restarts. App startup loads them into `AppState.settings`.
- [ ] Slide splitter consumers in T10 read `max_lines`/`max_chars_per_line` from settings; defaults from T3 apply only if unset.
- [ ] Component test for `MonitorPicker`: render with a 2-monitor mock list, choose index 1, assert `setSetting` called with `"presentation.monitor_index"`.
- [ ] Manual verification on real hardware with two monitors (per CLAUDE.md gotcha).

**Tests:** component + manual (hardware)
**Gate:** full (cargo + vitest)
**Commit:** `feat(settings): add font, slide layout, and monitor picker settings`

---

### T18: Portuguese strings audit + verification pass

**What:** Cross-cutting final pass. Every user-facing string in every screen, dialog, toast, and error path is Brazilian Portuguese. No raw Rust/JS errors leak to the user. Dates and numbers use pt-BR formatting.
**Where:**
- All files under `src/components/` and `src/windows/` — audit for English strings
- All `Result<_, String>` returns in `src-tauri/src/commands/` — confirm pt-BR
- `src/utils/format.ts` (create if needed) — `formatDate(d)` using `Intl.DateTimeFormat('pt-BR')`, `formatNumber(n)` similarly
**Depends on:** All UI tasks (T5, T6, T7, T9, T11, T12, T13, T14, T15, T16, T17)
**Requirement:** P1-15

**Done when:**
- [ ] A grep-based audit (`rg -t ts -t tsx "[A-Z][a-z]+(\\s+[A-Z][a-z]+)*"` filtered to UI files) flags no obvious English label/heading/button text.
- [ ] Every backend command's error path returns a pt-BR sentence — no raw `sqlx::Error::Display` or `serde_json::Error::Display` content reaches the user.
- [ ] All date renderers use `Intl.DateTimeFormat('pt-BR')`; numbers use `Intl.NumberFormat('pt-BR')` where decimal display matters.
- [ ] Add a checklist of audited screens to the task PR description (Library, Editor, Set Builder, Set List, Run Console, Presentation, Plain-text Import, Holyrics Import, Settings, all dialogs, all toasts).
- [ ] `cargo test` + `npx vitest run` + `tsc --noEmit` all green.

**Tests:** none new — verification pass
**Gate:** full (cargo + vitest + tsc)
**Commit:** `chore(i18n): final pt-BR audit pass for Phase 1`

---

## Parallel Execution Map

```
Phase A
  (T1 ∥ T2) → T3

Phase B
  T4 → (T5 ∥ T6 ∥ T14 ∥ T15)
  T6 → T7

Phase C
  T4 → T9 → (T10 ∥ T14_UI)
  T10 → T11 → (T12 ∥ T13_renderer)
  T6 → T13

Phase D / Cross-cutting
  T10 → T17 (settings)
  All UI → T18 (pt-BR audit)
```

(Notes: `T14_UI` above is T14 itself — the set builder UI — once T9 is in. `T15` and `T16` (import wizards) parallel with anything after T4 is green.)

---

## Granularity Check

| Task | Scope | Atomic? |
|------|-------|---------|
| T1: domain types | 4 new files + 1 modify + TS mirrors | One feature, contained ✓ |
| T2: FTS migration 002 | 1 new SQL + 1 new test file | Single concern ✓ |
| T3: slide_splitter | 1 new module + 1 modify | Single pure service ✓ |
| T4: song CRUD | 1 cmd file + 2 modify (mod, lib, ts) | One bounded surface ✓ |
| T5: library screen | 4 new + 1 modify | Single screen ✓ |
| T6: song editor | 3 new + 2 modify | Single screen, no dnd yet ✓ |
| T7: dnd-kit reorder | 2 modify + package.json | Single concern, layered on T6 ✓ |
| T8: FTS search | 1 modify + 1 new service | Single concern ✓ |
| T9: set CRUD | 1 cmd file + 2 modify | One bounded surface ✓ |
| T10: presentation runtime | 1 new cmd + state.rs + lib.rs + counter retirement | Coupled by definition — single feature ✓ |
| T11: presentation UI | 4 new + 2 modify | Two coupled surfaces (presentation window + run console) ✓ |
| T12: shortcuts | 1 hook + 2 modify | Single concern ✓ |
| T13: backgrounds | 5 files | Span backend+frontend by feature contract ✓ |
| T14: set builder UI | 4 new + 1 modify | Single screen ✓ |
| T15: text import | 4 new + 2 modify (incl. shared wizard frame) | Single wizard ✓ |
| T16: holyrics import | 5 new + 2 modify (reuses wizard frame from T15) | Single wizard ✓ |
| T17: settings | 4 new + 3 modify | Single feature ✓ |
| T18: pt-BR audit | cross-cutting audit | Final verification ✓ |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|------|-------------------|---------------|--------|
| T1 [P] | None | Phase A start | OK |
| T2 [P] | None | Phase A start | OK |
| T3 | T1 | After T1 | OK |
| T4 | T1, T2 | After T2 + T1 | OK |
| T5 [P] | T4 | After T4 | OK |
| T6 [P] | T4 | After T4 | OK |
| T7 | T6 | After T6 | OK |
| T8 | T4, T2 | After T4 | OK |
| T9 | T1, T4 | After T4 | OK |
| T10 | T1, T3, T9 | After T9 + T3 | OK |
| T11 | T10 | After T10 | OK |
| T12 | T11 | After T11 | OK |
| T13 | T6, T11 | After T6 + T11 | OK |
| T14 | T9, T5 | After T9 + T5 | OK |
| T15 [P] | T4, T6 | After T4 | OK |
| T16 [P] | T4 | After T4 | OK |
| T17 | T10, T3 | After T10 | OK |
| T18 | all UI tasks | Last node | OK |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|------|-----------|-----------------|-----------|--------|
| T1 | domain | unit (serde round-trip) | unit | OK |
| T2 | migrations | integration | integration | OK |
| T3 | services (pure) | unit | unit (≥ 6 cases) | OK |
| T4 | commands | integration (per command) | integration | OK |
| T5 | components (library) | component | component | OK |
| T6 | components (editor) | component | component | OK |
| T7 | components (dnd) | component | component | OK |
| T8 | commands + services | integration | integration | OK |
| T9 | commands | integration | integration | OK |
| T10 | state + commands | integration (engine extracted for testability) | integration | OK |
| T11 | components (presentation) | component + manual | component + manual | OK |
| T12 | hooks | component (synthetic events) + manual | component + manual | OK |
| T13 | commands + components | integration + component | integration + component | OK |
| T14 | components (setbuilder) | component | component | OK |
| T15 | services + components | unit + component | unit + component | OK |
| T16 | services + commands + components | unit + integration + component | unit + integration + component | OK |
| T17 | commands + components | component + manual (hardware) | component + manual | OK |
| T18 | cross-cutting | verification | verification | OK |

---

## Requirement → Task Map (back-fill for spec.md traceability)

| Requirement | Task(s) |
|---|---|
| P1-01 Domain types | T1 |
| P1-02 FTS migration 002 | T2 |
| P1-03 slide_splitter | T3 |
| P1-04 Song CRUD commands | T4 |
| P1-05 Song editor UI | T6 (+ T5 list scaffolding) |
| P1-06 dnd-kit section reorder | T7 |
| P1-07 FTS5 search | T8 (+ T5 UI box) |
| P1-08 Set builder | T9 (backend) + T14 (UI) |
| P1-09 Presentation runtime | T10 (backend) + T11 (UI) |
| P1-10 Keyboard shortcuts | T12 |
| P1-11 Backgrounds | T13 |
| P1-12 Plain-text import wizard | T15 |
| P1-13 Holyrics JSON import wizard | T16 |
| P1-14 Settings | T17 |
| P1-15 Portuguese UI strings | T18 (plus enforced inside every UI task) |

**Coverage:** 15 / 15 requirements mapped. 18 tasks total.
