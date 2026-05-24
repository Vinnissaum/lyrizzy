# Phase 3: V2 — Stage Display + Notes + Section BG + Shortcuts + CCLI + Theme + Auto-Update

**Status:** Draft — 2026-05-20. Awaiting user approval before Design phase.
**Feature:** phase3-v2
**Last updated:** 2026-05-20
**Depends on:** Phase 2 V1 closing (Phase 2 Phase J completed 2026-05-19; final Phase 2 sub-phases land into `main` before Phase 3 design begins).

---

## Problem Statement

Phase 2 brings Trinity Lyrics to feature parity with Holyrics for the church's weekly Sunday service. Phase 3 turns the production tool into a polished product the volunteer rotation can use comfortably and the maintainer can ship without manual file copies. Three operator-facing pains drive Phase 3: (1) volunteers on stage have nothing in front of them (no monitor preview, no presenter cues) and rely on shoulder-tapping the operator; (2) songs reuse a single background for every section, even when verse vs. bridge benefit from different visuals; and (3) the church's CCLI compliance is tracked by hand in a spreadsheet, separate from the app. Two operational pains drive the rest: keyboard shortcuts are locked to a defaults the rotation cannot remember consistently, the operator console is white-on-white in a dark booth, and shipping a new build today requires the maintainer to manually distribute installers. Phase 3 closes these gaps so the tool is production-stable for a 6+ month run before any Phase 4 work.

## Goals

- [ ] On-stage talent (worship leader, speaker) can see the current slide, next slide, notes, and a clock on a third monitor without operator intervention.
- [ ] Operator and (optionally) on-stage talent can read per-section notes attached to songs and per-item notes attached to non-song set items.
- [ ] Operator can attach a background image or video to an individual song section so verse / chorus / bridge can have distinct visuals; section override falls back cleanly to the song-level background and then to the global default.
- [ ] Operator can rebind every runtime keyboard shortcut, see conflicts, and restore defaults — without restarting the app.
- [ ] Operator can export a CCLI-compatible CSV of song usage for any date range, with author / copyright / CCLI-number metadata stored on each song.
- [ ] Operator console can be switched between light and dark theme; setting persists across restarts.
- [ ] App checks GitHub Releases for a newer signed version on startup, surfaces an update prompt non-blocking, and applies the update on operator confirmation + restart.
- [ ] Used in a real Sunday service for at least 8 consecutive weeks before Phase 4 begins (extended feedback gate; Phase 4 is the heavier-deps phase: PPTX + Sentry).

## Out of Scope

Captured here to prevent scope creep — these belong in Phase 4 or are out of v2 entirely.

| Feature | Reason |
|---|---|
| PPTX rendering (bundled LibreOffice sidecar) | Phase 4 — heavy installer impact (~150 MB) deserves its own phase + signing review; PROJECT.md installer goal stays intact through Phase 3 |
| Opt-in Sentry crash reporting | Phase 4 — privacy disclosure flow + DSN management bundled with PPTX phase |
| Per-slide notes (slide-level granularity for songs) | Phase 4 candidate — per-section notes deemed sufficient; slide-level adds editor complexity for marginal gain |
| Per-section background **for non-song set items** | Out of v2 — Media / Countdown / WebView items already carry their own background config; only songs benefit from section-level overrides |
| Custom theme colors / branding | Out of v2 — light + dark only; no palette editor |
| Auto-update rollback / channel selection (stable / beta) | Out of v2 — single stable channel from GitHub Releases; rollback is manual reinstall |
| Multi-language presenter notes | Out of v2 — notes are author-language only; not translated through i18next |
| CCLI direct API submission | Out of v2 — CSV export only; operator uploads to CCLI's reporting site manually |
| Cloud sync / multi-device | Out of v2 entirely (per PROJECT.md) |

---

## Resolved Open Questions

User decisions captured from the spec discussion on 2026-05-20:

| # | Question | Resolution |
|---|---|---|
| OQ-P3-01 | PPTX strategy (LibreOffice CLI / video-rs / placeholder / bundle / drop) | Bundle LibreOffice subset (Tauri sidecar) — but **deferred to Phase 4**. Phase 3 does not ship PPTX. |
| OQ-P3-02 | Sentry crash reporting in scope for Phase 3? | No — deferred to Phase 4 alongside PPTX. |
| OQ-P3-03 | Presenter-notes display target | Optional **third "stage display" WebviewWindow** plus the operator-window side panel. Never rendered on the projector (presentation window). |
| OQ-P3-04 | CCLI / report format and schema | CSV only. Songs schema gains `ccli_number TEXT`, `copyright TEXT`, `author TEXT` columns (nullable). |
| OQ-P3-05 | What counts as a "play" for CCLI? | Per service: counted exactly once when a set is started and the song appears in that set. Re-starting the same set on the same calendar day is idempotent — no double count. |
| OQ-P3-06 | Stage display content layout | Industry-standard ProPresenter layout — current slide thumbnail + next slide thumbnail + notes panel + large clock. |
| OQ-P3-07 | Auto-update distribution channel | GitHub Releases + Tauri updater plugin. Public key embedded in app; private signing key kept out of repo (`.gitignore`). |
| OQ-P3-08 | Theme scope (operator only vs both windows) | Operator window only. Presentation window is content-driven (song / media / webview backgrounds) — theme does not touch it. |

---

## Requirements

Requirements grouped by area. All are P1 (Phase-3-MVP-critical) unless explicitly flagged P2/P3. Each carries a unique ID `P3-NN` for traceability into `design.md`, `tasks.md`, and verification.

### Area A — Stage display window (foundation for notes)

#### P3-01: Stage display window plumbing

A third Tauri `WebviewWindow` labeled `"stage"` opens on demand, owns its own monitor selection, and shares the React entry point pattern (`main.tsx` branch on `getCurrentWindow().label`).

