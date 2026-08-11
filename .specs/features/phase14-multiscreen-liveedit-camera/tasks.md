# Phase 14 Tasks — Multi-Screen Launch, Live Lyrics Editing, Camera Stream Quality

**Spec**: `.specs/features/phase14-multiscreen-liveedit-camera/spec.md` (P14-01..P14-32)
**Design**: `.specs/features/phase14-multiscreen-liveedit-camera/design.md`
**Status**: Draft
**Date**: 2026-08-11

22 tasks across four independent slices. Slice order follows design.md § Implementation Order (14C → 14B → 14A), with 14D (icon) added 2026-08-11 and orderable anywhere, but the slices share no files and can be run in any order or concurrently. Within a slice, backend precedes frontend.

**Baseline at planning time** (measured 2026-08-11): **307 Rust tests**, **480 Vitest tests / 64 files**, both green. Every `Test count` below is stated against this baseline.

---

## Design Refinements Discovered While Planning

Three points where the task breakdown deviates from `design.md`. Each is grounded in code read during planning.

| # | design.md said | Tasks do | Why |
|---|---|---|---|
| R-1 | `SlideAnchor` / `anchor_of` / `resolve_anchor` live in `commands/presentation.rs` | They live in `src-tauri/src/domain/slide.rs` | They are pure functions over `Slide`, which is defined in `domain/slide.rs`. TESTING.md's coverage matrix requires unit tests for `domain/*.rs` and **none** for `commands/*.rs` — placing them in `domain` makes the required tests matrix-compliant instead of an exception. Same testability goal as the D-43 precedent, better-placed. |
| R-2 | `refresh_song_in_outputs` is one helper, integration-tested | Split into `regenerate_song_slides` (pool-only, integration-testable) + `refresh_song_in_outputs` (lock/emit shell) | `src-tauri/tests/presentation.rs` deliberately avoids `AppHandle`/`AppState` — it mirrors command logic against a real pool (`build_slide_groups`, line 24). A helper taking `AppHandle` cannot be tested there at all. Splitting puts the *interesting* logic (item matching, slide recomputation, multi-occurrence handling) under test and leaves only the proven lock dance untested. |
| R-3 | Profile switching needs no backend change | Adds **T6**: `update_set_item` must patch **all** outputs, not just `OutputId::One` | `commands/set.rs:444` hard-codes `state.output(OutputId::One)` when patching the live snapshot and emitting `state_changed`. Per D-47 the camera normally runs on **Tela 2** — so a profile switch would persist to the DB and never reach the window actually showing the camera. P14-26 ("restart the proxy and resume playback") fails on the exact configuration this phase exists to fix. |

---

## Execution Plan

### Slice 14C — Camera Stream Profiles (highest production urgency)

```
T1 ──→ T2 ──┬──→ T3 [P]
            ├──→ T4 [P]
            └──→ T5 [P]
T6 (independent)
```

### Slice 14B — Live Lyrics Editing

```
T7 ──→ T8 ──→ T9 ──→ T10 ──→ T11
```

### Slice 14A — Multi-Screen Launch & Monitor Names

```
T12 ──┬──→ T13 ──┐
      ├──→ T14 ──┼──→ T15 ──→ T16
      └──→ T17   │
                 │
T18 ──┬──→ T19   │
      └──→ T20 ◄─┘
```

### Slice 14D — Icon Rebranding

```
T22 (fully independent — no dependency on, and no file overlap with, any other task)
```

### Wrap-up

```
T1..T20, T22 ──→ T21
```

**Cross-slice file contention:** T5 and T11 both mount UI into `OperatorPresentationLayout.tsx`. They are in different slices with no dependency edge — **do not run them as concurrent sub-agents.** Everything else is file-disjoint.

---

## Task Breakdown

## Slice 14C — Camera Stream Profiles

### T1: `StreamProfile` domain type + additive `WebViewConfig` fields

**What**: Add the `StreamProfile` struct and two `#[serde(default)]` fields to `WebViewConfig`, proving legacy JSON still deserializes.
**Where**: `src-tauri/src/domain/set.rs` (modify)
**Depends on**: None
**Reuses**: existing `RtspTransport` enum (`domain/set.rs:35`); the `#[serde(default, skip_serializing_if)]` pattern already used for `crop`/`srt_config`/`rtsp_transport` (`domain/set.rs:97-105`)
**Requirement**: P14-24, P14-27, P14-28

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `StreamProfile { id, label, url, rtsp_transport: Option<RtspTransport> }` added with `#[serde(rename_all = "camelCase")]`, deriving `Serialize, Deserialize, Clone, Debug, PartialEq`
- [ ] `WebViewConfig` gains `profiles: Vec<StreamProfile>` (`#[serde(default, skip_serializing_if = "Vec::is_empty")]`) and `active_profile_id: Option<String>` (`#[serde(default, skip_serializing_if = "Option::is_none")]`)
- [ ] `mode` is NOT moved into `StreamProfile` — it stays item-level (design § 14C)
- [ ] Unit test: a legacy `WebViewConfig` JSON with **no** `profiles`/`activeProfileId` key deserializes with `profiles == []` and `active_profile_id == None`
- [ ] Unit test: `StreamProfile` serde round-trip preserves `rtspTransport`, and omits it from output when `None`
- [ ] Unit test: a `WebViewConfig` with empty `profiles` serializes **without** a `profiles` key (no churn on existing rows)
- [ ] No SQL migration added (`set_items.webview_config` is `TEXT` JSON — `003_media_phase2.sql:39`)
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: 307 baseline + ≥3 new = ≥310 pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml stream_profile` — legacy-deserialize and round-trip tests green.

**Commit**: `feat(domain): additive stream profiles on WebViewConfig`

---

### T2: TS `StreamProfile` types + `resolveActiveSource` resolver

**What**: Mirror the Rust shape in TS and add the pure active-source resolver with its fallback chain.
**Where**: `src/types/index.ts` (modify), `src/utils/streamProfile.ts` (new), `src/utils/streamProfile.test.ts` (new)
**Depends on**: T1
**Reuses**: existing `WebViewConfig`/`RtspTransport` TS types (`types/index.ts:120,166`)
**Requirement**: P14-24, P14-28

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `StreamProfile { id, label, url, rtspTransport?: RtspTransport }` exported; `WebViewConfig` gains `profiles?: StreamProfile[]` and `activeProfileId?: string`
- [ ] Field names match T1's camelCase serde output exactly
- [ ] `resolveActiveSource(cfg): { url: string; transport?: RtspTransport }` implemented per design § Legacy compatibility
- [ ] Unit test: empty/absent `profiles` → falls back to `cfg.url` + `cfg.rtspTransport` (P14-28)
- [ ] Unit test: `activeProfileId` matching a profile → that profile's url/transport
- [ ] Unit test: `activeProfileId` absent → first profile
- [ ] Unit test: `activeProfileId` pointing at a **deleted** profile → first remaining profile (edge case: "active profile is deleted")
- [ ] Unit test: a profile with no `rtspTransport` yields `transport: undefined`
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 480 baseline + ≥5 new = ≥485 pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `npx vitest run src/utils/streamProfile.test.ts` — 5 tests green.

**Commit**: `feat(types): stream profile types and active-source resolver`

---

### T3: `WebViewRenderer` builds its stream source from the active profile [P]

**What**: Route `buildStreamSource` through `resolveActiveSource` so the rendered stream follows the active profile.
**Where**: `src/components/presentation/WebViewRenderer.tsx` (modify), `src/components/presentation/WebViewRenderer.test.tsx` (modify)
**Depends on**: T2
**Reuses**: existing `buildStreamSource` switch (`WebViewRenderer.tsx:19-37`); `StreamProxyRenderer` unchanged
**Requirement**: P14-26, P14-28

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `buildStreamSource` derives url/transport from `resolveActiveSource(config)` for the `rtmp`/`rtsp` branches; `srt`/`multicast` keep reading their own config objects (profiles vary URL + transport only)
- [ ] `mode` still comes from the item, not the profile
- [ ] Behaviour with zero profiles is byte-identical to today (the 3 existing `WebViewRenderer` tests must pass **unmodified**)
- [ ] Component test: an rtsp config with two profiles and `activeProfileId` set renders a `StreamProxyRenderer` whose source uses the active profile's URL
- [ ] Component test: switching `activeProfileId` between renders changes the source passed downstream
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: ≥485 (post-T2) + ≥2 new = ≥487 pass (no silent deletions; the 3 pre-existing WebViewRenderer tests still present)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/presentation/WebViewRenderer.test.tsx` — 5 tests green.

