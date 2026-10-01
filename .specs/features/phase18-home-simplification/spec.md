# Phase 18: Home Simplification — Single Primary Action & Compact Set Control

**Status:** RELEASED as `v1.5.0` (status line corrected 2026-10-01; the code shipped before these docs were updated). Two requirements amended at design time, see Spec Amendments below
**Specified:** 2026-09-11
**Target tag:** `v1.5.0`
**Depends on:** Phase 17 (`v1.4.0`) — the Home `SetPicker` this phase compacts was introduced there (P17-19..P17-27).

---

## Problem Statement

Home is the screen the operator looks at seconds before the service starts, and it currently
presents four competing buttons in its action bar plus a full set-management panel above them.
The one action that matters at that moment — **Apresentar** — is styled identically to three
secondary actions (`Imagem`, `Aviso`, `Apresentação`) and is the same visual weight as everything
else. Above it, set management occupies a vertical list with per-row rename and delete buttons for
a feature that changes a few times a month, pushing the actual set contents down the screen.

The result is a Home page whose visual hierarchy does not match its usage frequency: the rarely-used
controls are the largest and most numerous, and the single hot path is easy to miss.

---

## Goals

- [ ] Home's action bar carries exactly one action — **Apresentar** — rendered unmistakably as the
      primary control (largest interactive element on the screen).
- [ ] Set management collapses from an always-open panel to one select plus a gear, with
      create/rename/delete behind a modal.
- [ ] Home's header shrinks from two stacked bars to one row, returning vertical space to the set
      contents.
- [ ] Zero capability is lost: every removed control remains reachable from where it is actually
      used.
- [ ] Ship as `v1.5.0` with a draft GitHub Release whose body lists the changes since `v1.4.0`.

---

## Out of Scope

| Feature | Reason |
| --- | --- |
| A pinned "main set" that overrides the last-used set at launch | `stores/library.ts:92` already persists the operator's selection as `ui.active_set_id` and restores it at launch, so the app already opens on the set you last chose. Adding a second source of truth for "which set opens" would have to win or lose against that one, and the operator gains nothing for the ambiguity. **D-80.** |
| Drag-to-reorder sets | Was only proposed as the mechanism for marking a main set. With the main-set concept dropped (D-80), reordering has no requirement behind it. A custom set order is a separate, independently-justifiable feature — logged as a deferred idea, not built here. |
| Removing `Imagem` / `Aviso` / `Apresentação` from the live presentation layout | These are the operator's live tools: raise an offering image, push an announcement, drop a PPTX mid-service. `OperatorPresentationLayout.tsx:303` keeps all of them. Only Home loses them. |
| Changing what `Apresentar` does | Its behaviour (load the active set → `requestPresentation`, empty-set toast) is correct and stays byte-for-byte. This phase changes only its prominence. |
| Rewriting `SetBuilder` (the set contents below the header) | Out of scope; the simplification is the header. |
| A `CHANGELOG.md` file | The draft GitHub Release is the changelog. Adding a tracked file duplicates it and creates a second thing to forget to update. |

---

## Current-State Analysis

Traced in the code before specifying. These are the facts the requirements below rest on.

### CS-1 — `Apresentação` on Home is a duplicate control

`HomeSetBuilder.handleImportPresentation` (`src/components/setbuilder/HomeSetBuilder.tsx:163`)
opens a PPTX/PDF dialog, calls `importPresentation`, and adds the result to the active set as a
`slide_show` item. `SetBuilder.handleAddPresentation`
(`src/components/set/SetBuilder.tsx:311`) does exactly the same thing — same dialog title, same
filters, same `addSetItem({ itemType: "slide_show" })` — and `SetBuilder` is rendered *directly
below* the action bar on Home (`HomeSetBuilder.tsx:245`). Removing the header button costs nothing:
the identical control is already on screen, two inches lower, attached to the item list it appends to.

### CS-2 — `OverlayActionBar` is shared between Home and the presentation layout

`src/components/presentation/OverlayActionBar.tsx` is mounted twice: by `HomeSetBuilder.tsx:219`
and by `OperatorPresentationLayout.tsx:303`. It already has the exact pattern this phase needs —
`onBlackout` and `onStop` are optional props whose buttons render only when the handler is supplied
(`OverlayActionBar.tsx:45,54`). `onOferta` / `onAviso` / `onPdf` are currently required. Making them
optional and conditionally rendered follows the component's own established convention rather than
introducing a new one.

### CS-3 — The app already opens on the last-used set

