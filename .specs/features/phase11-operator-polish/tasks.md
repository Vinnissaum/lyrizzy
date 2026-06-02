# Phase 11: Operator Polish — Tasks

**Design**: `.specs/features/phase11-operator-polish/design.md`
**Status**: Draft

Frontend-only. Baseline at start: **254 Vitest tests** (38 files), `tsc --noEmit` clean. No task may reduce the pre-existing count (no silent deletions).

---

## Execution Plan

### Phase 1: Independent render/store changes (Parallel)

Three different files, no inter-dependencies.

```
T1 (PresentationApp) [P]
T2 (LivePreview)     [P]
T3 (store)           [P]
```

### Phase 2: Consumers of the store (Parallel, after T3)

```
        ┌→ T4 (StrophesGrid) [P]
T3 ─────┤
        └→ T5 (SetItemList)  [P]
```

### Phase 3: Wrap-up (Sequential)

```
T1, T2, T4, T5 ──→ T6
```

---

## Task Breakdown

### T1: Announcement renders over blackout in the projection window [P]

**What**: Reorder `PresentationApp` render branches so an `announcement` overlay draws above `blank`; media/webView overlays stay below blank. New order: `announcement-overlay → blank → other-overlay → idle → live/frozen`.
**Where**: `src/windows/presentation/PresentationApp.tsx` (modify) + `src/windows/presentation/PresentationApp.test.tsx` (modify)
**Depends on**: None
**Reuses**: existing announcement branch (`SlideStage` + `SlideContent warningText`), `PRESET_COLORS`
**Requirement**: P11-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] An `overlay?.type === "announcement"` branch renders BEFORE the `if (mode === "blank")` return.
- [ ] Media/webView overlay branches remain AFTER the blank return (blackout still wins for them).
- [ ] D-40 precedence comment updated to D-45 order.
- [ ] New test: mode `blank` + announcement overlay → announcement text rendered (not bare blackout).
- [ ] New test: mode `blank` + media overlay → still blackout (announcement-only scope).
- [ ] New test: mode `blank`, no overlay → solid black (no regression).
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`
- [ ] Test count: ≥254, no pre-existing test removed.

**Verify**: `npx vitest run src/windows/presentation/PresentationApp.test.tsx` — new cases green.

**Tests**: component
**Gate**: quick
**Commit**: `fix(presentation): announcement overlay renders over blackout (P11-01)`

---

### T2: Announcement-over-blackout mirrored in LIVE preview [P]

**What**: Same branch reorder in `LivePreview`: announcement overlay card above the `mode === "blank"` blackout card; media/webView overlay cards stay below blackout.
**Where**: `src/components/presentation/LivePreview.tsx` (modify) + `src/components/presentation/LivePreview.test.tsx` (modify)
**Depends on**: None
**Reuses**: existing announcement preview card
**Requirement**: P11-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Announcement-overlay card renders before the blackout card.
- [ ] Media/webView overlay cards stay after the blackout card.
- [ ] New test: mode `blank` + announcement overlay → preview shows announcement text.
- [ ] New test: mode `blank` + media overlay → preview shows BLACKOUT (FrameTag), not the media.
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`
- [ ] Test count: ≥254, no pre-existing test removed.

**Verify**: `npx vitest run src/components/presentation/LivePreview.test.tsx` — new cases green.

**Tests**: component
**Gate**: quick
**Commit**: `fix(presentation): LIVE preview mirrors announcement-over-blackout (P11-02)`

---

### T3: Optimistic selection in the presentation store [P]

