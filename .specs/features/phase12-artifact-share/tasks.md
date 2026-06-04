# Phase 12: Artifact Share — Tasks

**Design**: `.specs/features/phase12-artifact-share/design.md`
**Spec**: `.specs/features/phase12-artifact-share/spec.md`
**Status**: Draft

8 tasks across 4 layers. The backend is mostly sequential (shared files: `archive.rs`, then the new `artifact.rs`); the only genuine parallelism is the two frontend leaf components (T6, T7).

---

## Execution Plan

### Phase 1 — Shared serialization core (Sequential)
```
T1
```

### Phase 2 — Selective service (Sequential, same new file)
```
T1 → T2 → T3
```

### Phase 3 — Command layer (Sequential)
```
T3 → T4
```

### Phase 4 — Frontend (T5 first, then T6/T7 parallel, then T8)
```
T4 → T5 ──┬→ T6 [P] ──→ T8
          └→ T7 [P]
```

---

## Task Breakdown

### T1: Refactor `archive.rs` into a shared, field-complete, kind-aware core

**What**: Add the `ArchiveKind` discriminator + manifest `kind` field (serde default `Library`), bump `SUPPORTED_SCHEMA_VERSION` 1→2, fix the song serializer to include the migration 007/008 columns, and promote the ZIP/JSON helpers to `pub(crate)` so the new service can reuse them. Generalize `write_zip` → `write_tlz(kind)`.
**Where**: `src-tauri/src/services/archive.rs` (modify)
**Depends on**: None
**Reuses**: existing `write_zip`, `gather_json_dump`, `do_import`, `parse_json_array`/`str_val`/`int_val`
**Requirement**: SHARE-02, SHARE-09 (default kind), SHARE-14 (schema guard), Concern C-1/C-2/C-3

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `ArchiveKind { Library(default), Songs, Set, Settings }` enum added; `ArchiveManifest.kind` field with `#[serde(default)]`
- [ ] `SUPPORTED_SCHEMA_VERSION = 2`; `inspect_archive` still accepts `<= 2`; v1 archives (no `kind`) deserialize as `Library`
- [ ] Single `SONG_JSON_OBJECT` SQL fragment includes `background_mode`, `background_preset`, `font_family`, `font_size`, and the migration 008 text-casing column; used by full-library export AND import binds
- [ ] `parse_json_array`, `str_val`, `int_val`, `read_zip_entry_str`, `read_archive_data`, `now_ms` are `pub(crate)`
- [ ] `write_tlz(out, media_dir, dump, kind, on_progress)` exists; existing full-library `export` calls it with `kind = Library`
- [ ] New unit test: a song with all 007/008 fields set survives export→import round-trip (proves C-1 fixed)
- [ ] New unit test: a v1-style manifest JSON (no `kind`) deserializes with `kind == Library`
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: existing 4 archive tests + 2 new = 6 pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml archive` shows the round-trip + default-kind tests green.

**Commit**: `refactor(archive): kind-aware, field-complete shared serialization core`

---

### T2: Selective export (`artifact.rs`) — songs, set, settings + dependency collection

**What**: New service module exporting scoped `.tlz` artifacts with transitive dependency bundling and de-dup.
**Where**: `src-tauri/src/services/artifact.rs` (new) + `services/mod.rs` (register)
**Depends on**: T1
**Reuses**: T1's `write_tlz`, `SONG_JSON_OBJECT`, `JsonDump`; `new_id()`
**Requirement**: SHARE-01, SHARE-03, SHARE-04, SHARE-05, SHARE-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `export_songs(pool, media_dir, ids, out, on_progress)` writes `kind=Songs`, includes each song + its sections (all 007/008 fields) + each media-backed background row & binary
- [ ] `export_set(pool, media_dir, set_id, out, on_progress)` writes `kind=Set`, transitively includes referenced songs+sections, set_items, and media rows+binaries; media de-duplicated by id
- [ ] Soft-deleted referenced rows are included; dangling `set_items.song_id` is skipped and reported in the summary
- [ ] `export_settings(pool, out)` writes `kind=Settings` with all `settings` rows (incl. `key_bindings`)
- [ ] Unit tests: songs round-trip incl. bg media; set bundles all deps + de-dups shared media; settings-only archive; dangling-ref skip
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: ≥4 new tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml artifact` green; inspect a produced archive’s `manifest.kind`.

