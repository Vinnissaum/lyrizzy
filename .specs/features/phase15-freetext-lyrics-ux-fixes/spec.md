# Phase 15 — Free-Text Lyrics Editor, Live-Edit Refresh & Operator UX Fixes

**Status:** Tasks drafted (2026-08-11) — spec + design done, 18 tasks in `tasks.md`, awaiting approval to execute
**Depends on:** Phase 14 (live lyrics editing, per-monitor naming, icon rebrand), Phase 7 (3-pane operator layout), D-47 (dual independent outputs)
**Release target:** its own tag, `v1.2.0` (minor — new behaviour + fixes, no breaking data change)

---

## Problem Statement

Phase 14 shipped live lyrics editing, per-monitor naming and an icon rebrand. Field use since then surfaced three defects in those features (the strophes list ignores a live edit, monitor names need an app restart to take effect, and a mislabelled control in the Aviso settings tab), one gap (screen names are absent exactly where the operator maps audio to a TV), and one rejection (the new icon does not read as a church app).

Separately, registering a song is still a multi-control ceremony — a list of section cards each with a label, a type dropdown, a repeat counter, a notes toggle and a body box — when the operator's real workflow is *paste the lyrics and go*. The app already has that flow hidden behind a "Colar letra completa" button; this phase promotes it to be the editor itself.

---

## Root-Cause Analysis

Each reported defect was traced to a specific line before this spec was written. No requirement below is speculative.

| # | Report | Root cause | Evidence |
|---|--------|-----------|----------|
| RC-1 | Live edit updates projection + preview but **not** the strophes list | `refresh_song_in_outputs` emits `pres.clone()`, and the in-memory `PresentationState` is deliberately kept **slim** (`all_slides_per_item` emptied at load time so navigation payloads stay small). The frontend's `reconcileSlides` sees an empty `allSlidesPerItem` on the same set and **carries the stale previous copy forward**. `currentSlide`/`nextSlide` *are* recomputed, which is exactly why projection and LIVE preview refresh while the grid does not. | `commands/presentation.rs:559` (`emit_state(app, output, &snapshot)` after `pres.clone()`), `commands/presentation.rs:614-615` (`slim.all_slides_per_item = Vec::new()`), `src/stores/presentation.ts:27-31`, `src/components/presentation/StrophesGrid.tsx:152,177` |
| RC-2 | Monitor names only take effect after an app restart | There is no shared state for monitor names. Four consumers each fetch them independently in a mount-time `useEffect` with no invalidation. `PresentationLaunchProvider` mounts **once for the app's lifetime**, so it caches the names at boot and never re-reads them. Renaming in Settings writes the DB and updates only `MonitorNameSettings`' own local `useState`. | `PresentationLaunchProvider.tsx:45-74`, `OutputSwitcher.tsx:56`, `MonitorPicker.tsx:43`, `MonitorNameSettings.tsx:23-35`, `utils/monitorNames.ts:49` |
| RC-3 | Aviso tab says "Tamanho do texto das músicas" | The Aviso tab reuses the Projeção tab's translation key verbatim for a control that sets the **announcement** font size. | `SettingsScreen.tsx:385` uses `t("settings.windows.fontSize")`; `pt-BR.json:676` = "Tamanho do texto das músicas" |
| RC-4 | Audio/mic config does not say which screen is which | The per-output audio blocks are titled only by index. | `MicAudioSettings.tsx:75` renders `t("presentation.output.tela", { n: i + 1 })` |

**Additional finding, not reported (F-1):** `db_update_song` deletes every row in `song_sections` and re-inserts with a fresh `new_id()` UUID on **every save** (`commands/song.rs:353-361`). `Slide.section_id` therefore changes on every edit, so the Phase 14 slide anchor (`SlideAnchor { section_id, ordinal }`, D-58/D-65) can never hit its exact-match or last-match branch after a live edit — `resolve_anchor` always falls through to step 3, `old_index.min(len - 1)` (`domain/slide.rs:82-91`). Position is held by index clamping, not by section identity. This works in the common case (fix a typo, slide count unchanged) and silently mis-anchors when the edit adds or removes a strophe above the current position. The free-text refactor makes section rewriting even more routine, so P15-19 fixes the id generation to be deterministic.

