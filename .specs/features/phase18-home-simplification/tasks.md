# Phase 18: Home Simplification — Tasks

**Spec:** `.specs/features/phase18-home-simplification/spec.md`
**Design:** `.specs/features/phase18-home-simplification/design.md`
**Status:** Executed. Released as `v1.5.0` (status line corrected 2026-10-01)

**Measured baseline (this tree, 2026-09-11):** 736 Vitest passing + 1 skipped (87 files) ·
`tsc --noEmit` clean. Rust untouched by this phase — 372 passing + 1 ignored must not move.

**Scope:** 10 tasks, 23 live requirements, frontend + CI only.

---

## Execution Plan

### Batch 1 — Foundations (all parallel)

No dependencies, no shared files.

```
├── T1 [P]  locale keys
├── T2 [P]  setSelection.ts
├── T3 [P]  release-notes.mjs
└── T4 [P]  HomeSetBuilder header
```

### Batch 2 — Dependents (all parallel)

```
T4 ──→ T5 [P]  OverlayActionBar sheds its Home props
T1 ─┬─→ T6 [P]  SetManagerDialog
T2 ─┘
T3 ──→ T8 [P]  release.yml notes job
```

### Batch 3 — Set picker (sequential)

```
T4 ─┬─→ T7  SetPicker rewrite
T6 ─┘
```

### Batch 4 — Release (sequential, gated on user approval)

```
T5 ─┐
T7 ─┼─→ T9 ──→ T10
T8 ─┘
```

### Parallel Execution Map

```
Batch 1 (parallel):
  ├── T1 [P]   src/i18n/locales/*.json
  ├── T2 [P]   src/utils/setSelection.*
  ├── T3 [P]   scripts/release-notes.*
  └── T4 [P]   src/components/setbuilder/HomeSetBuilder.*

Batch 2 (parallel, after their deps):
  ├── T5 [P]   OverlayActionBar.* + OperatorPresentationLayout.*
  ├── T6 [P]   SetManagerDialog.*
  └── T8 [P]   release.yml + release-workflow.test.mjs + docs/release.md

Batch 3 (sequential):
  T7           SetPicker.* + HomeSetBuilder.test.tsx

Batch 4 (sequential):
  T9 ──→ T10
```

**Why T7 is not parallel:** it is the only task in its batch, and it edits
`HomeSetBuilder.test.tsx`, which T4 also owns. The T4 dependency serialises that file.

**Why every `[P]` is safe:** TESTING.md's Parallelism Assessment marks Frontend Vitest
parallel-safe (per-file module isolation), and no two `[P]` tasks in a batch touch the same file.

---

## Task Breakdown

### T1: Add the set-manager locale keys [P]

**What:** Add the three new `sets.manage.*` keys to both locale files, at parity.
**Where:** `src/i18n/locales/pt-BR.json`, `src/i18n/locales/en-US.json`
**Depends on:** None
**Reuses:** Existing `sets.picker.*` block structure
**Requirement:** P18-12, P18-18 (enabling)

**Tools:** MCP: NONE · Skill: NONE

**Keys** (design.md § Locale Keys):

| Key | pt-BR | en-US |
| --- | --- | --- |
| `sets.manage.title` | Gerenciar conjuntos | Manage sets |
| `sets.manage.open` | Gerenciar conjuntos | Manage sets |
| `sets.manage.close` | Fechar | Close |

**Done when:**
- [ ] All three keys present in **both** files, same nesting
- [ ] No existing key removed — in particular `home.overlay.image`, `home.overlay.aviso`,
      `home.overlay.pdf`, `home.overlay.pdfTooltip`, `home.overlay.closeOverlay`,
      `home.overlay.announcementTitle`, `home.overlay.announcementPlaceholder`,
      `home.overlay.confirm`, `home.overlay.cancel`, `home.overlay.selectMedia` stay (still used by
      the presentation layout)
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 736 passing + 1 skipped (unchanged; parity suites must stay green)

