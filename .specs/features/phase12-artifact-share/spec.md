# Phase 12: Artifact Share — Selective Export / Import of Songs, Sets & Settings — Specification

## Problem Statement

Lyrizzy can back up and restore the **entire** library as a `.tlz` archive (`archive.rs` / `backup.rs`), and it can import foreign **Holyrics** JSON (`import.rs`). What it cannot do is move *individual* native artifacts between installs: a worship leader who builds a song or assembles a Sunday set on one machine has no way to hand just that song or set to another operator without shipping (and overwriting) the whole library. The result is ad-hoc workarounds — full-library merges that drag along unwanted data, or manual re-typing of songs. We need a first-class "share my own artifacts" path: pick a song / set / settings profile, export a self-contained file, and import it elsewhere with clear control over conflicts.

## Goals

- [ ] Operator can select one or more **songs** and export them to a single portable `.tlz` file that re-imports losslessly on another install (all section, slide-config, background-preset and typography fields preserved).
- [ ] Operator can export a **set** as a fully self-contained file that bundles every referenced song and media binary, so it opens correctly on a machine that has never seen those items.
- [ ] Operator can export a **settings/theme profile** (app settings, key bindings, background presets) and apply it on another install.
- [ ] On import, every collision with an existing artifact is surfaced to the operator, who resolves each as **skip / overwrite / import-as-copy** before anything is written.
- [ ] The new export path produces files that are distinguishable from full-library backups and never silently restore-wipe the target library.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Replacing or removing the existing full-library `.tlz` backup/restore | This feature is *additive* — selective sharing sits alongside the whole-library backup, which stays the disaster-recovery path. |
| Standalone media-item export as a primary unit | User decision: media is shared only as a **dependency** bundled inside a song or set, not as its own export command. |
| New on-disk extensions (`.tlsong` / `.tlset`) or OS file-association changes | User decision: reuse the existing `.tlz` ZIP container with a scoped manifest `kind`; one format, one handler. |
| Cloud / network sharing, links, or a sharing marketplace | Out of scope — export/import is local file in, local file out. |
| Foreign-format export (Holyrics, PowerPoint, ProPresenter, CCLI CSV) | Covered by existing/other features (`import.rs`, Phase 5 PPTX, P3-14 CCLI CSV). This feature is *native* artifacts only. |
| Auto-merge / no-prompt conflict modes | User decision: conflicts are always resolved interactively (see SHARE-07). A future "apply to all" convenience may ride on top but is not required for MVP. |

---

## User Stories

### P1: Export selected songs ⭐ MVP

**User Story**: As an operator, I want to select one or more songs in the library and export them to a single file, so that I can share exactly those songs with another operator without touching the rest of my library.

**Why P1**: The song is the atomic sharing unit and the simplest self-contained case (a song bundles only its own background media, if any). Establishes the scoped-`.tlz` format and the export plumbing every other story reuses.

**Acceptance Criteria**:

1. WHEN the operator selects ≥1 song and triggers **Export** THEN the system SHALL write a `.tlz` file whose manifest declares `kind: "songs"` and lists every selected song id.
2. WHEN a song is exported THEN the file SHALL include the song row, all its `song_sections`, AND every column added by migrations 007/008 (`background_mode`, `background_preset`, `font_family`, `font_size`, text-casing) so the artifact is field-complete (see Concern C-1).
3. WHEN an exported song references a media-backed background (`background_id`) THEN the system SHALL bundle that media row AND its binary file inside the archive.
4. WHEN the export completes THEN the system SHALL report a summary (songs count, media count, byte size, output path).
5. WHEN the operator cancels the file-save dialog THEN the system SHALL abort with no file written and no error toast.

**Independent Test**: Select two songs (one with a media background, one preset-only), export, unzip the result, and confirm the manifest `kind`, both song rows with all 007/008 columns, their sections, and the one media binary are present.

---

### P2: Export a set self-contained

**User Story**: As an operator, I want to export a set so that the file carries every song, media item, countdown, web and PPTX/PDF item it references, so the recipient can run the service without missing dependencies.

**Why P2**: Sets are the highest-value sharing unit (a whole service) but depend on P1's song/media bundling. Builds on the same format with transitive dependency collection.

**Acceptance Criteria**:

1. WHEN the operator exports a set THEN the manifest SHALL declare `kind: "set"` and the archive SHALL contain the `sets` row, all its `set_items`, and every referenced `songs` + `song_sections` + `media` row.
2. WHEN a set item references a media file (image/video/audio/PPTX-derived) THEN the system SHALL bundle that media binary in the archive.
3. WHEN a set item is a song that also has a media background THEN the system SHALL bundle that background media exactly once even if multiple items share it (de-duplicated by media id).
4. WHEN a referenced song or media row is soft-deleted (`deleted_at` set) THEN the system SHALL still include it so the set re-imports intact.
5. WHEN the export completes THEN the summary SHALL itemize counts per artifact type (songs, media, set items).

**Independent Test**: Build a set with a song-with-media-background, an image item, and a web item; export; on a clean install import it and confirm every item plays/renders with its correct background.

---

### P3: Export & apply a settings/theme profile

**User Story**: As an operator, I want to export my settings, key bindings, and background presets as a profile, so that I can replicate my preferred configuration on another machine.

**Why P3**: Valuable for multi-machine consistency but lower frequency than songs/sets, and settings carry no binary/dependency complexity.

**Acceptance Criteria**:

1. WHEN the operator exports a settings profile THEN the manifest SHALL declare `kind: "settings"` and the archive SHALL contain the `settings` rows (including the `key_bindings` JSON row per D-19).
2. WHEN a settings profile is imported THEN the system SHALL apply only `settings` rows and SHALL NOT touch songs, sets, or media.
3. WHEN a settings profile import overwrites the active configuration THEN the system SHALL emit the relevant change events (e.g. `state_changed` / settings reload) so both windows reflect the new config without a restart.

**Independent Test**: Change theme + a key binding, export profile, import on another install, confirm theme and binding match.

---

### P1: Import an artifact file with per-conflict resolution ⭐ MVP

**User Story**: As an operator, I want to open a shared artifact file, see exactly what it contains and what already exists, and decide per item whether to skip, overwrite, or import as a copy, so that importing never destroys or silently duplicates my work.

**Why P1**: Import is the other half of the MVP — an export no one can safely receive is useless. The conflict-resolution UX is the core safety requirement the user explicitly chose.

**Acceptance Criteria**:

1. WHEN the operator selects an artifact `.tlz` THEN the system SHALL inspect its manifest and present a pre-import review: `kind`, per-type counts, and which incoming artifacts collide with existing ones.
2. WHEN an incoming artifact's id matches an existing row OR (for songs) its normalized title+artist matches an existing song THEN the system SHALL flag it as a conflict (see Edge Cases for the precise rule).
3. WHEN the operator resolves a conflict as **skip** THEN the system SHALL leave the existing artifact untouched and not import the incoming one.
4. WHEN the operator resolves a conflict as **overwrite** THEN the system SHALL replace the existing artifact (and its children: sections / set items) with the incoming version.
5. WHEN the operator resolves a conflict as **import-as-copy** THEN the system SHALL assign fresh ids to the incoming artifact and all its children/dependency references, inserting it as a new item that leaves the existing one intact.
6. WHEN there are no conflicts THEN the system SHALL allow a one-click confirm that imports everything as-new.
7. WHEN the import runs THEN it SHALL be all-or-nothing per the operator's confirmed plan (a mid-import failure SHALL NOT leave a half-applied state — DB work in a transaction; media files reconciled after commit).
8. WHEN the import is a selective artifact (`kind` ≠ `library`) THEN the system SHALL NEVER wipe the target library or media directory (no Replace semantics on this path).
9. WHEN the file is a legacy full-library archive (`kind` absent → treated as `library`) THEN the system SHALL route it to the existing backup-restore flow, not the selective importer.

**Independent Test**: Import a song file twice — first into a clean library (imports clean), then into the same library and exercise all three resolutions (skip leaves one copy, overwrite updates in place, copy yields two).

---

### P2: Discover export/import from the UI

**User Story**: As an operator, I want obvious entry points to export selected songs, export a set, and import a file, so that I don't have to learn a hidden workflow.

**Why P2**: The commands are worthless if undiscoverable, but the exact placement depends on existing UI surfaces; functionally gated behind P1 commands existing.

**Acceptance Criteria**:

1. WHEN the operator multi-selects songs in the library THEN an **Export** action SHALL be available (context menu and/or toolbar).
2. WHEN the operator views/edits a set THEN an **Export set** action SHALL be available.
3. WHEN the operator chooses **Import** THEN a file picker SHALL accept `.tlz` files and route to the pre-import review (P1).
4. WHEN export/import is in progress THEN the UI SHALL show progress (reusing the existing `backup_progress` event pattern) and a final summary toast.

**Independent Test**: Drive the whole round trip (export → import → resolve) entirely from the UI with no devtools.

---

## Edge Cases