**Commit**: `feat(artifact): selective export of songs, sets, settings with bundled deps`

---

### T3: Selective import (`artifact.rs`) — plan + apply with conflict resolution & re-id

**What**: Read-only `plan_import` (conflict detection) and transactional `apply_import` honoring skip/overwrite/copy with FK-consistent re-id remapping; never wipes.
**Where**: `src-tauri/src/services/artifact.rs` (modify)
**Depends on**: T2
**Reuses**: T1 `read_archive_data`/`parse_json_array`/binds; `normalize()` rule (extract from `import.rs` to shared util); `new_id()`
**Requirement**: SHARE-07, SHARE-08, SHARE-10, SHARE-11, SHARE-15

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `plan_import(pool, path) -> ImportPlan` performs NO writes; flags conflicts by id match and (songs) normalized title+artist; defaults same-title-new-id to `copy`
- [ ] `apply_import(pool, media_dir, path, resolutions)` runs all DB row writes in a single transaction (rollback on error — SHARE-10); media files written only after commit
- [ ] `skip` leaves existing untouched; `overwrite` replaces row + children (sections/set_items) + rebuilds FTS; `copy` mints fresh ids for the artifact and ALL children, remapping `song_sections.song_id`, `songs.background_id`, `set_items.{set_id,song_id,media_id}` consistently (SHARE-11)
- [ ] `copy` media gets a new UUID file name; binary written under it (SHARE-15)
- [ ] No code path performs a wipe/Replace on the selective import (SHARE-08); `schemaVersion > 2` and unknown `kind` are refused (SHARE-14)
- [ ] Unit tests: clean import; skip/overwrite/copy each verified; re-id integrity (copied set internally coherent); rollback-on-failure leaves DB unchanged; unrelated-rows count unchanged after import
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: ≥6 new tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml artifact` green incl. the three-resolution and rollback tests.

**Commit**: `feat(artifact): two-phase import with per-conflict resolution and re-id remap`

---

### T4: Tauri command layer + registration

**What**: Thin command wrappers around the service (with `backup_progress` forwarder), registered in `lib.rs` and `commands/mod.rs`.
**Where**: `src-tauri/src/commands/artifact.rs` (new), `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`
**Depends on**: T3
**Reuses**: `backup.rs::media_dir`, the `tokio::mpsc` progress-forward pattern (`backup.rs:37-52`), `ErrorPayload`
**Requirement**: SHARE-01..11 (IPC surface), SHARE-13

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `export_songs`, `export_set`, `export_settings_profile`, `plan_artifact_import`, `import_artifact` commands defined returning `ExportSummary`/`ImportPlan`/`ImportSummary`
- [ ] All five registered in `lib.rs` `invoke_handler![]` and module wired in `mod.rs`
- [ ] Export commands forward `backup_progress` events like `export_library`
- [ ] Gate check passes (compile + full suite): `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`
- [ ] Test count: full Rust suite still green (no regressions)

**Tests**: none (command layer — tested via service unit tests per coverage matrix)
**Gate**: build

**Verify**: `cargo build --manifest-path src-tauri/Cargo.toml` succeeds; commands appear in `invoke_handler!`.

**Commit**: `feat(artifact): register export/import Tauri commands`

---

### T5: Frontend API wrappers + types

**What**: Add `ArchiveKind`/`ImportPlan`/`ImportPlanItem`/`Resolution` types and the five `invoke` wrappers to the single IPC entry file.
**Where**: `src/api/commands.ts` (modify)
**Depends on**: T4
**Reuses**: existing `invoke<…>` wrapper style, `ExportSummary`/`ImportSummary`/`ExportProgress` types, `onBackupProgress`
**Requirement**: SHARE-12/13 (enablement)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Types `ArchiveKind`, `ConflictKind`, `ResolutionAction`, `ImportPlanItem`, `ImportPlan`, `Resolution` exported
- [ ] Wrappers `exportSongs`, `exportSet`, `exportSettingsProfile`, `planArtifactImport`, `importArtifact` added (no raw `invoke` outside this file — IPC invariant)
- [ ] Gate check passes: `npx tsc --noEmit && npx vitest run`
- [ ] Test count: frontend suite still green (no regressions)

**Tests**: none (thin wrappers — coverage matrix says none)
**Gate**: build

**Verify**: `npx tsc --noEmit` clean.

**Commit**: `feat(artifact): frontend IPC wrappers for selective export/import`

---

### T6: `ImportReviewModal` component [P]

**What**: Modal that renders an `ImportPlan`, lets the operator set per-conflict resolution (skip/overwrite/copy with sensible defaults), and confirms.
**Where**: `src/components/backup/ImportReviewModal.tsx` (new) + i18n keys in `pt-BR.json`/`en-US.json`
**Depends on**: T5
**Reuses**: existing modal/toast primitives; `BackupScreen` styling; i18n pattern
**Requirement**: SHARE-07, SHARE-13

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Renders `kind`, per-type counts, and a row per item with conflict badge + resolution selector
- [ ] Default resolution: `copy` for same-title/new-id, `skip` preselected for exact-id matches (operator can change); no-conflict items need no choice
- [ ] `onConfirm` emits `Resolution[]`; `onCancel` closes with no side effects
- [ ] pt-BR + en-US strings added (no hardcoded copy)
- [ ] Component test: renders a mixed plan, toggles a resolution, asserts emitted `Resolution[]`
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: ≥1 new component test passes

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run ImportReviewModal` green.