**Tests:** none — no new test; `src/i18n/locales.test.ts` and
`src/tests/i18n/key-completeness.test.ts` already gate parity (see Test Co-location Validation, note A)
**Gate:** quick

**Verify:** `npx vitest run src/i18n src/tests/i18n` → all green
**Commit:** `feat(i18n): set manager dialog strings`

---

### T2: Create the `nextActiveSetId` helper [P]

**What:** Pure function deciding which set becomes active when the active one is deleted, plus its
unit tests.
**Where:** `src/utils/setSelection.ts` (new), `src/utils/setSelection.test.ts` (new)
**Depends on:** None
**Reuses:** `src/utils/outputDispatch.ts` — pure-decision-function + co-located-test pattern
**Requirement:** P18-16 (F-1)

**Tools:** MCP: NONE · Skill: NONE

**Interface:** `nextActiveSetId(sets: ServiceSet[], deletedId: string): string | null`

**Rule** (design.md DD-6): the set **after** the deleted one in list order; if it was last, the one
**before** it; `null` if it was the only set or is not in the list.

**Done when:**
- [ ] Function exported with the exact signature above, typed against `ServiceSet` from `src/types`
- [ ] Test: middle set deleted → returns the next one
- [ ] Test: last set deleted → returns the previous one
- [ ] Test: only set deleted → returns `null`
- [ ] Test: id not in the list → returns `null`
- [ ] Test: empty list → returns `null`
- [ ] No store import, no IPC import, no React import
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 741 passing + 1 skipped (736 + 5 new)

**Tests:** unit (matrix: `src/utils/*.ts` → unit)
**Gate:** quick

**Verify:** `npx vitest run src/utils/setSelection.test.ts` → 5 passed
**Commit:** `feat(sets): successor selection helper for set deletion`

---

### T3: Create the release-notes composer [P]

**What:** Pure notes-composition module + CLI + unit tests. No network, no `git`, no `fs` in the
pure path.
**Where:** `scripts/release-notes.mjs` (new), `scripts/release-notes.test.mjs` (new)
**Depends on:** None
**Reuses:** `scripts/version-files.mjs` (pure exports), `scripts/is-main-module.mjs` (CLI guard),
`scripts/fix-updater-manifest.mjs` (CLI arg-parsing shape)
**Requirement:** P18-23

**Tools:** MCP: NONE · Skill: NONE

**Exports** (design.md DD-7):
```js
export function hasChangeEntries(generatedBody)   // /^\s*[*-]\s+\S/m
export function extractCompareLink(generatedBody) // the **Full Changelog**: line, or null
export function composeReleaseNotes({ generatedBody, commitSubjects, installLine, compareUrl })
```

**Composition rules:** install line first, then a blank line; generated body verbatim when it has
entries; otherwise `## What's Changed` + `* <subject>` per commit + the compare link; subjects
matching `NOISE_SUBJECT_PATTERNS` (`/^chore\(release\):/`) dropped; never emit an empty
`## What's Changed`.

**Done when:**
- [ ] Three functions exported; `NOISE_SUBJECT_PATTERNS` exported as a named constant
- [ ] CLI guarded by `isMainModule(import.meta.url)`, accepting `--generated`, `--commits`,
      `--install-line`, `--compare-url`, writing composed notes to stdout
- [ ] Test: generated body **with** `* ` entries passes through verbatim under the install line
- [ ] Test: generated body with only the heading + compare link falls back to the commit list
- [ ] Test: the compare link from the generated body is preserved in the fallback
- [ ] Test: `compareUrl` is used when the generated body carries no link
- [ ] Test: a `chore(release): bump version to 1.5.0` subject is dropped
- [ ] Test: empty `generatedBody` **and** empty `commitSubjects` → install line (+ compare link if
      given), no empty `## What's Changed`
- [ ] Test: install line is always the first line
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 743 passing + 1 skipped (736 + 7 new)

**Tests:** unit (repo convention: every `scripts/*.mjs` has a co-located `.test.mjs` — see note B)
**Gate:** quick

**Verify:** `npx vitest run scripts/release-notes.test.mjs` → 7 passed
**Commit:** `feat(release): pure release-notes composer with git-log fallback`