- WHEN an incoming song's id is new BUT its normalized title+artist matches an existing song THEN the system SHALL flag a "possible duplicate" conflict (reusing the `normalize()` rule from `import.rs`) and default the resolution to **import-as-copy**, never silent skip.
- WHEN an incoming media binary's `file_name` already exists in the media dir but the media row id is new THEN the system SHALL store the incoming binary under a fresh unique file name and point the new row at it (avoid clobbering an unrelated file).
- WHEN the archive's `schemaVersion` is newer than `SUPPORTED_SCHEMA_VERSION` THEN the system SHALL refuse import with the existing "update Lyrizzy" message (reuse `SchemaTooNew`).
- WHEN the archive's `kind` is unrecognized THEN the system SHALL refuse with a clear "unsupported artifact type" error rather than guessing.
- WHEN a set is exported but a referenced song was hard-deleted (dangling `set_items.song_id`) THEN export SHALL skip the dangling item and warn in the summary rather than failing.
- WHEN import-as-copy re-ids a set THEN all internal references (`set_items.set_id`, `set_items.song_id`, `set_items.media_id`, `songs.background_id`) SHALL be remapped consistently so the copy is internally coherent.
- WHEN a media binary is missing from the archive at import (corrupt/partial file) THEN the system SHALL import the row, count it as `media_failed`, and surface it in the summary (mirrors current `do_import` resilience).
- WHEN the operator selects zero songs and triggers export THEN the action SHALL be disabled / no-op (no empty archive).
- WHEN the same import file is applied and the operator picks **overwrite** on a song THEN the FTS index SHALL be rebuilt so search reflects the overwritten content.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SHARE-01 | P1: Export songs | Design | Pending |
| SHARE-02 | P1: Export songs (field-complete incl. 007/008) | Design | Pending |
| SHARE-03 | P1: Export songs (bundle background media) | Design | Pending |
| SHARE-04 | P2: Export set (transitive deps + binaries) | Design | Pending |
| SHARE-05 | P2: Export set (de-dup media, include soft-deleted) | Design | Pending |
| SHARE-06 | P3: Export/apply settings profile | Design | Pending |
| SHARE-07 | P1: Per-conflict resolution (skip/overwrite/copy) | Design | Pending |
| SHARE-08 | P1: Import never wipes library (no Replace on selective) | Design | Pending |
| SHARE-09 | P1: Legacy `library` archives route to existing restore | Design | Pending |
| SHARE-10 | P1: Atomic / all-or-nothing import per confirmed plan | Design | Pending |
| SHARE-11 | P1: Re-id remapping integrity on import-as-copy | Design | Pending |
| SHARE-12 | P2: UI entry points (song export, set export, import) | - | Pending |
| SHARE-13 | P2: Progress + summary UX (reuse `backup_progress`) | - | Pending |
| SHARE-14 | Edge: schema-too-new / unknown-kind refusal | Design | Pending |
| SHARE-15 | Edge: media file-name collision → fresh unique name | Design | Pending |

**ID format:** `SHARE-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 15 total, 0 mapped to tasks (Design phase not yet run) ⚠️

---

## Open Concerns (surfaced during Specify)

- **C-1 (existing bug, in-scope to fix here):** `archive.rs::gather_json_dump` selects songs WITHOUT the migration 007 columns (`background_mode`, `background_preset`, `font_family`, `font_size`) or migration 008 text-casing column. The current full-library backup therefore **drops** those fields on round-trip. Selective export MUST include them (SHARE-02), and the shared serialization path should fix the full-library export too. Confirm during Design whether to refactor a single shared song-serializer or duplicate.
- **C-2:** Manifest backward compatibility — existing `.tlz` files have no `kind` field. The deserializer must default a missing `kind` to `library` (SHARE-09) so old backups keep working.
- **C-3:** Bumping `SUPPORTED_SCHEMA_VERSION` (currently 1). Adding `kind` + new song columns may warrant v2; decide in Design whether to bump and how v1 importers behave (they reject v2 via existing `SchemaTooNew`, which is acceptable).

---

## Success Criteria

How we know the feature is successful:

- [ ] A song exported on machine A imports on machine B with byte-identical sections, slide config, background preset, typography, and media background.
- [ ] A set exported on machine A runs end-to-end on a clean machine B with zero missing dependencies.
- [ ] Importing any selective artifact never reduces the count of unrelated existing songs/sets/media (no accidental wipe).
- [ ] Every conflict presented to the operator is resolvable as skip / overwrite / copy, and the chosen resolution is what actually happens for each item.
- [ ] Legacy full-library `.tlz` backups still restore exactly as before.
