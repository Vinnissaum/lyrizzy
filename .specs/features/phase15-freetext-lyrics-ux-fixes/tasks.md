# Phase 15 Tasks — Free-Text Lyrics Editor, Live-Edit Refresh & Operator UX Fixes

**Spec**: `.specs/features/phase15-freetext-lyrics-ux-fixes/spec.md` (P15-01..P15-22)
**Design**: `.specs/features/phase15-freetext-lyrics-ux-fixes/design.md` (DD-1..DD-8)
**Status**: Complete — all 18 tasks (T1–T18) implemented 2026-08-11 via parallel/sequential sub-agents in dependency batches (Batch 1: T1,T2,T3,T4,T5,T12,T13,T15,T16; Batch 2: T6,T7,T8,T9,T10,T11; then T14; then T17→T18). One consolidated fix commit (`7552032`) was needed between Batch 2 and T14 to repair test-mock gaps in `SettingsScreen.test.tsx`/`OperatorPresentationLayout.test.tsx` left by concurrent tasks switching monitor data to selector-based store reads — see STATE D-74. Final gate: 335 Rust tests (1 ignored), 599 Vitest tests, `tsc --noEmit` clean, `cargo clippy -D warnings` clean.
**Date**: 2026-08-11

18 tasks across six slices. The slices are file-disjoint except where called out under **Cross-slice file contention** below.

**Baseline measured at planning time (2026-08-11, both suites run fresh):** **546 Vitest tests / 73 files** and **327 Rust tests passing** (280 lib + 47 integration across 6 test binaries; 1 additional test is `#[ignore]`d). Both green. Every `Test count` below is stated against this baseline.

---

## Design Refinements Discovered While Planning

Four points where the task breakdown corrects or extends `design.md`. Each was verified against the code during planning.

| # | design.md said | Tasks do | Why |
|---|---|---|---|
| R-1 | `SectionCard.tsx` is deleted "(+ its test)", and the Vitest baseline absorbs "an expected, accounted-for reduction" | Delete `SectionCard.tsx` only; **no test file exists** and there is **no baseline reduction** | `ls src/components/library/` shows no `SectionCard.test.tsx`, and no test file references `SectionCard`. The 546 baseline must therefore **not** drop. `SongEditor.tsx:24,596` is the sole consumer (grep confirmed), so the delete is still safe. |
| R-2 | Test Plan lists `MicAudioSettings` under "**existing** Vitest component test" | T11 **creates** `src/components/settings/MicAudioSettings.test.tsx` | The file does not exist. Same for `OperatorNotesPanel.test.tsx` (T15). Both are new files, so their tests are net additions, not rewrites. |
| R-3 | Test Plan routes `outputScreenName` and `lyricsText` to Vitest unit tests | Same — but note **TESTING.md's coverage matrix has no `src/utils/*.ts` row** | Five util test files already exist (`monitorNames`, `slidePreview`, `streamProfile`, `outputDispatch`, `audioDevices`), so the *precedent* is unit-tested utils. The matrix is stale, not the plan. Worth adding a `src/utils/*.ts → unit` row to TESTING.md during wrap-up (T18). |
| R-4 | P15-18 AC-3 ("legacy `repeat_count > 1` still honoured") reads as new work | Already pinned by an **existing** test — `slide_splitter.rs:145 repeat_count_duplicates_slides` | The Settings control is UI-only (DD-8); the backend path is untouched and already covered. T12 must assert that test still passes rather than write a new one. |

---

## Execution Plan

### Slice 15A — Live edit reaches the strophes list

```
T1  (Rust: with_full_slides + call site)   [independent]
T2  (regression pins, frontend, test-only) [independent]
```

### Slice 15B — Slide anchoring by content

```
T3  (Rust: SlideAnchor rebase)             [independent]
```

### Slice 15C — Monitor names, everywhere and immediately

```
T4 ──┬────────────────→ T6
     ├────────────────→ T7  [P]
     └────────────────→ T8  [P]
     │
T5 ──┤
  T4+T5 ──┬──────────→ T9  [P]
          ├──────────→ T10 [P]
          └──────────→ T11 [P]
```

### Slice 15D — Settings labels

```
T12 (Aviso label + Repetições removal)     [independent]
```

### Slice 15E — Free-text lyrics editor

```
T13 ──→ T14
T15 (notes panel)                          [independent]
```

### Slice 15F — Icon

```
T16                                        [independent]
```

### Wrap-up

```
T1..T16 ──→ T17 ──→ T18
```

**Cross-slice file contention — do NOT run these as concurrent sub-agents:**

| Shared file | Tasks | Note |
|---|---|---|
| `src/i18n/locales/{pt-BR,en-US}.json` | **T12** and **T14** | L-9: concurrent locale edits race. Serialize them (either order). T11 must also be checked — if it needs a new key, it joins this group. |
| `src-tauri/` cargo target lock | T1, T3 | Not a correctness hazard (cargo serializes), but two concurrent `cargo test` runs block each other — expect wall-clock, not failure. |

Everything else is file-disjoint.

---

## Task Breakdown

## Slice 15A — Live Edit Reaches the Strophes List

### T1: `with_full_slides` payload helper + `refresh_song_in_outputs` call site

