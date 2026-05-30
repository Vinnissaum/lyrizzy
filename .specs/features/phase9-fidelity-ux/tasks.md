# Phase 9 — Fidelity & UX Tasks

**Design**: `.specs/features/phase9-fidelity-ux/design.md`
**Spec**: `.specs/features/phase9-fidelity-ux/spec.md`
**Status**: Done (2026-05-30) — all T1–T14 implemented + verified; T15 central gate green: tsc clean, 233 Vitest, Rust suite + clippy clean. Not yet committed.

Gate commands (from `.specs/codebase/TESTING.md`):
- **quick** (frontend): `npx vitest run`
- **quick** (rust): `cargo test --manifest-path src-tauri/Cargo.toml`
- **full**: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run`
- Always also keep `tsc --noEmit` and `cargo clippy -D warnings` clean.

Baseline test counts to preserve (Phase 8): **148 Vitest**, Rust suite green.

---

## Execution Plan

### Phase 1 — Foundation (all parallel, disjoint files)

```
T1 [P]  stores/settings.ts
T2 [P]  i18n locales
T3 [P]  SlideStage.tsx
T4 [P]  presentation.rs (blackout)
```

### Phase 2 — Bodies + locale sync

```
T1 ──┬──► T5  bodies.tsx        [P]
     └──► T6  loadLocale wiring  [P]
```

### Phase 3 — Switch

```
T3 ─┐
T5 ─┴──► T7  SlideContent.tsx
```

### Phase 4 — Projection routing

```
T6 ─┐
T7 ─┴──► T8  PresentationApp routing
```

### Phase 5 — Preview surfaces + UX (parallel, disjoint files)

```
T7 ──┬──► T9  [P] LivePreview
     ├──► T10 [P] StrophesGrid      (also needs T2)
     └──► T11 [P] SongEditor preview
T1 + T2 ──► T13 [P] SettingsScreen
T6 + T2 ──► T14 [P] disable tabs
(free)   ──► T12 [P] drag reorder
```

### Phase 6 — Verification

```
all ──► T15  full gate + regression sweep
```

---

## Task Breakdown

### T1: Extend settings store (locale + announcement margin + blackout toggle) [P]

**What**: Add `loadLocale()`, `announcementMargin` (+setter/+load/+key `announcement.margin`, default `lg`), `blackoutAfterSong` (+setter/+load/+key `presentation.blackout_after_song`, default `true`); include the two new keys in `PRESENTATION_SETTING_KEYS` and `loadPresentationSettings`.
**Where**: `src/stores/settings.ts`, `src/stores/settings.test.ts` (new if absent)
**Depends on**: None
**Reuses**: existing `readSetting`/`readBool`/`parseEnum` helpers; `MARGIN_VALUES`; `getSetting`/`setSetting`
**Requirement**: P9-01, P9-03, P9-09 (plumbing)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `loadLocale()` reads `app.locale`, sets store `locale` + calls `i18next.changeLanguage`, falls back to default on error
- [ ] `announcementMargin` + `blackoutAfterSong` fields, setters (persist via `setSetting`), and loaders exist
- [ ] Both new keys appear in `PRESENTATION_SETTING_KEYS` and are read in `loadPresentationSettings`
- [ ] Unit tests cover: locale parse/fallback, margin enum fallback, blackout bool fallback
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 (+ new) pass, no silent deletions

**Tests**: unit · **Gate**: quick
**Commit**: `feat(settings): locale load + announcement margin + blackout-after-song store fields`

---

### T2: Add Phase 9 i18n keys [P]

**What**: Add new translation keys to both locales: `nav.lockedWhilePresenting`, `presentation.blackoutSlide`, `settings.blackoutAfterSong` (+ description), `settings.announcementMargin` (+ margin option labels if not already present).
**Where**: `src/i18n/locales/en-US.json`, `src/i18n/locales/pt-BR.json`
**Depends on**: None
**Reuses**: existing key structure/namespaces
**Requirement**: P9-03, P9-06, P9-09 (strings)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] All keys present in BOTH locale files with the same shape (no missing-key drift)
- [ ] JSON valid; `tsc --noEmit` + `npx vitest run` still green
- [ ] Test count: ≥148 pass

**Tests**: none (locale JSON — not a tested layer per matrix) · **Gate**: quick
**Commit**: `chore(i18n): phase 9 strings (locked tabs, blackout, settings)`

---

### T3: Create `SlideStage` scaling shell [P]

**What**: A component that renders children onto a fixed 1280×720 stage and `transform: scale(min(cw/1280, ch/720))` to fit its container, letterboxing with a `backgroundColor` prop.
**Where**: `src/components/presentation/SlideStage.tsx`, `SlideStage.test.tsx`
**Depends on**: None
**Reuses**: `SlideChip.tsx` virtual-stage + `ResizeObserver` scale logic (STAGE_W/H, origin-top-left)
**Requirement**: P9-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Renders a 1280×720 inner stage, scaled to fill width and contained in height
- [ ] `backgroundColor` fills the container (letterbox bars match preset)
- [ ] Component test asserts stage dims + that children render inside
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 (+ new) pass

**Tests**: component · **Gate**: quick
**Commit**: `feat(presentation): shared SlideStage scaling shell`

---

### T4: Rust blackout slide after each song [P]

**What**: Add `BLACKOUT_SLIDE_LABEL = "__blackout__"` + pure `blackout_slide(song_id)` helper; in `load_set_for_presentation`, append it after each **Song** item's slides when `presentation.blackout_after_song` (default true) is set.
**Where**: `src-tauri/src/commands/presentation.rs`
**Depends on**: None
**Reuses**: `read_bool_setting`, `build_title_slide`/`resolve_title_credit` pattern, `Slide` struct (no change)
**Requirement**: P9-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `blackout_slide()` returns `Slide{ lines: vec![], section_label: "__blackout__", section_id: "{song_id}__blackout" }`
- [ ] Appended only for `SetItemType::Song`, only when setting enabled (default true)
- [ ] Inline `#[cfg(test)]` unit tests: appended when on, absent when off, only for songs (mirrors existing pure-helper tests in this file)
- [ ] Gate passes: `cargo test --manifest-path src-tauri/Cargo.toml` + `cargo clippy -D warnings` clean
- [ ] Rust test count: ≥ baseline (+ new) pass