---

### T4: Rebuild Home's header and delete the unreachable overlay code [P]

**What:** Replace Home's two header bands with one row (`SetPicker` + spacer + prominent
`Apresentar`), stop mounting `OverlayActionBar`, and delete everything P18-01 makes unreachable.
**Where:** `src/components/setbuilder/HomeSetBuilder.tsx`,
`src/components/setbuilder/HomeSetBuilder.test.tsx`
**Depends on:** None
**Reuses:** `OverlayActionBar.tsx:36-44` (the `Apresentar` markup being promoted)
**Requirement:** P18-01, P18-05, P18-06, P18-07, P18-08, P18-09, P18-19 (partial: stops passing
`disabled`)

**Tools:** MCP: NONE · Skill: NONE

**Header row** (design.md DD-3):
`<div className="px-3 py-2 border-b border-border flex items-center gap-3 flex-wrap shrink-0">` →
`<SetPicker />`, `<div className="flex-1" />`, then the `Apresentar` button with
`px-5 py-2.5 text-sm font-semibold bg-primary hover:bg-primary-hover text-fg-on-primary rounded-lg
inline-flex items-center gap-2` and `<Play size={16} className="fill-current" />`.

**Delete** (P18-05): `showAnnouncementDialog`, `announcementText`, `announcementRef`,
`showMediaPicker`, `isImportingPresentation`, `handleOferta`, `handleSelectMediaOverlay`,
`handleConfirmAnnouncement`, `handleClearOverlay`, `handleAvisoClick`, `handleImportPresentation`,
`ensurePresentation`, `isOverlayActive`, `isPresenting`, `imageMedia`, the announcement-dialog and
media-picker JSX, and the imports `open` (plugin-dialog), `X`, `clearOverlay`, `importPresentation`,
`setAnnouncementOverlay`, `setMediaOverlay`, `useMediaStore`, `mediaUrl`, `usePresentationStore`,
`OverlayActionBar`.

**Keep:** song sidebar, drag-and-drop, `SetBuilder`, `errorToast`, `handleApresentar`,
`data-testid="apresentar-button"`.

**Do NOT touch** `src/api/commands.ts` — every command dropped here is still used by
`OperatorPresentationLayout` or `SetBuilder`.

**Done when:**
- [ ] Home renders no `Imagem`, `Aviso`, `Apresentação`, or `Fechar overlay` control (P18-01, DD-2)
- [ ] Exactly one element with `border-b` in Home's header
- [ ] `Apresentar` carries the DD-3 classes and `data-testid="apresentar-button"`
- [ ] `<SetPicker />` is rendered with **no** `disabled` prop
- [ ] Test added: `home.overlay.image`, `home.overlay.aviso`, `home.overlay.pdf` are **not** in the DOM
- [ ] Test added: exactly one `border-b` header band
- [ ] Test added: `Apresentar` has `bg-primary` and `text-sm`
- [ ] **Deleted:** `HomeSetBuilder.test.tsx:224` "disables the SetPicker while presenting"
      (authorised by P18-19 / F-2) — the only planned deletion in this task
- [ ] Existing `Apresentar` tests (`:111`, `:143`, `:155`, `:171`, `:188`, `:203`) still pass unchanged
- [ ] `npx tsc --noEmit` clean
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 738 passing + 1 skipped (736 − 1 deleted + 3 new)

**Tests:** component (matrix: `src/components/**/*.tsx` → component)
**Gate:** quick

**Verify:** `npx vitest run src/components/setbuilder/HomeSetBuilder.test.tsx` → 11 passed
**Commit:** `refactor(home): one header row with Apresentar as the single action`

---

### T5: Strip the Home-only props from `OverlayActionBar` [P]