`useLibraryStore.loadActiveSet` (`stores/library.ts:92`) reads the `ui.active_set_id` setting,
validates the set still exists, and falls back to `getOrCreateDefaultSet()` when it doesn't.
`setActiveSet` (`stores/library.ts:110`) writes the setting on every switch. The launch-selection
behaviour a "main set" would provide is already shipped. See D-80.

### CS-4 — The `SetPicker` panel is ~125 lines of always-visible management UI

`SetPicker.tsx:129-237` renders, unconditionally: a label row, a "Trocar conjunto" heading, a `<ul>`
with one row per set (each carrying a switch button, a rename button and a delete button), and a
create button or inline create form. For a library with five sets that is 17 interactive elements
permanently on Home, none of them on the hot path.

### F-1 (defect, unreported) — deleting the active set leaves a dangling `activeSetId`

`SetPicker.handleDelete` (`SetPicker.tsx:118`) calls `deleteSet`, then `refresh()` on the sets store
— and never touches `activeSetId`. Delete is offered for every set including the active one (the only
guard is `canDelete = sets.length > 1`, `SetPicker.tsx:47`). So deleting the set you are currently on
leaves `useLibraryStore.activeSetId` pointing at a row that no longer exists;
`HomeSetBuilder` then renders `<SetBuilder setId={deletedId}>` (`HomeSetBuilder.tsx:245`), which
cannot load. The state only self-heals at next launch, when `loadActiveSet`'s existence check
(CS-3) drops the stale id. Fixed here as P18-16, since delete is being moved anyway.

### F-2 (dead code) — `SetPicker`'s `disabled` prop is unreachable

`HomeSetBuilder` passes `disabled={isPresenting}` (`HomeSetBuilder.tsx:215`) using a local
`isPresenting` of `mode === live | blank | frozen` (`HomeSetBuilder.tsx:190`). But
`OperatorApp.tsx:433` computes a *strictly broader* `isPresenting` — the same three modes **plus**
`countdownActive` **plus** `presentingOutputs.size > 0` — and renders `<HomeSetBuilder />` only in
its `else` branch (`OperatorApp.tsx:568-574`). Home cannot be on screen while its own narrower
predicate is true, so `disabled` is always `false` in production. Only `SetPicker.test.tsx:183`
("disabled prop hides every mutating control") exercises it, by passing the prop directly.
Retired as P18-19.

---

## User Stories

### P1: One obvious action on Home ⭐ MVP

**User Story**: As the operator, I want Home's action bar to offer only **Apresentar**, rendered as
the clear primary action, so that at 09:58 on Sunday I hit the right button without reading four
labels.

**Why P1**: This is the phase's headline. It is also the cheapest change with the highest payoff —
three buttons removed, one restyled.

**Acceptance Criteria**:

1. WHEN the operator is on Home THEN the action bar SHALL render `Apresentar` and SHALL NOT render
   `Imagem`, `Aviso`, or `Apresentação`.
2. WHEN the operator is on Home THEN `Apresentar` SHALL be the largest interactive element in the
   header — strictly greater in rendered height and font size than the set select and the gear —
   and SHALL carry the primary fill (`bg-primary` / `text-fg-on-primary`).
3. WHEN the operator clicks `Apresentar` THEN the system SHALL behave exactly as it does today:
   load the active set, then request presentation; and on an empty set show the
   `error.presentation.empty_set` toast without opening a presentation window.
4. WHEN the operator is in a live presentation THEN the presentation layout SHALL still render
   `Imagem`, `Aviso`, `Apresentação`, `Tela preta` and `Parar`, unchanged.
5. WHEN an overlay is active and the operator is on Home THEN the action bar SHALL still offer
   `Fechar overlay`, so an overlay raised from the presentation layout and outliving it can always
   be dismissed.
6. WHEN a PPTX or PDF must be added to the set from Home THEN the operator SHALL do so through the
   existing `SetBuilder` control (CS-1), which is unchanged and remains on screen.

**Independent Test**: Open Home. The bar has one filled button, visibly larger than everything
beside it. Start a presentation; the live layout still has all five of its buttons.

---

### P1: Set management out of the way ⭐ MVP

**User Story**: As the operator, I want the set controls collapsed to a single select, with
create/rename/delete behind a gear, so that Home shows my set contents instead of a management
panel I touch twice a month.

**Why P1**: The set panel is the larger of the two space consumers, and the user's stated reason for
the phase. Without it, Home is still top-heavy.