**Tests**: unit (inline pure-helper; precedent: `build_title_slide` tests) · **Gate**: full
**Commit**: `feat(presentation): blackout slide after each song (default on)`

---

### T5: Slide bodies — `SongSlideBody` + `AnnouncementBody` [P]

**What**: Extract the song/blank/title/blackout text body (with author one notch smaller than body via `stepSize(fontSize,-1)`, title `stepSize(+1)`, blackout label → solid black no text) and a full-stage warning body honoring `announcementPosition` + new `announcementMargin`.
**Where**: `src/components/presentation/bodies.tsx`, `bodies.test.tsx`
**Depends on**: T1 (reads `announcementMargin`)
**Reuses**: `PresentationApp.SongSlide` JSX, `AnnouncementRenderer` body, `layout.ts` maps (`PREVIEW_SIZE_PX`, `MARGIN_CLASS`, `POSITION_CLASS`, `PRESET_COLORS`, `stepSize`)
**Requirement**: P9-05, P9-03, P9-09 (render)

**Tools**: MCP: NONE · Skill: `react-best-practices` (optional)

**Done when**:
- [ ] Title slide: author font size < title font size, same fg color, opacity-80
- [ ] `sectionLabel === "__blackout__"` → solid black div, no text
- [ ] Warning body fills the full stage with preset bg (no gray), honoring position + margin
- [ ] Component tests assert author<title size, blackout black, warning fill
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 (+ new) pass

**Tests**: component · **Gate**: quick
**Commit**: `feat(presentation): shared slide bodies (smaller author, blackout, full-fill warning)`

---

### T6: Wire `loadLocale()` into app boot [P]

**What**: Call `loadLocale()` in the `OperatorApp` and `PresentationApp` boot effects so the settings store `locale` (and thus `LanguagePicker`) matches the persisted/active locale.
**Where**: `src/windows/operator/OperatorApp.tsx`, `src/windows/presentation/PresentationApp.tsx`
**Depends on**: T1
**Reuses**: existing boot `useEffect` + `loadPresentationSettings()` call site
**Requirement**: P9-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Both windows call `loadLocale()` on mount
- [ ] Component test: with `app.locale=en-US` mocked, store `locale` resolves to `en-US`
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 (+ new) pass