**What:** Remove `showApresentarButton`, `onApresentar` and the `Apresentar` button from
`OverlayActionBar`, and drop the prop at its one remaining call site.
**Where:** `src/components/presentation/OverlayActionBar.tsx`,
`src/components/presentation/OverlayActionBar.test.tsx`,
`src/components/presentation/OperatorPresentationLayout.tsx` (line 303 only),
`src/components/presentation/OperatorPresentationLayout.test.tsx`
**Depends on:** T4 — Home must stop mounting the component first, or `tsc` breaks on the removed props
**Reuses:** —
**Requirement:** P18-02 (as restated by DD-1), P18-03

**Tools:** MCP: NONE · Skill: NONE

**Note:** `onOferta` / `onAviso` / `onPdf` stay **required** (DD-1) — the one remaining caller always
supplies them. This task is two files plus their tests because removing a prop and its only call
site is not separable without a red `tsc` in between.

**Done when:**
- [ ] `Props` no longer declares `showApresentarButton` or `onApresentar`; the `Play` import is gone
      if otherwise unused
- [ ] `OperatorPresentationLayout.tsx:303` no longer passes `showApresentarButton={false}`
- [ ] The presentation layout still renders all six controls: `Imagem`, `Aviso`, `Apresentação`,
      `Tela preta`, `Parar`, and `Fechar overlay` when an overlay is active (P18-03)
- [ ] **Deleted:** `OverlayActionBar.test.tsx` cases at `:29`, `:34`, `:49` (the three
      `Apresentar` prop cases) — authorised by DD-1, the only planned deletions in this task
- [ ] `OperatorPresentationLayout.test.tsx:421` reworded to "the bar has no Apresentar button"; its
      assertion is unchanged and still passes
- [ ] `npx tsc --noEmit` clean
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 735 passing + 1 skipped (738 from T4 − 3 deleted)

**Tests:** component
**Gate:** quick

**Verify:** `npx vitest run src/components/presentation/OverlayActionBar.test.tsx src/components/presentation/OperatorPresentationLayout.test.tsx` → all green
**Commit:** `refactor(presentation): OverlayActionBar sheds its Home-only props`

---

### T6: Create `SetManagerDialog` [P]

**What:** The `Gerenciar conjuntos` modal — list with counts, rename, delete (with the play-count
confirmation and last-set guard), create — plus its component tests.
**Where:** `src/components/setbuilder/SetManagerDialog.tsx` (new),
`src/components/setbuilder/SetManagerDialog.test.tsx` (new)
**Depends on:** T1 (locale keys), T2 (`nextActiveSetId`)
**Reuses:** `StopPresentationModal.tsx` (backdrop/panel/Escape pattern), `ConfirmDialog.tsx`,
`SetPicker.tsx:54-127` (the existing create/rename/delete handlers, moved not rewritten),
`useSetsStore`, `useLibraryStore`
**Requirement:** P18-13, P18-14, P18-15, P18-16, P18-17, P18-18

**Tools:** MCP: NONE · Skill: NONE

**Props:** `{ onClose: () => void }` — mounted only while open, so closing unmounts and discards
pending `renameValue` / `newName` by construction (DD-5).

**Delete flow (DD-6):** `getSetPlayCount` → `ConfirmDialog` (`sets.picker.deleteWithPlays`) → on
confirm compute `nextActiveSetId(sets, id)` **before** `deleteSet` → `deleteSet` → `refresh()` → if
the deleted id was active **and** a successor exists, `setActiveSet(successor)`.

**Done when:**
- [ ] Renders a titled modal (`sets.manage.title`) with an `X` labelled `sets.manage.close`
- [ ] Scrollable list (`max-h-[60vh] overflow-y-auto`) with `{name}` and `t("sets.item", { count })`
- [ ] Rename per row → `updateSet`, preserving `serviceDate` and `notes` as today
- [ ] Create form → `createSet` → `setActiveSet(created.id)`
- [ ] Delete disabled with the `sets.picker.lastSetHint` title when `sets.length <= 1`
- [ ] `useEffect` on `sets` clears `renamingId` when that set is no longer listed (DD-5)
- [ ] Escape / backdrop click / `X` all call `onClose`
- [ ] Test: list shows every set with its item count
- [ ] Test: create makes the new set active
- [ ] Test: rename calls `updateSet`
- [ ] Test: delete shows the play count then calls `deleteSet`
- [ ] Test: **deleting the active set calls `setActiveSet` with the successor** (F-1 regression)
- [ ] Test: deleting a non-active set does **not** call `setActiveSet`
- [ ] Test: a failed `deleteSet` leaves the dialog open and never calls `setActiveSet`
- [ ] Test: delete disabled when only one set exists
- [ ] Test: Escape closes; backdrop click closes
- [ ] Test: a `sets` refresh mid-rename does not clear the typed value
- [ ] `npx tsc --noEmit` clean
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 746 passing + 1 skipped (735 from T5 + 11 new — count independently of T5/T8 if run in parallel; reconcile at batch end)