**Commit**: `feat(artifact): import review modal with per-conflict resolution`

---

### T7: Export entry points (library multi-select + set editor) [P]

**What**: Add "Export selected" to the library multi-select surface and "Export set" to the set editor, both opening a `.tlz` save dialog and calling the wrappers with a progress/summary toast.
**Where**: library list component + set editor component (modify) + i18n keys
**Depends on**: T5
**Reuses**: `save` dialog pattern (`BackupScreen.tsx:32`), `onBackupProgress`, existing selection state, toast
**Requirement**: SHARE-12, SHARE-13

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Library: with ≥1 song selected, an Export action saves a `.tlz` via `exportSongs`; disabled at zero selection
- [ ] Set editor: an Export action saves a `.tlz` via `exportSet`
- [ ] Progress shown during write; final summary toast with counts; cancel = silent no-op
- [ ] pt-BR + en-US strings added
- [ ] Component test: clicking export with a selection calls the wrapper with the selected ids (dialog mocked, per `HolyricsImport.test.tsx` pattern)
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: ≥1 new component test passes

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run` green; manual: export from both surfaces produces a `.tlz`.

**Commit**: `feat(artifact): library + set export entry points`

---

### T8: Import wiring in `BackupScreen` (plan → review → apply)

**What**: Add an "Import artifact" flow: open `.tlz`, call `planArtifactImport`, route `kind=library` to the existing `restoreLibrary` flow (SHARE-09), otherwise show `ImportReviewModal`, then `importArtifact` with resolutions; progress + summary toast.
**Where**: `src/components/backup/BackupScreen.tsx` (modify) + i18n keys
**Depends on**: T6
**Reuses**: `ImportReviewModal` (T6), `open` dialog (`BackupScreen.tsx:132`), `onBackupProgress`, existing restore path
**Requirement**: SHARE-07, SHARE-09, SHARE-12, SHARE-13

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] "Import artifact" button opens a `.tlz` picker and calls `planArtifactImport`
- [ ] When the plan's `kind == "library"`, the existing restore-library flow is used (selective importer NOT invoked — SHARE-09)
- [ ] Otherwise `ImportReviewModal` opens; confirming calls `importArtifact(path, resolutions)`; progress + summary toast shown
- [ ] pt-BR + en-US strings added
- [ ] Component test: a non-library plan opens the modal; a library plan routes to restore (both mocked)
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: ≥1 new component test passes

**Tests**: component
**Gate**: quick

**Verify**: end-to-end manual round trip (export from T7 → import here → resolve) works without devtools.

**Commit**: `feat(artifact): import flow with kind routing and conflict review`

---

## Parallel Execution Map

```
Phase 1:  T1
Phase 2:  T1 → T2 → T3            (same files: archive.rs then artifact.rs — sequential)
Phase 3:  T3 → T4                 (commands + lib.rs wiring)
Phase 4:  T4 → T5 ──┬→ T6 [P] ──→ T8
                    └→ T7 [P]