**Tests**: component · **Gate**: quick
**Commit**: `fix(i18n): sync settings-store locale from DB at boot (picker selection bug)`

---

### T7: `SlideContent` item-type switch

**What**: One renderer that maps `{itemType, slide, background, appearance, previewMode, configs}` to the correct body/renderer (song/blank/title/blackout→`SongSlideBody`; warning→`AnnouncementBody`; countdown→`CountdownRenderer`; media image→`<img>`; slideshow→`SlideshowRenderer`; video/web_view→placeholder in preview, real renderer when `previewMode=false`).
**Where**: `src/components/presentation/SlideContent.tsx`, `SlideContent.test.tsx`
**Depends on**: T3, T5
**Reuses**: `bodies.tsx`, `CountdownRenderer`, `SlideshowRenderer`, `MediaSlideRenderer`/`WebViewRenderer`, `LivePreview` placeholder cards
**Requirement**: P9-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Every item type routes to the correct body/renderer
- [ ] `previewMode` swaps video/web_view to placeholder cards (D-34), real renderers when false
- [ ] Component tests cover each branch (song, warning, countdown, image, slideshow, placeholders, blackout)
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 (+ new) pass

**Tests**: component · **Gate**: quick
**Commit**: `feat(presentation): SlideContent unified item-type renderer`

---

### T8: Route `PresentationApp` through SlideStage + SlideContent

**What**: Replace the inline `SongSlide` + per-item branches in the projection window with `<SlideStage><SlideContent previewMode={false} .../></SlideStage>`; route the announcement/overlay branch through `SlideContent` warning. Behavior-preserving for the projector.
**Where**: `src/windows/presentation/PresentationApp.tsx`
**Depends on**: T7, T6 (same-file ordering)
**Reuses**: existing state wiring, `TransitionStage` (wraps the stage), appearance assembly
**Requirement**: P9-02, P9-03, P9-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Projection renders via the shared stage; songs/title/warning/countdown/media/slideshow unchanged visually
- [ ] Existing `PresentationApp.test.tsx` passes (updated if structure changed, no assertion weakening)
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 pass

**Tests**: component · **Gate**: quick
**Commit**: `refactor(presentation): projection renders through shared SlideStage`

---

### T9: Route `LivePreview` through shared renderer [P]

**What**: Delete `SongSlidePreview`; render `<SlideStage><SlideContent previewMode .../></SlideStage>` driven by live state. Keep `FrameTag` (BLACKOUT/CONGELADO) + empty state.
**Where**: `src/components/presentation/LivePreview.tsx`
**Depends on**: T7
**Reuses**: `SlideContent`, `usePresentationStore`, settings appearance
**Requirement**: P9-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Live pane honors font/size/position/margin/preset/background for all item types
- [ ] `LivePreview.test.tsx` passes (updated, no weakened assertions)
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 pass

**Tests**: component · **Gate**: quick
**Commit**: `feat(presentation): faithful live preview via shared renderer`

---

### T10: Larger faithful strophe thumbnails [P]

**What**: Rebuild `SlideCard` to render a faithful slide via `SlideStage`+`SlideContent` with a section-label badge; enlarge grid (`minmax(~220px,1fr)`); render blackout slides as a black thumbnail labeled `t("presentation.blackoutSlide")`. Keep active highlight + `scrollIntoView`.
**Where**: `src/components/presentation/StrophesGrid.tsx`
**Depends on**: T7, T2
**Reuses**: shared renderer; existing active-ref/scroll logic; `itemMeta`
**Requirement**: P9-08, P9-09 (grid badge)

**Tools**: MCP: NONE · Skill: `web-design-guidelines` (optional)

**Done when**:
- [ ] Thumbnails are faithful 16:9 previews, larger than current 160px tiles
- [ ] Blackout slide shows black thumb + label
- [ ] Active highlight + auto-scroll preserved; `StrophesGrid.test.tsx` passes
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 pass

**Tests**: component · **Gate**: quick
**Commit**: `feat(presentation): larger faithful strophe thumbnails`

---

### T11: Song-editor faithful preview pane [P]

