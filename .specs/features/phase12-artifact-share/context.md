# Phase 12: Artifact Share — Context (user decisions)

Captured during Specify on 2026-06-03. These resolve the gray areas before Design.

| # | Question | Decision | Rationale / impact |
| - | -------- | -------- | ------------------ |
| 1 | Which artifact types are in scope? | **Songs, Sets, Settings/themes** | Standalone media is *not* a primary export unit — it rides along bundled inside songs/sets (SHARE-03, SHARE-04). |
| 2 | On-disk packaging format? | **Reuse `.tlz` container with a scoped manifest `kind`** | One ZIP engine (`archive.rs`), one handler. No new extensions or OS file associations. Drives SHARE-01/09 and Concern C-2. |
| 3 | Import conflict behavior? | **Ask per conflict: skip / overwrite / import-as-copy** | Explicit pre-import review UI; never silent skip or silent overwrite. Drives SHARE-07 and the re-id integrity requirement SHARE-11. |
| 4 | Dependency handling on export? | **Bundle everything self-contained** | Sets/songs carry every referenced song + media binary so they import on a never-seen-it machine (SHARE-04, SHARE-05). No "link by reference" mode, no export-time toggle. |

## Derived design constraints

- Selective import path is **strictly additive** — it must never invoke Replace/wipe semantics (SHARE-08). The existing whole-library Replace stays only on the legacy `library` route (SHARE-09).
- Manifest gains a `kind` discriminator: `"library"` (legacy/full backup, default when absent) | `"songs"` | `"set"` | `"settings"`.
- Reuse existing infrastructure where possible: `backup_progress` event, `inspect_archive`, `SchemaTooNew`, `normalize()` duplicate rule from `import.rs`, the `.tlz` ZIP writer/reader.
- Fix Concern C-1 (missing 007/008 song columns) via a shared song serializer so both selective export and full-library backup become field-complete.