**What**: Add the pure emit-payload builder in `domain/` and switch the live-edit emit to use it, so `state_changed` carries the regenerated slides while the stored state stays slim.
**Where**: `src-tauri/src/domain/presentation.rs` (add fn + `#[cfg(test)]` cases), `src-tauri/src/commands/presentation.rs` (call site — the `pres.clone()` at the end of the `snapshot` block, ~line 544)
**Depends on**: None
**Reuses**: `PresentationState` (`domain/presentation.rs:36`); the existing `presentation_slides` read → `presentation` write lock scope in `refresh_song_in_outputs` — **unchanged**
**Requirement**: P15-01, P15-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `pub fn with_full_slides(state: &PresentationState, all: &[Vec<Slide>]) -> PresentationState` added to `domain/presentation.rs`, returning a clone whose `all_slides_per_item` is `all.to_vec()`
- [ ] `refresh_song_in_outputs` returns `with_full_slides(&pres, &all)` instead of `pres.clone()`, **inside** the existing guard scope; `emit_state` is still called after both guards drop (CONCERN-7 lock ordering untouched)
- [ ] No new lock, no change to lock order, no change to `emit_state`'s signature
- [ ] Unit test: the returned payload carries every slide of every item
- [ ] Unit test: the **input** `PresentationState` is unmodified — `state.all_slides_per_item` is still empty after the call (this is P15-02 as an assertion, per DD-2)
- [ ] Unit test: an empty `all` yields an empty `all_slides_per_item` (no panic on an item-less set)
- [ ] Unit test: every other field (mode, frozen_at, overlay, current_slide, item_slide_counts) is copied through untouched
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: 327 baseline + ≥4 new = ≥331 pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml with_full_slides` — all new cases green; `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` clean.

**Commit**: `feat(presentation): emit full slides on live-edit refresh`

---

### T2: Regression pins for the strophes-grid refresh

**What**: Pin the two frontend behaviours P15-03 depends on — `reconcileSlides` taking a non-empty incoming list verbatim, and `StrophesGrid` rendering from the store's `allSlidesPerItem`.
**Where**: `src/stores/presentation.test.ts` (modify), `src/components/presentation/StrophesGrid.test.tsx` (modify)
**Depends on**: None (test-only; `reconcileSlides` needs no code change per design § 15A)
**Reuses**: existing `reconcileSlides` (`stores/presentation.ts:23-32`) — **do not modify it**; existing StrophesGrid test harness
**Requirement**: P15-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Test: same set id + **non-empty** incoming `allSlidesPerItem` → incoming is taken verbatim (previous copy discarded), covering a longer list (strophe added), a shorter list (strophe removed) and a reordered list
- [ ] Test: same set id + **empty** incoming `allSlidesPerItem` → previous copy is carried forward (existing behaviour, still pinned)
- [ ] Test: `StrophesGrid` re-renders its cards when the store's `allSlidesPerItem` for the active item changes, and the active card keeps `aria-current`
- [ ] No production file is modified by this task
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 546 baseline + ≥4 new = ≥550 pass (no silent deletions)

**Tests**: unit + component (test-only task)
**Gate**: quick

**Verify**: `npx vitest run src/stores/presentation.test.ts src/components/presentation/StrophesGrid.test.tsx` — green.

**Commit**: `test(presentation): pin slide reconciliation and grid refresh`

---

## Slice 15B — Slide Anchoring by Content

### T3: Rebase `SlideAnchor` on slide content (DD-1)

**What**: Change the anchor's matching basis from `section_id` to a slide-content key, keeping the struct shape, function signatures and fallback chain intact.
**Where**: `src-tauri/src/domain/slide.rs` (modify, incl. its `#[cfg(test)]` block)
**Depends on**: None
**Reuses**: the existing `anchor_of` / `resolve_anchor` shape and fallback chain (`domain/slide.rs:45-92`) — only the matching basis changes
**Requirement**: P15-19

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `SlideAnchor { key: String, ordinal: usize }` replaces `{ section_id, ordinal }`; doc comment states key = each line trimmed, joined with `\n`
- [ ] `anchor_of` builds `key` from `slide.lines`, and `ordinal` = count of preceding slides in the item sharing that key
- [ ] `resolve_anchor` matches on `key`; fallback chain **unchanged**: exact `(key, ordinal)` → last slide with `key` → `old_index` clamped → `0`
- [ ] `commands/presentation.rs` compiles with **no call-site edit** (verified at planning: no external `SlideAnchor` field access exists)
- [ ] Existing anchor tests rewritten to the content basis (none deleted outright — each keeps its scenario)
- [ ] New test: a strophe **inserted above** the current position → the same strophe is returned, shifted by the insert (P15-19 AC-2)
- [ ] New test: a strophe **deleted above** the current position → the same strophe is returned, shifted back
- [ ] New test: the **current slide's own text edited** → falls through to the clamped `old_index`, which is correct because the slide count is unchanged (P15-19 AC-3, never blanks)
- [ ] New test: two identical strophes (`RepeatMode::Duplicate`, same key) are disambiguated by ordinal
- [ ] New test: content-less sentinel slides (`Slide::pseudo`, `lines: []` → key `""`) still resolve by ordinal
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: 327 baseline + ≥5 new = ≥332 pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml anchor` — every case green, including the three new insert/delete/edit scenarios.

**Commit**: `fix(presentation): anchor live-edit position on slide content`

---

## Slice 15C — Monitor Names, Everywhere and Immediately

### T4: Monitor-setup store slice

**What**: Add the single source of truth for the monitor list, operator-chosen names and per-output monitor assignment to the settings store.
**Where**: `src/stores/settings.ts` (modify), `src/stores/settings.test.ts` (modify)
**Depends on**: None
**Reuses**: `loadOutputAudio` / `setOutputAudio` / `applyOutputAudioSetting` as the structural template (`stores/settings.ts:410-433`); `loadMonitorNames`'s malformed-row tolerance (`utils/monitorNames.ts:49`); `PRESENTATION_MONITOR_KEY` / `OUTPUT2_MONITOR_KEY` from `api/commands`
**Requirement**: P15-04, P15-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] State added: `monitors: MonitorInfo[]`, `monitorNames: MonitorNameMap`, `outputMonitorIndex: Record<OutputId, number | null>` with empty/`null` defaults
- [ ] `loadMonitorSetup(): Promise<void>` loads all three concurrently (`listMonitors`, `loadMonitorNames`, both monitor-index settings), each degrading to its default on rejection
- [ ] `setMonitorName(identity, name): Promise<void>` merges into the **store** map optimistically, then persists the whole map via `setSetting(MONITOR_NAMES_KEY, ...)` — preserving names for monitors not currently detected
- [ ] `applyMonitorSetting(key, value)` applies a `setting_changed` payload for `display.monitor_names`, `PRESENTATION_MONITOR_KEY` and `OUTPUT2_MONITOR_KEY`; any other key is a no-op returning the same state
- [ ] Test: `loadMonitorSetup` happy path populates all three fields
- [ ] Test: `listMonitors` rejecting leaves `monitors: []` and does not throw (P15-06)
- [ ] Test: a malformed/missing `display.monitor_names` row resolves to `{}` and does not throw (P15-06)
- [ ] Test: `setMonitorName` keeps pre-existing entries for undetected monitors and persists the merged map
- [ ] Test: `applyMonitorSetting` updates names for the names key, parses `"auto"`/non-numeric index values to `null`, and no-ops on an unrelated key
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 546 baseline + ≥6 new = ≥552 pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `npx vitest run src/stores/settings.test.ts` — green, ≥28 tests in the file (22 existing + ≥6).

**Commit**: `feat(settings): monitor setup store slice`

---

### T5: `outputScreenName` resolver [P]

**What**: One helper that turns an output's assigned monitor index into a display name, replacing the duplicated logic in the switcher and the launch provider.
**Where**: `src/utils/monitorNames.ts` (modify), `src/utils/monitorNames.test.ts` (modify)
**Depends on**: None
**Reuses**: `resolveMonitorName` (`utils/monitorNames.ts:33`) — **do not modify it**
**Requirement**: P15-05, P15-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `outputScreenName(monitors, names, index, fallback): string` exported — returns `resolveMonitorName(m, index, names)` when `index` addresses a real monitor, else `fallback`
- [ ] Test: `index === null` → `fallback`
- [ ] Test: `index` out of range (monitor unplugged) → `fallback`, no throw
- [ ] Test: valid index with an operator-chosen name → that name
- [ ] Test: valid index with no chosen name → OS name, then `Monitor N — W×H` when the OS name is blank (fallback chain intact, P15-06)
- [ ] Existing `monitorNames.test.ts` cases untouched and still green
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 546 baseline + ≥4 new = ≥550 pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `npx vitest run src/utils/monitorNames.test.ts` — ≥15 tests in the file (11 existing + ≥4).

**Commit**: `feat(monitors): outputScreenName resolver`

---

### T6: Operator boot load + `setting_changed` invalidation

**What**: Load the monitor setup once at operator boot and re-apply it whenever a monitor-setup setting changes, so no consumer needs its own fetch.
**Where**: `src/windows/operator/OperatorApp.tsx` (modify, ~lines 180-186), `src/windows/operator/OperatorApp.test.tsx` (modify)
**Depends on**: T4
**Reuses**: the existing `onSettingChanged` listener and its `presentation.*` / `announcement.*` branch (`OperatorApp.tsx:180-184`); the boot-time `loadPresentationSettings()` call as the placement precedent (DD-3)
**Requirement**: P15-04, P15-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `loadMonitorSetup()` is called once at operator boot, alongside `loadPresentationSettings()`
- [ ] The `onSettingChanged` handler routes `display.monitor_names`, `presentation.monitor_index` and `output2.monitor_index` to `applyMonitorSetting(key, value)` — the existing `presentation.*` prefix branch must not swallow `presentation.monitor_index` into a full `loadPresentationSettings()` reload (check the branch order)
- [ ] No new listener, no polling, no extra IPC round-trip per consumer
- [ ] Test: boot invokes the monitor-setup load
- [ ] Test: a `setting_changed` event for `display.monitor_names` reaches the store and the new name is observable in store state
- [ ] Existing `OperatorApp.test.tsx` (15 tests) and `OperatorApp.smoke.test.tsx` stay green
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 546 baseline + ≥2 new = ≥548 pass (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/windows/operator/` — green.