**Commit**: `feat(presentation): render the active camera stream profile`

---

### T4: `StreamProfileEditor` inside `WebViewSetItemEditor` [P]

**What**: Add/rename/remove/reorder-free profile management in the camera item editor, carrying the P14-30 explanatory copy.
**Where**: `src/components/set/StreamProfileEditor.tsx` (new), `src/components/set/StreamProfileEditor.test.tsx` (new), `src/components/set/WebViewSetItemEditor.tsx` (modify), `src/i18n/locales/en-US.json` + `pt-BR.json` (modify)
**Depends on**: T2
**Reuses**: `WebViewSetItemEditor`'s existing `persist()` + rtsp-transport radio group (`WebViewSetItemEditor.tsx:122,179,269-280`); existing form styling tokens
**Requirement**: P14-24, P14-30

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Operator can add a named profile (label + URL), edit both, and remove one; changes persist through the editor's existing `persist()` path into `webviewConfig.profiles`
- [ ] The transport control renders **per profile** only for `mode === "rtsp"`; it is omitted for rtmp/srt/multicast (edge case: protocols without a transport concept)
- [ ] Adding the first profile pre-fills it from the item's existing `url`/`rtspTransport` so a legacy item is not silently emptied
- [ ] Help text states all three P14-30 points: profiles select **which camera stream is pulled**; a lighter sub-stream reduces network load; it does **not** affect what OBS/YouTube pull
- [ ] All new strings exist in **both** `en-US` and `pt-BR`
- [ ] Component test: add → two profiles rendered; remove → one; transport control absent in rtmp mode
- [ ] Component test: the help text renders the OBS-independence sentence
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥4 new (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/set/StreamProfileEditor.test.tsx src/i18n/locales.test.ts` — component tests + locale parity green.

**Commit**: `feat(set): per-camera stream profile editor`

---

### T5: `StreamProfileSwitcher` — mid-presentation profile switch [P]

**What**: Operator-facing switcher that persists `activeProfileId` on the item and reverts the selection on failure.
**Where**: `src/components/presentation/StreamProfileSwitcher.tsx` (new), `src/components/presentation/StreamProfileSwitcher.test.tsx` (new), `src/components/presentation/OperatorPresentationLayout.tsx` (modify), locales (modify)
**Depends on**: T2
**Reuses**: `updateSetItem` (`api/commands.ts:278`); `MicSwitch.tsx` as the pattern for a small in-layout operator control
**Requirement**: P14-25, P14-26, P14-27, P14-29

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Renders only when the focused item is a WebView item with **≥2** profiles; renders nothing at 0 or 1 profile (P14-28)
- [ ] Selecting a profile calls `updateSetItem` with the full `webviewConfig` and the new `activeProfileId`, changing **no other profile's** fields (P14-24 / P14-04-analogue)
- [ ] Selection is optimistic and **reverts to the previous profile** if `updateSetItem` rejects, surfacing the error (P14-29) — mirrors the D-46 optimistic-then-reconcile pattern
- [ ] Persisted `activeProfileId` is read back from the item on mount, so the choice survives relaunch (P14-27)
- [ ] No new Rust command is introduced — the proxy respawn is `start_stream_proxy`'s existing config-changed path (`stream.rs:124-134`), reached via the re-render from T3
- [ ] All new strings in both locales
- [ ] Component test: hidden at 0 and 1 profile, visible at 2
- [ ] Component test: clicking a profile invokes `updateSetItem` with the new `activeProfileId` and the untouched `profiles` array
- [ ] Component test: a rejected `updateSetItem` restores the prior selection
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥4 new (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/presentation/StreamProfileSwitcher.test.tsx` — 4 tests green.

**Commit**: `feat(presentation): switch camera stream profile mid-presentation`

---

### T6: `update_set_item` patches every output, not just Tela 1

**What**: Extract the live-snapshot patch as a pure helper and apply it across `OutputId::ALL` so a set-item edit reaches whichever screen is showing it.
**Where**: `src-tauri/src/commands/set.rs` (modify)
**Depends on**: None
**Reuses**: `OutputId::ALL` (`domain/output.rs:21`); the existing patch/emit block (`commands/set.rs:439-467`); `StateChangedPayload::new`
**Requirement**: P14-26 (edge case: "camera is presented on a second output")

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Pure helper `patch_item_in_set(set: &mut ServiceSet, item: &SetItem) -> bool` extracted, returning whether a slot was replaced
- [ ] `update_set_item` loops `OutputId::ALL`, patching each output's presentation snapshot and emitting a `state_changed` tagged with **that** output — replacing the hard-coded `OutputId::One`
- [ ] Every write guard is dropped before each `app.emit()` (CONCERN-7 / CLAUDE.md deadlock invariant) — snapshots collected first, emitted after
- [ ] An output whose loaded set does not contain the item emits nothing (unchanged behaviour for that output)
- [ ] `set_changed` is still emitted exactly once
- [ ] Unit test: `patch_item_in_set` replaces a matching item and returns `true`
- [ ] Unit test: returns `false` and mutates nothing when no id matches
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: 307 baseline + ≥2 new (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml patch_item_in_set` green; `grep -n "OutputId::One" src-tauri/src/commands/set.rs` no longer matches inside `update_set_item`.

**Commit**: `fix(set): propagate live set-item edits to every output`

---

## Slice 14B — Live Lyrics Editing

### T7: Pure slide anchoring — `SlideAnchor`, `anchor_of`, `resolve_anchor`

**What**: The `(section_id, ordinal)` anchor type and its two pure functions, with the full fallback chain.
**Where**: `src-tauri/src/domain/slide.rs` (modify) — see R-1
**Depends on**: None
**Reuses**: `Slide` + its `section_id` field; the pure-helper-with-mirrored-tests pattern from D-43
**Requirement**: P14-18, P14-19

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `SlideAnchor { section_id: String, ordinal: usize }` defined; `ordinal` documented as the index among slides sharing `section_id` **within the item**
- [ ] `anchor_of(slides: &[Slide], index: usize) -> Option<SlideAnchor>` returns `None` for an out-of-range index
- [ ] `resolve_anchor(new_slides: &[Slide], anchor: Option<&SlideAnchor>, old_index: usize) -> usize` implements the chain: exact `(section_id, ordinal)` → last slide carrying that `section_id` → clamp `old_index` to `new_len - 1` → `0`
- [ ] `resolve_anchor` **never** returns an out-of-range index, including for empty `new_slides` (returns `0`)
- [ ] Unit test: exact hit on an unchanged slide list returns the same index
- [ ] Unit test: a section split across 3 slides — ordinal 2 resolves to the third, not the first
- [ ] Unit test: `RepeatMode::Duplicate`-style repeated runs — ordinal disambiguates the second run
- [ ] Unit test: ordinal overflow (section now has fewer slides) falls back to that section's **last** slide
- [ ] Unit test: section deleted entirely → clamps `old_index` to the new last slide
- [ ] Unit test: shrink to fewer slides than `old_index` → returns `new_len - 1`
- [ ] Unit test: empty `new_slides` → `0`
- [ ] Unit test: synthetic `__title__` / `__blackout__` slides anchor by the same rule with no special case
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: 307 baseline + ≥8 new = ≥315 pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml anchor` — 8 tests green.

**Commit**: `feat(domain): pure slide anchoring for live regeneration`

---

### T8: `regenerate_song_slides` — pool-only regeneration core

**What**: Given a song id and a loaded set, recompute slides for **every** item referencing that song, without touching Tauri state.
**Where**: `src-tauri/src/commands/presentation.rs` (modify), `src-tauri/tests/presentation.rs` (modify) — see R-2
**Depends on**: T7
**Reuses**: `compute_item_slides` (`commands/presentation.rs:334`, already `pub(crate)`), `load_slide_gen_settings`, `SlideConfig::default()`; `tests/presentation.rs` `open_test_db` harness (line 11)
**Requirement**: P14-17, P14-20

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `pub(crate) async fn regenerate_song_slides(pool, set: &ServiceSet, song_id: &str) -> Result<Vec<(usize, Vec<Slide>)>, ErrorPayload>` returns `(item_index, new_slides)` for every matching item
- [ ] Returns an **empty vec** when no item references the song — P14-20 falls out with no caller branch
- [ ] A song appearing twice in one set yields **two** entries (edge case: "same song appears twice")
- [ ] Signature takes only `&SqlitePool` + `&ServiceSet` + `&str` — no `AppHandle`, no `AppState` (this is what makes it testable in `tests/presentation.rs`)
- [ ] Integration test: edit a song's section text, regenerate → the returned slides carry the new text
- [ ] Integration test: the same song at set positions 0 and 2 → both indices returned
- [ ] Integration test: a song not in the set → empty vec
- [ ] Integration test: a song whose sections are all deleted → the item still yields ≥1 slide (`blank_slide()` fallback), so navigation cannot break (edge case)
- [ ] Integration test: with `blackout_after_song` on, the regenerated slides still end with the `__blackout__` sentinel (D-38 preserved)
- [ ] Integration test: with `show_title_slide` on, the regenerated slides still start with the title slide including credit normalization (D-43 preserved)
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Test count: ≥315 (post-T7) + ≥6 new = ≥321 pass (no silent deletions)

**Tests**: integration
**Gate**: full

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml --test presentation` — existing tests plus 6 new green.

**Commit**: `feat(presentation): pool-only song slide regeneration core`

---

### T9: `refresh_song_in_outputs` + `update_song` wiring

**What**: The lock/anchor/emit shell around T8, invoked from `update_song` after a successful DB write.
**Where**: `src-tauri/src/commands/presentation.rs` (modify), `src-tauri/src/commands/song.rs` (modify)
**Depends on**: T8
**Reuses**: the append-path lock order (`commands/presentation.rs:428-450`: slides write → slides read → presentation write → drop → emit); `emit_state` (line 227); `resolve_next_slide` (line 159); `OutputId::ALL`
**Requirement**: P14-17, P14-21, P14-22, P14-23

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `pub(crate) async fn refresh_song_in_outputs(app, state, song_id) -> Result<(), ErrorPayload>` iterates `OutputId::ALL` — mirror outputs are covered by the loop, not by special-casing (P14-21)
- [ ] Per output: skip if no set is loaded; call `regenerate_song_slides`; if empty, emit nothing for that output
- [ ] The anchor is captured with `anchor_of(old_slides, current_slide_index)` **before** the splice, and only when the regenerated item **is** the current item
- [ ] `presentation_slides` spliced; `item_slide_counts` recomputed; `set.items` left as-is (song text is not stored on `SetItem`)
- [ ] If the current item changed: `current_slide_index = resolve_anchor(...)`, then `current_slide` and `next_slide` refreshed via `resolve_next_slide`
- [ ] `mode`, `frozen_at` and `overlay` are **not written** — blank/frozen survives with no special case (P14-22)
- [ ] All guards dropped before every `emit_state` (CONCERN-7)
- [ ] `update_song` calls it **after** `db_update_song` succeeds and after `songs_changed` is emitted; a regeneration error does not roll back the save but is returned to the caller
- [ ] A failed save short-circuits before regeneration, so the projection keeps its pre-edit slides (P14-23)
- [ ] `cargo clippy -D warnings` clean
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`
- [ ] Test count: ≥321 Rust (post-T8) and 480 Vitest, no regressions (per TESTING.md, `commands/*.rs` command handlers carry no co-located tests — the logic under this shell is covered by T7 + T8)

**Tests**: none (command wiring — matrix: `src-tauri/src/commands/*.rs` → none)
**Gate**: full

**Verify**: `cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` — green and clean.

**Commit**: `feat(presentation): regenerate and re-project a song on save`

---

### T10: `LiveSongEditModal` — the editor without leaving presentation

**What**: Modal shell mounting the unmodified `SongEditor` over the operator presentation layout.
**Where**: `src/components/presentation/LiveSongEditModal.tsx` (new), `src/components/presentation/LiveSongEditModal.test.tsx` (new), `src/stores/library.ts` (modify), locales (modify)
**Depends on**: T9
**Reuses**: `SongEditor` (`components/library/SongEditor.tsx:195` — propless, store-driven, calls `closeEditor()` on save); `OutputLaunchModal.tsx` for modal shell structure/styling
**Requirement**: P14-16, P14-23

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] **Navigation hazard handled**: `useLibraryStore.openEditor()` sets `currentView: "editor"` and `closeEditor()` sets `currentView: "library"` (`stores/library.ts:59-65`) — mounting the editor this way would navigate the operator **out of** the presentation layout. The modal must open/close the editor without mutating `currentView` (e.g. a dedicated `openLiveEditor`/`closeLiveEditor` pair, or a `currentView` snapshot restored on close). Whichever is chosen, the operator returns to the presentation layout on both save and cancel.
- [ ] `SongEditor` is mounted **unchanged, with no new props** (design § `SongEditor` reuse)
- [ ] Modal unmounts when the editor's song id clears (save or cancel)
- [ ] Cancel writes nothing — song and projection both untouched (P14-23)
- [ ] Component test: opening the modal renders `SongEditor` and leaves `currentView` on the presentation layout
- [ ] Component test: closing restores the pre-open view
- [ ] Component test: cancel invokes no `update_song`
- [ ] All new strings in both locales
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥3 new (no silent deletions; existing `SongEditor` tests unmodified)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/presentation/LiveSongEditModal.test.tsx` — 3 tests green.

**Commit**: `feat(presentation): live song edit modal`

---

### T11: Live-edit entry point + exit cleanup in the operator layout

**What**: The affordance that opens the live editor for the projected song, and the cleanup that prevents an orphaned overlay.
**Where**: `src/components/presentation/OperatorPresentationLayout.tsx` (modify), `src/components/presentation/OperatorPresentationLayout.test.tsx` (modify), locales (modify)
**Depends on**: T10
**Reuses**: existing SET-pane / LIVE-preview structure (D-30); `SetItemList` item-type discrimination
**Requirement**: P14-16

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] An edit affordance is present for the currently projected item and **enabled only** for `Song` items — disabled or absent for media/countdown/webview/slideshow (Out of Scope: live editing of non-song items)
- [ ] Activating it opens `LiveSongEditModal` for that item's `song_id`; the presentation window is never asked to do anything (read-only invariant)
- [ ] Exiting presentation while the editor is open clears the editing song id so no orphaned overlay survives (edge case)
- [ ] All new strings in both locales
- [ ] Component test: the affordance is enabled on a Song item and disabled on a Media item
- [ ] Component test: exiting presentation with the editor open leaves no editor mounted
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥2 new (no silent deletions; existing `OperatorPresentationLayout` tests still present)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx` — existing plus 2 new green.

**Commit**: `feat(presentation): open the live song editor from the operator layout`

---

## Slice 14A — Multi-Screen Launch & Monitor Names

### T12: `LaunchPolicy` setting — key, store field, action

**What**: The three-value policy persisted as a `settings` row and exposed on the settings store.
**Where**: `src/stores/settings.ts` (modify), `src/stores/settings.test.ts` (modify or new)
**Depends on**: None
**Reuses**: the `MULTI_SCREEN_ENABLED_KEY` / `MIRROR_ENABLED_KEY` pattern (`stores/settings.ts:46-48,385-390`); the `settings` key/value table (no migration — precedent D-19, D-39)
**Requirement**: P14-07, P14-08, P14-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `LaunchPolicy = "ask" | "mirror_all" | "main_only"` type exported
- [ ] `LAUNCH_POLICY_KEY = "output.launch_policy"` exported
- [ ] Store gains `launchPolicy: LaunchPolicy` defaulting to `"ask"` (P14-08), plus a `setLaunchPolicy` action that writes the setting
- [ ] The value is loaded in the store's existing bootstrap alongside `multiScreenEnabled` / `mirrorEnabled`, so it applies without an app restart (P14-10)
- [ ] An unrecognised or absent persisted value falls back to `"ask"`
- [ ] Unit test: default is `"ask"` before any load
- [ ] Unit test: `setLaunchPolicy` updates the store and calls `setSetting` with the right key
- [ ] Unit test: a garbage persisted value loads as `"ask"`
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: 480 baseline + ≥3 new (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `npx vitest run src/stores/settings.test.ts` — 3 new tests green.

**Commit**: `feat(settings): multi-screen launch policy setting`

---

### T13: `resolveLaunchPlan` + `startPresentationPlan`

**What**: The pure policy resolver and the plan executor, both in the existing dispatch module.
**Where**: `src/utils/outputDispatch.ts` (modify), `src/utils/outputDispatch.test.ts` (modify)
**Depends on**: T12
**Reuses**: `launchOutputAt` semantics (`utils/outputDispatch.ts:74`), `loadSetForPresentation`/`enterPresentation`/`goToItem`; deliberately **not** `engageMirror` (it starts at the master's current position — P14-02 requires item 0)
**Requirement**: P14-01, P14-02, P14-03, P14-04, P14-06, P14-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `resolveLaunchPlan(policy, multiScreenEnabled): "ask" | "mirrorAll" | "mainOnly"` is pure with no imports of stores or the API layer
- [ ] `multiScreenEnabled === false` → always `"mainOnly"`, for **all three** policies (P14-04)
- [ ] `startPresentationPlan(plan, setId)`: `mainOnly` → `enterPresentation("one")` only, opening **no** window for output two (P14-03); `mirrorAll` → set `mirrorEnabled`, then per output `loadSetForPresentation` → `enterPresentation` → `goToItem(0, 0)` (P14-02)
- [ ] A rejected `loadSetForPresentation` (e.g. `presentation.empty_set`) propagates **before** any window opens, and a per-output failure does not abort the surviving outputs (P14-06, design § Error Handling "Mirror-all partially fails")
- [ ] Unit test: all 3 policies × multi-screen on/off = 6 cases for `resolveLaunchPlan`
- [ ] Unit test: `mainOnly` invokes `enterPresentation` exactly once and never with `"two"`
- [ ] Unit test: `mirrorAll` invokes `goToItem(0, 0, o)` for both outputs
- [ ] Unit test: a rejected load for output two leaves output one running and surfaces the error
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥9 new (no silent deletions; existing `outputDispatch` tests still present)

**Tests**: unit
**Gate**: quick

**Verify**: `npx vitest run src/utils/outputDispatch.test.ts` — existing plus 9 new green.

**Commit**: `feat(presentation): launch plan resolver and executor`

---

### T14: `MultiScreenLaunchModal` [P]

**What**: The binary mirror-all question, with a dismissal that mutates nothing.
**Where**: `src/components/presentation/MultiScreenLaunchModal.tsx` (new), `.test.tsx` (new), locales (modify)
**Depends on**: T12
**Reuses**: `OutputLaunchModal.tsx` for shell structure, Esc handling (line 58) and styling — reference only, not extended (DQ-5)
**Requirement**: P14-01, P14-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Props are exactly `{ onAnswer: (mirrorAll: boolean) => void; onCancel: () => void }`
- [ ] Affirmative and negative controls call `onAnswer(true)` / `onAnswer(false)`
- [ ] Esc **and** the close control call `onCancel` — never `onAnswer` (P14-05)
- [ ] Screen names come from a prop, not from hard-coded "Tela 1"/"Tela 2" (consumed in T20)
- [ ] All new strings in both locales
- [ ] Component test: affirmative → `onAnswer(true)`
- [ ] Component test: negative → `onAnswer(false)`
- [ ] Component test: Esc → `onCancel`, and neither `onAnswer` call fires
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥3 new (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/presentation/MultiScreenLaunchModal.test.tsx` — 3 tests green.

**Commit**: `feat(presentation): multi-screen launch modal`

---

### T15: `PresentationLaunchProvider` + `useRequestPresentation`

**What**: One mounted modal and one entry point that every Apresentar site can call.
**Where**: `src/components/presentation/PresentationLaunchProvider.tsx` (new), `.test.tsx` (new)
**Depends on**: T13, T14
**Reuses**: T13's resolver/executor, T14's modal, `useSettingsStore`
**Requirement**: P14-01, P14-04, P14-05, P14-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `useRequestPresentation(): (setId: string) => Promise<void>` exported
- [ ] Provider reads `launchPolicy` + `multiScreenEnabled`, calls `resolveLaunchPlan`, and either runs `startPresentationPlan` directly or renders the modal and runs it on answer
- [ ] Mounted **once**, in `OperatorApp` only — the presentation window never mounts it (read-only invariant)
- [ ] Cancelling resolves the promise without launching anything and without mutating any store (P14-05)
- [ ] Component test: policy `mirror_all` → no modal, `startPresentationPlan("mirrorAll")` called
- [ ] Component test: policy `main_only` → no modal, `startPresentationPlan("mainOnly")` called
- [ ] Component test: policy `ask` + multi-screen on → modal shown; answering yes runs the mirror plan
- [ ] Component test: policy `ask` + multi-screen **off** → no modal, main-only plan (P14-04)
- [ ] Component test: cancel → no plan executed
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥5 new (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/presentation/PresentationLaunchProvider.test.tsx` — 5 tests green.

**Commit**: `feat(presentation): launch policy provider and hook`

---

### T16: Route all four Apresentar call sites through the hook

**What**: Replace the bare `enterPresentation()` calls with `useRequestPresentation`, and mount the provider.
**Where**: `src/windows/operator/OperatorApp.tsx:155` (modify), `src/components/setbuilder/HomeSetBuilder.tsx:85,95` (modify), `src/components/set/SetBuilder.tsx:381` (modify)
**Depends on**: T15
**Reuses**: T15's hook
**Requirement**: P14-01, P14-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] All four sites call `requestPresentation(setId)`; no bare `enterPresentation()` remains in these files
- [ ] `PresentationLaunchProvider` wraps the operator tree in `OperatorApp`
- [ ] The three intra-presentation calls in `OperatorPresentationLayout.tsx:97,103,139` are **left alone** — they switch/mirror an already-running presentation, not a launch, and the policy does not apply to them (document this in a comment so the next reader does not "fix" it)
- [ ] `api/commands.ts:85` `openPresentationWindow` is left as the raw wrapper (it is the API layer, not a call site)
- [ ] Existing empty-set behaviour is preserved: `presentation.empty_set` still surfaces before any window opens (P14-06)
- [ ] Component test: pressing Apresentar in `HomeSetBuilder` invokes the hook, not `enterPresentation`
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥1 new (no silent deletions; existing `HomeSetBuilder`/`SetBuilder`/`OperatorApp` tests still pass, updated for the new indirection only where they asserted on `enterPresentation`)

**Tests**: component
**Gate**: quick

**Verify**: `grep -n "enterPresentation()" src/windows/operator/OperatorApp.tsx src/components/setbuilder/HomeSetBuilder.tsx src/components/set/SetBuilder.tsx` returns no matches.

**Commit**: `refactor(presentation): route every Apresentar through the launch policy`

---

### T17: `LaunchPolicySetting` control [P]

**What**: The three-value radio group in settings, inert when multi-screen is off.
**Where**: `src/components/settings/LaunchPolicySetting.tsx` (new), `.test.tsx` (new), `src/components/settings/SettingsScreen.tsx` (modify), locales (modify)
**Depends on**: T12
**Reuses**: existing settings-screen row layout and the multi-screen toggle already rendered there
**Requirement**: P14-07, P14-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Exactly three options rendered: ask every time / always mirror all screens / only the main screen (P14-07)
- [ ] Selecting one calls `setLaunchPolicy`, persisting immediately (P14-10)
- [ ] When `multiScreenEnabled` is false the control is **visibly inapplicable** — disabled with an explanatory note, not hidden (P14-07 AC-6)
- [ ] All new strings in both locales
- [ ] Component test: three options rendered, current value checked
- [ ] Component test: selecting an option calls `setLaunchPolicy` with that value
- [ ] Component test: disabled with the note when multi-screen is off
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥3 new (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/settings/LaunchPolicySetting.test.tsx` — 3 tests green.

**Commit**: `feat(settings): launch policy control`

---

### T18: `monitorIdentity` + `resolveMonitorName` + name persistence [P]

**What**: The identity key, the display-name fallback chain, and the `display.monitor_names` settings row.
**Where**: `src/utils/monitorNames.ts` (new), `src/utils/monitorNames.test.ts` (new)
**Depends on**: None
**Reuses**: `MonitorInfo` (`types/index.ts:331` — carries `name?`, `width`, `height`, `x`, `y`, `scaleFactor`); the `settings` key/value table
**Requirement**: P14-13, P14-14, P14-15

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `monitorIdentity(m: MonitorInfo): string` returns `name:<trimmed OS name>` when the name is present and non-empty, else `geom:{w}x{h}@{x},{y}` (DQ-1)
- [ ] `resolveMonitorName(m, index, names): string` implements the chain operator name → OS name → `Monitor {index+1} — {w}×{h}` (P14-13)
- [ ] `MONITOR_NAMES_KEY = "display.monitor_names"`; load/save helpers serialize the whole map as one JSON settings row
- [ ] Saving a name for one monitor **preserves entries for monitors not currently detected** — nothing is pruned (P14-15)
- [ ] Names are never keyed by index anywhere (CLAUDE.md gotcha, D-32)
- [ ] A malformed persisted JSON blob loads as an empty map rather than throwing
- [ ] Unit test: named monitor → `name:` key; unnamed → `geom:` key
- [ ] Unit test: whitespace-only OS name is treated as absent
- [ ] Unit test: full fallback chain, all three levels
- [ ] Unit test: saving one name keeps an unrelated stored entry for an absent monitor (P14-15)
- [ ] Unit test: two monitors swapping enumeration order keep their own names (P14-15 / AC-7)
- [ ] Unit test: malformed JSON → empty map
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥6 new (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**: `npx vitest run src/utils/monitorNames.test.ts` — 6 tests green.

**Commit**: `feat(settings): stable per-monitor identity and naming`

---

### T19: `MonitorNameSettings` UI

**What**: The editable per-monitor name list in settings.
**Where**: `src/components/settings/MonitorNameSettings.tsx` (new), `.test.tsx` (new), `src/components/settings/SettingsScreen.tsx` (modify), locales (modify)
**Depends on**: T18
**Reuses**: `listMonitors` (`api/commands.ts`), `MonitorPicker`'s monitor-fetch effect pattern (`MonitorPicker.tsx:32-39`)
**Requirement**: P14-11, P14-14

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Every detected monitor is listed with its resolution and an editable name field (P14-11)
- [ ] Editing a name persists via T18's save helper, keyed by `monitorIdentity`
- [ ] Clearing a name removes the override and the row falls back down the chain
- [ ] Names reload from the settings row on mount, so they survive restart (P14-14)
- [ ] All new strings in both locales
- [ ] Component test: two monitors render two rows with their resolutions
- [ ] Component test: typing a name persists it under the identity key, not the index
- [ ] Component test: names present on mount are shown in the fields
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥3 new (no silent deletions)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/settings/MonitorNameSettings.test.tsx` — 3 tests green.

**Commit**: `feat(settings): per-monitor name editor`

---

### T20: Display monitor names wherever an output is identified

**What**: Replace index labels with resolved monitor names in the three surfaces that identify a screen.
**Where**: `src/components/settings/MonitorPicker.tsx` (modify), `src/components/presentation/OutputSwitcher.tsx` (modify), `src/components/presentation/MultiScreenLaunchModal.tsx` (modify), respective tests (modify), locales (modify)
**Depends on**: T18, T14
**Reuses**: T18's `resolveMonitorName`; the per-output monitor key resolution already used by `enterPresentation`
**Requirement**: P14-12, P14-13

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `MonitorPicker` options render `resolveMonitorName(...)` instead of the raw `m.name ?? "Monitor {i+1}"` fallback (`MonitorPicker.tsx:57-60`)
- [ ] `OutputSwitcher` tabs show the name of the monitor each output is currently assigned to, falling back down the chain when unassigned (P14-12)
- [ ] `MultiScreenLaunchModal` names the screens it is about to launch, via the prop introduced in T14
- [ ] The literal "Tela {{n}}" label remains only as the generated fallback tier, never as the primary label (Success Criteria: "no reference to Tela 1/Tela 2 indices")
- [ ] All new/changed strings in both locales
- [ ] Component test: `OutputSwitcher` renders a stored monitor name for the assigned output
- [ ] Component test: `OutputSwitcher` falls back to the generated label when no name is stored
- [ ] Component test: `MonitorPicker` renders the operator name in preference to the OS name
- [ ] Gate check passes: `npx vitest run`
- [ ] Test count: baseline + ≥3 new (no silent deletions; existing `MonitorPicker`/`OutputSwitcher` tests updated only where they asserted on index labels)

**Tests**: component
**Gate**: quick

**Verify**: `npx vitest run src/components/presentation/OutputSwitcher.test.tsx src/components/settings/MonitorPicker.test.tsx` — existing plus 3 new green.

**Commit**: `feat(presentation): identify screens by monitor name`

---

## Slice 14D — Icon Rebranding

### T22: L-as-music-note app icon, from one SVG source [P]

**What**: Author the new icon as a single committed SVG and regenerate every platform asset plus the two favicon surfaces from it.
**Where**: `src-tauri/icons/icon.svg` (new — the source of truth), `src-tauri/icons/**` (regenerated), `public/icons/{32x32.png,128x128.png,icon.ico}` (synced)
**Depends on**: None
**Reuses**: `npx tauri icon` (Tauri CLI generator, already available via the project's devDependency); the existing brand palette — purple mark on a dark rounded square, as in the current `icon.png`
**Requirement**: P14-31, P14-32

**Tools**: MCP: NONE · Skill: NONE

**Verified during planning** (probe run 2026-08-11, output inspected at 128×128):
- `npx tauri icon <file>.svg -o <dir>` **accepts SVG** and emits the full set: `32/64/128/128@2x`, all `Square*Logo.png`, `StoreLogo.png`, `icon.ico`, `icon.icns`, `android/`, `ios/` — matching exactly what the repo already tracks
- The generator **preserves transparency and composites no background** → the dark rounded square must be drawn *in the source SVG*, or the icon ships with a transparent backdrop and looks broken on a light taskbar
- The generator writes **only** to its output dir → `public/icons/` is not touched and must be synced by hand
- Must be run from the repo root; `npx tauri` outside it fails to resolve the local CLI

**Done when**:
- [ ] `src-tauri/icons/icon.svg` committed as the **only** hand-edited icon artefact; every raster asset is generated from it (P14-31 AC-1)
- [ ] Artwork is the agreed concept: the L's vertical stroke doubles as the note stem, with a filled notehead fused at the corner where the L turns — one continuous mark, not a letter with a note placed beside it
- [ ] The SVG draws its own dark rounded-square background (P14-31 AC-3), and the mark keeps the existing purple; no new brand colour is introduced (P14-32 AC-7)
- [ ] Square viewBox, and the mark is optically centred with margin comparable to the current icon — the generator does not pad
- [ ] Regenerated via `npx tauri icon src-tauri/icons/icon.svg -o src-tauri/icons` from the repo root
- [ ] `public/icons/32x32.png`, `128x128.png` and `icon.ico` copied from the regenerated set — these are what `index.html:5-6` and `presentation.html:5-6` load (P14-32 AC-5)
- [ ] No change needed to `tauri.conf.json` (`bundle.icon` paths are unchanged) — confirm rather than edit
- [ ] Legibility check at 32×32: still reads as both an L and a note; no stroke thinner than ~2px at that size (P14-31 AC-2)
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run` — assets only, so this proves nothing regressed rather than proving the icon

**Tests**: none (binary art assets — no code layer in the TESTING.md coverage matrix)
**Gate**: build

**Verify**:
1. `ls src-tauri/icons` — every previously tracked file still present, all with fresh mtimes
2. Open `src-tauri/icons/32x32.png` and `128x128.png` and read them visually at size — the 32×32 is the one that decides whether the concept works
3. `git status --short public/icons src-tauri/icons` — the three `public/icons` files show as modified
4. Confirm the 128×128 has an opaque dark rounded-square backdrop, not transparency

**Commit**: `feat(brand): L-as-music-note app icon from a single SVG source`

---

### T21: Full gate, i18n parity, traceability and docs

**What**: Close the phase — verify the whole gate, update the spec traceability table, ROADMAP and STATE.
**Where**: `.specs/features/phase14-multiscreen-liveedit-camera/spec.md`, `.specs/project/ROADMAP.md`, `.specs/project/STATE.md`, this file
**Depends on**: T1–T20, T22
**Reuses**: existing locale parity test (`src/i18n/locales.test.ts`); the Phase 11/13 completion-summary format in STATE.md
**Requirement**: All (Success Criteria)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green, count ≥ 480 + the sum of all per-task additions, with 0 pre-existing tests deleted
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` green, count ≥ 307 + all additions
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` clean
- [ ] `src/i18n/locales.test.ts` passes — every new string present in **both** `en-US` and `pt-BR`
- [ ] Spec traceability table: all 32 requirements moved from `Design | Pending` to `Tasks | Implemented`, each naming its task(s); coverage line updated to "32 mapped, 0 unmapped"
- [ ] ROADMAP gains a Phase 14 row
- [ ] STATE.md: current phase updated, R-1/R-2/R-3 recorded as decisions (D-61..D-63), and a Phase 14 completion summary added
- [ ] The manual-verification checklist below is copied into STATE.md as an open verification note (it cannot be gated locally)
- [ ] Gate check passes: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`

**Tests**: none (documentation and gate verification)
**Gate**: build

**Verify**: `npx tsc --noEmit && npx vitest run && cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` — all four green.

**Commit**: `docs(phase14): close out multi-screen, live editing and camera profiles`

---

## Manual Verification (hardware required — cannot be gated)

Carried from design.md § Manual Verification. Two monitors are required for 14A, a real camera for 14C.

1. Launch policy across all three values, from all four Apresentar call sites
2. Monitor names surviving restart, unplug/replug, and enumeration reorder
3. Live edit mid-song: no black frame, position held, with blackout and frozen modes engaged
4. Profile switch mid-presentation while OBS pulls the 4K main stream concurrently — confirm OBS is unaffected and latency stops growing
5. **New (from R-3):** profile switch while the camera is on **Tela 2**, confirming the switch reaches the second screen

**Field actions before shipping** (spec § Root-Cause Analysis — configuration, not code): switch the camera item's RTSP transport `udp` → `tcp`; enable a 1080p/720p sub-stream on the camera; verify negotiated NIC link speed at both ends.

---

## Pre-Approval Validation

### Check 1 — Task Granularity

| Task | Scope | Status |
|---|---|---|
| T1 | 1 struct + 2 fields, one file | ✅ Granular |
| T2 | 1 type + 1 pure function | ✅ Granular |
| T3 | 1 function change in 1 component | ✅ Granular |
| T4 | 1 component (+ its mount point) | ✅ Granular |
| T5 | 1 component (+ its mount point) | ✅ Granular |
| T6 | 1 pure helper + 1 command loop, one file | ✅ Granular |
| T7 | 1 struct + 2 pure functions, one file | ✅ Granular |
| T8 | 1 function | ✅ Granular |
| T9 | 1 function + 1 call site | ✅ Granular |
| T10 | 1 component (+ store action) | ✅ Granular |
| T11 | 1 affordance + 1 cleanup, one file | ✅ Granular |
| T12 | 1 store field + action | ✅ Granular |
| T13 | 2 cohesive functions, same file | ⚠️ OK — resolver and its executor are the same concern, ~40 lines total |
| T14 | 1 component | ✅ Granular |
| T15 | 1 provider + its hook, same file | ✅ Granular |
| T16 | 4 one-line call-site edits | ⚠️ OK — mechanical, atomic as a unit; splitting would leave the app half-routed |
| T17 | 1 component | ✅ Granular |
| T18 | 3 pure functions, same module | ⚠️ OK — identity, resolution and persistence of one concept |
| T19 | 1 component | ✅ Granular |
| T20 | 3 label sites, same concern | ⚠️ OK — one rename applied consistently; splitting risks partial "Tela N" leakage |
| T22 | 1 SVG + 1 generate/sync step | ✅ Granular |
| T21 | Docs + gate | ✅ Granular |

No ❌. The four ⚠️ are cohesive-same-file cases explicitly allowed by the granularity rule.

### Check 2 — Diagram–Definition Cross-Check

| Task | Depends on (body) | Diagram shows | Status |
|---|---|---|---|
| T1 | None | root of 14C | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 [P] | ✅ Match |
| T4 | T2 | T2 → T4 [P] | ✅ Match |
| T5 | T2 | T2 → T5 [P] | ✅ Match |
| T6 | None | independent | ✅ Match |
| T7 | None | root of 14B | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T8 | T8 → T9 | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T10 | T10 → T11 | ✅ Match |
| T12 | None | root of 14A | ✅ Match |
| T13 | T12 | T12 → T13 | ✅ Match |
| T14 | T12 | T12 → T14 | ✅ Match |
| T15 | T13, T14 | T13 → T15, T14 → T15 | ✅ Match |
| T16 | T15 | T15 → T16 | ✅ Match |
| T17 | T12 | T12 → T17 | ✅ Match |
| T18 | None | second 14A root | ✅ Match |
| T19 | T18 | T18 → T19 | ✅ Match |
| T20 | T18, T14 | T18 → T20, T14 → T20 | ✅ Match |
| T22 | None | standalone 14D slice | ✅ Match |
| T21 | T1–T20, T22 | T1..T20, T22 → T21 | ✅ Match |

No `[P]` task depends on another task in its own parallel group: T3/T4/T5 all depend only on T2; T13/T14/T17 all depend only on T12.

### Check 3 — Test Co-location Validation

| Task | Code layer created/modified | Matrix requires | Task says | Status |
|---|---|---|---|---|
| T1 | `src-tauri/src/domain/set.rs` | unit (pure types) | unit | ✅ OK |
| T2 | `src/utils/*.ts` (utility) | unit | unit | ✅ OK |
| T3 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T4 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T5 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T6 | `src-tauri/src/commands/set.rs` | none | unit | ✅ OK — exceeds the matrix; the task extracts a pure helper precisely so it can be tested |
| T7 | `src-tauri/src/domain/slide.rs` | unit | unit | ✅ OK (see R-1 — placement chosen to satisfy this row) |
| T8 | `src-tauri/src/commands/presentation.rs` + `tests/presentation.rs` | none (commands) / integration harness exists | integration | ✅ OK — exceeds the matrix (see R-2) |
| T9 | `src-tauri/src/commands/*.rs` (handlers) | none | none | ✅ OK — logic beneath it is covered by T7 + T8, which is *coverage*, not deferral |
| T10 | `src/components/**/*.tsx`, `src/stores/library.ts` | component + unit | component | ✅ OK — highest required type applied; store change is exercised through the component test |
| T11 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T12 | `src/stores/settings.ts` | unit | unit | ✅ OK |
| T13 | `src/utils/outputDispatch.ts` | unit | unit | ✅ OK |
| T14 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T15 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T16 | `src/windows/**/*.tsx`, `src/components/**/*.tsx` | component | component | ✅ OK |
| T17 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T18 | `src/utils/*.ts` | unit | unit | ✅ OK |
| T19 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T20 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T22 | binary art assets (`src-tauri/icons`, `public/icons`) | — (no matrix row) | none | ✅ OK — no code layer touched |
| T21 | docs only | — | none | ✅ OK — no code layer touched |

No ❌ VIOLATION. T9 is the only `Tests: none`, and it is matrix-sanctioned (`commands/*.rs` → none), not deferral: R-2 exists specifically so the testable logic lives in T7/T8 rather than being postponed.

### Parallelism Constraint Check

All three test types are marked **Parallel-Safe: Yes** in TESTING.md, so `[P]` is gated only by code dependencies and file disjointness.

| Parallel group | Tasks | Shared files? | Verdict |
|---|---|---|---|
| 14C after T2 | T3, T4, T5 | `WebViewRenderer.tsx` / `WebViewSetItemEditor.tsx` / new + `OperatorPresentationLayout.tsx` — disjoint | ✅ Safe |
| 14A after T12 | T13, T14, T17 | `outputDispatch.ts` / new / new + `SettingsScreen.tsx` — disjoint | ✅ Safe |
| Cross-slice | T5, T11 | **both edit `OperatorPresentationLayout.tsx`** | ❌ Never concurrently |
| Cross-slice | T17, T19 | **both edit `SettingsScreen.tsx`** | ❌ Never concurrently |
| 14D | T22 | none — touches only icon assets | ✅ Safe with anything |

Locale JSON files are touched by T4, T5, T10, T11, T14, T17, T19 and T20. Concurrent sub-agents editing `en-US.json`/`pt-BR.json` will conflict — **serialize the locale edit** within any parallel group, or have each agent append under a distinct top-level key and reconcile before running T21's parity test.

---

## Requirement Coverage

| Requirement | Task(s) |
|---|---|
| P14-01 | T13, T14, T15, T16 |
| P14-02 | T13 |
| P14-03 | T13 |
| P14-04 | T13, T15 |
| P14-05 | T14, T15 |
| P14-06 | T13, T16 |
| P14-07 | T12, T17 |
| P14-08 | T12 |
| P14-09 | T13, T15 |
| P14-10 | T12, T17 |
| P14-11 | T19 |
| P14-12 | T20 |
| P14-13 | T18, T20 |
| P14-14 | T18, T19 |
| P14-15 | T18 |
| P14-16 | T10, T11 |
| P14-17 | T8, T9 |
| P14-18 | T7, T9 |
| P14-19 | T7 |
| P14-20 | T8 |
| P14-21 | T9 |
| P14-22 | T9 |
| P14-23 | T9, T10 |
| P14-24 | T1, T2, T4 |
| P14-25 | T5 |
| P14-26 | T3, T5, T6 |
| P14-27 | T1, T5 |
| P14-28 | T1, T2, T3, T5 |
| P14-29 | T5 |
| P14-30 | T4 |
| P14-31 | T22 |
| P14-32 | T22 |

**Coverage: 32 of 32 requirements mapped, 0 unmapped.** ✅

---

## Tooling Question (open — needs your answer before Execute)

No MCP servers or skills are assumed by any task above; every task is plain file editing plus the two gate commands. Confirm whether you want any of the installed skills used during execution — `mermaid-studio` is the only obvious candidate (T21 could render the slice diagram), and `codenavi` is not installed.
