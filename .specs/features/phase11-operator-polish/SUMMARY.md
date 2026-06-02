# Phase 11: Operator Polish — Completion Summary

**Completed:** 2026-06-02
**Spec:** `.specs/features/phase11-operator-polish/spec.md` (5 requirements P11-01..P11-05)
**Scope:** Frontend-only — no Rust, no schema, no IPC contract change. Backend `PresentationState` remains the single source of truth (architecture invariant preserved).

All 5 P11-01..P11-05 requirements delivered via T1–T6 (parallel sub-agents: T1/T2/T3 independent; T4/T5 after T3; T6 wrap-up).

| Area | Task(s) | Delivered |
|---|---|---|
| Announcement over blackout — projection | T1 (P11-01) | `PresentationApp.tsx` render precedence reordered to **announcement-overlay → blank → other-overlay → idle → live/frozen** (D-45). The `overlay?.type === "announcement"` branch lifted above the `if (mode === "blank")` return; media/webView overlays stay below blank. D-40 comment updated. +3 tests (announcement-over-blank renders text; media-over-blank stays black; no-overlay blank stays black). |
| Announcement over blackout — LIVE preview | T2 (P11-02) | `LivePreview.tsx` mirrors the same precedence: announcement card before the `BLACKOUT` FrameTag card; media/webView cards stay below blackout. +2 tests (announcement text over blank; media-over-blank shows BLACKOUT). |
| Optimistic selection — store | T3 (P11-03 core) | `usePresentationStore` gains `pendingSelection: {itemIndex, slideIndex} | null` + `selectSlide(itemIndex, slideIndex)` — sets pending synchronously, awaits `goToItem`, reconciles `state` and clears pending; clears pending on reject. The `onStateChanged` handler now clears `pendingSelection` with every authoritative update (D-46). `pendingSelection` kept separate from `state` so LIVE/projection stay truthful. New `src/stores/presentation.test.ts` (+4 tests). |
| Optimistic + memo + crop — StrophesGrid | T4 (P11-03/04/05) | Highlight reads `effectiveSlideIdx = (pendingSelection && pendingSelection.itemIndex === currentItemIndex) ? pendingSelection.slideIndex : currentSlideIndex`; click → `selectSlide`. `SlideCard` wrapped in `React.memo`; `appearance` via `useMemo`; one stable `useCallback` `onSelect` handler. 16:9 moved onto the outer `<button>` (`aspect-video w-full`) + grid `items-start` → tight cards, no empty space; ring/badge/`SlideStage` letterbox preserved. +3 tests. |
| Optimistic selection — SetItemList | T5 (P11-03) | Active item from `pendingSelection?.itemIndex ?? currentItemIndex`; click → `selectSlide(idx, 0)` with the existing already-active guard. +2 tests. |
| Wrap-up | T6 | Full gate green; ROADMAP Phase 11 section, STATE current-phase + this summary, spec traceability → Verified. |

## Decisions referenced
- **D-45** — announcement-over-blackout is announcement-scoped and render-only; new precedence partially reverses D-40's "blank beats everything". Oferta/Câmera still lose to blackout. Backend `overlay.rs` still does NOT flip `mode`, so clearing the announcement restores blackout automatically.
- **D-46** — operator selection feedback is optimistic: local highlight updates immediately, reconciles to backend `state_changed` (backend stays source of truth). Paired with memoized `SlideCard` so the full grid does not re-render per state change.

## Test results at completion
- `npx tsc --noEmit` — clean.
- `npx vitest run` — **268 tests across 39 files** passing (baseline 254; +14 new: T1 ×3, T2 ×2, T3 ×4, T4 ×3, T5 ×2). No pre-existing test removed.
- `cargo test --manifest-path src-tauri/Cargo.toml` — green (Rust unchanged; sanity only).

## Verification notes (manual, on hardware)
- P11-05 "zero empty space" and P11-03 "perceptually instant highlight" are not directly unit-assertable; tests cover structural proxies (`items-start` on grid root, `aspect-video` on the card button, `aria-current` driven by `pendingSelection`). Manual confirmation on the two-monitor rig recommended: F10 blackout → Aviso shows over black → clear → returns to black → F10 restores live; rapid strophe/set-item clicking tracks with no lag; cards are tight 16:9.