---

## Goals

- [ ] A live edit is reflected in **every** operator surface — projection, LIVE preview *and* the strophes list — in one save, with no black frame and no lost position
- [ ] Renaming a monitor takes effect everywhere immediately, with no app restart
- [ ] Every setting is labelled for the thing it actually controls, and every screen-scoped control names its screen
- [ ] Registering a song is *paste the lyrics and save* — one title, one text box, no section ceremony — and the same box is what the operator gets mid-presentation
- [ ] The app icon reads as a church worship app: Trinity symbol fused with music

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dropping the `song_sections` table / adding `songs.lyrics` | User decision (GA-1): sections become derived internal storage. Keeping the schema preserves `.tlz` backup compatibility, the FTS body index, per-strophe slide anchoring and both import wizards, at a fraction of the risk |
| Bracket-label syntax (`[Refrão]`) inside the free-text box | Would consume the line on save and re-emit it on load, breaking exact round-trip in a box the operator edits **live**. The plain-text import wizard keeps its bracket handling for pasted third-party content |
| Per-section backgrounds (P3-06/P3-07) | Reachable only through the section UI being removed. Backend resolution chain (`services/background.rs`) is left intact for legacy data; no new UI surface |
| Per-section notes | User decision (GA-2): replaced by song-level notes, repointed into the operator Notes panel |
| Repeat count as new data | User decision (GA-3): dropped from the UI. See P15-18 for the deliberately narrow scope |
| Renaming a monitor from the presentation window | Presentation window is read-only (architecture invariant) |
| Reworking the plain-text / Holyrics import wizards | They already produce sections; the derived-section save path consumes the same shape |
| A full brand refresh (wordmark, splash, installer art) | Icon only, as in Phase 14D |

---

## User Stories

### 15A — Live edit reaches the strophes list

#### P1: Strophes list refreshes on a live save ⭐ MVP

**User Story**: As an operator, I want the strophes list to show my correction the moment I save it, so that I am not clicking blind on cards that show text the projector no longer displays.

**Why P1**: The operator navigates by clicking strophe cards. A grid showing pre-edit text after an edit is actively misleading — worse than not being able to edit at all.

**Acceptance Criteria**:

1. WHEN a song is saved while it is loaded in an output THEN the `state_changed` payload for that output SHALL carry the regenerated `allSlidesPerItem` for the whole set
2. WHEN that payload arrives THEN `reconcileSlides` SHALL take the incoming slides verbatim rather than carrying the previous copy forward
3. WHEN the operator saves a live edit THEN the strophes grid SHALL show added, removed, reordered and re-worded strophes without leaving presentation mode
4. WHEN the payload is applied THEN the in-memory `PresentationState` held in `AppState` SHALL still store `all_slides_per_item` empty, so ordinary navigation events stay small
5. WHEN the edited song appears more than once in the set THEN every occurrence's slides SHALL be refreshed in the grid
6. WHEN the edited song is not the currently displayed item THEN the grid SHALL be unaffected and the current item SHALL keep its position

**Independent Test**: Enter presentation on a set, live-edit the projected song to add a strophe in the middle, save. The projector holds position and shows the right slide; the strophes grid gains a card at the right place; the active card is still highlighted.

---

### 15B — Screen names, everywhere and immediately

#### P1: Renaming a monitor takes effect without restart ⭐ MVP

**User Story**: As an operator, I want a monitor rename to apply immediately, so that I can label the screens once during setup and see it work.

**Why P1**: The naming feature shipped in Phase 14 is effectively inert — the operator cannot verify their own change without restarting the app mid-setup.

**Acceptance Criteria**:

1. WHEN the operator window boots THEN monitor names and the monitor list SHALL be loaded once into shared store state
2. WHEN a name is saved in Settings THEN every consumer SHALL re-render with the new name with no app restart — Settings monitor list, presentation-monitor picker, output switcher, multi-screen launch modal, and the audio/mic blocks
3. WHEN a name field is cleared THEN every consumer SHALL immediately fall back through the chain OS name → `Monitor N — W×H`
4. WHEN the settings row is missing or malformed THEN the store SHALL resolve to an empty map rather than throwing, preserving today's behaviour
5. WHEN two operator surfaces are open at once THEN they SHALL never display different names for the same monitor