**Acceptance Criteria**:

1. WHEN Home renders THEN the set control SHALL be a single `<select>` showing the active set's
   name, and SHALL NOT render any create, rename, or delete control in its closed state.
2. WHEN the operator picks a different set in the select THEN the system SHALL make that set active
   and persist the choice via `setActiveSet` (`ui.active_set_id`), exactly as today.
3. WHEN the operator clicks the gear beside the select THEN the system SHALL open a
   `Gerenciar conjuntos` modal.
4. WHEN the manage modal is open THEN it SHALL list every set with its item count, offer rename and
   delete per row, and offer create.
5. WHEN the operator creates a set from the modal THEN the system SHALL make the new set active and
   reflect it in the select.
6. WHEN the operator renames a set THEN the system SHALL persist the new name via `updateSet` and
   the select SHALL show it without a reload.
7. WHEN the operator deletes a set THEN the system SHALL first show the play-count confirmation
   (`sets.picker.deleteWithPlays`), as today.
8. WHEN only one set exists THEN delete SHALL be disabled with the `sets.picker.lastSetHint`
   tooltip, as today.
9. WHEN the operator deletes the **active** set THEN the system SHALL switch the active set to
   another surviving set and persist it — never leave `activeSetId` pointing at a deleted row (F-1).
10. WHEN the operator presses `Escape`, clicks the backdrop, or clicks the close button THEN the
    modal SHALL close without applying a pending rename or create.
11. WHEN the modal closes THEN the select SHALL show whatever set is active at that moment.

**Independent Test**: Home shows one select and a gear. Open the gear, rename a set, close — the
select shows the new name. Delete the set you are on — Home stays functional and shows another set.

---

### P2: Header on one row

**User Story**: As the operator, I want the set control and `Apresentar` on the same row, so Home
spends its vertical space on the set contents.

**Why P2**: Real but secondary — the phase's goals are met without it; it is what turns "fewer
controls" into "visibly more room". Depends on both P1 stories landing first.

**Acceptance Criteria**:

1. WHEN Home renders THEN the set select, the gear, and `Apresentar` SHALL occupy a single header
   row: set control leading, `Apresentar` trailing.
2. WHEN the header is a single row THEN Home SHALL render exactly one bottom-bordered header band,
   not the two stacked bands it renders today (`HomeSetBuilder.tsx:214` and `:219`).
3. WHEN the operator window is narrowed THEN the row SHALL wrap rather than clip or overflow
   horizontally.

**Independent Test**: One header band, not two; the set contents start measurably higher up the page.

---

### P2: Release `v1.5.0` with a populated draft

**User Story**: As the maintainer, I want pushing the `v1.5.0` tag to produce a draft release whose
body already lists the changes, so I publish instead of writing release notes by hand.

**Why P2**: Shipping is required, but the notes automation is an improvement to an already-working
pipeline, not a blocker for the UI work.

**Acceptance Criteria**:

1. WHEN the version is bumped THEN all five sources checked by `scripts/check-version.mjs`
   (`package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`,
   `src-tauri/Cargo.lock`) SHALL read `1.5.0`.
2. WHEN the `v1.5.0` tag is pushed THEN `verify-version` SHALL pass and both platform builds SHALL
   produce signed artifacts on a **draft** release, as today.
3. WHEN both builds have completed THEN a subsequent job SHALL replace the draft's body with release
   notes covering every change since the previous tag, and the release SHALL remain a draft.
4. WHEN the notes are composed THEN they SHALL retain the installer line
   (`Baixe o instalador para a sua plataforma abaixo.`) above the change list.
5. WHEN GitHub's generated notes contain no change entries THEN the system SHALL substitute the
   commit subjects from `git log --no-merges <previous-tag>..<tag>` (see F-3), preserving GitHub's
   `Full Changelog` compare link.
6. WHEN the notes job fails THEN the draft release and its uploaded artifacts SHALL survive — a
   notes failure SHALL NOT fail the release or delete artifacts.

**Independent Test**: Push the tag; the resulting draft's body lists the phase's commits, and the
installers are attached.

---

### F-3 (release finding) — GitHub's generated notes would come back empty for this repo

This is a correction to D-83 as originally chosen, and the reason AC-5 above exists.

GitHub's auto-generated release notes list **merged pull requests**, not commits. This repository
commits directly to `main`: `git log --merges v1.3.0..HEAD` returns **zero** merge commits across
the 20 commits of Phase 17, and the last PR merge in the history is `#2`, long before `v1.3.0`.
`POST /repos/{owner}/{repo}/releases/generate-notes` would therefore return a body consisting of an
empty `## What's Changed` heading and the compare link — which does not deliver "the release draft
brings the commit messages".