**What**: Add a right-side, default-open `SongPreviewPane` rendering the whole song (title slide + `sections.flatMap(splitSectionBody)` [+ trailing blackout if enabled]) as faithful thumbnails; refit `SongEditor` to a two-column layout; remove the per-section Eye toggle from `SectionCard`.
**Where**: `src/components/presentation/SongPreviewPane.tsx` (new), `src/components/library/SongEditor.tsx`, `src/components/library/SectionCard.tsx`
**Depends on**: T7
**Reuses**: `splitSectionBody` (`utils/slidePreview.ts`), existing `previewBackground` memo + assembled `appearance`, shared renderer
**Requirement**: P9-04

**Tools**: MCP: NONE · Skill: `react-best-practices` (optional)

**Done when**:
- [ ] Preview pane visible by default, lists title + all section slides faithfully
- [ ] Pane updates on text/casing/repeat/background edits
- [ ] `SectionCard` Eye toggle + `previewOpen` removed; `SongEditor.test.tsx`/`SectionCard` tests updated and green
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 pass

**Tests**: component · **Gate**: quick
**Commit**: `feat(library): faithful whole-song preview pane in editor`

---

### T12: Drag-to-reorder set items [P]

**What**: Add dnd-kit drag reorder to the set item list in `SetBuilder` (and the `HomeSetBuilder` set list), persisting via `reorderSetItems`; keep the up/down arrow buttons.
**Where**: `src/components/set/SetBuilder.tsx`, `src/components/setbuilder/HomeSetBuilder.tsx`
**Depends on**: None
**Reuses**: `SectionCard` dnd-kit pattern (`DndContext`/`SortableContext`/`useSortable`/`arrayMove`), `reorderSetItems` (`api/commands.ts:254`)
**Requirement**: P9-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Set items reorder by drag; new order persists via `reorder_set_items`
- [ ] Arrow buttons still work; component test covers a drag-end reorder calling the command
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 (+ new) pass

**Tests**: component · **Gate**: quick
**Commit**: `feat(set): drag-to-reorder set items`

---

### T13: Settings UI — blackout toggle + announcement margin [P]

**What**: Add a "Black slide after each song" toggle (`blackoutAfterSong`) and an announcement margin picker to `SettingsScreen`, wired to the store setters.
**Where**: `src/components/settings/SettingsScreen.tsx`
**Depends on**: T1, T2
**Reuses**: existing `Toggle`/select patterns in `SettingsScreen`, store setters
**Requirement**: P9-03, P9-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Toggle reflects/sets `blackoutAfterSong`; margin picker reflects/sets `announcementMargin`
- [ ] Labels use T2 keys; component test asserts toggle/select wiring
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 (+ new) pass

**Tests**: component · **Gate**: quick
**Commit**: `feat(settings): blackout-after-song toggle + announcement margin`

---

### T14: Disable nav tabs while presenting [P]

**What**: When `isPresenting`, render the five top-nav buttons as disabled (`disabled`, `disabled:opacity-50 disabled:cursor-not-allowed`, `title={t("nav.lockedWhilePresenting")}`).
**Where**: `src/windows/operator/OperatorApp.tsx`
**Depends on**: T6 (same-file ordering), T2 (string)
**Reuses**: existing `isPresenting` flag + nav button block (`OperatorApp.tsx:220-272`)
**Requirement**: P9-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Tabs disabled + visually muted while presenting; clicks no-op
- [ ] Tabs restored after exit; `OperatorApp` test asserts disabled state while presenting
- [ ] Gate passes: `npx vitest run`
- [ ] Test count: ≥148 (+ new) pass

**Tests**: component · **Gate**: quick
**Commit**: `feat(operator): disable nav tabs while presenting`

---

### T15: Verification & regression sweep

**What**: Run the full gate, `tsc --noEmit`, `cargo clippy -D warnings`; visually confirm preview==projection for each item type; confirm blackout toggle behavior end-to-end.
**Where**: repo-wide
**Depends on**: T1–T14
**Reuses**: existing suites
**Requirement**: all (verification)

**Tools**: MCP: NONE · Skill: `verify` (optional, run the app)