**Tests:** component
**Gate:** quick

**Verify:** `npx vitest run src/components/setbuilder/SetManagerDialog.test.tsx` → 11 passed
**Commit:** `feat(sets): Gerenciar conjuntos dialog`

---

### T7: Rewrite `SetPicker` as select + gear

**What:** Replace the always-open management panel with a native `<select>` and a gear that opens
`SetManagerDialog`; drop the dead `disabled` prop.
**Where:** `src/components/setbuilder/SetPicker.tsx`,
`src/components/setbuilder/SetPicker.test.tsx`,
`src/components/setbuilder/HomeSetBuilder.test.tsx` (two coupled cases only)
**Depends on:** T4 (Home no longer passes `disabled`), T6 (the dialog exists)
**Reuses:** `MonitorPicker.tsx:58-70` (select markup + token classes), `useSetsStore`,
`useLibraryStore`, the existing `onSetChanged` subscription
**Requirement:** P18-10, P18-11, P18-12, P18-19

**Tools:** MCP: NONE · Skill: NONE

**Shape:** ~256 lines → ~60. Props: **none**. Owns the `onSetChanged` → `refresh()` subscription and
the dialog's open flag. Create/rename/delete and `ConfirmDialog` move out to T6's component.

**Classes (DD-3):** select `text-xs px-2 py-1.5 bg-surface border border-border rounded-lg
focus:outline-none focus:border-primary`; gear `p-1.5 text-muted hover:text-inherit rounded` with
`<Settings size={14} />` and `aria-label={t("sets.manage.open")}`.

**Done when:**
- [ ] Renders one `<select>` (options = set names, `value={activeSetId}`, `aria-label` =
      `sets.picker.switch`) and one gear button — nothing else in the closed state
- [ ] `onChange` → `setActiveSet(e.target.value)`
- [ ] Gear click mounts `<SetManagerDialog onClose={…} />`
- [ ] While `sets` is empty, the select shows a single disabled option holding the active set's name
      — never blank or `undefined`
- [ ] The `disabled` prop is **removed** from the component's interface (P18-19)
- [ ] Test: select lists every set and has the active one selected
- [ ] Test: changing the select calls `setActiveSet`
- [ ] Test: no create / rename / delete control in the closed state
- [ ] Test: gear opens the dialog
- [ ] Test: empty sets list renders no blank option
- [ ] **Deleted:** `SetPicker.test.tsx:183` "disabled prop hides every mutating control"
      (authorised by P18-19 / F-2) — the only planned deletion in this task
- [ ] **Updated in `HomeSetBuilder.test.tsx`:** `:117` "renders the SetPicker" (the
      `set-picker-active-name` testid is gone — assert the select instead) and `:123` "switching sets
      repoints SetBuilder's setId" (drive the select with `fireEvent.change`, not a button click).
      Both must keep asserting the same behaviour.
- [ ] `npx tsc --noEmit` clean
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: batch-end total 750 passing + 1 skipped (736 − 5 authorised deletions + 19 new).
      **Record the actual number**; any other decrease is a silent deletion and fails the task.

**Tests:** component
**Gate:** full — `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run` (last frontend
task; confirm Rust is still 372 + 1 ignored, i.e. untouched)