Also verified: `gh release edit` has **no** `--generate-notes` flag (only `--notes`, `--notes-file`,
`--draft`, `--title`, `--tag`, `--target`, `--latest`, `--prerelease`, `--discussion-category`,
`--verify-tag`, `--repo`). The generated-notes body must be fetched from the REST endpoint above and
applied with `gh release edit --notes-file`.

So the implementation keeps the chosen mechanism *and* makes it deliver: request GitHub's notes,
and when they carry no `* ` bullet, fill the change list from `git log` instead. If PR-based flow
resumes later, GitHub's own notes take over with no further change. **D-83 (amended).**

---

## Edge Cases

- WHEN the sets list has not loaded yet THEN the select SHALL render the active set's name if known
  and SHALL NOT render an empty or `undefined` option.
- WHEN a `set_changed` event arrives while the manage modal is open THEN the modal list SHALL
  refresh without discarding text the operator is currently typing into a rename or create field.
- WHEN `deleteSet` fails THEN the modal SHALL remain open, the set SHALL remain listed, and the
  active set SHALL be unchanged.
- WHEN rename is submitted with an empty or whitespace-only name THEN the system SHALL reject it and
  keep the previous name (current behaviour, preserved).
- WHEN the library contains many sets THEN the select SHALL remain a fixed-height control and the
  modal list SHALL scroll rather than grow the dialog past the viewport.
- WHEN `Apresentar` is clicked twice quickly THEN the second click SHALL NOT open a second
  presentation window (current behaviour via `requestPresentation`, preserved).
- WHEN the previous tag cannot be resolved in the notes job (e.g. the very first tag) THEN the job
  SHALL fall back to the full history and still produce a non-empty body.
- WHEN the release workflow runs THEN the notes job SHALL check out with full history
  (`fetch-depth: 0`), since `git log <prev>..<tag>` cannot work on a shallow clone.

---

## Requirement Traceability

| Requirement ID | Story | Group | Priority | Status |
| --- | --- | --- | --- | --- |
| P18-01 | P1: One obvious action | 18A Header trim | P1 | Pending |
| P18-02 | P1: One obvious action | 18A Header trim | P1 | Restated (DD-1) |
| P18-03 | P1: One obvious action | 18A Header trim | P1 | Pending |
| P18-04 | P1: One obvious action | 18A Header trim | P1 | **Retired (DD-2)** |
| P18-05 | P1: One obvious action | 18A Header trim | P1 | Pending |
| P18-06 | P1: One obvious action | 18B Apresentar | P1 | Pending |
| P18-07 | P1: One obvious action | 18B Apresentar | P1 | Pending |
| P18-08 | P2: Header on one row | 18B Apresentar | P2 | Pending |
| P18-09 | P2: Header on one row | 18B Apresentar | P2 | Pending |
| P18-10 | P1: Set management out of the way | 18C Set control | P1 | Pending |
| P18-11 | P1: Set management out of the way | 18C Set control | P1 | Pending |
| P18-12 | P1: Set management out of the way | 18C Set control | P1 | Pending |
| P18-13 | P1: Set management out of the way | 18C Set control | P1 | Pending |
| P18-14 | P1: Set management out of the way | 18C Set control | P1 | Pending |
| P18-15 | P1: Set management out of the way | 18C Set control | P1 | Pending |
| P18-16 | P1: Set management out of the way | 18C Set control | P1 | Pending |
| P18-17 | P1: Set management out of the way | 18C Set control | P1 | Pending |
| P18-18 | P1: Set management out of the way | 18C Set control | P1 | Pending |
| P18-19 | P1: Set management out of the way | 18C Set control | P2 | Pending |
| P18-20 | P2: Release | 18D Release | P2 | Pending |
| P18-21 | P2: Release | 18D Release | P2 | Pending |
| P18-22 | P2: Release | 18D Release | P2 | Pending |
| P18-23 | P2: Release | 18D Release | P2 | Pending |
| P18-24 | P2: Release | 18D Release | P2 | Pending |

### Requirement text

**18A — Header trim**