**What**: Add `pendingSelection` field + `selectSlide(itemIndex, slideIndex)` action to `usePresentationStore`; clear `pendingSelection` on every authoritative state update (event listener + `goToItem` resolve + reject).
**Where**: `src/stores/presentation.ts` (modify) + `src/stores/presentation.test.ts` (**new**)
**Depends on**: None
**Reuses**: existing `subscribe`/`goToItem`/`onStateChanged` plumbing
**Requirement**: P11-03 (core)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `pendingSelection: { itemIndex, slideIndex } | null` defaults to `null`.
- [ ] `selectSlide` sets `pendingSelection` synchronously, then awaits `goToItem`, then sets returned authoritative `state` AND clears `pendingSelection`.
- [ ] On `goToItem` rejection, `selectSlide` clears `pendingSelection` (reconcile) and logs.
- [ ] The `onStateChanged` handler clears `pendingSelection` together with setting `state`.
- [ ] `pendingSelection` is NOT merged into `state` (LIVE preview/projection read `state` only).
- [ ] New test file mocks `../api/commands`: (a) `selectSlide` sets pending immediately; (b) resolves → authoritative state set + pending cleared; (c) rejects → pending cleared; (d) `state_changed` event clears a standing pending.
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`
- [ ] Test count: ≥254 + 4 new, no pre-existing test removed.

**Verify**: `npx vitest run src/stores/presentation.test.ts` — 4 new cases green.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(presentation): optimistic selectSlide in presentation store (P11-03)`

---

### T4: StrophesGrid — consume pending, memoize cards, crop to 16:9 [P]

**What**: (P11-03) highlight reads `pendingSelection ?? state` and `onClick` calls `selectSlide`; (P11-04) wrap `SlideCard` in `React.memo`, memoize `appearance` (`useMemo`) and the select handler (`useCallback`); (P11-05) move `aspect-video` onto the card's outer `<button>` and add `items-start` to the grid container.
**Where**: `src/components/presentation/StrophesGrid.tsx` (modify) + `src/components/presentation/StrophesGrid.test.tsx` (modify)
**Depends on**: T3
**Reuses**: `usePresentationStore.selectSlide` (T3), `SlideStage`, `SlideContent`
**Requirement**: P11-03, P11-04, P11-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `effectiveSlideIdx = (pendingSelection && pendingSelection.itemIndex === currentItemIndex) ? pendingSelection.slideIndex : currentSlideIndex`; `aria-current`/ring use it.
- [ ] `onClick` calls `selectSlide(currentItemIndex, slideIdx)` (not raw `goToItem`).
- [ ] `SlideCard` is `React.memo`-wrapped; `appearance` via `useMemo`; per-card handler via `useCallback` (stable identity).
- [ ] Outer `<button>` carries the 16:9 aspect ratio; grid container has `items-start`; active `ring-2`, badge overlay, and `SlideStage` letterbox preserved.
- [ ] New test: setting `pendingSelection` to a slide makes that card `aria-current` even though `state.currentSlideIndex` differs.
- [ ] New test: clicking a card calls `selectSlide` with the right indices.
- [ ] New test (structural, P11-05): the grid root has `items-start` and the card button carries the aspect-ratio class.
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`
- [ ] Test count: ≥254, no pre-existing test removed.

**Verify**: `npx vitest run src/components/presentation/StrophesGrid.test.tsx` — new cases green. Manual: open operator presentation layout — cards are tight 16:9 with no bottom gap; clicking a strophe highlights instantly.

**Tests**: component
**Gate**: quick
**Commit**: `fix(presentation): instant strophe highlight + tight 16:9 cards (P11-03/04/05)`

---

### T5: SetItemList — consume pending for instant active item [P]

**What**: Active-item highlight reads `pendingSelection?.itemIndex ?? currentItemIndex`; `onClick` calls `selectSlide(idx, 0)` (keep the already-active guard).
**Where**: `src/components/presentation/SetItemList.tsx` (modify) + `src/components/presentation/SetItemList.test.tsx` (modify)
**Depends on**: T3
**Reuses**: `usePresentationStore.selectSlide` (T3)
**Requirement**: P11-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `isActive` derives from `pendingSelection?.itemIndex ?? currentItemIndex`.
- [ ] `onClick` calls `selectSlide(idx, 0)` only when `idx !== liveIdx`.
- [ ] New test: standing `pendingSelection.itemIndex` makes that item `aria-current` before authoritative state catches up.
- [ ] New test: clicking a non-active item calls `selectSlide(idx, 0)`.
- [ ] Gate passes: `npx tsc --noEmit && npx vitest run`
- [ ] Test count: ≥254, no pre-existing test removed.

**Verify**: `npx vitest run src/components/presentation/SetItemList.test.tsx` — new cases green.

**Tests**: component
**Gate**: quick
**Commit**: `fix(presentation): instant set-item highlight via optimistic selection (P11-03)`

---

### T6: Wrap-up — full gate, ROADMAP, STATE, SUMMARY

**What**: Run the full gate, append the Phase 11 ROADMAP row, mark P11-01..P11-05 Verified in STATE/spec traceability, write `SUMMARY.md`.
**Where**: `.specs/project/ROADMAP.md`, `.specs/project/STATE.md`, `.specs/features/phase11-operator-polish/spec.md` (traceability), `.specs/features/phase11-operator-polish/SUMMARY.md` (new)
**Depends on**: T1, T2, T4, T5
**Reuses**: existing ROADMAP/STATE format
**Requirement**: all

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Full gate green: `cargo test --manifest-path src-tauri/Cargo.toml && npx tsc --noEmit && npx vitest run` (Rust unchanged — sanity only).
- [ ] ROADMAP Phase 11 section added with the 5-requirement table.
- [ ] STATE current-phase line → "Phase 11 IMPLEMENTED"; traceability statuses → Verified.
- [ ] `SUMMARY.md` written (area → tasks → delivered, final test counts).

**Verify**: gate command above exits 0; docs reflect completion.

**Tests**: none (docs) · **Gate**: full
**Commit**: `chore(phase11): wrap-up — roadmap, state, summary`

---

## Parallel Execution Map

```
Phase 1 (Parallel — 3 independent files):
    ├── T1 [P]  PresentationApp.tsx
    ├── T2 [P]  LivePreview.tsx
    └── T3 [P]  stores/presentation.ts