**Verify:** `npx vitest run src/components/setbuilder/` → all green; then `npm run tauri dev` and
confirm Home's header is one row with a select, a gear and a dominant `Apresentar`
**Commit:** `refactor(sets): compact set picker with a manage dialog`

---

### T8: Add the release-notes job to the workflow [P]

**What:** A third job in `release.yml` that composes and applies the draft's body, its workflow
assertions, and the docs entry.
**Where:** `.github/workflows/release.yml`, `scripts/release-workflow.test.mjs`, `docs/release.md`
**Depends on:** T3 (the composer must exist for the job to call)
**Reuses:** `scripts/release-workflow.test.mjs` (existing YAML-parsing assertions), T3's composer
**Requirement:** P18-22, P18-24

**Tools:** MCP: NONE · Skill: NONE

**Job shape (DD-8):** `release-notes`, `needs: build`, `runs-on: ubuntu-24.04`,
`actions/checkout@v4` with `fetch-depth: 0`, `actions/setup-node@v4`, then one step with
`continue-on-error: true`, `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` and `TAG: ${{ github.ref_name }}`
that resolves `PREV` via `git describe --tags --abbrev=0 "${TAG}^"`, fetches
`gh api repos/$GITHUB_REPOSITORY/releases/generate-notes --jq .body`, collects
`git log --no-merges --pretty=format:%s "$PREV..$TAG"`, runs `node scripts/release-notes.mjs`, and
applies `gh release edit "$TAG" --notes-file notes.md`.

**Done when:**
- [ ] `verify-version` and `build` jobs are **byte-identical** to before
- [ ] The new job never references `TAURI_SIGNING_PRIVATE_KEY` or its password
- [ ] The job creates/publishes/deletes nothing — only `generate-notes` (read) and
      `release edit` (PATCH)
- [ ] `PREV` resolution tolerates a missing previous tag (`|| true`), and both the `gh api` call and
      the `git log` degrade to full history in that case
- [ ] Test: a `release-notes` job exists with `needs: build`
- [ ] Test: its checkout step sets `fetch-depth: 0`
- [ ] Test: its apply step sets `continue-on-error: true`
- [ ] Test: the job's YAML contains no signing-secret reference
- [ ] Test: the workflow still has exactly the two-platform build matrix and the draft settings
      (existing cases still pass)
- [ ] `docs/release.md` documents the step **and** the DD-9 fallback
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: +4 new cases in `release-workflow.test.mjs`; reconcile at batch end

**Tests:** unit (workflow YAML is unit-tested in this repo — see note B)
**Gate:** quick

**Verify:** `npx vitest run scripts/release-workflow.test.mjs` → all green;
`node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/release.yml','utf8'))"` parses
**Commit:** `ci(release): fill the draft release body from commits`

---

### T9: Bump the version to 1.5.0

**What:** Move all five version sources to `1.5.0`.
**Where:** `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` — via `scripts/bump-version.mjs`
**Depends on:** T5, T7, T8 (all code complete)
**Reuses:** `scripts/bump-version.mjs`, `scripts/check-version.mjs`
**Requirement:** P18-20

**Tools:** MCP: NONE · Skill: NONE

**Done when:**
- [ ] `node scripts/bump-version.mjs 1.5.0` run (do not hand-edit the five files)
- [ ] `node scripts/check-version.mjs v1.5.0` exits 0
- [ ] All four gates green: `npx vitest run`, `cargo test --manifest-path src-tauri/Cargo.toml`,
      `cargo clippy --all-targets -D warnings`, `npx tsc --noEmit`
- [ ] Rust still 372 passing + 1 ignored (this phase touches no Rust — any change is a red flag)
- [ ] Test count: 750 passing + 1 skipped, or the reconciled batch-end figure from T7/T8

**Tests:** none — the matrix has no row for version manifests; `check-version.mjs` and
`tauri-config.test.mjs` already gate them (note A)
**Gate:** full

**Verify:** `node scripts/check-version.mjs v1.5.0 && echo OK`
**Commit:** `chore(release): bump version to 1.5.0`

---

### T10: Tag, release, and verify the draft ⚠️ requires explicit go-ahead