| ID | Requirement |
| --- | --- |
| P18-01 | Home's action bar renders no `Imagem`, no `Aviso`, and no `Apresentação` button |
| P18-02 | ~~`OverlayActionBar` renders `onOferta` / `onAviso` / `onPdf` only when the handler prop is supplied~~ → **restated by DD-1:** `OverlayActionBar` sheds its Home-only props (`showApresentarButton`, `onApresentar`) and is mounted only by `OperatorPresentationLayout`; Home renders its own header row. The other three props stay required — the one remaining caller always supplies them |
| P18-03 | `OperatorPresentationLayout`'s action bar is unchanged: `Imagem`, `Aviso`, `Apresentação`, `Tela preta`, `Parar`, and `Fechar overlay` all still render |
| P18-04 | ~~Home still offers `Fechar overlay` while an overlay is active~~ → **retired by DD-2:** unreachable. `exit_presentation` clears `overlay` unconditionally (`window.rs:539`), the only overlay setters live in the presentation layout, and Home is unmounted while any output presents — so the button could never render |
| P18-05 | The handlers, dialogs, state and imports left unreachable in `HomeSetBuilder` by P18-01 are deleted (announcement dialog, media picker, presentation-import handler, `useMediaStore`/`mediaUrl` usage) — no dead code retained |

**18B — Apresentar prominence**

| ID | Requirement |
| --- | --- |
| P18-06 | `Apresentar` is the largest interactive element in Home's header — strictly greater rendered height and font size than the set select and the gear — with the primary fill |
| P18-07 | `Apresentar` keeps `data-testid="apresentar-button"` and its current behaviour, including the empty-set toast path |
| P18-08 | Home's header is a single row: set select + gear leading, `Apresentar` trailing |
| P18-09 | Home renders exactly one bottom-bordered header band, and the row wraps rather than overflowing when the window is narrow |

**18C — Compact set control**

| ID | Requirement |
| --- | --- |
| P18-10 | The closed set control is a single `<select>` showing the active set; no create/rename/delete control is visible in the closed state |
| P18-11 | Selecting another set switches the active set and persists it via `setActiveSet` |
| P18-12 | A gear button beside the select opens the `Gerenciar conjuntos` modal |
| P18-13 | The modal lists every set with its item count and offers rename and delete per row |
| P18-14 | The modal creates a set; the created set becomes active |
| P18-15 | Rename persists via `updateSet` and is reflected in the select with no reload |
| P18-16 | Deleting the active set reassigns and persists the active set to a surviving set (fixes F-1) |
| P18-17 | Delete keeps the play-count confirmation and the last-set guard with its tooltip |
| P18-18 | The modal closes on `Escape`, backdrop click, and close button, discarding any pending rename/create input |
| P18-19 | `SetPicker`'s unreachable `disabled` prop and `HomeSetBuilder`'s dead `isPresenting` computation are retired (F-2) |

**18D — Release**

| ID | Requirement |
| --- | --- |
| P18-20 | Version bumped to `1.5.0` across all five sources checked by `scripts/check-version.mjs` |
| P18-21 | `v1.5.0` tag pushed; `verify-version` passes and both platform builds upload signed artifacts to a draft release |
| P18-22 | A post-build job sets the draft's body to release notes covering every change since the previous tag, keeping draft status |
| P18-23 | Notes are composed by `scripts/release-notes.mjs`: GitHub's generated body when it carries entries, otherwise `git log --no-merges` subjects, always retaining the installer line and the `Full Changelog` link (F-3) |
| P18-24 | A failure in the notes job leaves the draft release and its artifacts intact |

**Coverage:** 24 specified, 1 retired at design time (P18-04) → **23 live**, 23 mapped to components in `design.md`, 0 mapped to tasks (Tasks phase pending).

---

## Spec Amendments (from `design.md`, 2026-09-11)

| Requirement | Change | Reason |
| --- | --- | --- |
| P18-02 | Restated | DD-1 — with `Apresentar` promoted out of the shared bar and P18-04 retired, Home's `OverlayActionBar` instance would render a bordered band containing no buttons, violating P18-09. Home builds its own header row instead, and the bar becomes the presentation layout's alone. |
| P18-04 | Retired | DD-2 — traced as unreachable: `exit_presentation` sets `pres.overlay = None` in the same critical section as `mode = Idle` (`src-tauri/src/commands/window.rs:520-540`); after P18-01 the only `setMediaOverlay`/`setAnnouncementOverlay` call sites are in `OperatorPresentationLayout`; and `OperatorApp.tsx:433` keeps Home unmounted while any output presents. Keeping the button would add exactly the dead-code class F-2 retires. |