**Commit**: `feat(operator): load and invalidate monitor setup from the store`

---

### T7: `MonitorNameSettings` reads and writes the store [P]

**What**: Replace the component's two local `useState` caches and its direct `saveMonitorName` call with the store slice.
**Where**: `src/components/settings/MonitorNameSettings.tsx` (modify), `src/components/settings/MonitorNameSettings.test.tsx` (modify)
**Depends on**: T4
**Reuses**: `monitorIdentity` / `resolveMonitorName` (unchanged); store `monitors`, `monitorNames`, `setMonitorName`
**Requirement**: P15-05, P15-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] The `useEffect` that calls `listMonitors()` + `loadMonitorNames()` is removed; both come from the store
- [ ] `onChange` calls the store's `setMonitorName`; the direct `saveMonitorName` import is gone from this file
- [ ] Rows still render resolution and the placeholder fallback name per monitor
- [ ] Test: rows render from store state (no `listMonitors` invoke from this component)
- [ ] Test: typing a name calls `setMonitorName` with the monitor's identity key
- [ ] Test: clearing a name makes the row's placeholder fall back through OS name → `Monitor N — W×H` (P15-06)
- [ ] Existing 3 tests in the file are updated, not deleted
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 546 baseline + ≥1 net new = ≥547 pass (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/settings/MonitorNameSettings.test.tsx` — green.

**Commit**: `refactor(settings): monitor name editor reads the store`

---

### T8: `MonitorPicker` reads the store [P]

**What**: Drop the component's monitor/name fetches in favour of the store slice, keeping its own `settingKey` value fetch.
**Where**: `src/components/settings/MonitorPicker.tsx` (modify), `src/components/settings/MonitorPicker.test.tsx` (modify)
**Depends on**: T4
**Reuses**: `resolveMonitorName` (unchanged); store `monitors`, `monitorNames`
**Requirement**: P15-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `listMonitors()` and `loadMonitorNames()` are no longer called from this component; `monitors`/`monitorNames` come from the store
- [ ] The `getSetting(settingKey)` / `setSetting(settingKey, v)` behaviour is unchanged (this picker still owns its own value)
- [ ] Test: options render the store-resolved names
- [ ] Test: a store name change is reflected in the option labels without remounting (P15-05)
- [ ] Existing 3 tests updated, not deleted
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 546 baseline + ≥1 net new = ≥547 pass (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/settings/MonitorPicker.test.tsx` — green.

**Commit**: `refactor(settings): monitor picker reads the store`

---

### T9: `OutputSwitcher` uses the store + `outputScreenName` [P]

**What**: Replace the switcher's three local caches and its private `labelFor` logic with the store slice and the shared resolver.
**Where**: `src/components/presentation/OutputSwitcher.tsx` (modify, `:46-77`), `src/components/presentation/OutputSwitcher.test.tsx` (modify)
**Depends on**: T4, T5
**Reuses**: `outputScreenName` (T5); store `monitors`, `monitorNames`, `outputMonitorIndex`
**Requirement**: P15-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] The mount-time `useEffect` fetching monitors / names / both monitor-index settings is removed
- [ ] `labelFor` delegates to `outputScreenName(..., t("presentation.output.tela", { n: i + 1 }))` — the duplicated resolve/fallback block is gone
- [ ] Mirror toggle, focus behaviour and `onRequestLaunch` are untouched
- [ ] Test: tabs show the resolved monitor names
- [ ] Test: an unassigned output falls back to the `Tela N` label
- [ ] Test: a store name change updates the tab label with no remount (P15-05)
- [ ] Existing 9 tests updated as needed, none deleted
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 546 baseline + ≥2 net new = ≥548 pass (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/presentation/OutputSwitcher.test.tsx` — green.

**Commit**: `refactor(presentation): output switcher names come from the store`

---

### T10: `PresentationLaunchProvider` uses the store + `outputScreenName` [P]

**What**: Remove the boot-once name cache that is the direct cause of RC-2 and resolve screen names from the store on every render.
**Where**: `src/components/presentation/PresentationLaunchProvider.tsx` (modify, `:45-74`), `src/components/presentation/PresentationLaunchProvider.test.tsx` (modify)
**Depends on**: T4, T5
**Reuses**: `outputScreenName` (T5); store `monitors`, `monitorNames`, `outputMonitorIndex`
**Requirement**: P15-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] The `useEffect` + `screenNames` `useState` + `cancelled` guard are removed; names are derived from store state (this provider mounts once for the app's lifetime — RC-2's root cause)
- [ ] `requestPresentation`, `resolveLaunchPlan` and `startPresentationPlan` behaviour is unchanged
- [ ] Test: the launch modal shows the resolved monitor names
- [ ] Test: renaming a monitor in the store changes the modal's names **without remounting the provider** (this is the RC-2 regression pin)
- [ ] Test: unassigned outputs fall back to `Tela N`
- [ ] Existing 5 tests updated as needed, none deleted
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 546 baseline + ≥2 net new = ≥548 pass (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/presentation/PresentationLaunchProvider.test.tsx` — green, including the no-remount rename case.

**Commit**: `fix(presentation): launch modal screen names update without restart`

---

### T11: `MicAudioSettings` names its screens [P]

**What**: Title each per-output audio block with its resolved monitor name alongside the `Tela N` label.
**Where**: `src/components/settings/MicAudioSettings.tsx` (modify, `:73-77`), `src/components/settings/MicAudioSettings.test.tsx` (**new**)
**Depends on**: T4, T5
**Reuses**: `outputScreenName` (T5); store `monitors`, `monitorNames`, `outputMonitorIndex`; the existing `audio` store slice this component already consumes
**Requirement**: P15-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] The `<h4>` heading shows the resolved monitor name alongside `t("presentation.output.tela", { n: i + 1 })` when the output has an assigned monitor
- [ ] With no assigned monitor, the heading is the plain `Tela N` label used today (P15-07 AC-2)
- [ ] If a new locale key is needed for the combined heading, it is added to **both** `pt-BR` and `en-US` (see the contention note — serialize with T12/T14)
- [ ] New test file created with: name shown when assigned, plain label when unassigned, heading updates on a store rename (P15-07 AC-3)
- [ ] Mic/camera/delay/device controls are untouched
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 546 baseline + ≥3 new = ≥549 pass (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/settings/MicAudioSettings.test.tsx src/i18n/locales.test.ts` — green (locale parity included).

**Commit**: `feat(settings): audio blocks name their screen`

---

## Slice 15D — Settings Labels

### T12: Aviso font-size label + Repetições removal

**What**: Give the Aviso tab an announcement-scoped text-size label and delete the global repeat-mode control from the Projeção tab.
**Where**: `src/components/settings/SettingsScreen.tsx` (modify, `:205,341,385`), `src/i18n/locales/pt-BR.json`, `src/i18n/locales/en-US.json`, `src/components/settings/SettingsScreen.test.tsx` (modify)
**Depends on**: None
**Reuses**: the existing `settings.announcement.*` locale block (`pt-BR.json:737`) as the home for the new key
**Requirement**: P15-08, P15-18

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] The Aviso tab's font-size control uses a new announcement-scoped key (e.g. `settings.announcement.fontSize`), not `settings.windows.fontSize`
- [ ] `pt-BR` reads "Tamanho do texto do aviso"; `en-US` reads "Announcement text size"
- [ ] The Projeção tab's font-size control keeps `settings.windows.fontSize` and its existing song wording (P15-08 AC-2)
- [ ] The `settings.appearance.repeatMode` control and the `repeatModeLabel` helper are removed from `SettingsScreen.tsx`
- [ ] The now-unused `settings.appearance.repeatMode` / `repeatModes.*` keys are removed from **both** locale files, keeping parity
- [ ] `useSettingsStore.presentationRepeatMode` and the backend read stay (DD-8) — `SongPreviewPane` still receives `repeatMode`
- [ ] Existing `slide_splitter.rs:145 repeat_count_duplicates_slides` still passes, unmodified — this is P15-18 AC-3's proof (R-4); no new Rust test needed
- [ ] Test: Aviso tab renders the announcement-scoped label; Projeção tab renders the song label
- [ ] Test: no "Repetições" control is present on the Projeção tab
- [ ] `src/i18n/locales.test.ts` green (locale parity)
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`
- [ ] Test count: 546 Vitest baseline + ≥2 new = ≥548, and 327 Rust baseline unchanged (no silent deletions)

**Tests**: component
**Gate**: full

**Verify**: `npx vitest run src/components/settings/SettingsScreen.test.tsx src/i18n/locales.test.ts` and `cargo test --manifest-path src-tauri/Cargo.toml repeat` — all green.

**Commit**: `fix(settings): label announcement text size and retire the repeat control`

---

## Slice 15E — Free-Text Lyrics Editor

### T13: `lyricsText` pure functions

**What**: The whole section model reduced to three pure functions with an exact round-trip contract.
**Where**: `src/utils/lyricsText.ts` (**new**), `src/utils/lyricsText.test.ts` (**new**)
**Depends on**: None
**Reuses**: nothing — deliberately independent of `parse_plain_text` (D-69, DD-6). `splitSectionBody` (`utils/slidePreview.ts`) stays the *within-strophe* splitter and is not touched
**Requirement**: P15-12, P15-13, P15-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `lyricsToBlocks(text): string[]` splits on runs of blank (whitespace-only) lines, trims each block, drops empties
- [ ] `blocksToSectionPayloads(blocks)` returns `{ label: "", type: "verse", body, sortOrder: i, repeatCount: 1 }` per block (DD-5, P15-18 AC-1)
- [ ] `sectionsToLyrics(sections)` joins trimmed bodies with `\n\n`
- [ ] No `[Label]` bracket handling anywhere in this file (D-69)
- [ ] Test: a single newline stays a line break **inside** one block; a blank line starts a new block (P15-12)
- [ ] Test: two or more consecutive blank lines produce exactly one boundary and no empty section (P15-13, spec edge case)
- [ ] Test: leading/trailing blank lines are trimmed and produce no empty sections (spec edge case)
- [ ] Test: whitespace-only lines count as blank for boundary purposes (spec edge case)
- [ ] Test: empty / whitespace-only input → `[]`
- [ ] Test: round-trip — `sectionsToLyrics(blocksToSectionPayloads(lyricsToBlocks(t)))` equals `lyricsToBlocks(t).join("\n\n")`, and is **stable** when fed back through (P15-14)
- [ ] Test: a legacy section body containing its own blank line splits into two blocks on the next save (spec edge case — a visible normalisation, not data loss)
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 546 baseline + ≥7 new = ≥553 pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `npx vitest run src/utils/lyricsText.test.ts` — ≥7 tests green.

**Commit**: `feat(editor): lyrics text to derived sections`

---

### T14: `SongEditor` becomes one lyrics box

**What**: Replace the section-card list, the drag machinery and the paste dialog with a single lyrics textarea that derives sections on save; delete `SectionCard.tsx`.
**Where**: `src/components/library/SongEditor.tsx` (modify), `src/components/library/SectionCard.tsx` (**delete**), `src/components/library/SongEditor.test.tsx` (rewrite), `src/i18n/locales/{pt-BR,en-US}.json` (modify)
**Depends on**: T13
**Reuses**: `lyricsToBlocks` / `blocksToSectionPayloads` / `sectionsToLyrics` (T13); `SongPreviewPane` with **unchanged props** (`sections: { body }[]`, `repeatCounts: number[]`); `ConfirmDialog`; the existing title/artist/language/background/casing/rights/delete/toast code — all untouched
**Requirement**: P15-11, P15-13, P15-14, P15-15, P15-16, P15-17, P15-18 (editor half), P15-20 (editor half)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] State `sections: SectionDraft[]` → `lyrics: string`; one `<textarea>` with generous `rows` and `resize-y`, sized so several strophes are visible without scrolling (P15-11 AC-1)
- [ ] Load: `setLyrics(sectionsToLyrics(song.sections))` in stored `sortOrder` (spec edge case)
- [ ] Save: `sections: blocksToSectionPayloads(lyricsToBlocks(lyrics))`
- [ ] Validate: `lyricsToBlocks(lyrics).length > 0`, reusing the existing `editor.validation.bodyRequired` message; `isValid` updated to match (P15-11 AC-5)
- [ ] Preview: `sections={blocks.map(b => ({ body: b }))}`, `repeatCounts={blocks.map(() => 1)}` — pane updates as typed (P15-16)
- [ ] Notes textarea `rows={2}` → `rows={6}` (P15-20 AC-1)
- [ ] **Removed:** `DndContext`/`SortableContext`, `handleDragEnd`, `addSection`, `removeSection`, `updateSection`, `newSection`, `nextDndId`/`dndCounter`, `applyPaste`, `showPaste`/`pasteText`/`pasteBusy`, the paste modal, the sensors, the `parsePlainTextImport` import, and every `@dnd-kit` import **from this file** (P15-15)
- [ ] `@dnd-kit` stays a project dependency — `SetBuilder` still uses it for set-item reorder (D-39). Do not uninstall it.
- [ ] `src/components/library/SectionCard.tsx` deleted; grep for `SectionCard` returns zero hits (it has **no test file** — R-1; the Vitest baseline must not drop)
- [ ] `PlainTextImport.tsx`'s `parsePlainTextImport` usage is untouched (D-69, out of scope)
- [ ] Locale: a lyrics-box placeholder key added to both locales; the now-unused `editor.paste.*`, `editor.sections`, `editor.addSection` keys removed from both, keeping parity
- [ ] Test rewrite: no label field, no type dropdown, no repeat counter, no notes toggle, no drag handle, no add/remove-section button, no "Colar letra completa" button, no paste dialog (P15-15)
- [ ] Test: save of a 4-strophe paste produces 4 sections with `label: ""`, `type: "verse"`, `repeatCount: 1` and ascending `sortOrder` (P15-13, P15-18 AC-1)
- [ ] Test: load → save round-trip of a multi-strophe song reproduces the text exactly (P15-14)
- [ ] Test: empty lyrics blocks save with the existing validation message
- [ ] Existing title / create / update / delete / preview tests kept (adapted to the new placeholder); the obsolete "reorders sections" test is **replaced** by the round-trip test, not dropped
- [ ] `LiveSongEditModal.test.tsx` still green with **no change to `LiveSongEditModal.tsx`** (P15-17 AC-3)
- [ ] `src/i18n/locales.test.ts` green
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: ≥546 pass — the file's own count must not fall below its current 8 (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/library/ src/components/presentation/LiveSongEditModal.test.tsx src/i18n/locales.test.ts` — green; `npx tsc --noEmit` clean.