**What:** Push the `v1.5.0` tag, watch the workflow, and confirm the draft's body carries the
commit list — including the DD-9 open question.
**Where:** git tag + GitHub Actions (no files)
**Depends on:** T9
**Reuses:** the existing release pipeline
**Requirement:** P18-21, P18-22 (verification), P18-23 (verification), DD-9

**Tools:** MCP: NONE · Skill: NONE

**⚠️ This task pushes a tag and creates a public draft release. It is outward-facing and not
cleanly reversible — do not run it without the user explicitly saying go.**

**Done when:**
- [ ] All four gates green on the exact commit being tagged
- [ ] `git tag v1.5.0 && git push origin v1.5.0`
- [ ] `verify-version` passes; both platform builds upload signed artifacts
- [ ] The release is still a **draft** after the notes job runs
- [ ] The draft body starts with `Baixe o instalador para a sua plataforma abaixo.` and lists this
      phase's commits (P18-23)
- [ ] **DD-9 resolved:** record whether `gh release edit <tag>` resolved the draft by tag name. If it
      did not, apply the documented `gh api` + `PATCH` fallback, commit the fix, and note the outcome
      in STATE.md
- [ ] Windows and Linux installers are both attached
- [ ] STATE.md and ROADMAP.md updated to RELEASED with the final gate figures

**Tests:** none (release operation)
**Gate:** build

**Verify:** `gh release view v1.5.0` → draft, body lists commits, both assets present
**Commit:** `docs(specs): mark phase 18 done and note the v1.5.0 release`

---

## Pre-Approval Check 1 — Task Granularity

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 2 locale files, same key block | ✅ Granular (cohesive pair) |
| T2 | 1 helper + its test | ✅ Granular |
| T3 | 1 script + its test | ✅ Granular |
| T4 | 1 component + its test | ✅ Granular |
| T5 | 1 component + 1 call site + 2 tests | ⚠️ OK — inseparable: removing a prop and its only call site cannot be split without a red `tsc` between them |
| T6 | 1 component + its test | ✅ Granular |
| T7 | 1 component + its test + 2 coupled cases in a neighbour's test | ✅ Granular (the neighbour edit is forced by the testid change) |
| T8 | 1 workflow + its test + 1 docs entry | ⚠️ OK — cohesive: the job, its assertions, and the line that documents it |
| T9 | 5 files via one script | ✅ Granular (one scripted operation) |
| T10 | 0 files (release operation) | ✅ Granular |

No ❌. Two ⚠️ are justified above, both from "cannot be split without leaving the tree broken".

---

## Pre-Approval Check 2 — Diagram-Definition Cross-Check

| Task | `Depends on` (body) | Diagram arrows | Status |
| --- | --- | --- | --- |
| T1 | None | none (Batch 1 root) | ✅ Match |
| T2 | None | none (Batch 1 root) | ✅ Match |
| T3 | None | none (Batch 1 root) | ✅ Match |
| T4 | None | none (Batch 1 root) | ✅ Match |
| T5 | T4 | `T4 ──→ T5` | ✅ Match |
| T6 | T1, T2 | `T1 ─┬─→ T6`, `T2 ─┘` | ✅ Match |
| T7 | T4, T6 | `T4 ─┬─→ T7`, `T6 ─┘` | ✅ Match |
| T8 | T3 | `T3 ──→ T8` | ✅ Match |
| T9 | T5, T7, T8 | `T5 ─┐ T7 ─┼─→ T9 T8 ─┘` | ✅ Match |
| T10 | T9 | `T9 ──→ T10` | ✅ Match |

**No `[P]` task depends on another task in its own batch:** Batch 1 (T1–T4) are all roots; Batch 2's
T5/T6/T8 depend only on Batch 1 tasks; Batch 3's T7 is alone. ✅

---

## Pre-Approval Check 3 — Test Co-location Validation