**Acceptance criteria:**
1. WHEN the Rust crate compiles THEN a new `open_stage_window` Tauri command SHALL exist alongside `open_presentation_window`, creating a WebviewWindow with label `"stage"` and a configurable monitor index.
2. WHEN `main.tsx` runs and `getCurrentWindow().label === "stage"` THEN it SHALL dynamically import and mount `<StageApp />` (parallel to `<OperatorApp />` and `<PresentationApp />`).
3. WHEN the operator opens "Configurações > Janelas > Stage display" and picks a monitor THEN the stage window SHALL open fullscreen on that monitor (or windowed on the operator's monitor if no extra monitor is available).
4. WHEN the operator closes the stage window THEN the `open_stage_window` command SHALL be idempotent — calling it again reopens the window on the previously chosen monitor.
5. WHEN the stage window is open THEN it SHALL be **read-only** (never invokes mutating commands — same invariant as the presentation window).
6. WHEN `state_changed`, `countdown_tick`, or `media_library_changed` events fire THEN the stage window SHALL listen and react identically to the other two windows.

**Notes:** Stage window is optional. The app must run normally with only operator + presentation. Failing to open the stage window is non-fatal.

---

#### P3-02: Stage display renderer

Stage window content follows the ProPresenter layout — current slide preview top-left, next slide preview top-right, notes panel below, clock prominent.

**Acceptance criteria:**
1. WHEN the runtime is on any set item THEN the stage display SHALL show the **current slide / item** rendered as a scaled-down preview occupying the top-left quadrant (~40% width).
2. WHEN the next slide or set item exists THEN the stage display SHALL show a **next** preview at top-right (same scale). When no next exists ("end of set") it SHALL show a localized "Fim do culto" placeholder.
3. WHEN the active item has notes (per P3-04) THEN the notes SHALL render below the previews in large readable type (target line height ~28 px on a 1080p display) with auto-scroll if content overflows.
4. WHEN any time the stage window is mounted THEN a **clock** SHALL render in the bottom-right showing local time (`HH:MM:SS`, locale-formatted from P2-20). When a countdown set item is active the clock SHALL switch to the countdown's `remaining_ms` (same rendering as P2-12) instead of wall-clock.
5. WHEN the lyric song's current section advances THEN both the "current" and "next" previews SHALL update with the 200 ms crossfade transition from P2-09.
6. WHEN the operator triggers Blank or Freeze on the presentation window THEN the stage display SHALL **not** blank — the on-stage view stays visible to the talent (this is intentional: the operator can hide from the congregation without losing the stage view).
7. WHEN the operator triggers Blank THEN the stage display SHALL render a small "Tela apagada" / "Screen blanked" indicator badge so the talent knows what the projector is showing.

**Notes:** Stage display content is text-and-thumbnail-heavy; it must not GPU-stress the system (the presentation window is doing the heavy media work). Use CSS `transform: scale()` for previews, not separate video decoders.

---

### Area B — Presenter notes

#### P3-03: Notes domain + schema (per-section + per-set-item)

Notes attach at two levels: per song-section (for `song` set items, granular per verse/chorus/bridge) and per-set-item (for non-song items where there's no sub-structure).

**Acceptance criteria:**
1. WHEN migration `005_notes_phase3.sql` runs THEN the `sections` table SHALL gain a `notes TEXT` column (nullable, default NULL) and the `set_items` table SHALL gain a `notes TEXT` column (nullable, default NULL).
2. WHEN the Rust crate compiles THEN `domain::song::Section` SHALL include `notes: Option<String>` and `domain::set::SetItem` SHALL include `notes: Option<String>`, both serializing camelCase.
3. WHEN `src/types/index.ts` is read THEN the TypeScript `Section` and `SetItem` types SHALL mirror the Rust additions.
4. WHEN a section or set item is created without notes THEN the column SHALL remain NULL — empty string is normalized to NULL on save.
5. WHEN existing Phase 2 data is migrated forward THEN no row SHALL be touched except for the schema change (notes default NULL for everything pre-existing).

---

#### P3-04: Notes editor UI

Operator edits section notes in the song editor and set-item notes in the set builder.

**Acceptance criteria:**
1. WHEN the operator opens the song editor THEN each section row SHALL have a small "Notas" toggle/icon that expands a textarea (auto-grow) bound to `section.notes`. Default state is collapsed if notes are empty.
2. WHEN the operator edits a non-song set item (media, countdown, webview, blank) in the set editor's detail panel THEN a "Notas" textarea SHALL be present at the bottom of the inline panel, bound to `set_item.notes`.
3. WHEN the operator types in any notes field THEN changes SHALL be debounced (~300 ms) and persisted via the existing update commands; the existing `state_changed` event delivers the update to the stage display in real time.
4. WHEN notes contain newlines THEN they SHALL be preserved (rendered with `white-space: pre-wrap` everywhere).
5. WHEN notes exceed 2000 characters THEN the editor SHALL show a soft character count warning but allow saving (no hard limit — operators may paste sermon outlines).

**Notes:** Notes never participate in i18n. They are author-content. The operator who writes Portuguese notes sees Portuguese notes; an English-locale UI operator still sees those Portuguese notes verbatim.

---

#### P3-05: Notes rendered in operator panel + stage display

Notes appear in two places, never on the projector.

**Acceptance criteria:**
1. WHEN the runtime is on a song set item AND the current section has notes THEN the operator window's runtime view SHALL show those notes in a right-hand side panel (or below the slide preview, layout TBD in design).
2. WHEN the runtime is on a non-song set item AND that item has notes THEN the operator window SHALL show those notes in the same panel location.
3. WHEN the active section / item has no notes THEN the panel SHALL collapse (no empty placeholder taking up space).
4. WHEN notes are shown in the operator panel THEN they SHALL render in the same `white-space: pre-wrap` style as the editor.
5. WHEN notes are shown in the stage display THEN they SHALL follow P3-02 criterion 3 (large type, auto-scroll on overflow).
6. WHEN the presentation window renders THEN it SHALL **never** include notes content (privacy: notes are operator/talent-only).

---

### Area C — Per-section background overrides

#### P3-06: Section background column + fallback semantics

Sections gain an optional `background_id` foreign key to the `media` table. Effective background for a slide is `section.background_id ?? song.background_id ?? settings.default_background`.

**Acceptance criteria:**
1. WHEN migration `005_notes_phase3.sql` runs (same migration as P3-03) THEN the `sections` table SHALL also gain `background_id TEXT NULL` with a foreign key to `media.id` (ON DELETE SET NULL).
2. WHEN the Rust crate compiles THEN `domain::song::Section` SHALL include `background_id: Option<String>`, camelCase on the wire.
3. WHEN the presentation renderer computes the effective background for the current slide THEN it SHALL apply the fallback chain: `section.background_id`, falling through to `song.background_id`, falling through to `settings.default_background_color` (or default-background-image).
4. WHEN a section's `background_id` references a media row that has been soft-deleted (P2-02 criterion 4) THEN the fallback chain SHALL skip the section override and continue from `song.background_id`; a console warning SHALL log the broken reference.
5. WHEN slides advance within a song and a slide crosses a section boundary that has different effective backgrounds THEN the renderer SHALL crossfade the background per the P2-09 transition rules (200 ms).
6. WHEN a video background is configured at the section level THEN it SHALL behave identically to a song-level video background (looped, muted, scrim per P2-08) — but it SHALL restart on the section boundary, not continue across section changes.

**Notes:** Section-level video background restarts at every section boundary. This is intentional: a 30 s background on a 4-minute song would otherwise look stale. The song-level video background is the one that plays continuously across sections.

---

#### P3-07: Section editor UI for background picker

The song editor exposes the section background picker alongside the existing notes editor.

**Acceptance criteria:**
1. WHEN the operator opens the song editor THEN each section row SHALL have a small "Fundo" button next to the "Notas" button. Default state: no background (uses song default).
2. WHEN the operator clicks "Fundo" on a section THEN the existing media picker (introduced in P2-04 detail panel) SHALL open scoped to images and videos; selecting a media row sets `section.background_id`.
3. WHEN the operator clicks "Limpar fundo" THEN `section.background_id` SHALL be set to NULL (falls back to song default per P3-06).
4. WHEN the section list is rendered THEN sections with custom backgrounds SHALL show a small thumbnail badge so the operator can see at a glance which sections have overrides.
5. WHEN the operator deletes a media file used by a section override THEN the existing P2-02 criterion 5 dependency check SHALL include sections in its "Mídia em uso por:" listing.

---

### Area D — Keyboard shortcut customization

#### P3-08: Shortcut binding storage

Keyboard shortcuts move from hard-coded constants to a persisted setting.

**Acceptance criteria:**
1. WHEN migration `005_notes_phase3.sql` runs THEN a `key_bindings` row SHALL be inserted into the existing `settings` key/value table with a default JSON map covering every Phase 1/2 shortcut: advance (Space, ArrowRight), previous (ArrowLeft), blank (B), freeze (F), exit (Escape), digits 1-9 (jump to item), countdown pause (P), open presentation window (Ctrl+P), search focus (Ctrl+F).
2. WHEN the Rust crate compiles THEN `domain::settings::KeyBindings` SHALL exist as `HashMap<ActionId, Vec<Shortcut>>` where `ActionId` is an enum of all bindable actions and `Shortcut` carries the keyboard event signature (`key`, `ctrl`, `shift`, `alt`).
3. WHEN the Tauri command `getKeyBindings()` is called THEN it SHALL return the current bindings deserialized from the settings row.
4. WHEN `setKeyBindings(bindings)` is called THEN the backend SHALL validate that every required `ActionId` has at least one shortcut, that no two actions share an identical `Shortcut`, and persist the update; a `state_changed` event (or new `key_bindings_changed` event — design choice) SHALL notify the operator window to refresh its dispatcher.
5. WHEN no `key_bindings` row exists at startup (fresh install, or restore from a pre-Phase-3 backup) THEN the migration SHALL insert the default bindings.

---

#### P3-09: Shortcuts settings UI

Operator rebinds shortcuts in a dedicated settings screen with conflict detection and a "Restore defaults" action.

**Acceptance criteria:**
1. WHEN the operator opens "Configurações > Atalhos" THEN a list of every bindable action SHALL render with its current shortcut(s) shown as keycap-styled tags.
2. WHEN the operator clicks "Editar" on an action THEN the row SHALL enter capture mode — the next physical keypress combination is recorded and proposed as the new binding (Esc cancels capture).
3. WHEN the proposed binding conflicts with another action's binding THEN the UI SHALL surface a pt-BR/en error inline ("Conflito com 'Avançar slide' — desfaça primeiro") and refuse to save.
4. WHEN the operator clicks "Restaurar padrões" THEN a confirmation dialog SHALL appear; on confirm, the bindings JSON SHALL revert to the migration defaults.
5. WHEN the operator saves a change THEN the runtime dispatcher SHALL pick up the new binding within ~100 ms (no app restart required).
6. WHEN multiple shortcuts are bound to the same action (e.g., Space AND ArrowRight both advance) THEN the UI SHALL allow this explicitly via an "Adicionar atalho" row per action.

---

#### P3-10: Runtime shortcut dispatcher reads from settings

The keyboard handler in the operator window dispatches actions based on the persisted bindings rather than literal key checks.

**Acceptance criteria:**
1. WHEN the operator window mounts THEN it SHALL call `getKeyBindings()` and build a runtime lookup `Map<KeyEvent, ActionId>`.
2. WHEN a keydown fires on the operator window THEN the handler SHALL consult the lookup; matching events trigger their action via existing commands.
3. WHEN bindings change (via the settings UI) THEN the dispatcher's lookup SHALL rebuild without a window reload.
4. WHEN a keydown originates from inside a text input (song editor textarea, search box) THEN runtime shortcuts SHALL NOT fire — existing input-blur semantics preserved.
5. WHEN the presentation or stage windows receive keydown events THEN they SHALL forward through the operator's dispatcher (presentation/stage stay read-only — they never run commands directly).

---

### Area E — Service report / CCLI export

#### P3-11: Song schema additions for CCLI metadata

Songs gain three nullable text columns for CCLI compliance.

**Acceptance criteria:**
1. WHEN migration `005_notes_phase3.sql` runs THEN the `songs` table SHALL gain `ccli_number TEXT NULL`, `copyright TEXT NULL`, and `author TEXT NULL` columns.
2. WHEN the Rust crate compiles THEN `domain::song::Song` SHALL include `ccli_number: Option<String>`, `copyright: Option<String>`, `author: Option<String>`, camelCase on the wire.
3. WHEN existing songs are read (no values) THEN all three fields SHALL be `None` / `null`.
4. WHEN the FTS5 search index is refreshed (P1-07) THEN `author` SHALL participate as a searchable field alongside title and artist (migration includes the FTS trigger update).

**Notes:** `author` is distinct from the existing `artist` column — `artist` is "who performs this version" and `author` is the credit-line owner used for CCLI reporting. Both can be populated; CCLI export uses `author`.

---

#### P3-12: Song editor exposes CCLI fields

The song editor surfaces the new fields in a dedicated "Direitos / Licença" panel that is collapsed by default.

**Acceptance criteria:**
1. WHEN the operator opens the song editor THEN a collapsible "Direitos / Licença" section SHALL exist below the lyrics/sections area with three inputs: "CCLI #", "Direitos autorais (©)", and "Autor".
2. WHEN any field is edited THEN changes SHALL be debounced and persisted; no special validation beyond optional non-empty string.
3. WHEN the operator searches songs by FTS5 (P1-07) THEN matches on `author` SHALL appear with the title and artist matches.

---

#### P3-13: Play-counting service

A `song_plays` ledger records "song was used in this set on this date" — driven automatically when a set is started.

**Acceptance criteria:**
1. WHEN migration `005_notes_phase3.sql` runs THEN a `song_plays` table SHALL be created: `id TEXT PK`, `song_id TEXT NOT NULL` (FK to songs), `set_id TEXT NOT NULL` (FK to sets), `played_on DATE NOT NULL`, `created_at INTEGER NOT NULL`. Unique constraint on (`song_id`, `set_id`, `played_on`) enforces idempotency.
2. WHEN the operator triggers "Iniciar culto" / "Start service" on a set (existing command to begin the runtime) THEN the backend SHALL insert one `song_plays` row per song-typed `set_item` in that set; the unique constraint silently skips duplicates within the same day.
3. WHEN the same set is started twice on the same calendar day THEN no duplicate rows SHALL be created (idempotent per OQ-P3-05).
4. WHEN a set is started across two calendar days (e.g. New Year's Eve service crossing midnight) THEN `played_on` SHALL be the **set start date** (operator's local timezone), not the slide-advance time.
5. WHEN a song referenced by a `song_plays` row is hard-deleted (currently impossible in v2 — songs are soft-deleted) THEN the play record SHALL survive (FK ON DELETE SET NULL or NO ACTION; design picks).
6. WHEN `cargo test` runs THEN an integration test SHALL exercise the idempotency guarantee: start the same set twice, assert exactly one row per song.

---

#### P3-14: CSV export UI + command

Operator exports a CCLI-compatible CSV for a date range.

**Acceptance criteria:**
1. WHEN the operator opens "Configurações > Relatórios > Exportar CCLI" THEN a screen SHALL render with a date-range picker (from / to, default = last 90 days), a preview table of qualifying plays, and an "Exportar CSV" button.
2. WHEN the operator clicks "Exportar CSV" THEN a save dialog SHALL prompt for the output path (default filename: `ccli-report-{YYYY-MM-DD}-to-{YYYY-MM-DD}.csv`).
3. WHEN the CSV is written THEN it SHALL contain UTF-8 with BOM (Excel compatibility), comma delimiter, headers in row 1: `Data, Título, Autor, CCLI #, Direitos`. One row per play within the date range.
4. WHEN multiple plays exist for the same song in the range THEN each play is its own row (this matches CCLI's "Usage per service" reporting model).
5. WHEN a song's CCLI metadata fields are empty THEN the CSV cell SHALL be empty (not "null", not a placeholder).
6. WHEN the date range yields zero plays THEN the export SHALL still succeed, producing a CSV with only the header row, and a pt-BR/en toast notifies the operator.
7. WHEN `cargo test` runs THEN an integration test SHALL seed a song_plays fixture and assert the CSV output byte-for-byte matches an expected file.

---

### Area F — Dark/light UI theme

#### P3-15: Theme setting + Tailwind dark-mode wiring

Tailwind v4's class-based dark mode is wired to a persisted setting.

**Acceptance criteria:**
1. WHEN `tailwind.config` (or the v4 equivalent CSS-based config) is read THEN dark mode SHALL be enabled via the `class` strategy (`<html class="dark">` toggles).
2. WHEN migration `005_notes_phase3.sql` runs THEN a `theme` row SHALL be inserted into `settings` with default value `"light"`.
3. WHEN the operator window mounts THEN the persisted theme value SHALL be read and applied as the `dark` class on `<html>` before first paint (no flash of wrong theme).
4. WHEN the Rust crate exposes `setTheme(theme: "light" | "dark")` THEN it SHALL persist the value and emit `state_changed`.
5. WHEN the presentation OR stage windows mount THEN they SHALL NOT read or apply the theme — they remain content-driven (OQ-P3-08).

---

#### P3-16: Theme picker in settings

Operator switches theme via Settings > General; change is instant.

**Acceptance criteria:**
1. WHEN the operator opens "Configurações > Geral" THEN a "Tema" toggle SHALL appear with two options: "Claro" / "Escuro" (localized).
2. WHEN the operator changes the value THEN the operator window's `<html>` SHALL toggle the `dark` class instantly (no reload, no flicker).
3. WHEN the operator restarts the app THEN the persisted theme SHALL apply on startup.
4. WHEN every operator-facing component is reviewed THEN it SHALL render correctly under both themes — no white-on-white, no black-on-black, no Phase 1/2 components that hard-coded `bg-white text-black` (regression sweep is part of the implementation work).

---

### Area G — Auto-update

#### P3-17: Tauri updater plugin + signing infrastructure

Tauri's `updater` plugin is integrated; release artifacts are signed with a key pair; the public key is embedded in the app.

**Acceptance criteria:**
1. WHEN `package.json` and `Cargo.toml` are read THEN `@tauri-apps/plugin-updater` and `tauri-plugin-updater` SHALL be present.
2. WHEN `tauri.conf.json` is read THEN the `updater` section SHALL be configured with `"active": true`, `endpoints` pointing at the GitHub Releases JSON manifest URL pattern (e.g., `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`), and `pubkey` containing the embedded public key.
3. WHEN a release is built and uploaded to GitHub Releases THEN a `latest.json` manifest SHALL accompany the installer with the signature, version, and download URL — generation documented in the release process (TBD in design).
4. WHEN the signing private key is generated THEN it SHALL be kept out of the repository (added to `.gitignore`) and stored separately by the maintainer. A `tauri-key.pub` (or similar) public-key file MAY be committed.
5. WHEN `cargo test` and `npm run build` run THEN they SHALL succeed without the updater plugin reaching out to GitHub (no network in tests).

**Notes:** Signing key management is operational — outside the spec's testable scope but flagged so design captures the maintainer playbook. If signing keys are not yet generated, the design phase produces the procedure.

---

#### P3-18: Update flow UI

Operator sees a non-blocking prompt when an update is available; manual check is also available.

**Acceptance criteria:**
1. WHEN the app launches THEN it SHALL check for updates ONCE per 24-hour window (debounced via a `last_update_check` timestamp in `settings`); failure is silent (no error toast on offline launches).
2. WHEN an update is available THEN a non-blocking banner SHALL appear in the operator window header: "Nova versão {x.y.z} disponível — Atualizar". Dismissing the banner suppresses it for the current session only.
3. WHEN the operator clicks the banner OR opens "Configurações > Sobre > Verificar atualizações" manually THEN an update dialog SHALL show release notes (fetched from the manifest), the new version number, and "Baixar e instalar" / "Mais tarde" actions.
4. WHEN the operator chooses "Baixar e instalar" THEN the plugin SHALL download the signed installer, verify the signature, prompt for restart, and re-launch into the new version.
5. WHEN signature verification fails THEN the install SHALL be aborted with a pt-BR/en error; no partial installation is left on disk.
6. WHEN the operator chooses "Mais tarde" THEN the banner SHALL stay dismissed until the next 24-hour window elapses.
7. WHEN the update fails (network drop mid-download, disk full, signature mismatch) THEN the running app SHALL remain functional; the failure is logged and surfaced as a non-blocking error toast.

---

## Edge Cases

Captured as forward-looking acceptance criteria — these are recurring failure modes the spec addresses.

- WHEN the operator opens the stage display window on a single-monitor system THEN it SHALL open as a regular floating window on the same monitor as the operator (no error); on the next launch with two monitors, the previous monitor preference is restored if valid.
- WHEN the operator closes the stage display mid-service THEN the presentation window SHALL be unaffected; reopening the stage display picks back up at the current slide.
- WHEN the operator drags the stage window between monitors manually THEN the new monitor index SHALL be persisted on close.
- WHEN a song with section-level video backgrounds is the active song AND the operator advances rapidly across sections THEN the video background restarts SHALL be visually smooth (crossfade per P2-09) even when consecutive sections share the same `background_id` (in that case, no restart — same media continues).
- WHEN the operator binds a runtime shortcut that overlaps a known browser shortcut (Ctrl+T, Ctrl+W) THEN the dispatcher SHALL prevent the default and dispatch the action — no new tab opens, no window closes.
- WHEN a binding capture in the settings UI receives only a modifier key (e.g., Shift alone with no main key) THEN the UI SHALL reject the capture and prompt for a complete combination.
- WHEN the CCLI export date range spans a daylight-saving transition THEN `played_on` (DATE column) SHALL not be affected (date arithmetic, not timestamp).
- WHEN a song was renamed or had its CCLI metadata edited AFTER a play was recorded THEN the CSV export SHALL use the song's CURRENT metadata (not historical) — this is intentional; CCLI reports the canonical credit line.
- WHEN the theme is switched in the middle of an edit (operator has an unsaved textarea) THEN no in-flight content SHALL be lost; the theme change SHALL only affect rendering.
- WHEN auto-update detects a version older than the installed one (downgrade scenario) THEN it SHALL silently ignore — no rollback in v2.
- WHEN the update manifest is unreachable for 7+ consecutive launches THEN the `last_update_check` SHALL still be touched on each attempt (back-off), but no nagging error is shown.
- WHEN the user restores a backup (P2-18) from a pre-Phase-3 export THEN the migration runs against the restored DB and the new columns/tables (notes, section.background_id, song_plays, CCLI fields, key_bindings/theme settings) SHALL all be created with their defaults.
- WHEN the operator binds a single shortcut to two actions (impossible by P3-08 validation) THEN the UI SHALL never allow saving — the conflict check covers both directions.
- WHEN the stage window is open and the operator presses a runtime shortcut WHILE the stage window has focus THEN the dispatcher SHALL still handle it (events bubble back to the operator's command layer per P3-10 criterion 5).

---

## Requirement Traceability

| ID | Area | Phase | Status |
|---|---|---|---|
| P3-01 | A — Stage display: window plumbing | Design | Pending |
| P3-02 | A — Stage display: renderer (current+next+notes+clock) | Design | Pending |
| P3-03 | B — Notes: domain + schema (per-section + per-set-item) | Design | Pending |
| P3-04 | B — Notes: editor UI in song + set builder | Design | Pending |
| P3-05 | B — Notes: rendered in operator panel + stage | Design | Pending |
| P3-06 | C — Section BG: column + fallback semantics | Design | Pending |
| P3-07 | C — Section BG: section editor picker | Design | Pending |
| P3-08 | D — Shortcuts: bindings storage | Design | Pending |
| P3-09 | D — Shortcuts: settings UI | Design | Pending |
| P3-10 | D — Shortcuts: runtime dispatcher | Design | Pending |
| P3-11 | E — CCLI: song schema additions | Design | Pending |
| P3-12 | E — CCLI: song editor fields | Design | Pending |
| P3-13 | E — CCLI: play-counting service | Design | Pending |
| P3-14 | E — CCLI: CSV export UI + command | Design | Pending |
| P3-15 | F — Theme: setting + Tailwind wiring | Design | Pending |
| P3-16 | F — Theme: picker in settings | Design | Pending |
| P3-17 | G — Auto-update: plugin + signing infra | Design | Pending |
| P3-18 | G — Auto-update: update flow UI | Design | Pending |

**Coverage:** 18 total, 0 mapped to tasks yet, 18 pending design.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

---

## Success Criteria

Phase 3 is done when ALL of the following are true:

- [ ] A real Sunday-service rotation runs a full set with: stage window open on a front-of-stage monitor (talent reads notes + previews from it), at least one song with section-level background overrides, custom keyboard bindings configured by the volunteer who runs the booth, and dark theme active.
- [ ] After 4 consecutive Sundays of use, the operator exports a CCLI CSV for the month; the CSV imports into CCLI's reporting site without manual cleanup (header row + per-play rows, correct date formatting, correct CCLI #s).
- [ ] An update published to GitHub Releases is detected by the running app within 24 hours, the operator can apply it from the in-app banner, signature verification succeeds, and the app re-launches into the new version without losing library state.
- [ ] Operator window passes a visual regression sweep under both themes — no contrast issues, no hardcoded color leaks.
- [ ] Keyboard bindings persist across restarts; "Restore defaults" works; conflict detection prevents duplicate bindings.
- [ ] `cargo test` and `npx vitest run` both pass green; `tsc --noEmit` is clean; the app runs through an 8-week real-service feedback period before Phase 4 begins.
- [ ] No regression in Phase 1 or Phase 2 user stories (P1-01..P1-15, P2-01..P2-20) — full smoke test of those flows is part of the validation gate.

---

## Decisions still open (candidates for Discuss / Design)

These are gray areas with proposed defaults that the user should confirm or redirect before design begins:

1. **Notes panel placement in operator window** (P3-05): proposed right-hand sidebar next to the slide preview. Alternative: a bottom-strip panel below the preview (more horizontal real estate for notes; less vertical room for the slide). Design picks; mock-up needed.
2. **Stage display monitor selection UX** (P3-01): proposed reusing the Phase 1 monitor picker pattern (P1-14). Alternative: introduce a "Janelas" sub-screen in settings that owns ALL window placements (presentation + stage). Slight refactor of P1-14.
3. **Section background restart vs continue across sections** (P3-06 criterion 6): proposed restart on section boundary. Alternative: continue (treat the section override as "this section's preferred bg" but never interrupt playback). Worship-leader UX call.
4. **Key bindings: scheme presets** (P3-09): proposed individual per-action binding. Future-friendly alternative: ship one or two named "schemes" (e.g., "Holyrics-like", "ProPresenter-like") that the operator can apply as a bundle. Not v2 — flagged here for Phase 4.
5. **CCLI metadata enforcement** (P3-11/P3-12): proposed all three fields are optional. Alternative: warn at export time when a played song has no CCLI #. Design picks the warning UX.
6. **Auto-update channel selection** (P3-17): single stable channel in v2. Alternative: ship a hidden "beta" channel for the maintainer to test pre-release builds against their own machine. Out of v2 per "Out of Scope" but worth confirming.
7. **Update check frequency** (P3-18 criterion 1): proposed 24 h. Alternative: on every launch (chattier) or weekly (quieter). 24 h is the default; flag for confirmation.
8. **Dark mode default for new users** (P3-15 criterion 2): proposed `"light"`. Alternative: follow OS theme on first launch (`prefers-color-scheme` media query) then persist whichever was applied. Slight UX win, slight implementation cost.

---