**Independent Test**: With the app running, rename a monitor in Settings, then open the Projeção tab, the output switcher and the Apresentar launch modal — all show the new name.

#### P2: Screen names in the audio/mic configuration

**User Story**: As an operator, I want the audio/mic blocks to say which screen they belong to by name, so that I can map a microphone to the right TV without counting.

**Why P2**: A real ergonomic gap, but the operator can currently work it out from the index; it does not block a service.

**Acceptance Criteria**:

1. WHEN a monitor is assigned to an output THEN that output's audio block heading SHALL show the resolved monitor name alongside the `Tela N` label
2. WHEN no monitor is assigned to an output THEN the heading SHALL fall back to the plain `Tela N` label used today
3. WHEN a monitor is renamed THEN the audio block heading SHALL update immediately (per P15-04..P15-06)

**Independent Test**: Name the two monitors, enable multi-screen, open Projeção → the two audio blocks are headed with the monitor names.

---

### 15C — Correct label in the Aviso tab

#### P1: Announcement font size is labelled as such ⭐ MVP

**User Story**: As an operator, I want the Aviso tab's text-size control to say it sizes the announcement, so that I am not afraid of changing the song size by accident.

**Why P1**: One-line fix; the current label states the opposite of what the control does.

**Acceptance Criteria**:

1. WHEN the Aviso tab renders its text-size control THEN the label SHALL name the announcement, not songs
2. WHEN the Projeção tab renders its text-size control THEN it SHALL keep the existing song wording
3. WHEN either locale is active THEN the new key SHALL exist in both `pt-BR` and `en-US`, keeping the locale-parity test green

**Independent Test**: Open Settings → Aviso in both languages; the control reads "Tamanho do texto do aviso" / "Announcement text size".

---

### 15D — Trinity + music app icon

#### P2: Icon reads as a church worship app

**User Story**: As the maintainer, I want the app icon to combine a Trinity symbol with a musical mark, so that it reads as what it is at a glance in the taskbar.

**Why P2**: Cosmetic — no operator is blocked — but the Phase 14 mark was explicitly rejected, so it does not stay.

**Acceptance Criteria**:

1. WHEN the icon is authored THEN it SHALL be a **triquetra (Trinity knot) whose three lobes terminate in filled noteheads**, on the existing purple-on-dark-rounded-square palette (D-64 continuity)
2. WHEN the mark is rendered at 32×32 THEN the knot and the noteheads SHALL both remain distinguishable
3. WHEN the source changes THEN it SHALL be one committed `src-tauri/icons/icon.svg`, with every raster asset generated from it via `npx tauri icon`
4. WHEN the asset set is regenerated THEN `public/icons/` and both favicon surfaces SHALL be synced to match
5. WHEN the icon is drawn THEN it SHALL introduce no denomination-specific imagery beyond the Trinity knot itself

**Independent Test**: Build and install; taskbar, Start menu, window chrome and both browser tabs show the new mark, legible at the smallest size.

---

### 15E — Free-text lyrics editor

#### P1: A song is one title and one lyrics box ⭐ MVP

**User Story**: As an operator, I want to register a song by pasting the whole lyric into one box, so that adding a song takes seconds instead of a card-by-card build-up.

**Why P1**: This is the core request and the largest ongoing time cost in the app.

**Acceptance Criteria**:

1. WHEN the song editor opens THEN it SHALL present a single large lyrics textarea in place of the section-card list, sized so several strophes are visible without scrolling
2. WHEN the operator types a blank line THEN it SHALL separate one strophe from the next; a single newline SHALL stay a line break inside the same strophe
3. WHEN the song is saved THEN one section SHALL be derived per blank-line-separated block, in order, with an empty label, type `verse` and repeat count 1
4. WHEN a saved song is reopened THEN its section bodies SHALL be joined back with blank-line separators, reproducing the text exactly as it was typed (round-trip stable)
5. WHEN the song has no lyrics text THEN save SHALL be blocked with the existing body-required validation message
6. WHEN the operator types THEN the right-hand preview pane SHALL update per strophe as today
7. WHEN the editor renders THEN the "Colar letra completa" button and its paste dialog SHALL be gone — the editor *is* that box
8. WHEN the editor renders THEN the per-section label field, type dropdown, repeat counter, notes toggle, drag handle and add/remove-section buttons SHALL be gone
9. WHEN blocks are separated by two or more blank lines THEN they SHALL still resolve to exactly one boundary, with no empty sections written
10. WHEN a strophe has no derived label THEN the operator-side strophe card badge SHALL fall back to its ordinal number, as it already does for unlabelled slides

**Independent Test**: Create a song by pasting a four-strophe lyric, save, reopen — the text is byte-identical to what was pasted, and the strophes grid shows four cards.

#### P1: The live editor is the same box ⭐ MVP

**User Story**: As an operator, I want the mid-presentation editor to behave exactly like the library editor, so that there is only one thing to learn under pressure.

**Why P1**: The user explicitly asked for parity, and `LiveSongEditModal` already mounts the unmodified `SongEditor` — parity is preserved by not breaking it.

**Acceptance Criteria**:

1. WHEN the live-edit modal opens THEN it SHALL show the same single lyrics textarea, with no section controls
2. WHEN a live edit is saved THEN the derived sections SHALL be persisted and the outputs refreshed exactly as in 15A
3. WHEN the modal is used THEN it SHALL continue to mount `SongEditor` unmodified, so the two editors cannot drift apart

**Independent Test**: Open the live editor mid-service; it is visually and behaviourally identical to the library editor.

#### P2: Notes move to the song

**User Story**: As an operator, I want one notes box for the whole song, shown to me during presentation, so that I keep the cue I need without per-strophe bookkeeping.

**Why P2**: Depends on the editor refactor; the panel currently shows nothing for songs once section notes are gone, which is a regression that must be closed in the same release.

**Acceptance Criteria**:

1. WHEN the editor renders THEN the song-level notes textarea SHALL remain, with a taller default height than today's two rows
2. WHEN a song item is live and the song has notes THEN the operator Notes panel SHALL show the song-level notes
3. WHEN a song item is live and the song has no notes THEN the Notes panel SHALL stay hidden, as it does today
4. WHEN a non-song item is live THEN the Notes panel SHALL keep showing that item's own notes, unchanged
5. WHEN a legacy song carries per-section notes THEN they SHALL NOT be shown; the song-level notes are the only source

**Independent Test**: Add notes to a song, present it — the Notes panel shows them on every strophe of that song.

#### P2: Repeat count retires from the UI

**User Story**: As an operator, I want the repeat machinery out of my way, so that the editor has nothing in it that is not lyrics.

**Why P2**: Cleanup that follows from the editor refactor.

**Acceptance Criteria**:

1. WHEN a song is saved from the new editor THEN every derived section SHALL be written with `repeat_count = 1`
2. WHEN Settings renders the Projeção tab THEN the global "Repetições" control SHALL be gone
3. WHEN a legacy song with `repeat_count > 1` is loaded — including one restored from an older `.tlz` backup — THEN slide generation SHALL still honour it using the default `Duplicate` mode, so no existing set silently changes length
4. WHEN the schema is inspected THEN `song_sections.repeat_count` SHALL still exist, defaulting to 1

> **Stated assumption (flagged).** "Drop it" is implemented as *drop it from the UI and from everything newly written*, not as a schema migration — matching the GA-1 decision to leave the schema alone. Removing the column and the `RepeatMode` enum outright would break `.tlz` restore of pre-1.2.0 backups and touch 17 files for no operator-visible gain. If you want the harder removal, say so and it moves into scope.

#### P2: Slide anchoring survives an edit

**User Story**: As an operator, I want my position to hold on the strophe I was actually on, even when the edit adds or removes a strophe above it.

**Why P2**: Found during analysis (F-1), not reported. It makes the Phase 14 anchor design work as documented instead of degrading to index clamping.

**Acceptance Criteria**:

1. WHEN slide position is re-anchored after a regeneration THEN the anchor SHALL match on **slide content**, not on section id, so a strophe that was not itself edited keeps its position when strophes are inserted or removed above it

   > **Amended at design time (DD-1, 2026-08-11).** This AC originally required deterministic `{song_id}-s{N}` section ids. Design analysis showed that basis is not merely insufficient but actively wrong: inserting a strophe shifts every later strophe's id down by one, so the anchor's exact-match branch resolves to the *wrong* strophe instead of failing safe to the clamp. Content matching holds the correct strophe on insert and delete, degrades to today's clamp when the current slide's own text was edited, and needs no DB, id-generation or `archive.rs` change. See `design.md` § Tech Decisions DD-1.
2. WHEN a strophe is inserted above the current position THEN the projected slide SHALL remain the same strophe, not shift by the number of inserted slides
3. WHEN the current strophe is deleted THEN position SHALL fall back through the existing chain and SHALL NOT blank the projector
4. WHEN blank or frozen mode is engaged THEN it SHALL survive the regeneration, as it does today

**Independent Test**: Present a song, navigate to strophe 4, live-edit to insert a new strophe 2, save — the projector still shows the strophe that was 4 (now 5).

---

### 15F — Release

#### P1: Ships as its own tag ⭐ MVP

**Acceptance Criteria**:

1. WHEN the phase is complete THEN `scripts/bump-version.mjs` SHALL write `1.2.0` to all five version sources
2. WHEN the tag `v1.2.0` is pushed THEN the `verify-version` CI job SHALL pass and a signed draft release SHALL be produced (P13-06..P13-09)

---

## Edge Cases

- WHEN the lyrics box holds leading/trailing blank lines THEN they SHALL be trimmed and SHALL NOT produce empty sections
- WHEN the lyrics box holds lines that are whitespace-only THEN they SHALL be treated as blank for boundary purposes
- WHEN a legacy song's sections were reordered by drag before this release THEN reopening SHALL join them in their stored `sort_order`, which is what the operator last saw
- WHEN a legacy song has a section whose body itself contains blank lines THEN reopening and re-saving SHALL split it into separate sections — a one-time, visible-in-preview normalisation, not silent data loss
- WHEN a live edit deletes every strophe THEN save SHALL be blocked by validation, so an output can never be left with an empty slide list
- WHEN the edited song is loaded in **both** outputs THEN both SHALL refresh, mirror included
- WHEN a monitor is unplugged while Settings is open THEN the stored name SHALL be preserved for its identity and reappear on replug
- WHEN `listMonitors` fails THEN name resolution SHALL degrade to the numbered labels rather than throwing
- WHEN the icon SVG fails to regenerate rasters THEN the build SHALL fail loudly rather than shipping a mixed asset set

---

## Requirement Traceability

