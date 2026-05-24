# Phase 3: V2 Tasks — Stage Display + Notes + Section BG + Shortcuts + CCLI + Theme + Auto-Update

**Spec:** `.specs/features/phase3-v2/spec.md` (18 requirements P3-01..P3-18)
**Design:** `.specs/features/phase3-v2/design.md`
**Status:** Drafted 2026-05-20 — awaiting execution
**Last updated:** 2026-05-20

---

## Decisions adopted during task planning

Resolved during spec + design (see `STATE.md` D-14..D-19 plus 7 new design-phase decisions).

| # | Decision | Adopted | Source |
|---|---|---|---|
| TD-1 | Notes panel placement = right-hand sidebar (~30%), collapsible, persisted | design Area B + Tech Decision #1 | design |
| TD-2 | Unified `WindowsScreen` settings panel owns presentation + stage monitor placement | design Area A + Tech Decision #2 | design |
| TD-3 | Section-level video bg restarts on section boundary; song-level continues | design Area C + Tech Decision #3 | design |
| TD-4 | CCLI metadata is optional; no enforcement / warning gate | design Area E + Tech Decision #5 | design |
| TD-5 | Update-check frequency = 24h; offline failures silent; touch `last_update_check` on every attempt | design Area G + Tech Decision #7 | spec OQ-P3-07 |
| TD-6 | Theme default = `"light"`; do NOT follow `prefers-color-scheme` | design Tech Decision #8 | spec OQ-P3-08 |
| TD-7 | Phase 3 ships keyboard shortcuts from scratch — P1-10 was deferred; defaults live in migration 005 | design Discovery + Tech Decision #9 | design |
| TD-8 | Migration 005 targets `song_sections` (actual table name), NOT `sections` (spec wording) | design Tech Decision #10 | design |
| TD-9 | `song_plays.song_id`/`set_id` FK = `NO ACTION` (matches v2 soft-delete model) | design Tech Decision #11 | design |
| TD-10 | CSV headers always Portuguese regardless of operator-window locale | design Tech Decision #12 | design |
| TD-11 | Theme persisted in both SQLite settings AND `localStorage` (synchronous flash-free bootstrap) | design Tech Decision #13 | design |
| TD-12 | Release pipeline = `docs/release.md` + `scripts/release.ps1` (manual maintainer-run); no CI in v2 | design Tech Decision #14 | design |
| TD-13 | Set-item notes editor hidden for `song` items (section-level notes are the right place) | design Tech Decision #15 | design |
| TD-14 | Stage window does NOT auto-open on app launch even if previously open; monitor preference persisted | design open-item #1 | design |
| TD-15 | `KeyBindings` stored as JSON-stringified value in `settings.key_bindings`; on parse error log warn + fall back to defaults | design open-item #3 | design |
| TD-16 | CCLI CSV: one row per `song_plays` row (no dedup) | design open-item #4 | design |
| TD-17 | Light theme = white bg + `text-gray-900` + emerald accent (Tailwind tokens, no custom palette) | design open-item #5 | design |
| TD-18 | `tauri-plugin-updater` pinned `^2.0` | design open-item #7 | design |
| TD-19 | `song_plays` insertion centralized in `record_set_start`; only `load_set_for_presentation` calls it | design Area E | design |

---

## Execution Plan

```
Phase 0 — Foundations (parallel)
  T1 (migration 005)
  T2 (domain extensions)        ← can run in parallel with T1; both feed everything below
  T3 (release pipeline docs/script) ← independent

Phase A — Stage display window (P3-01, P3-02)
  T1 + T2 → T4 (open_stage_window) → T5 (stage.html + StageApp mount) → T6 (StageRenderer + previews + clock)
  T6 → T7 (WindowsScreen unified settings panel)

Phase B — Notes (P3-03, P3-04, P3-05)
  T2 → T8 (song + section commands accept new fields) → T9 (SectionCard notes editor) ∥ T10 (Set-item notes editor) → T11 (OperatorNotesPanel) → T12 (StageNotesPanel)

Phase C — Section background (P3-06, P3-07)
  T1 + T2 → T13 (background resolver service) → T14 (SectionCard background picker) ∥ T15 (renderer integration + restart semantics)
  T13 → T16 (delete_media references include sections)

Phase D — Keyboard shortcuts (P3-08, P3-09, P3-10)
  T1 + T2 → T17 (key_bindings domain + commands) → T18 (runtime dispatcher) → T19 (KeyBindingsScreen UI) → T20 (presentation/stage forward keydown)

Phase E — CCLI (P3-11, P3-12, P3-13, P3-14)
  T1 + T2 → T21 (song editor CCLI panel) ∥ T22 (play_counter service + wiring)
  T22 → T23 (export_ccli_csv command) → T24 (CCLIReportScreen)

Phase F — Theme (P3-15, P3-16)
  T1 → T25 (Tailwind dark variant + theme bootstrap + store) → T26 (ThemeToggle in settings) → T27 (regression sweep for light theme)

Phase G — Auto-update (P3-17, P3-18)
  T3 → T28 (plugin install + config + signing) → T29 (updates commands) → T30 (UpdateBanner + UpdateDialog)

Phase H — Cross-cutting / final
  T11, T12, T15, T19, T24, T26, T30 → T31 (i18n strings extracted for all new UI)
  ALL → T32 (Phase 3 verification + STATE/ROADMAP update)
```

---

## Task Breakdown

---

### T1: Migration 005 — Phase 3 schema additions

**What:** Single SQL migration adding section-level notes + background, CCLI metadata, `song_plays` ledger, FTS update for `author`, and the new settings rows.
**Where:**
- `src-tauri/migrations/005_phase3.sql` (create)
- `src-tauri/tests/migrations.rs` (extend — assert all new columns/tables exist after a fresh run)
**Depends on:** None
**Requirement:** P3-03, P3-06, P3-08 (defaults), P3-11, P3-13, P3-15 (theme), P3-18 (last_update_check)

**Done when:**
- [ ] `ALTER TABLE song_sections ADD COLUMN notes TEXT;` runs.
- [ ] `ALTER TABLE song_sections ADD COLUMN background_id TEXT REFERENCES media(id) ON DELETE SET NULL;` runs.
- [ ] `ALTER TABLE songs ADD COLUMN author TEXT;` + `ALTER TABLE songs ADD COLUMN copyright TEXT;` run.
- [ ] `CREATE TABLE song_plays (...)` with unique index `idx_song_plays_unique` on `(song_id, set_id, played_on)` and lookup index `idx_song_plays_played_on`.
- [ ] FTS triggers updated so `songs_fts.body` includes `author` (recreate `songs_fts_insert`, `songs_fts_update` referencing `coalesce(new.author, '')` in the body concatenation).
- [ ] `INSERT OR IGNORE INTO settings` for `theme=light`, `key_bindings=<JSON defaults>`, `last_update_check=''`, `ui.notes_panel_collapsed=false`, `window.presentation.monitor=''`, `window.stage.monitor=''`.
- [ ] Default `key_bindings` JSON is generated from a `KeyBindings::defaults()` reference and embedded verbatim — design Area D lists the 17 default rows.
- [ ] Integration test runs 001→002→003→004→005 against a temp DB and asserts every new column / table / settings row exists with expected defaults. Running migration twice does not duplicate the settings rows.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` green.

**Tests:** integration (Rust, temp DB)
**Gate:** quick
**Commit:** `feat(db): migration 005 — Phase 3 schema (notes, section bg, CCLI, plays, theme, key bindings)`

---

### T2: Domain extensions for Phase 3 [P]

**What:** Add `SongSection.notes`, `SongSection.background_id`, `Song.author`, `Song.copyright`. Add new domain modules: `key_bindings`, `song_play`, `update`, `background`. TS mirrors in `src/types/index.ts`.
**Where:**
- `src-tauri/src/domain/song.rs` (modify — `Song` + `SongSection`)
- `src-tauri/src/domain/key_bindings.rs` (create — `ActionId`, `Shortcut`, `KeyBindings`, `KeyBindings::defaults()`, `validate()`)
- `src-tauri/src/domain/song_play.rs` (create — `SongPlay`)
- `src-tauri/src/domain/update.rs` (create — `UpdateInfo`)
- `src-tauri/src/domain/background.rs` (create — `BackgroundInfo` with `restart_on_section_boundary` flag)
- `src-tauri/src/domain/mod.rs` (modify — `pub mod key_bindings; pub mod song_play; pub mod update; pub mod background;`)
- `src/types/index.ts` (modify — TS mirrors for all new types + extended `Song` + `SongSection`)
**Depends on:** None (compiles independently of T1 since the domain types don't query the DB)
**Requirement:** P3-03, P3-06, P3-08, P3-11, P3-13, P3-17, P3-18

**Done when:**
- [ ] `SongSection { ..., notes: Option<String>, background_id: Option<String> }` — camelCase serde.
- [ ] `Song { ..., author: Option<String>, copyright: Option<String> }` — camelCase serde; `ccli_number` field unchanged (already present).
- [ ] `ActionId` enum has all 17 variants from design Area D (`AdvanceSlide`, `PreviousSlide`, `Blank`, `Freeze`, `ExitPresentation`, `JumpToItem1..9`, `CountdownPause`, `OpenPresentationWindow`, `FocusSearch`); `#[serde(rename_all = "camelCase")]`.
- [ ] `Shortcut { key: String, ctrl: bool, shift: bool, alt: bool }`. Equality is case-insensitive on `key` (`Shortcut::matches(&self, event_key: &str)` helper).
- [ ] `KeyBindings::defaults()` returns the map from design Area D (matches the JSON seeded by T1).
- [ ] `KeyBindings::validate()` returns `Err(KeyBindingsValidationError::MissingAction(id))` when an action has zero shortcuts, `Err(Conflict { action_a, action_b })` on duplicate Shortcut.
- [ ] `Shortcut::validate()` rejects modifier-only (no `key` or `key.is_empty()`).
- [ ] `SongPlay { id, song_id, set_id, played_on, created_at }` camelCase serde.
- [ ] `UpdateInfo { version, current_version, notes, pub_date }` camelCase serde.
- [ ] `BackgroundInfo { media_kind, asset_url, scrim_opacity, restart_on_section_boundary }` camelCase serde.
- [ ] Serde round-trip tests for each new type (one combined test fine).
- [ ] `cargo test` green; `tsc --noEmit` clean.