Phase 2 (Parallel — both depend on T3):
    T3 done, then:
      ├── T4 [P]  StrophesGrid.tsx
      └── T5 [P]  SetItemList.tsx

Phase 3 (Sequential):
    T1, T2, T4, T5 done, then:
      T6  (docs + full gate)
```

---

## Pre-Approval Validation

### Check 1 — Task Granularity

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 file (PresentationApp) — branch reorder | ✅ Granular |
| T2 | 1 file (LivePreview) — branch reorder | ✅ Granular |
| T3 | 1 file (store) — 1 field + 1 action | ✅ Granular |
| T4 | 1 file (StrophesGrid) — 3 cohesive changes, same file | ✅ Granular (file-cohesive; cannot split without same-file conflict) |
| T5 | 1 file (SetItemList) — highlight + click | ✅ Granular |
| T6 | docs + gate | ✅ Granular |

### Check 2 — Diagram ↔ Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | none | ✅ Match |
| T2 | None | none | ✅ Match |
| T3 | None | none | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T3 | T3 → T5 | ✅ Match |
| T6 | T1, T2, T4, T5 | T1,T2,T4,T5 → T6 | ✅ Match |

T1/T2/T3 are mutually independent (different files) → valid `[P]`. T4/T5 both depend only on T3 and touch different files → valid `[P]`.

### Check 3 — Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | `src/windows/**/*.tsx` | component | component | ✅ OK |
| T2 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T3 | `src/stores/*.ts` | unit | unit | ✅ OK |
| T4 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T5 | `src/components/**/*.tsx` | component | component | ✅ OK |
| T6 | docs only | none | none | ✅ OK |

All three checks pass.

---

## Requirement Coverage

| Requirement | Task(s) |
| ----------- | ------- |
| P11-01 | T1 |
| P11-02 | T2 |
| P11-03 | T3 (core), T4, T5 (consumers) |
| P11-04 | T4 |
| P11-05 | T4 |

5/5 requirements mapped. No unmapped requirements.
</content>