**Done when**:
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run` green
- [ ] `tsc --noEmit` clean; `cargo clippy -D warnings` clean
- [ ] Manual: live pane, strophe thumbs, editor preview each match projection for song/warning/countdown/image
- [ ] Test count ≥148 Vitest + Rust baseline, no silent deletions

**Tests**: full suite · **Gate**: full
**Commit**: `test(phase9): full gate + regression sweep`

---

## Pre-Approval Validation

### Check 1 — Task Granularity

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 store file (cohesive settings plumbing) | ✅ |
| T2 | 2 locale JSONs (same keys) | ✅ |
| T3 | 1 component | ✅ |
| T4 | 1 Rust helper + insertion (1 file) | ✅ |
| T5 | bodies module (2 cohesive bodies, 1 file) | ✅ |
| T6 | 2 boot effects (1 trivial call each) | ✅ |
| T7 | 1 switch component | ✅ |
| T8 | 1 window (route through renderer) | ✅ |
| T9 | 1 component | ✅ |
| T10 | 1 component | ✅ |
| T11 | preview pane + editor layout + toggle removal (cohesive) | ✅ |
| T12 | reorder behavior (2 list files, same pattern) | ✅ |
| T13 | 1 settings screen | ✅ |
| T14 | 1 window nav block | ✅ |
| T15 | verification | ✅ |

### Check 2 — Diagram ↔ Definition Cross-Check

| Task | Depends on (body) | Diagram arrows | Status |
| --- | --- | --- | --- |
| T1 | None | (root) | ✅ |
| T2 | None | (root) | ✅ |
| T3 | None | (root) | ✅ |
| T4 | None | (root) | ✅ |
| T5 | T1 | T1→T5 | ✅ |
| T6 | T1 | T1→T6 | ✅ |
| T7 | T3, T5 | T3→T7, T5→T7 | ✅ |
| T8 | T7, T6 | T6→T8, T7→T8 | ✅ |
| T9 | T7 | T7→T9 | ✅ |
| T10 | T7, T2 | T7→T10, T2→T10 | ✅ |
| T11 | T7 | T7→T11 | ✅ |
| T12 | None | (free node) | ✅ |
| T13 | T1, T2 | T1→T13, T2→T13 | ✅ |
| T14 | T6, T2 | T6→T14, T2→T14 | ✅ |
| T15 | T1–T14 | all→T15 | ✅ |

Parallel-group check: Phase 1 `[P]` {T1,T2,T3,T4} — mutually independent, disjoint files ✅. Phase 2 `[P]` {T5,T6} — both depend T1 only, disjoint files (bodies.tsx vs windows) ✅. Phase 5 `[P]` {T9,T10,T11,T12,T13,T14} — disjoint files (LivePreview / StrophesGrid / SongEditor+SongPreviewPane+SectionCard / SetBuilder+HomeSetBuilder / SettingsScreen / OperatorApp), no shared file ✅.

### Check 3 — Test Co-location Validation

| Task | Layer modified | Matrix requires | Task says | Status |
| --- | --- | --- | --- | --- |
| T1 | `src/stores/*.ts` | unit | unit | ✅ |
| T2 | locale JSON | none (not listed) | none | ✅ |
| T3 | `src/components/**` | component | component | ✅ |
| T4 | `commands/presentation.rs` | none* (handlers) | unit (pure helper) | ✅ see note |
| T5 | `src/components/**` | component | component | ✅ |
| T6 | `src/windows/**` | component | component | ✅ |
| T7 | `src/components/**` | component | component | ✅ |
| T8 | `src/windows/**` | component | component | ✅ |
| T9 | `src/components/**` | component | component | ✅ |
| T10 | `src/components/**` | component | component | ✅ |
| T11 | `src/components/**` | component | component | ✅ |
| T12 | `src/components/**` | component | component | ✅ |
| T13 | `src/components/**` | component | component | ✅ |
| T14 | `src/windows/**` | component | component | ✅ |

*Note (T4): the matrix marks `commands/*.rs` as "none (tested via integration)" because async handlers need a DB. T4's deliverable is a **pure** helper (`blackout_slide` + an enable-gated insertion), which the same file already unit-tests inline (`build_title_slide`, `resolve_next_slide`, `wake_to_live`). Unit-testing the pure logic is stricter than the matrix minimum, not a violation.

---

## Tools Question (Step 6)

Default per task is **no MCP / no Skill**. Optional skill suggestions are noted on T5/T10/T11/T15. Confirm before Execute:
- Use `react-best-practices` on the renderer tasks (T5, T7, T11)?
- Use `web-design-guidelines` on the thumbnail redesign (T10)?
- Use the `verify`/`run` skill for the manual fidelity check in T15?
- Any MCPs to enable, or proceed with built-in file tools only?
</content>