**Tests:** unit (serde + validate)
**Gate:** quick
**Commit:** `feat(domain): Phase 3 types — section notes/bg, CCLI fields, key bindings, plays, updates`

---

### T3: Release pipeline docs + signing key playbook

**What:** Document the manual release process for the Tauri updater plugin: key generation, build, sign, manifest, publish. Add a Windows-first PowerShell helper.
**Where:**
- `docs/release.md` (create) — step-by-step playbook: key generation, env setup, version bump, build, sign, generate `latest.json`, draft GitHub release.
- `scripts/release.ps1` (create) — parametrized helper that runs the build + sign + manifest-emit steps. Reads private key path from `$env:TAURI_PRIVATE_KEY_PATH`.
- `.gitignore` (modify — add `*.tauri-private-key`, `*.key`).
**Depends on:** None
**Requirement:** P3-17

**Done when:**
- [ ] `docs/release.md` covers: prerequisites (`tauri signer generate`), version bump locations, build command, sign command, `latest.json` schema with example, GitHub Release flow.
- [ ] `scripts/release.ps1` runs `npm run tauri build`, then `npm run tauri signer sign -- --private-key $env:TAURI_PRIVATE_KEY_PATH …`, then emits `latest.json` at `dist/latest.json` with the schema Tauri's updater expects: `{ version, notes, pub_date, platforms: { "windows-x86_64": { url, signature } } }`.
- [ ] `.gitignore` includes the private-key patterns.
- [ ] Manual smoke run is documented (the maintainer's first try will be a dry-run; design risks).
- [ ] No automated test — manual verification only.

**Tests:** manual
**Gate:** docs review
**Commit:** `docs(release): manual signing + GitHub Releases playbook (release.md + release.ps1)`

---

### T4: open_stage_window command + monitor positioning refactor

**What:** Add the `open_stage_window` Tauri command symmetric to `open_presentation_window`. Refactor the monitor positioning into a private helper shared by both. Idempotent: focuses existing stage window if present.
**Where:**
- `src-tauri/src/commands/window.rs` (modify) — extract `fn position_window(builder, app, idx) -> Result<…, ErrorPayload>` private helper; `open_stage_window` uses it.
- `src-tauri/src/lib.rs` (modify — register `open_stage_window` in `invoke_handler![]`).
- `src/api/commands.ts` (modify — `openStageWindow(monitorIndex?)` wrapper).
**Depends on:** T2
**Requirement:** P3-01

**Done when:**
- [ ] `open_stage_window(app, monitor_index: Option<usize>)` exists. Builds `WebviewWindowBuilder::new(app, "stage", WebviewUrl::App("stage.html".into()))`.
- [ ] Monitor positioning refactor: `position_window` returns the builder with `.position(...).inner_size(...)` applied; called by both window openers.
- [ ] If a window with label `"stage"` already exists, focuses it and returns `Ok(())`.
- [ ] On single-monitor systems, monitor_index=None or out-of-range → builds without position (windowed; OS picks position). `monitor_index` value persists in `settings.window.stage.monitor` after open.
- [ ] Integration test: stub out the WebviewWindowBuilder (or use a test-only helper that returns the prepared config), assert `position_window` produces the expected position for a fixture monitor list.
- [ ] `cargo test` green.

**Tests:** integration (Rust)
**Gate:** quick
**Commit:** `feat(window): open_stage_window with shared monitor positioning helper`

---

### T5: stage.html + StageApp mount + Vite multi-page

**What:** Third entry HTML loading `src/main.tsx`. Branch on `getCurrentWindow().label === 'stage'` to dynamically import and mount `StageApp`. Add the page to Vite's input config so the build produces a bundle for it.
**Where:**
- `stage.html` (create — sibling to `presentation.html`)
- `vite.config.ts` (modify — add `stage: resolve(__dirname, 'stage.html')` to `build.rollupOptions.input`)
- `src/main.tsx` (modify — add `'stage'` branch)
- `src/windows/stage/StageApp.tsx` (create — subscribes to `state_changed`, `countdown_tick`, `media_library_changed`, `locale_changed`; renders placeholder until T6 lands)
**Depends on:** T4
**Requirement:** P3-01

**Done when:**
- [ ] `npm run tauri dev` opens; calling `openStageWindow(0)` from the operator window opens a stage window that loads `stage.html` and renders the placeholder.
- [ ] `getCurrentWindow().label === 'stage'` branch in `main.tsx` lazy-imports `StageApp` (parallel to existing operator/presentation branches).
- [ ] StageApp subscribes to events and listens for `locale_changed`; no mutating commands invoked (read-only invariant).
- [ ] `npm run tauri build` succeeds and produces a `stage.html` bundle.
- [ ] Component test mounts `StageApp` with mocked event listeners; asserts no `invoke()` of mutating commands is called.

**Tests:** component (Vitest with Tauri API mocks)
**Gate:** quick (build + smoke)
**Commit:** `feat(stage): stage.html + StageApp mount with read-only event subscriptions`

---

### T6: StageRenderer — current + next previews + notes panel + clock

**What:** Build the ProPresenter-style layout: top-left current preview, top-right next preview, notes panel below, clock bottom-right. Use CSS scale on existing slide renderers (no separate video decoders).
**Where:**
- `src/components/stage/StageRenderer.tsx` (create) — CSS Grid layout container
- `src/components/stage/StagePreview.tsx` (create) — scaled-down wrapper around `SlideRenderer` for "current" + "next"
- `src/components/stage/StageClock.tsx` (create) — wall-clock vs countdown digit display, locale-formatted
- `src/components/stage/StageBlankIndicator.tsx` (create) — badge top-right when mode = blank/frozen
- `src/components/stage/useCountdownDigits.ts` (create — shared with the existing `CountdownRenderer`; refactor that component to consume the same hook)
- `src/components/presentation/CountdownRenderer.tsx` (modify — consume `useCountdownDigits`)
- `src/windows/stage/StageApp.tsx` (modify — render `<StageRenderer />`)
**Depends on:** T5
**Requirement:** P3-02

**Done when:**
- [ ] CSS Grid layout: top row two equal columns (~40% width each) — current preview left, next preview right. Bottom row spans full width — notes panel + absolute-positioned clock bottom-right.
- [ ] `StagePreview` wraps `SlideRenderer` in a `1920×1080` virtual frame scaled with `transform: scale(...)` to fit the column. Aspect-ratio preserved.
- [ ] When there is no next slide / set item, "next" preview shows localized "Fim do culto" / "End of service" placeholder.
- [ ] `StageClock` reads `presentationState.currentSetItem` — if `itemType === 'countdown'`, renders `mm:ss` from `countdownState.remainingMs`; otherwise renders `HH:MM:SS` locale-formatted (re-renders every second via `setInterval`).
- [ ] `StageBlankIndicator` reads `presentationState.mode` — renders "Tela apagada" or "Tela congelada" badge top-right when mode is `blank` or `frozen`.
- [ ] Crossfade between current/next on slide advance uses the existing `TransitionStage` semantics (P2-09 transition).
- [ ] Component tests: empty state (no set loaded), song with one slide, last-slide-of-set (next = placeholder), countdown item (clock switches to digits), blank mode (indicator shows).
- [ ] `npx vitest run` green.

**Tests:** component
**Gate:** full
**Commit:** `feat(stage): StageRenderer with current+next previews, clock, blank indicator`

---

### T7: WindowsScreen unified settings panel

**What:** Consolidate presentation + stage monitor placement into a single "Janelas" settings sub-screen. Refactors the inline monitor picker out of `OperatorApp.tsx`.
**Where:**
- `src/components/settings/WindowsScreen.tsx` (create) — lists monitors, per-window dropdown + open button, persists last-used monitor
- `src/components/settings/SettingsScreen.tsx` (modify — add "Janelas" group/route)
- `src/windows/operator/OperatorApp.tsx` (modify — remove inline monitor picker render; surface a small "Abrir janela de apresentação" + "Abrir janela de stage" toolbar button group that opens with the persisted monitor)
- `src/api/commands.ts` (modify — `getSetting('window.presentation.monitor')`/`getSetting('window.stage.monitor')` helpers; `openStageWindow` wrapper from T4)
**Depends on:** T4, T6 (so stage window opens to a real renderer)
**Requirement:** P3-01 (criterion 3), P3-02 (open from settings)

**Done when:**
- [ ] Settings sub-screen lists every monitor (name, resolution, position) with the operator's monitor flagged "atual".
- [ ] Per-window section ("Janela de apresentação", "Janela de stage"): dropdown of monitors, "Abrir / Reabrir nesta tela" button.
- [ ] Selecting a monitor + opening persists the choice (`window.presentation.monitor` / `window.stage.monitor` settings).
- [ ] Closing a window does NOT auto-reopen on next launch (TD-14), but the persisted monitor is the default for the next open.
- [ ] Operator toolbar buttons in `OperatorApp.tsx` use the persisted monitor; no monitor selector inline.
- [ ] Component tests: monitor list renders, open-button calls `openPresentationWindow`/`openStageWindow` with the right index, setting persists.

**Tests:** component
**Gate:** quick
**Commit:** `feat(settings): unified WindowsScreen for presentation + stage placement`

---

### T8: Song + section commands accept new fields (notes, background_id, author, copyright)

**What:** Extend `update_song` and section CRUD to round-trip the new domain fields. Existing payload types extended.
**Where:**
- `src-tauri/src/commands/song.rs` (modify — `update_song` payload accepts `author`, `copyright`, `sections[*].notes`, `sections[*].backgroundId`)
- `src-tauri/src/db/song.rs` (modify if separated; otherwise inline) — INSERT/UPDATE statements include the new columns
- `src/api/commands.ts` (modify — `UpdateSongPayload` adds `author?`, `copyright?`; `SongSectionInput` adds `notes?`, `backgroundId?`)
- `src/types/index.ts` (already extended in T2)
**Depends on:** T1, T2
**Requirement:** P3-03, P3-11

**Done when:**
- [ ] Round-trip integration test: insert a song with sections that carry notes + backgroundId + author + copyright, fetch it back, assert all fields preserved.
- [ ] Empty string normalizes to NULL on save (P3-03 criterion 4): `update_song` trims and converts empty strings to `None` before INSERT/UPDATE.
- [ ] FTS index reflects `author` (search test: insert song with `author='João Silva'`, search `silva`, assert song returned).
- [ ] `cargo test` green; `tsc --noEmit` clean.

**Tests:** integration (Rust) + a small FTS search test
**Gate:** quick
**Commit:** `feat(song): persist section notes/background and song author/copyright`

---

### T9: SectionCard notes editor

**What:** Add a "Notas" icon button per section row in the song editor; clicking expands an auto-grow textarea bound to `section.notes`. Debounced save (300 ms).
**Where:**
- `src/components/library/SectionCard.tsx` (modify — add Notes affordance + collapsible textarea)
- `src/components/common/NotesField.tsx` (create — shared auto-grow textarea + debounced onChange, `white-space: pre-wrap` preview)
- `src/i18n/locales/pt-BR.json` + `en-US.json` (modify — add `editor.section.notes.toggle`, `editor.section.notes.placeholder`, `editor.section.notes.charCountWarning`)
**Depends on:** T8
**Requirement:** P3-04

**Done when:**
- [ ] "Notas" icon next to existing section controls. Collapsed when notes are empty; expanded when non-empty.
- [ ] Textarea auto-grows via `scrollHeight` measurement; max 10 visible rows then internal scroll.
- [ ] Debounced save (300 ms) calls the song update flow; existing `state_changed`/song update event propagates to listeners.
- [ ] >2000 chars shows soft warning ("Nota longa — considere dividir em seções"); does not block save.
- [ ] Newlines preserved (white-space: pre-wrap).
- [ ] Component tests: open editor, type notes, assert debounced `updateSong` called once; >2000 chars shows warning; clear notes → field collapses on next mount.

**Tests:** component
**Gate:** quick
**Commit:** `feat(song): per-section notes editor in song editor`

---

### T10: Set-item notes editor (media + countdown + webview + blank)

**What:** Add a "Notas" textarea at the bottom of every non-song set-item editor. Reuses the `NotesField` shared component from T9.
**Where:**
- `src/components/set/MediaSetItemEditor.tsx` (modify — append `<NotesField />` at the bottom)
- `src/components/set/CountdownSetItemEditor.tsx` (modify — same)
- `src/components/set/WebViewSetItemEditor.tsx` (modify — same)
- `src/components/set/SetBuilder.tsx` (modify — when selected item is `blank`, render an inline `NotesField` directly since blank items don't have a dedicated editor file)
- `src/api/commands.ts` (modify if needed — `updateSetItem` already accepts `notes` per T1's wire compat; just confirm) 
**Depends on:** T9 (for `NotesField`)
**Requirement:** P3-04

**Done when:**
- [ ] Each of the four editors exposes a notes textarea bound to `setItem.notes`.
- [ ] Song set items do NOT show a notes textarea in the set builder (TD-13).
- [ ] Debounced save calls `updateSetItem` with the new notes.
- [ ] `state_changed` event propagates the new notes to operator notes panel + stage notes panel.
- [ ] Component tests for each editor: type notes, assert debounced `updateSetItem` invoked.

**Tests:** component
**Gate:** quick
**Commit:** `feat(set): per-item notes editor for media/countdown/webview/blank items`

---

### T11: OperatorNotesPanel — right-hand sidebar

**What:** Right-hand sidebar in the operator runtime view showing the current section's / set-item's notes. Collapsible; collapsed state persisted.
**Where:**
- `src/components/presentation/OperatorNotesPanel.tsx` (create)
- `src/components/presentation/SlideController.tsx` (modify — embed `OperatorNotesPanel` in a 70/30 split when notes exist; collapse the panel column when no notes are present)
- `src/stores/settings.ts` (modify — expose `notesPanelCollapsed: boolean`, `setNotesPanelCollapsed`)
- `src/api/commands.ts` (modify — `getSetting('ui.notes_panel_collapsed')` / `setSetting`)
**Depends on:** T9, T10
**Requirement:** P3-05

**Done when:**
- [ ] Panel reads `presentationState.currentSection?.notes ?? presentationState.currentSetItem?.notes ?? null`.
- [ ] When notes is null, the column collapses (operator gets full preview width).
- [ ] Chevron toggle persists `ui.notes_panel_collapsed` in settings; respected on next mount.
- [ ] `white-space: pre-wrap` rendering matches editor.
- [ ] Component tests: notes present → panel renders; notes null → panel collapsed; toggle persists.

**Tests:** component
**Gate:** quick
**Commit:** `feat(operator): right-hand notes panel for current section/item`

---

### T12: StageNotesPanel — large-type auto-scroll

**What:** Notes panel in the stage window, large type, auto-scroll if content exceeds the visible area.
**Where:**
- `src/components/stage/StageNotesPanel.tsx` (create)
- `src/components/stage/StageRenderer.tsx` (modify — slot `<StageNotesPanel />` in the layout's bottom row)
**Depends on:** T6, T11
**Requirement:** P3-02 (criterion 3), P3-05

**Done when:**
- [ ] Reads same notes source as `OperatorNotesPanel`.
- [ ] Font-size `clamp(20px, 2.5vmin, 36px)`; line-height 1.4.
- [ ] On notes change, scroll position resets to top.
- [ ] Overflow → internal vertical scroll with `scroll-behavior: smooth`.
- [ ] Renders nothing when notes is null (grid row collapses).
- [ ] **Defense-in-depth test (P3-05 criterion 6):** assert the presentation-window slide payload (returned by `load_set_for_presentation`) does NOT include the notes string even when the section has non-empty notes.
- [ ] Component tests cover the four states (no notes, short notes, long-with-overflow, notes change resets scroll).

**Tests:** component + integration (the privacy assertion runs against the presentation slide payload)
**Gate:** quick
**Commit:** `feat(stage): StageNotesPanel + privacy assertion that notes never reach the projector`

---

### T13: Background fallback resolver service

**What:** Pure Rust service that resolves the effective background for a slide via the section → song → settings.default fallback chain.
**Where:**
- `src-tauri/src/services/background.rs` (create) — `resolve_for_slide(pool, song_id, section_id) -> Result<Option<BackgroundInfo>, sqlx::Error>`
- `src-tauri/src/services/mod.rs` (modify — `pub mod background;`)
- `src-tauri/src/commands/presentation.rs` (modify — `load_set_for_presentation` and the per-slide resolution path call `background::resolve_for_slide` instead of reading `song.background_id` directly)
**Depends on:** T1, T2
**Requirement:** P3-06

**Done when:**
- [ ] `resolve_for_slide` checks `song_sections.background_id` first; if non-null AND the referenced media is non-deleted → returns `BackgroundInfo { restart_on_section_boundary: true, ... }`.
- [ ] Section override pointing at soft-deleted media → `warn!` logged; falls through to song-level.
- [ ] Song-level `songs.background_id` → returns `BackgroundInfo { restart_on_section_boundary: false, ... }`.
- [ ] Both NULL → reads `settings.default_background_*` (if such row exists from Phase 2); otherwise returns `None`.
- [ ] `scrim_opacity` from `songs.scrim_opacity` (per-song scrim applies to section-level overrides too — design Area C).
- [ ] Unit tests: section override present (returns section), section overrides deleted media (falls through), song-only (returns song with restart=false), neither (returns None or default).
- [ ] `load_set_for_presentation` integration test asserts a section's resolved background is included in the presentation state payload.
- [ ] `cargo test` green.

**Tests:** unit + integration
**Gate:** quick
**Commit:** `feat(presentation): section→song→default background fallback resolver`

---

### T14: SectionCard background picker

**What:** "Fundo" icon button per section row in the song editor; opens the existing media picker scoped to images+videos; sets `section.background_id`. Section list shows a thumbnail badge for sections with overrides.
**Where:**
- `src/components/library/SectionCard.tsx` (modify — add "Fundo" button + thumbnail badge rendering)
- `src/components/library/SongEditor.tsx` (modify — pass through the updated section list to `updateSong`)
- `src/i18n/locales/pt-BR.json` + `en-US.json` (modify — `editor.section.background.pick`, `editor.section.background.clear`)
**Depends on:** T8, T13
**Requirement:** P3-07

**Done when:**
- [ ] "Fundo" icon next to "Notas" on each section row.
- [ ] Clicking opens the existing media picker modal filtered to `kind ∈ {image, video}`.
- [ ] Selecting a media row sets `section.backgroundId`; "Limpar fundo" clears it.
- [ ] Section row with non-null backgroundId shows a 24×14 thumbnail badge to the left of the label.
- [ ] Save flows through `updateSong` with the new section list.
- [ ] Component tests: open picker, select media, assert section's backgroundId updated; clear flow; badge renders when set.

**Tests:** component
**Gate:** quick
**Commit:** `feat(song): per-section background picker in song editor`

---

### T15: SongBackground renderer — restart-on-section semantics

**What:** Update the existing `SongBackground.tsx` to honor `BackgroundInfo.restart_on_section_boundary`. When true AND the previous slide's resolved background_id differs, remount the `<video>` element (forces playback from 0) before crossfading. When two consecutive sections share the same media id, keep the current `<video>` mounted (no restart, no audible glitch).
**Where:**
- `src/components/presentation/SongBackground.tsx` (modify — track previous `assetUrl`; when restart flag true and url differs, set `key={assetUrl}` to force remount)
- `src/components/presentation/TransitionStage.tsx` (modify if needed — ensure crossfade still works with the remount)
**Depends on:** T13
**Requirement:** P3-06 (criterion 5 + 6 + spec edge case "consecutive sections share same id")

**Done when:**
- [ ] When `restart_on_section_boundary === true` AND `prevAssetUrl !== currentAssetUrl` → `<video key={currentAssetUrl}>` mounts fresh; playback starts from 0.
- [ ] When `restart_on_section_boundary === true` AND `prevAssetUrl === currentAssetUrl` → `<video>` stays mounted; playback continues.
- [ ] When `restart_on_section_boundary === false` (song-level background) → `<video>` stays mounted across slide advances within the same song (unchanged from Phase 2).
- [ ] Crossfade duration unchanged (200 ms per P2-09).
- [ ] Component tests: section→section different media (restart), section→section same media (no restart), song-level continuous (no restart).
- [ ] Manual smoke (in T32): hardware test with a real 30 s video on a 3-section song.

**Tests:** component
**Gate:** quick
**Commit:** `feat(presentation): section-level video background restart on section boundary`

---

### T16: delete_media references include song_sections

**What:** Extend `get_media_references` and `delete_media`'s reference check to also count `song_sections.background_id = ?`. Confirm dialog string lists "Seções de músicas: N".
**Where:**
- `src-tauri/src/commands/media.rs` (modify — `get_media_references` returns `MediaReferences { songs, setItems, sections }`; `delete_media` includes sections in the in-use check)
- `src-tauri/src/db/media.rs` (modify — extend the count query)
- `src/api/commands.ts` (modify — `MediaReferences` type extended)
- `src/components/media/MediaDetailPanel.tsx` (modify — show section count in the reference list)
- `src/types/index.ts` (modify — `MediaReferences` extended)
**Depends on:** T13 (section.background_id schema exists)
**Requirement:** P3-07 (criterion 5)

**Done when:**
- [ ] `get_media_references(id)` returns sections that reference the media.
- [ ] `delete_media(id)` errors with `media.in_use` including the section count when any section references it.
- [ ] UI confirm dialog shows "Mídia em uso por: N música(s), M item(s) de set, K seção(ões)".
- [ ] Integration test: insert media + section with `background_id = media.id`; assert delete blocked; clear the section's backgroundId; assert delete succeeds.
- [ ] Component test: dialog renders with the new count.

**Tests:** integration + component
**Gate:** quick
**Commit:** `feat(media): include song_sections in delete-references check`

---

### T17: key_bindings domain validation + commands

**What:** Add the `commands::key_bindings` module: `get_key_bindings`, `set_key_bindings`, `reset_key_bindings`. Wire validation + emit `key_bindings_changed` event.
**Where:**
- `src-tauri/src/commands/key_bindings.rs` (create) — three commands; emits `key_bindings_changed` after a successful set/reset
- `src-tauri/src/commands/mod.rs` (modify — `pub mod key_bindings;`)
- `src-tauri/src/lib.rs` (modify — register the three commands)
- `src/api/commands.ts` (modify — `getKeyBindings`, `setKeyBindings`, `resetKeyBindings`, `onKeyBindingsChanged(cb)` wrappers)
**Depends on:** T1 (settings row exists), T2 (domain types exist)
**Requirement:** P3-08

**Done when:**
- [ ] `get_key_bindings()` reads `settings.key_bindings`; on parse error logs a warn and returns `KeyBindings::defaults()` (TD-15).
- [ ] `set_key_bindings(bindings)` runs `bindings.validate()`; on failure returns the appropriate error code (`key_bindings.missing_action` / `key_bindings.conflict` / `key_bindings.invalid_shortcut`); on success serializes + persists + emits `key_bindings_changed`.
- [ ] `reset_key_bindings()` writes defaults + emits + returns defaults.
- [ ] Emit happens AFTER `RwLock` write guard is dropped (CLAUDE.md invariant, even though no `PresentationState` is touched — defensive consistency).
- [ ] Integration tests for each command's happy + error paths.
- [ ] `cargo test` green.

**Tests:** integration (Rust)
**Gate:** quick
**Commit:** `feat(key-bindings): get/set/reset commands with validation and change event`

---

### T18: Runtime keyboard dispatcher (operator window)

**What:** Build the dispatcher from scratch (TD-7): `keydown` listener on `window`, builds `Map<KeyEventSignature, ActionId>` from persisted bindings, dispatches to action callbacks. Subscribes to `key_bindings_changed` to rebuild the map without reload. Ignores keydown originating from inputs/textareas/contenteditable.
**Where:**
- `src/runtime/keyboard.ts` (create) — `installKeyboardDispatcher(callbacks)`, `useKeyBindings()` hook, `eventSignature(event) -> string` helper
- `src/windows/operator/OperatorApp.tsx` (modify — install dispatcher on mount with action callbacks bound to existing commands)
- `src/stores/keyBindings.ts` (create — small store that loads bindings on mount, listens to `key_bindings_changed`, exposes the current bindings)
**Depends on:** T17
**Requirement:** P3-10

**Done when:**
- [ ] Dispatcher attaches a single `window.addEventListener('keydown', ...)` on mount and detaches on unmount.
- [ ] Builds `Map<string, ActionId>` keyed by `eventSignature(event)` = `"${ctrl?'C':''}${shift?'S':''}${alt?'A':''}:${key.toLowerCase()}"`.
- [ ] On match, invokes the corresponding callback. Callbacks map to: `nextSlide`, `prevSlide`, `setPresentationMode('blank')`, `setPresentationMode('frozen')`, `setPresentationMode('idle')`, `goToItem(n-1)` for 1..9, `pauseCountdown`, `openPresentationWindow`, dispatch DOM event `'app:focus-search'`.
- [ ] `event.preventDefault()` on match (avoids browser-default behavior like Ctrl+F opening Find).
- [ ] Input blur: if `event.target instanceof HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement` OR `event.target?.isContentEditable`, do nothing.
- [ ] On `key_bindings_changed`, the dispatcher rebuilds within ~100 ms (store updates → effect re-runs).
- [ ] `SongList.tsx` listens for `'app:focus-search'` DOM event and focuses its search input.
- [ ] Unit tests with synthetic `KeyboardEvent`s: match → action invoked; input element → action NOT invoked; conflict-free defaults dispatch correctly.

**Tests:** unit (Vitest)
**Gate:** quick
**Commit:** `feat(runtime): keyboard dispatcher reads from persisted key bindings`

---

### T19: KeyBindingsScreen — operator UI for rebind + conflict + restore

**What:** Settings sub-screen listing every `ActionId` with current shortcut(s) as keycap tags. "Editar" enters capture mode; "Adicionar atalho" supports multiple bindings per action; "Restaurar padrões" confirms and resets.
**Where:**
- `src/components/settings/KeyBindingsScreen.tsx` (create)
- `src/components/common/Keycap.tsx` (create — styled `<kbd>` element)
- `src/components/common/ConfirmDialog.tsx` (reuse if exists; otherwise small wrapper)
- `src/components/settings/SettingsScreen.tsx` (modify — add "Atalhos" group/route)
- `src/i18n/locales/pt-BR.json` + `en-US.json` (modify — labels for every `ActionId`, capture-mode hints, conflict messages, restore-defaults confirmation)
**Depends on:** T17, T18
**Requirement:** P3-09

**Done when:**
- [ ] Every `ActionId` listed with current shortcuts rendered as `<Keycap>` tags.
- [ ] "Editar" enters capture mode for one row. Next keydown (with a valid main key) populates a draft Shortcut. Esc cancels.
- [ ] Modifier-only capture rejected inline ("Inclua uma tecla principal além dos modificadores").
- [ ] On save, calls `setKeyBindings`; conflict error renders inline ("Conflito com 'Avançar slide'").
- [ ] "Adicionar atalho" appends a new capture row for the same action.
- [ ] "Restaurar padrões" → confirm → `resetKeyBindings`.
- [ ] After save, the dispatcher picks up the new bindings (verified by triggering a synthetic event after save).
- [ ] Component tests: render list, enter capture mode, capture conflict + display error, multi-shortcut add, restore defaults.

**Tests:** component
**Gate:** full
**Commit:** `feat(settings): KeyBindingsScreen — capture, conflict, multi-bind, restore`

---

### T20: Presentation + stage windows forward keydown to operator dispatcher

**What:** Both read-only windows emit a Tauri event `forward_keydown { signature }` when they receive keydown. The operator's dispatcher subscribes and replays through the action map. (Avoids the operator needing to refocus to drive the show.)
**Where:**
- `src/windows/presentation/PresentationApp.tsx` (modify — add `window.addEventListener('keydown', ...)` that emits `forward_keydown` and prevents default)
- `src/windows/stage/StageApp.tsx` (modify — same)
- `src/runtime/keyboard.ts` (modify — `installKeyboardDispatcher` also subscribes to the `forward_keydown` Tauri event and replays through the same action map)
- `src/api/commands.ts` (modify — emit/listen wrappers for the event)
**Depends on:** T18, T5
**Requirement:** P3-10 (criterion 5)

**Done when:**
- [ ] Pressing Space on the focused presentation window advances the slide via the operator dispatcher (round-trip: keydown → forward_keydown event → operator dispatcher → nextSlide command).
- [ ] Same from the stage window.
- [ ] `event.preventDefault()` on both ends so the read-only windows don't double-trigger.
- [ ] Integration test (Vitest with Tauri event mock): emit a `forward_keydown` event, assert the operator's dispatcher invokes the right action.

**Tests:** unit (Vitest with mocked Tauri events)
**Gate:** quick
**Commit:** `feat(runtime): presentation + stage forward keydown to operator dispatcher`

---

### T21: Song editor "Direitos / Licença" panel [P]

**What:** Add a collapsible "Direitos / Licença" panel to the song editor with three inputs: CCLI #, copyright, author. Debounced save.
**Where:**
- `src/components/library/SongEditor.tsx` (modify — collapsible panel below the existing sections list)
- `src/i18n/locales/pt-BR.json` + `en-US.json` (modify — `editor.rights.title`, `editor.rights.ccliNumber`, `editor.rights.copyright`, `editor.rights.author`)
**Depends on:** T8
**Requirement:** P3-12

**Done when:**
- [ ] Collapsible panel "Direitos / Licença" rendered below the sections list. Collapsed by default if all three fields are empty; expanded when any is set.
- [ ] Three text inputs bound to `song.ccliNumber`, `song.copyright`, `song.author`. Debounced save (300 ms) via existing `updateSong`.
- [ ] FTS search by author works (covered by T8's FTS test).
- [ ] Component tests: edit each field, assert debounced `updateSong` invoked; expand/collapse persists during the session (no need to persist across reloads).

**Tests:** component
**Gate:** quick
**Commit:** `feat(song): Direitos / Licença panel with CCLI #, author, copyright`

---

### T22: play_counter service + wiring into load_set_for_presentation [P]

**What:** Centralized service that inserts one `song_plays` row per song-typed `set_item` when a set is started. Idempotent per `(song_id, set_id, played_on)`. Wired into `load_set_for_presentation`.
**Where:**
- `src-tauri/src/services/play_counter.rs` (create) — `record_set_start(pool, set_id) -> Result<usize, sqlx::Error>`
- `src-tauri/src/services/mod.rs` (modify — `pub mod play_counter;`)
- `src-tauri/src/commands/presentation.rs` (modify — `load_set_for_presentation` calls `record_set_start` after the existing set-load transaction succeeds)
- `Cargo.toml` (modify if needed — `chrono = "0.4"` for `Local::today()` if not already present)
**Depends on:** T1, T2
**Requirement:** P3-13

**Done when:**
- [ ] `record_set_start` queries song-typed set_items, builds an `INSERT OR IGNORE` for each with `played_on = chrono::Local::today().format("%Y-%m-%d")`.
- [ ] Returns count of newly-inserted rows (zero on idempotent re-start).
- [ ] Unique index on (song_id, set_id, played_on) enforces idempotency at the DB level (T1).
- [ ] **Integration tests (P3-13 criterion 6):** start the same set twice on the same calendar day — assert exactly one row per song. Start same set on two different mocked dates — assert two rows per song. Start a set that crosses midnight — assert played_on = start-date (TZ test with a mocked clock).
- [ ] **Centralization assertion:** a Rust test searches for the string `INSERT INTO song_plays` across the codebase — only `play_counter.rs` is allowed (TD-19).
- [ ] `cargo test` green.

**Tests:** integration (Rust)
**Gate:** quick
**Commit:** `feat(plays): play_counter service with idempotent per-day insert on set start`

---

### T23: export_ccli_csv command + preview query

**What:** Two commands: `preview_ccli_export(from, to) -> Vec<CcliRow>` and `export_ccli_csv(from, to, outPath) -> ExportSummary`. CSV is UTF-8-with-BOM, RFC 4180 quoting, headers in Portuguese.
**Where:**
- `src-tauri/src/commands/reports.rs` (create)
- `src-tauri/src/commands/mod.rs` (modify — `pub mod reports;`)
- `src-tauri/src/lib.rs` (modify — register both commands)
- `src/api/commands.ts` (modify — `previewCcliExport`, `exportCcliCsv` wrappers; `CcliRow` type)
- `src/types/index.ts` (modify — `CcliRow { playedOn, title, author, ccliNumber, copyright }`)
**Depends on:** T22
**Requirement:** P3-14

**Done when:**
- [ ] `preview_ccli_export` SELECTs `song_plays JOIN songs` filtered by `played_on BETWEEN ? AND ?`, returns array of `CcliRow` with current song metadata (P3-14 criterion edge case "metadata edited after play recorded").
- [ ] `export_ccli_csv` writes UTF-8 BOM (`\xEF\xBB\xBF`) + header line `Data,Título,Autor,CCLI #,Direitos\n` (TD-10) + one row per play.
- [ ] RFC 4180 quoting: fields containing `,`, `"`, or `\n` are wrapped in `"..."` with internal `"` doubled to `""`.
- [ ] Empty metadata fields → empty cell (no `null`, no placeholder).
- [ ] Zero-range export succeeds (CSV with header only); operator-facing toast handled in T24.
- [ ] **Integration test (P3-14 criterion 7):** seed song_plays + songs fixture, run export, byte-compare against `tests/fixtures/ccli-report-expected.csv`.
- [ ] `cargo test` green.

**Tests:** integration (Rust, fixture compare)
**Gate:** quick
**Commit:** `feat(reports): preview + CSV export for CCLI usage reports`

---

### T24: CCLIReportScreen — date range picker + preview + export

**What:** Operator UI for the CCLI report. Date-range picker, preview table, "Exportar CSV" button with save dialog.
**Where:**
- `src/components/reports/CCLIReportScreen.tsx` (create)
- `src/components/settings/SettingsScreen.tsx` (modify — add "Relatórios > Exportar CCLI" group/route)
- `src/i18n/locales/pt-BR.json` + `en-US.json` (modify — labels, default-range hint, empty-toast, success-toast)
- `src/api/commands.ts` (modify — uses `previewCcliExport`, `exportCcliCsv` wrappers; save-dialog via `@tauri-apps/plugin-dialog`)
**Depends on:** T23
**Requirement:** P3-14

**Done when:**
- [ ] Date-range picker (from / to) defaults to last 90 days.
- [ ] Preview table re-fetches on date change (debounced).
- [ ] "Exportar CSV" opens save dialog with default filename `ccli-report-{YYYY-MM-DD}-to-{YYYY-MM-DD}.csv`.
- [ ] Zero-range export → toast "Nenhum culto no período selecionado" + CSV with only the header line is still produced.
- [ ] Component tests: preview renders with mocked rows, change date triggers re-preview, click export invokes `exportCcliCsv`, zero-range path shows the toast.

**Tests:** component
**Gate:** full
**Commit:** `feat(reports): CCLIReportScreen with preview + CSV export UI`

---

### T25: Tailwind dark variant + theme bootstrap + themeStore

**What:** Wire Tailwind v4 dark-mode variant. Add synchronous `localStorage` theme bootstrap before React mount. Add `themeStore` that writes to both SQLite settings + localStorage.
**Where:**
- `src/index.css` (modify — add `@variant dark (&:where(.dark, .dark *));` after Tailwind import; verify v4 syntax)
- `src/main.tsx` (modify — synchronous `localStorage.getItem('trinity.theme')` check, apply `.dark` class to `<html>` before mount)
- `src/stores/theme.ts` (create — Zustand store; `setTheme(t)` writes localStorage + calls `setSetting('theme', t)` + toggles `<html>` class)
- `src/api/commands.ts` (modify — `getSetting('theme')` already works; nothing new on the API surface)
**Depends on:** T1
**Requirement:** P3-15

**Done when:**
- [ ] Tailwind `dark:` utilities work (`<div class="bg-white dark:bg-gray-900">` flips based on `<html class="dark">`).
- [ ] `main.tsx` reads `localStorage.getItem('trinity.theme')` synchronously and applies `.dark` if value is `"dark"` BEFORE React renders.
- [ ] On first launch (no localStorage, no DB setting) → light theme applied; `localStorage.setItem('trinity.theme', 'light')` written.
- [ ] On DB-only state (fresh install, no localStorage) → after first `getSetting('theme')` resolves, store synchronizes localStorage.
- [ ] Presentation + stage windows do NOT read/apply the theme (OQ-P3-08 / D-18 — verified by an assertion test).
- [ ] Component test: store toggles class; flash-of-wrong-theme test (mount with `localStorage = 'dark'`, assert `<html>` already has `.dark` before any render).

**Tests:** unit + component
**Gate:** quick
**Commit:** `feat(theme): Tailwind dark variant + synchronous bootstrap + themeStore`

---

### T26: ThemeToggle in settings

**What:** Two-option theme toggle ("Claro" / "Escuro") in the existing settings "Geral" panel.
**Where:**
- `src/components/settings/SettingsScreen.tsx` (modify — add toggle to "Geral" group)
- `src/components/common/Toggle.tsx` (create if not exists; small reusable two-option toggle)
- `src/i18n/locales/pt-BR.json` + `en-US.json` (modify — `settings.theme.label`, `settings.theme.light`, `settings.theme.dark`)
**Depends on:** T25
**Requirement:** P3-16

**Done when:**
- [ ] Toggle reflects current theme; changing it calls `themeStore.setTheme`.
- [ ] Theme flips instantly with no reload, no flicker.
- [ ] After restart, persisted theme reapplies on bootstrap.
- [ ] Component test: render, toggle, assert store + localStorage + setSetting all called.

**Tests:** component
**Gate:** quick
**Commit:** `feat(settings): theme toggle in Configurações > Geral`

---

### T27: Light theme regression sweep across operator window

**What:** Audit every operator-window component for hard-coded color classes. Replace with paired light/dark Tailwind tokens. Add a small lint helper + a contrast-sampling component test.
**Where:**
- Every file under `src/components/` (modify selectively — components that hard-code `text-white`, `bg-gray-900`, `border-gray-700`, etc.)
- `src/windows/operator/OperatorApp.tsx` (modify)
- `scripts/check-theme-tokens.ps1` (create) — grep-based linter that fails CI if a known-problem class lacks a matching `dark:` paired class outside an allowlist
- `tests/theme/contrast.test.tsx` (create) — mounts 5 top-level screens in each theme; asserts no rendered text computes a contrast ratio below 4.5:1 against its background (uses a tiny in-test color-contrast helper)
**Depends on:** T25, T26
**Requirement:** P3-15 (criterion 4), P3-16 (criterion 4)

**Done when:**
- [ ] Every top-level operator screen renders cleanly in both themes (manual visual sweep + the contrast test).
- [ ] No `text-white` / `bg-gray-9XX` outside the allowlist (lint script passes).
- [ ] `OperatorApp` chrome (toolbar, sidebar, modals) uses paired tokens.
- [ ] Contrast test passes for at least 5 top-level screens.

**Tests:** component (contrast) + lint (script)
**Gate:** full
**Commit:** `feat(theme): light-theme regression sweep across operator window`

---

### T28: Tauri updater plugin install + config + signing wiring

**What:** Install the Tauri updater plugin in Rust + JS sides; configure the manifest endpoint; embed the public key. Plugin's built-in dialog is disabled so Phase 3 owns the UI.
**Where:**
- `src-tauri/Cargo.toml` (modify — `tauri-plugin-updater = "2"`)
- `package.json` (modify — `@tauri-apps/plugin-updater` ^2.0)
- `src-tauri/src/lib.rs` (modify — `.plugin(tauri_plugin_updater::Builder::new().build())`)
- `src-tauri/tauri.conf.json` (modify — `plugins.updater = { active: true, endpoints: [...], dialog: false, pubkey: "..." }`)
- `docs/release.md` (modify if needed — verify against T3's playbook; reconcile any drift)
**Depends on:** T3
**Requirement:** P3-17

**Done when:**
- [ ] `npm install` + `cargo build` succeed with the new dependencies.
- [ ] `tauri.conf.json` has the updater section with `active: true`, the GitHub endpoint, `dialog: false`, and a placeholder pubkey value (real key inserted by the maintainer before shipping).
- [ ] App still launches in dev (`npm run tauri dev`).
- [ ] No network is hit during `cargo test` or `npx vitest` (the updater is only invoked from `commands::updates` which has no test that hits the network).
- [ ] README / docs/release.md cross-references match.

**Tests:** smoke (cargo + npx vitest + tauri dev startup)
**Gate:** full
**Commit:** `feat(updater): integrate tauri-plugin-updater with GitHub Releases endpoint`

---

### T29: commands::updates — check + apply

**What:** Two commands: `check_for_updates(force: bool)` and `apply_update_and_restart()`. Check is debounced via `settings.last_update_check`.
**Where:**
- `src-tauri/src/commands/updates.rs` (create)
- `src-tauri/src/commands/mod.rs` (modify — `pub mod updates;`)
- `src-tauri/src/lib.rs` (modify — register both commands)
- `src/api/commands.ts` (modify — wrappers)
**Depends on:** T28
**Requirement:** P3-18

**Done when:**
- [ ] `check_for_updates(false)` reads `last_update_check`; if < 24h ago, returns `Ok(None)`. Else queries the plugin, touches `last_update_check`, returns `Ok(Some(UpdateInfo))` or `Ok(None)`.
- [ ] `check_for_updates(true)` always queries the plugin (manual-check path), but still touches `last_update_check`.
- [ ] On network error / offline: silently returns `Ok(None)`, touches `last_update_check` (P3-18 criterion 6 + edge case).
- [ ] On version older than current (downgrade) → returns `Ok(None)` silently.
- [ ] `apply_update_and_restart()` invokes the plugin's download + verify + install. On signature mismatch returns `update.signature_invalid`. On success calls `app.restart()`.
- [ ] Unit test using a mocked updater interface: 24h debounce works, force bypasses it, downgrade ignored, signature mismatch surfaces the right error code.

**Tests:** integration (Rust, mocked updater)
**Gate:** quick
**Commit:** `feat(updater): check + apply commands with 24h debounce and silent offline`

---

### T30: UpdateBanner + UpdateDialog UI

**What:** Non-blocking banner at the top of the operator window when an update is available. "Mais tarde" dismisses for session. "Atualizar" opens a dialog with release notes + "Baixar e instalar" / cancel.
**Where:**
- `src/components/system/UpdateBanner.tsx` (create)
- `src/components/system/UpdateDialog.tsx` (create)
- `src/windows/operator/OperatorApp.tsx` (modify — call `checkForUpdates(false)` on mount; mount banner conditionally)
- `src/components/settings/SettingsScreen.tsx` (modify — add "Sobre > Verificar atualizações" entry that calls `checkForUpdates(true)`)
- `src/i18n/locales/pt-BR.json` + `en-US.json` (modify — banner / dialog / errors)
**Depends on:** T29
**Requirement:** P3-18

**Done when:**
- [ ] On `OperatorApp` mount, `checkForUpdates(false)` runs once; on result with `Some(UpdateInfo)`, banner appears.
- [ ] "Mais tarde" hides banner for the session (sessionStorage flag), reappears after the next 24h check / next launch.
- [ ] "Atualizar" opens `UpdateDialog` with release notes + apply button.
- [ ] Apply → calls `applyUpdateAndRestart`. On signature error → modal-style error in the dialog ("Falha na verificação de assinatura — atualização abortada"). On success → app restarts (visible smoke; in tests just assert the command was invoked).
- [ ] Manual-check path: settings entry invokes `checkForUpdates(true)`; if no update, toast "Você já está na versão mais recente."
- [ ] Component tests: banner renders on `UpdateInfo` available, dismiss path, apply path (with mocked command), signature-error path, manual-check no-update toast.

**Tests:** component
**Gate:** full
**Commit:** `feat(updater): UpdateBanner + UpdateDialog with non-blocking flow`

---

### T31: i18n extraction sweep for Phase 3 strings

**What:** Verify every new user-facing string in Phase 3 components has a key in `pt-BR.json` and `en-US.json`. Add `errors.keyBindings.*`, `errors.update.*` translations for the new backend error codes.
**Where:**
- Every Phase 3 component touched in T4..T30 (modify if any literal strings slipped through)
- `src/i18n/locales/pt-BR.json` + `en-US.json` (modify — keys for every label, button, hint, error code introduced in Phase 3)
- `tests/i18n/key-completeness.test.ts` (extend — existing Phase 2 key-completeness test runs against the new locale entries automatically)
**Depends on:** T6, T7, T9, T10, T11, T12, T14, T19, T21, T24, T26, T27, T30
**Requirement:** P3 cross-cutting (matches Phase 2 i18n discipline)

**Done when:**
- [ ] No JSX string literal in Phase 3 components matches a Portuguese word (audit via grep across modified files).
- [ ] Both locale files have the same key set after extraction (existing key-completeness test passes).
- [ ] Error codes (`key_bindings.conflict`, `key_bindings.missing_action`, `update.signature_invalid`, etc.) have `errors.*` translations with `{{params}}` interpolation where applicable.
- [ ] Component tests pass with the extracted keys.

**Tests:** component + custom (key completeness)
**Gate:** full
**Commit:** `feat(i18n): extract Phase 3 strings to pt-BR + en-US locale files`

---

### T32: Phase 3 verification + STATE/ROADMAP update

**What:** End-to-end manual verification on real hardware. Build a set that exercises section backgrounds + notes + stage display + custom keybindings + dark/light theme switch + CCLI export round-trip + auto-update dry run. Capture findings in `STATE.md` "Phase 3 Completion Summary" and flip ROADMAP entries to Done. Kick off the 8-week field period.
**Where:**
- `.specs/features/phase3-v2/VERIFICATION.md` (create) — checklist + findings
- `.specs/project/STATE.md` (modify — add "Phase 3 Completion Summary" section, update Current phase line)
- `.specs/project/ROADMAP.md` (modify — flip Phase 3 items to Done)
**Depends on:** All previous tasks
**Requirement:** All P3-01..P3-18

**Done when:**
- [ ] Manual run: build a song with 3 sections (each with notes + a different section background); add it to a set with 1 countdown + 1 webview item; open stage window on a second monitor + presentation window on a third; drive the show end-to-end with custom keyboard bindings rebound through Settings; verify notes appear on operator + stage but never on the projector; verify section backgrounds restart on section boundaries; flip theme mid-test (operator only flips; projector + stage unaffected).
- [ ] CCLI: run set on three different mocked dates; export the CSV; confirm row count + format match the expected fixture; import into a local CCLI-emulator (or visually inspect).
- [ ] Auto-update dry run: maintainer publishes a `0.0.0 → 0.0.1` fake release to a private GitHub release; verifies the banner appears, signature validates, app restarts into the new build.
- [ ] `cargo test` + `npx vitest run` + `tsc --noEmit` all green.
- [ ] `npm run tauri build` produces an installer ≤ 30 MB (relaxed from Phase 2's 25 MB ceiling; tauri-plugin-updater adds ~1-2 MB).
- [ ] STATE.md updated; ROADMAP entries flipped to Done; 8-week field period start date recorded.

**Tests:** manual (hardware)
**Gate:** full (cargo + vitest + tsc + tauri build) + manual signoff
**Commit:** `chore(phase3): verification pass and Phase 3 completion summary`

---

## Parallel Execution Map

```
Phase 0 (foundations):
  T1 [P] ∥ T2 [P] ∥ T3 [P]

Phase A (stage display):
  T1 + T2 → T4 → T5 → T6 → T7

Phase B (notes):
  T2 → T8 → (T9 ∥ T10) → T11 → T12

Phase C (section background):
  T1 + T2 → T13 → (T14 ∥ T15)
  T13 → T16

Phase D (keyboard shortcuts):
  T1 + T2 → T17 → T18 → T19
  T18 + T5 → T20

Phase E (CCLI):
  T2 + T8 → T21 [P]
  T1 + T2 → T22 [P]
  T22 → T23 → T24

Phase F (theme):
  T1 → T25 → T26 → T27

Phase G (auto-update):
  T3 → T28 → T29 → T30

Phase H (cross-cutting / final):
  T6, T7, T9, T10, T11, T12, T14, T19, T21, T24, T26, T27, T30 → T31
  ALL → T32
```

**Parallelism notes:**
- `[P]` tasks within a phase share no mutable state (separate files, separate components).
- T1 (migration) and T2 (domain) can run truly in parallel — the migration SQL doesn't depend on Rust code; the domain types don't query the DB.
- T9 (SectionCard notes) and T10 (Set-item notes) both touch the song-editor / set-builder areas but in distinct files; safe to parallelize on different sessions.
- T14 (SectionCard background picker) and T15 (renderer restart semantics) modify the song editor and presentation renderer respectively; safe.
- T21 (CCLI panel in song editor) and T22 (play_counter service) are independent vertical slices; truly parallel.
- T27 (light-theme sweep) touches many files but only adds `dark:` paired tokens — does not invalidate other tasks' code structure.
- T31 (i18n sweep) is gated on every UI task being done, so it lands last before T32.

---

## Granularity Check

| Task | Scope | Atomic? |
|---|---|---|
| T1: Migration 005 | 1 SQL + 1 test | ✓ |
| T2: domain extensions | 6 files | ✓ Cohesive — all new Phase 3 types |
| T3: release pipeline docs/script | 2 files + .gitignore | ✓ |
| T4: open_stage_window | 1 cmd file + lib.rs + commands.ts | ✓ Single window opener |
| T5: stage.html + StageApp | 4 files | ✓ Window mount |
| T6: StageRenderer | 5 files + shared hook | ✓ Single screen feature |
| T7: WindowsScreen | 4 files | ✓ One settings panel + operator refactor |
| T8: song/section commands | 3 files + FTS test | ✓ |
| T9: SectionCard notes | 3 files | ✓ One editor affordance |
| T10: set-item notes (4 editors) | 5 files | ✓ Cohesive — same shared component |
| T11: OperatorNotesPanel | 4 files | ✓ |
| T12: StageNotesPanel | 2 files + privacy test | ✓ |
| T13: background resolver | 3 files + tests | ✓ |
| T14: SectionCard bg picker | 3 files | ✓ |
| T15: restart-on-section renderer | 2 files | ✓ |
| T16: media references include sections | 5 files | ✓ Cohesive |
| T17: key_bindings commands | 4 files | ✓ |
| T18: runtime dispatcher | 3 files | ✓ Single dispatcher |
| T19: KeyBindingsScreen | 5 files | ✓ One settings screen |
| T20: presentation/stage forward keydown | 4 files | ✓ |
| T21: CCLI panel song editor | 2 files | ✓ |
| T22: play_counter service | 3 files + test | ✓ |
| T23: CSV export command | 5 files + fixture | ✓ |
| T24: CCLIReportScreen | 4 files | ✓ |
| T25: Tailwind dark + bootstrap + store | 4 files | ✓ |
| T26: ThemeToggle | 3 files | ✓ |
| T27: light theme sweep | many files + 2 helpers | ✓ One sweeping refactor |
| T28: updater plugin install | 4 files | ✓ |
| T29: updates commands | 4 files | ✓ |
| T30: UpdateBanner + Dialog | 5 files | ✓ Cohesive |
| T31: i18n extraction | many files + 2 locales | ✓ One sweep |
| T32: verification + STATE/ROADMAP | 3 docs | ✓ |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | Phase 0 parallel | OK |
| T2 | None | Phase 0 parallel | OK |
| T3 | None | Phase 0 parallel | OK |
| T4 | T2 | After T2 (and indirectly T1 for settings rows) | OK |
| T5 | T4 | After T4 | OK |
| T6 | T5 | After T5 | OK |
| T7 | T4, T6 | After T4 + T6 | OK |
| T8 | T1, T2 | After Phase 0 | OK |
| T9 | T8 | After T8 | OK |
| T10 | T9 | After T9 (shared NotesField) | OK |
| T11 | T9, T10 | After T9 + T10 | OK |
| T12 | T6, T11 | After T6 + T11 | OK |
| T13 | T1, T2 | After Phase 0 | OK |
| T14 | T8, T13 | After T13 + T8 | OK |
| T15 | T13 | After T13 | OK |
| T16 | T13 | After T13 | OK |
| T17 | T1, T2 | After Phase 0 | OK |
| T18 | T17 | After T17 | OK |
| T19 | T17, T18 | After T18 | OK |
| T20 | T18, T5 | After T5 + T18 | OK |
| T21 | T8 | After T8 | OK |
| T22 | T1, T2 | After Phase 0 | OK |
| T23 | T22 | After T22 | OK |
| T24 | T23 | After T23 | OK |
| T25 | T1 | After T1 | OK |
| T26 | T25 | After T25 | OK |
| T27 | T25, T26 | After T26 | OK |
| T28 | T3 | After T3 | OK |
| T29 | T28 | After T28 | OK |
| T30 | T29 | After T29 | OK |
| T31 | many UI tasks | After UI phases | OK |
| T32 | All | Final | OK |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | migration | integration | integration | OK |
| T2 | domain | unit (serde + validate) | unit | OK |
| T3 | docs/script | manual | manual | OK |
| T4 | commands | integration | integration | OK |
| T5 | windows mount | component | component | OK |
| T6 | components | component | component | OK |
| T7 | components | component | component | OK |
| T8 | commands | integration | integration | OK |
| T9 | components | component | component | OK |
| T10 | components | component | component | OK |
| T11 | components | component | component | OK |
| T12 | components + integration | component + integration | component + integration | OK |
| T13 | services | unit + integration | unit + integration | OK |
| T14 | components | component | component | OK |
| T15 | components | component | component | OK |
| T16 | commands + components | integration + component | integration + component | OK |
| T17 | commands | integration | integration | OK |
| T18 | runtime (frontend) | unit | unit | OK |
| T19 | components | component | component | OK |
| T20 | runtime + windows | unit | unit | OK |
| T21 | components | component | component | OK |
| T22 | services | integration | integration | OK |
| T23 | commands | integration | integration | OK |
| T24 | components | component | component | OK |
| T25 | bootstrap + store | unit + component | unit + component | OK |
| T26 | components | component | component | OK |
| T27 | components + lint | component + lint | component + lint | OK |
| T28 | config + plugin | smoke | smoke | OK |
| T29 | commands | integration | integration | OK |
| T30 | components | component | component | OK |
| T31 | components + i18n | component + custom | component + custom | OK |
| T32 | verification | manual | manual | OK |

---

## Requirement → Task Map

| Requirement | Task(s) |
|---|---|
| P3-01 Stage display window plumbing | T4, T5, T7 |
| P3-02 Stage display renderer (current+next+notes+clock) | T6, T12 |
| P3-03 Notes domain + schema | T1, T2, T8 |
| P3-04 Notes editor UI | T9, T10 |
| P3-05 Notes rendered in operator + stage panels | T11, T12 |
| P3-06 Section background fallback semantics | T1, T2, T13, T15 |
| P3-07 Section editor background picker | T14, T16 |
| P3-08 Key bindings storage | T1, T2, T17 |
| P3-09 Shortcuts settings UI | T19 |
| P3-10 Runtime shortcut dispatcher | T18, T20 |
| P3-11 Songs schema for CCLI metadata | T1, T2, T8 |
| P3-12 Song editor CCLI fields | T21 |
| P3-13 Play-counting service | T1, T2, T22 |
| P3-14 CCLI CSV export | T23, T24 |
| P3-15 Theme setting + Tailwind wiring | T1, T25 |
| P3-16 Theme picker in settings | T26, T27 |
| P3-17 Tauri updater plugin + signing | T3, T28 |
| P3-18 Update flow UI | T29, T30 |
| (cross-cutting i18n) | T31 |
| (cross-cutting verification) | T32 |

**Coverage:** 18 / 18 requirements mapped. 32 tasks total. T3 (release docs) + T16 (cross-feature media references) + T20 (key-event forwarding) + T27 (theme sweep) + T31 (i18n sweep) + T32 (verification) = 6 supporting tasks; T1, T2 = 2 foundations; T4–T30 (excluding the supporting ones) = 24 feature tasks across 18 requirements.

---

## MCPs and Skills (per task — to be confirmed)

For each task during Execute, use:
- **MCP:** filesystem (always), `tauri-plugin-dialog` for the CSV save dialog (T24), `tauri-plugin-updater` for update commands (T29).
- **Skill:** `mermaid-studio` if any task needs an extra diagram during execution; `codenavi` for the light-theme sweep (T27) since it touches many files.

No external MCPs needed — this is fully offline desktop work. Auto-update plugin pings GitHub Releases but only at runtime; tests never touch the network.

---

## What this plan deliberately does NOT do

- **No PPTX rendering.** Deferred to Phase 4 per D-14. No LibreOffice sidecar, no PPTX-aware set item type.
- **No Sentry crash reporting.** Deferred to Phase 4. No DSN management, no privacy disclosure flow.
- **No per-slide notes.** Per-section is the granularity for songs; per-set-item for everything else. Phase 4 candidate.
- **No per-section background for non-song set items.** Media / Countdown / WebView items already carry their own background config.
- **No custom theme palette.** Light + dark only via Tailwind tokens.
- **No update channels.** Single stable channel from GitHub Releases.
- **No CCLI direct API submission.** CSV export only; operator uploads to CCLI's site manually.
- **No multi-language presenter notes.** Notes are author-content; not translated through i18next.
- **No CI/CD pipeline.** Manual release via `scripts/release.ps1`; CI is Phase 4-shaped work.
- **No keyboard scheme presets ("Holyrics-like", "ProPresenter-like").** Per-action only; presets are a Phase 4 candidate.