Also note **DD-9**, an open verification point rather than a decision: whether `gh release edit <tag>`
resolves a *draft* release by tag name is unverified (`gh` is not installed in the dev environment).
The fallback — resolve the release id via `gh api` and `PATCH` the body — is documented in
`design.md`; the implementation task must confirm which path works on the first real tag push.

---

## Locale Impact

Both `src/i18n/locales/pt-BR.json` and `src/i18n/locales/en-US.json` must stay at parity (there is
a locale-parity test).

- **Reused unchanged:** `sets.picker.label`, `sets.picker.create`, `sets.picker.rename`,
  `sets.picker.delete`, `sets.picker.deleteWithPlays`, `sets.picker.lastSetHint`,
  `sets.namePlaceholder`, `sets.cancelButton`, `sets.delete.confirm`, `sets.item`,
  `presentation.action.present`, `home.overlay.closeOverlay`.
- **New:** a title for the manage modal (e.g. `sets.manage.title` → "Gerenciar conjuntos"), its
  open-button `aria-label`/tooltip, and a close `aria-label`.
- **Possibly orphaned:** `sets.picker.switch` ("Trocar conjunto") becomes the select's accessible
  label or is removed. `home.overlay.image`, `home.overlay.aviso`, `home.overlay.pdf`,
  `home.overlay.pdfTooltip` are **still used** by the presentation layout — do not delete them.

---

## Test Impact

| File | Impact |
| --- | --- |
| `src/components/setbuilder/SetPicker.test.tsx` | Rewritten for the select + modal; the `disabled` test (`:183`) is removed with F-2 |
| `src/components/setbuilder/HomeSetBuilder.test.tsx` | Assertions for the three removed buttons and for the retained `Apresentar` behaviour |
| `src/components/presentation/OverlayActionBar.test.tsx` | New cases: each of the three buttons is absent when its handler prop is omitted |
| `src/components/presentation/OperatorPresentationLayout.test.tsx` | Regression guard: the live layout still renders all five buttons |
| `scripts/release-workflow.test.mjs` | New cases for the notes job: runs after `build`, checks out with `fetch-depth: 0`, keeps the release a draft, and does not fail the workflow on error |
| `scripts/release-notes.test.mjs` | **New.** Unit tests for the pure composition function: GitHub body with entries passes through; empty body falls back to the commit list; installer line and compare link always present |
| `docs/release.md` | Documents the notes step |

**Gates (all four must be green, per project convention):** `npx vitest run`,
`cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --all-targets -D warnings`,
`tsc --noEmit`. Baseline to beat: 736 Vitest (1 skipped), 372 Rust (1 ignored).

**Note:** this phase is frontend + CI only. No Rust, no migration, no IPC contract change — the
existing `createSet` / `updateSet` / `deleteSet` / `getSetPlayCount` / `listSets` commands cover it.

---

## User Decisions

| ID | Decision |
| --- | --- |
| D-80 | **No "main set" concept.** `ui.active_set_id` already persists the operator's selection and restores it at launch (CS-3); a second launch-selection source would only compete with it. |
| D-81 | **Select + gear → modal.** Switching is a native select in the header; create/rename/delete live in a `Gerenciar conjuntos` dialog behind a gear icon. Chosen over an in-dropdown manage panel for the room it gives the management UI, and over moving management to Settings for keeping the flow on Home. |
| D-82 | **No drag-to-set-main, no drag-to-reorder.** Dropped as a consequence of D-80 — it was only ever the mechanism for marking a main set. |
| D-83 | **GitHub auto-generated notes**, fetched from `POST /repos/{owner}/{repo}/releases/generate-notes` and applied with `gh release edit --notes-file`. **Amended at spec time** by F-3: because this repo commits directly to `main` and GitHub's generator lists pull requests, the notes fall back to `git log --no-merges` subjects whenever the generated body carries no entries. |

---

## Success Criteria

- [ ] Home's header contains exactly two controls plus one primary button; `Apresentar` is the
      largest element on it.
- [ ] Home renders one header band instead of two, and the set contents start higher on the page.
- [ ] Every capability removed from Home is reachable: overlays and mid-service imports from the
      presentation layout, PPTX/PDF from `SetBuilder`, set management from the gear.
- [ ] Deleting the active set no longer strands Home on a dangling id (F-1).
- [ ] All four gates green, with new tests covering the removed buttons, the modal, and the notes
      composer.
- [ ] The `v1.5.0` draft release lists this phase's commits without anyone typing them.