| ID | Requirement | Story | Priority | Task(s) | Status |
|----|-------------|-------|----------|---------|--------|
| P15-01 | `refresh_song_in_outputs` emits the regenerated `all_slides_per_item` for the affected output | 15A | P1 | T1 | Implemented |
| P15-02 | Stored in-memory `PresentationState` keeps `all_slides_per_item` empty; only the emitted payload carries slides | 15A | P1 | T1 | Implemented |
| P15-03 | Strophes grid reflects add / remove / reorder / re-word after a live save, active highlight preserved, every occurrence refreshed | 15A | P1 | T2 | Implemented |
| P15-04 | Monitor names + monitor list live in shared store state, loaded once at operator boot | 15B | P1 | T4, T6 | Implemented |
| P15-05 | Saving a name updates every consumer immediately, no restart (picker, switcher, launch modal, audio blocks, settings list) | 15B | P1 | T5, T6, T7, T8, T9, T10 | Implemented |
| P15-06 | Cleared name falls back OS name → `Monitor N — W×H` immediately; malformed row → empty map, no throw | 15B | P1 | T4, T5, T7 | Implemented |
| P15-07 | Audio/mic blocks show the resolved monitor name beside `Tela N`, falling back to the plain label when unassigned | 15B | P2 | T11 | Implemented |
| P15-08 | Aviso font-size control uses an announcement-scoped label in both locales; Projeção keeps the song wording | 15C | P1 | T12 | Implemented |
| P15-09 | `icon.svg` — triquetra with noteheads at the three lobes, existing palette, legible at 32×32 | 15D | P2 | T16 | Implemented |
| P15-10 | Full raster set regenerated via `npx tauri icon`; `public/icons/` + both favicons synced | 15D | P2 | T16 | Implemented |
| P15-11 | Song editor presents one large lyrics textarea; section-card list removed | 15E | P1 | T14 | Implemented |
| P15-12 | Blank line separates strophes; single newline stays a line break | 15E | P1 | T13 | Implemented |
| P15-13 | Save derives one section per block — empty label, type `verse`, repeat 1, in order, no empty sections | 15E | P1 | T13, T14 | Implemented |
| P15-14 | Reopen joins section bodies with blank lines; round-trip is exact | 15E | P1 | T13, T14 | Implemented |
| P15-15 | "Colar letra completa" button + paste dialog removed; label / type / repeat / notes / drag / add / remove controls removed | 15E | P1 | T14 | Implemented |
| P15-16 | Preview pane updates per strophe as typed; strophe badges fall back to ordinals for unlabelled sections | 15E | P1 | T14 | Implemented |
| P15-17 | Live-edit modal shows the identical editor and still mounts `SongEditor` unmodified | 15E | P1 | T14 (by not modifying the modal) | Implemented |
| P15-18 | Repeat control + global "Repetições" setting removed from the UI; new sections written with `repeat_count = 1`; legacy values still honoured | 15E | P2 | T12, T13, T14 (AC-3 already pinned by `slide_splitter.rs:145`) | Implemented |
| P15-19 | Slide anchor matches on slide content, not section id, so anchoring holds across saves (F-1; amended by DD-1) | 15E | P2 | T3 | Implemented |
| P15-20 | Song-level notes textarea kept and given a taller default; operator Notes panel repointed to song-level notes for songs | 15E | P2 | T14, T15 | Implemented |
| P15-21 | Non-song items keep their own notes in the panel, unchanged | 15E | P2 | T15 | Implemented |
| P15-22 | Version bumped to `1.2.0` across all five sources; `v1.2.0` tag produces a signed draft release | 15F | P1 | T17 (+ manual tag push) | Implemented |

**ID format:** `P15-NN`
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 22 total, **22 mapped to tasks, 0 unmapped, all 22 Implemented** ✅ — see `tasks.md` (18 tasks, all complete 2026-08-11)

---

## User Decisions (gray areas resolved 2026-08-11)

| # | Gray area | Decision | Consequence |
|---|-----------|----------|-------------|
| GA-1 | How deep does "sections no longer exist" go? | **UI-only, derived sections.** `song_sections` stays as internal derived storage; one section per blank-line block written on save | No migration, no `.tlz` break, FTS index intact, per-strophe anchoring intact, both import wizards untouched |
| GA-2 | What does the operator Notes panel show once section notes are gone? | **Repoint to song-level notes** | Song-level notes textarea stays and grows; panel keeps working for songs |
| GA-3 | Keep repeat count? | **Drop it** | Removed from editor and Settings; schema column retained at 1 (see the flagged assumption under P15-18) |
| GA-4 | Logo direction | **Triquetra with noteheads at the three lobes**, existing purple-on-dark-rounded-square palette | Brand palette continuity with D-64; the Phase 14 L-mark is retired |

---

## Success Criteria

- [ ] A typo is fixed mid-service and every operator surface — projector, LIVE preview, strophes grid — agrees within one save, with no black frame and no lost position
- [ ] A monitor rename is visible in all five naming surfaces without restarting the app
- [ ] Zero settings controls remain that name something other than what they change
- [ ] A four-strophe song is registered by paste-and-save, and reopening reproduces the pasted text exactly
- [ ] The live editor and the library editor are the same component with the same behaviour
- [ ] `v1.2.0` builds a signed draft release from a tag push with no manual signing step
- [ ] Gate green: `tsc --noEmit` clean, `cargo clippy -D warnings` clean, locale parity test green, and no net loss of Vitest (baseline 546) or Rust (baseline 327) tests