**Commit**: `feat(editor): single free-text lyrics box replaces section cards`

---

### T15: Operator Notes panel shows song-level notes [P]

**What**: Repoint `useCurrentNotes` from per-section notes to the song's own notes, leaving non-song items alone.
**Where**: `src/components/presentation/OperatorNotesPanel.tsx` (modify, `:8-28`), `src/components/presentation/OperatorNotesPanel.test.tsx` (**new**)
**Depends on**: None
**Reuses**: `usePresentationStore` / `useLibraryStore` lookups already in the hook
**Requirement**: P15-20, P15-21

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] For `itemType === "song"`, the hook returns `song.notes ?? null`; the `song.sections.find(...)` lookup and the `state.currentSlide.sectionId` dependency are removed
- [ ] Non-song items still return `item.notes` (P15-21)
- [ ] New test file with: song notes shown on every strophe of that song; panel hidden when the song has no notes (P15-20 AC-3); non-song item notes unchanged (P15-21); a legacy song carrying **section** notes but no song notes shows nothing (P15-20 AC-5)
- [ ] Collapse/expand behaviour and `notesPanelCollapsed` persistence untouched
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 546 baseline + ≥4 new = ≥550 pass (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/presentation/OperatorNotesPanel.test.tsx` — 4 tests green.

**Commit**: `feat(presentation): notes panel shows song-level notes`

---

## Slice 15F — Icon

### T16: Triquetra-with-noteheads app icon [P]

**What**: Author the new mark as one SVG and regenerate every raster from it.
**Where**: `src-tauri/icons/icon.svg` (rewrite), all generated `src-tauri/icons/*` rasters, `public/icons/{icon.ico,128x128.png,32x32.png}`
**Depends on**: None
**Reuses**: the existing palette read from the current source — radial gradient `#34365c` → `#1c1d30` → `#0f0f18` on an `rx=90` rounded square in a `512×512` viewBox, mark in `#7C74F5`; the Phase 14D `npx tauri icon` pipeline (D-64 probe findings: SVG input accepted, transparency preserved, `public/icons/` **not** written by the CLI)
**Requirement**: P15-09, P15-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `icon.svg` draws one vesica-shaped lobe path instantiated three times at `rotate(0|120|240)` about the canvas centre, **stroked** with round caps so the interlace reads, plus three filled circles as noteheads at the lobe tips (D-71)
- [ ] Background rounded square is drawn **in the source** (the CLI preserves transparency; it does not add a background)
- [ ] Full asset set regenerated via `npx tauri icon` — non-zero exit fails the task rather than shipping a mixed set (design § Error Handling)
- [ ] `public/icons/{icon.ico,128x128.png,32x32.png}` synced by hand to match
- [ ] Knot and noteheads both distinguishable in the generated **`32x32.png`** — verify against the raster, not the SVG (P15-09 AC-2)
- [ ] No denomination-specific imagery beyond the Trinity knot (P15-09 AC-5)
- [ ] The D-64 L-as-music-note mark is fully retired — no leftover reference in the source
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run` (no code layer touched; confirms nothing regressed)
- [ ] Test count: 546 Vitest / 327 Rust unchanged

**Tests**: none (asset-only; coverage matrix has no row for icon assets)
**Gate**: build

**Verify**: open `src-tauri/icons/32x32.png` at 100% — the knot's three lobes and the three noteheads are individually legible; `git status` shows the full raster set regenerated.

**Commit**: `feat(brand): triquetra with noteheads app icon`

---

## Wrap-up

### T17: Version bump to 1.2.0

**What**: Write `1.2.0` to all five version sources with the existing script.
**Where**: `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (all via `scripts/bump-version.mjs`)
**Depends on**: T1–T16
**Reuses**: `scripts/bump-version.mjs`, `scripts/check-version.mjs`, `scripts/version-files.mjs` and their existing tests (D-49)
**Requirement**: P15-22

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `node scripts/bump-version.mjs 1.2.0` run; all five sources read `1.2.0`
- [ ] `node scripts/check-version.mjs` exits 0
- [ ] `scripts/version-files.test.mjs`, `scripts/release-workflow.test.mjs`, `scripts/ci-workflow.test.mjs`, `scripts/tauri-config.test.mjs` all green
- [ ] No source file is edited by hand
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`
- [ ] Test count: no reduction from the post-T16 total

**Tests**: none (version metadata; existing script tests are the gate)
**Gate**: build

**Verify**: `node scripts/check-version.mjs && npx vitest run scripts/` — green. The `v1.2.0` tag push and the signed draft release (P15-22 AC-2) are a **manual** post-merge step — see § Manual Verification.

**Commit**: `chore(release): bump version to 1.2.0`

---

### T18: Phase close-out

**What**: Full gate, spec traceability, roadmap/state records.
**Where**: `.specs/features/phase15-freetext-lyrics-ux-fixes/spec.md`, `.specs/project/ROADMAP.md`, `.specs/project/STATE.md`, `.specs/codebase/TESTING.md`, this file
**Depends on**: T1–T17
**Reuses**: the Phase 14 close-out format (STATE § Phase 14 Completion Summary)
**Requirement**: all

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Full gate green **in one pass**: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`, plus `npx tsc --noEmit` and `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` (L-9: run tsc once at the end — concurrent tasks surface nullable-type mismatches no individual gate catches)
- [ ] `src/i18n/locales.test.ts` green
- [ ] No net loss against the 546 Vitest / 327 Rust baselines
- [ ] Spec traceability table: all 22 requirements → Implemented, with task IDs and the coverage line updated from "0 mapped / 22 unmapped"
- [ ] ROADMAP Phase 15 row added
- [ ] STATE: current phase updated, Phase 15 completion summary added, and any decision discovered during implementation recorded as D-74+
- [ ] TESTING.md gains a `src/utils/*.ts → unit` coverage-matrix row (R-3)
- [ ] This file marked Complete with per-task status
- [ ] Manual-verification checklist below carried into STATE

**Tests**: none (documentation)
**Gate**: full

**Verify**: the four gate commands above, all clean.

**Commit**: `docs(phase15): close out free-text lyrics and operator UX fixes`

---

## Manual Verification (hardware / release required — cannot be automated)

1. **P15-03 end to end**: enter presentation, live-edit the projected song to insert a strophe in the middle, save — projector holds position, LIVE preview and strophes grid both refresh, active card still highlighted, **no black frame**
2. **P15-19 end to end**: navigate to strophe 4, insert a new strophe 2, save — the projector still shows the strophe that was 4
3. **P15-19 AC-4**: repeat (1) and (2) with blackout engaged, then with freeze engaged — the mode survives the regeneration
4. **P15-01 multi-output**: edit a song loaded in **both** outputs (mirror on) — both refresh
5. **P15-05 across five surfaces**: rename a monitor in Settings, then check the settings list, Projeção monitor picker, output switcher, Apresentar launch modal and the audio blocks — all show the new name, no restart
6. **P15-06 unplug/replug**: unplug a monitor while Settings is open, replug — the stored name reappears for its identity
7. **P15-09/10**: build and install — taskbar, Start menu, window chrome and both browser tabs show the new mark, legible at the smallest size
8. **P15-22 AC-2**: push the `v1.2.0` tag — `verify-version` CI passes and a **signed draft** release is produced. Per D-51 `latest.json` returns 404 while the release is a draft; that is the intended gate

---

## Pre-Approval Validation

### Check 1 — Task Granularity

| Task | Scope | Status |
|---|---|---|
| T1 | 1 pure fn + its 1-expression call site | ✅ Granular (merged: the helper is dead code without the call site, and the call site is untestable without the helper — tasks.md § Resolving compilation dependencies, merge-backward) |
| T2 | 2 test files, 1 requirement, no production code | ✅ Granular |
| T3 | 1 struct + 2 fns in 1 file | ✅ Granular |
| T4 | 1 store slice (3 actions, 1 file) | ✅ Granular |
| T5 | 1 function | ✅ Granular |
| T6 | 1 wiring change in 1 file | ✅ Granular |
| T7–T11 | 1 component each | ✅ Granular |
| T12 | 1 screen, 2 controls, same file + locales | ✅ Granular (cohesive: both are Settings-tab label corrections in one file; splitting would put two tasks in the same file **and** the same locale JSONs — a guaranteed L-9 race) |
| T13 | 3 pure fns, 1 new file | ✅ Granular |
| T14 | 1 component rewrite + delete its only child | ✅ Granular (the delete is a consequence, not a second deliverable) |
| T15 | 1 hook in 1 component | ✅ Granular |
| T16 | 1 asset pipeline | ✅ Granular |
| T17 | 1 script invocation | ✅ Granular |
| T18 | close-out | ✅ Granular |

### Check 2 — Diagram / Definition Cross-Check

| Task | Depends on (body) | Diagram shows | Status |
|---|---|---|---|
| T1 | None | independent | ✅ Match |
| T2 | None | independent | ✅ Match |
| T3 | None | independent | ✅ Match |
| T4 | None | root of 15C | ✅ Match |
| T5 | None | root of 15C | ✅ Match |
| T6 | T4 | T4 → T6 | ✅ Match |
| T7 | T4 | T4 → T7 | ✅ Match |
| T8 | T4 | T4 → T8 | ✅ Match |
| T9 | T4, T5 | T4+T5 → T9 | ✅ Match |
| T10 | T4, T5 | T4+T5 → T10 | ✅ Match |
| T11 | T4, T5 | T4+T5 → T11 | ✅ Match |
| T12 | None | independent | ✅ Match |
| T13 | None | root of 15E | ✅ Match |
| T14 | T13 | T13 → T14 | ✅ Match |
| T15 | None | independent | ✅ Match |
| T16 | None | independent | ✅ Match |
| T17 | T1–T16 | T1..T16 → T17 | ✅ Match |
| T18 | T1–T17 | T17 → T18 | ✅ Match |

No `[P]` task depends on another `[P]` task in the same phase. T7–T11 are mutually independent; T9/T10/T11 share only their **read** dependency on T4/T5, not on each other.

### Check 3 — Test Co-location Validation

| Task | Code layer created/modified | Matrix requires | Task says | Status |
|---|---|---|---|---|
| T1 | `src-tauri/src/domain/*.rs` (+ `commands/*.rs`) | unit (+ none) → **unit** | unit | ✅ OK |
| T2 | none (test-only) | — | unit + component | ✅ OK |
| T3 | `src-tauri/src/domain/*.rs` | unit | unit | ✅ OK |
| T4 | `src/stores/*.ts` | unit | unit | ✅ OK |
| T5 | `src/utils/*.ts` | *no matrix row* — unit by precedent (R-3) | unit | ✅ OK |
| T6 | `src/windows/**/*.tsx` | component | component | ✅ OK |
| T7 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T8 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T9 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T10 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T11 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T12 | `src/components/**/*.tsx` + locales | component | component | ✅ OK |
| T13 | `src/utils/*.ts` | unit by precedent (R-3) | unit | ✅ OK |
| T14 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T15 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T16 | assets only (no matrix row) | none | none | ✅ OK |
| T17 | version metadata / scripts | none (script tests already exist) | none | ✅ OK |
| T18 | docs | none | none | ✅ OK |

No task defers its tests to a later task. Every task that produces code also verifies it.

---

## Requirement Coverage

| Requirement | Task(s) |
|---|---|
| P15-01 | T1 |
| P15-02 | T1 |
| P15-03 | T2 (T1 supplies the payload) |
| P15-04 | T4, T6 |
| P15-05 | T5, T6, T7, T8, T9, T10 |
| P15-06 | T4, T5, T7 |
| P15-07 | T11 |
| P15-08 | T12 |
| P15-09 | T16 |
| P15-10 | T16 |
| P15-11 | T14 |
| P15-12 | T13 |
| P15-13 | T13, T14 |
| P15-14 | T13, T14 |
| P15-15 | T14 |
| P15-16 | T14 |
| P15-17 | T14 (by not modifying `LiveSongEditModal`) |
| P15-18 | T12 (Settings control), T13/T14 (`repeatCount: 1`), existing `slide_splitter` test (AC-3, R-4) |
| P15-19 | T3 |
| P15-20 | T14 (editor), T15 (panel) |
| P15-21 | T15 |
| P15-22 | T17 (+ manual tag push) |

**22 / 22 requirements mapped. 0 unmapped.**

---

## Task Completion Status (2026-08-11)

| Task | Commit | Status |
|---|---|---|
| T1 | `c17df27` | ✅ Complete |
| T2 | `e1e792d` | ✅ Complete |
| T3 | `4efd267` | ✅ Complete |
| T4 | `c17e151` | ✅ Complete |
| T5 | `8a37ccc` | ✅ Complete |
| T6 | `e35df8b` | ✅ Complete |
| T7 | `a1bbdc0` | ✅ Complete |
| T8 | `32269b7` | ✅ Complete |
| T9 | `68339d1` | ✅ Complete |
| T10 | `1e21216` | ✅ Complete |
| T11 | `3a3d60a` | ✅ Complete |
| T12 | `0a4426f` | ✅ Complete |
| T13 | `60a475a` | ✅ Complete |
| T14 | `97afb0f` | ✅ Complete |
| T15 | `19bf922` | ✅ Complete |
| T16 | `21a2c0a` | ✅ Complete |
| — | `7552032` | Consolidated fix (not a tasks.md task): repaired `SettingsScreen.test.tsx`/`OperatorPresentationLayout.test.tsx` mocks that predated T7–T9's switch to selector-based store reads |
| T17 | `0e5aa9d` | ✅ Complete |
| T18 | (this commit) | ✅ Complete |