```

`[P]` constraint check: T6 (new `ImportReviewModal.tsx`) and T7 (library/set components) touch disjoint files, both depend only on T5, and component tests are Parallel-Safe (TESTING.md). ✅

---

## Pre-Approval Validation

### Check 1 — Task Granularity

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 file (archive.rs cohesive refactor) | ✅ Granular |
| T2 | 1 file (artifact.rs export) | ✅ Granular |
| T3 | 1 file (artifact.rs import) | ✅ Granular |
| T4 | command file + 2 wiring edits (cohesive registration) | ✅ Granular |
| T5 | 1 file (commands.ts) | ✅ Granular |
| T6 | 1 component | ✅ Granular |
| T7 | 2 export entry points (cohesive: same feature) | ✅ Granular |
| T8 | 1 component (BackupScreen wiring) | ✅ Granular |

### Check 2 — Diagram ↔ Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | (root) | ✅ Match |
| T2 | T1 | T1→T2 | ✅ Match |
| T3 | T2 | T2→T3 | ✅ Match |
| T4 | T3 | T3→T4 | ✅ Match |
| T5 | T4 | T4→T5 | ✅ Match |
| T6 | T5 | T5→T6 | ✅ Match |
| T7 | T5 | T5→T7 | ✅ Match |
| T8 | T6 | T6→T8 | ✅ Match |

T6 and T7 share no dependency on each other → `[P]` valid. ✅

### Check 3 — Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | `services/archive.rs` | unit | unit | ✅ OK |
| T2 | `services/artifact.rs` | unit | unit | ✅ OK |
| T3 | `services/artifact.rs` | unit | unit | ✅ OK |
| T4 | `commands/*.rs` + `lib.rs` | none | none | ✅ OK |
| T5 | `api/commands.ts` | none | none | ✅ OK |
| T6 | `components/**/*.tsx` | component | component | ✅ OK |
| T7 | `components/**/*.tsx` | component | component | ✅ OK |
| T8 | `components/**/*.tsx` | component | component | ✅ OK |

All three checks pass — no ❌.

---

## Requirement Coverage

| Requirement | Task(s) |
| ----------- | ------- |
| SHARE-01 | T2, T4, T7 |
| SHARE-02 | T1 |
| SHARE-03 | T2 |
| SHARE-04 | T2, T7 |
| SHARE-05 | T2 |
| SHARE-06 | T2, T4 |
| SHARE-07 | T3, T6, T8 |
| SHARE-08 | T3 |
| SHARE-09 | T1, T8 |
| SHARE-10 | T3 |
| SHARE-11 | T3 |
| SHARE-12 | T7, T8 |
| SHARE-13 | T4, T6, T7, T8 |
| SHARE-14 | T1, T3 |
| SHARE-15 | T3 |

**Coverage:** 15/15 requirements mapped to tasks. 0 unmapped. ✅