| Task | Code layer created/modified | Matrix requires | Task says | Status |
| --- | --- | --- | --- | --- |
| T1 | `src/i18n/locales/*.json` | *(no row — note A)* | none | ✅ OK |
| T2 | `src/utils/*.ts` | unit | unit | ✅ OK |
| T3 | `scripts/*.mjs` | *(no row — note B)* | unit | ✅ OK |
| T4 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T5 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T6 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T7 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T8 | `.github/workflows/*.yml` | *(no row — note B)* | unit | ✅ OK |
| T9 | version manifests | *(no row — note A)* | none | ✅ OK |
| T10 | none (release operation) | — | none | ✅ OK |

No ❌ VIOLATION. Every task that creates code carries the tests for that code — none are deferred.

**Note A — matrix gaps, covered by existing suites.** TESTING.md has no row for locale JSON or the
version manifests. Both are already gated: `src/i18n/locales.test.ts` and
`src/tests/i18n/key-completeness.test.ts` for parity, `scripts/check-version.mjs` and
`scripts/tauri-config.test.mjs` for versions. `Tests: none` here means "no *new* test file", not
"untested" — each task asserts the existing suite stays green.

**Note B — matrix gaps, covered by repo convention.** TESTING.md predates `scripts/` and
`.github/workflows/`, but this repo unit-tests both: `version-files.test.mjs`,
`is-main-module.test.mjs`, `fix-updater-manifest.test.mjs`, `cli.test.mjs`,
`release-workflow.test.mjs`, `ci-workflow.test.mjs`, `publish-manifest-workflow.test.mjs`,
`tauri-config.test.mjs`. T3 and T8 follow it. **TESTING.md should gain rows for `scripts/*.mjs` →
unit and `.github/workflows/*.yml` → unit** — logged as a follow-up, not fixed in this phase.

---

## Test Accounting

Every deletion is authorised by a requirement; nothing else may shrink.

| Task | Deleted | Authorised by | New | Running total |
| --- | --- | --- | --- | --- |
| — | — | baseline | — | 736 + 1 skipped |
| T1 | 0 | — | 0 | 736 |
| T2 | 0 | — | 5 | 741 |
| T3 | 0 | — | 7 | 748 |
| T4 | 1 (`HomeSetBuilder.test.tsx:224`) | P18-19 / F-2 | 3 | 750 |
| T5 | 3 (`OverlayActionBar.test.tsx:29,34,49`) | DD-1 | 0 | 747 |
| T6 | 0 | — | 11 | 758 |
| T7 | 1 (`SetPicker.test.tsx:183`) | P18-19 / F-2 | ~8 net after the rewrite | ~766 |
| T8 | 0 | — | 4 | ~770 |

**Planned deletions: 5 total, each named and requirement-backed.** Because Batch 1 and Batch 2 tasks
run in parallel, per-task running totals are indicative — reconcile the real figure at each batch
end. Any decrease not in this table is a silent deletion and fails the task.

---

## Tools and Skills

No MCP server and no skill is needed for any task in this phase. Everything is file edits plus the
four existing gate commands; `gh` is used only inside the workflow, on the runner.

**Confirm before execution:** if you would rather some tasks used a particular MCP or skill, say
which — otherwise execution proceeds with plain file tools and the gate commands above.

---

## Requirement Coverage

| Requirement | Task | Requirement | Task |
| --- | --- | --- | --- |
| P18-01 | T4 | P18-13 | T6 |
| P18-02 *(restated DD-1)* | T5 | P18-14 | T6 |
| P18-03 | T5 | P18-15 | T6 |
| P18-04 | **retired (DD-2)** | P18-16 | T2, T6 |
| P18-05 | T4 | P18-17 | T6 |
| P18-06 | T4 | P18-18 | T6 |
| P18-07 | T4 | P18-19 | T4, T7 |
| P18-08 | T4 | P18-20 | T9 |
| P18-09 | T4 | P18-21 | T10 |
| P18-10 | T7 | P18-22 | T8, T10 |
| P18-11 | T7 | P18-23 | T3, T10 |
| P18-12 | T1, T7 | P18-24 | T8 |

**23 of 23 live requirements mapped.** P18-04 retired at design time.
