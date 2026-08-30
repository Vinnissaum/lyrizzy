# Phase 16 — Tasks

**Status:** All tasks T1–T12 complete (2026-08-30). T13 is manual hardware verification, still outstanding.
**Spec:** `spec.md` · **Design:** `design.md`
**Gate (every task):** `npx vitest run` green · `npx tsc --noEmit` clean · `cargo test --manifest-path src-tauri/Cargo.toml` green · `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` clean · `pwsh -File scripts/check-theme-tokens.ps1` green

Rust tasks (T1, T2, T5) additionally require the local toolchain: Rust 1.96.0 (installed) **and** the MSVC linker + Windows SDK.

---

## Dependency Graph

```
T1 ─┐                          (Rust: pin predicates)
T2 ─┴─→ T3                     (Rust: focus-loss re-assert)   T3 verifies 16A on hardware
T5                             (Rust: parser — independent)
T4                             (i18n rename — independent)
T6 ─→ T7 ─→ T8 ─→ T9           (16E: predicate → modal → wiring → verify)
T10                            (16C — independent)
T1..T10 ─→ T11 ─→ T12          (version bump → tag)
```

Parallelisable: **T1, T4, T5, T6, T10** have no interdependencies.

---

## T1 — `should_pin_on_top` covers every fullscreen presentation

- **What:** Re-key the predicate from monitor count to "is this going fullscreen", per design §16A.
- **Where:** `src-tauri/src/commands/window.rs`
- **Reuses:** `use_windowed_fallback` (existing, unchanged)
- **Done when:** `should_pin_on_top(output, target_idx)` returns `!use_windowed_fallback(...)`; the call site is moved below `target_idx` resolution and passes the new arguments; the `builder.always_on_top` line and its `tracing::info!` field are unchanged in behaviour.
- **Tests:** Rewrite the four `should_pin_on_top_*` unit tests against the new signature — pinned for `One`/`Two` with a resolved monitor, pinned for `One` with none, **not** pinned for `Two` with none. Keep a case asserting the single-monitor setup is still pinned.
- **Requirements:** P16-01, P16-02

## T2 — `should_reassert_on_top` predicate

- **What:** Add the pure label predicate the focus-loss handler will consult.
- **Where:** `src-tauri/src/commands/window.rs`
- **Reuses:** `should_close_presentation_on_destroy` (same shape, adjacent), `OutputId::ALL` / `window_label()`
- **Done when:** `pub(crate) fn should_reassert_on_top(label: &str) -> bool` exists and is exported for `lib.rs`.
- **Tests:** true for every `OutputId::ALL` label; false for `"operator"`, `""`, and an unknown label.
- **Requirements:** P16-04

## T3 — Re-assert the pin on focus loss

- **What:** Extend the `WindowEvent::Focused(false)` arm to re-apply always-on-top for fullscreen presentation windows.
- **Where:** `src-tauri/src/lib.rs` (the arm currently at `:116`)
- **Depends on:** T2
- **Done when:** The arm keeps its existing `tracing::info!`, then — only when `should_reassert_on_top(&label)` **and** `window.is_fullscreen()` — calls `window.set_always_on_top(true)`, logging any `Err` at `warn` and swallowing it. The operator window's behaviour is byte-identical to today.
- **Tests:** No unit test (needs a live WebView). Covered by T2's predicate tests plus the T13 hardware pass.
- **Requirements:** P16-03

## T4 — Rename the blank set item to "Tela preta"

- **What:** Three values per locale, per design §16B.
- **Where:** `src/i18n/locales/pt-BR.json`, `src/i18n/locales/en-US.json`
- **Done when:** `builder.blank`, `builder.add.blank`, `presentation.blankSlide` read "Tela preta" / "Black screen". **Keys unchanged.** `presentation.mode.blank`, the `blank` keybinding label and `SongEditor`'s "linha em branco" placeholder are untouched.
- **Tests:** `src/tests/i18n/key-completeness.test.ts` stays green. Update the string assertions in `SetBuilder.test.tsx` / `SlideController` tests if any assert the old copy. Add a guard asserting no locale value contains "Tela em branco".
- **Requirements:** P16-05, P16-06, P16-07, P16-08

## T5 — Holyrics single-object root

- **What:** Accept an object root as a one-song list, per design §16D.
- **Where:** `src-tauri/src/services/holyrics_parser.rs`
- **Done when:** `parse` normalises the root via the three-way match; the array branch is behaviourally unchanged; `UnexpectedShape`'s `Display` names both accepted shapes.
- **Tests:** Add — single-object root yields one song with title/artist/sections matching the array form; object root with no `lyrics` yields one song with zero sections; number root and string root both `UnexpectedShape`. All existing tests pass unmodified.
- **Requirements:** P16-13, P16-14, P16-15, P16-16

## T6 — `needsStopChoice` predicate

- **What:** The pure gate deciding whether Stop must ask.
- **Where:** `src/utils/outputDispatch.ts`
- **Reuses:** the file's existing pure-decision convention (`resolveLaunchPlan`)
- **Done when:** `needsStopChoice(multiScreenEnabled, mirrorEnabled, presentingOutputs)` is exported and does no I/O and no store reads.
- **Tests:** `src/utils/outputDispatch.test.ts` — false when multi-screen off (even with 2 presenting); false when mirroring; false with 0 or 1 presenting; true only for multi-screen + mirror off + size > 1.
- **Requirements:** P16-17, P16-18

## T7 — `StopPresentationModal`

- **What:** The pure question component, per design §16E.
- **Where:** `src/components/presentation/StopPresentationModal.tsx` (new) + `presentation.stopChoice.*` in both locales
- **Depends on:** T6 (for the `OutputId` set shape only)
- **Reuses:** `MultiScreenLaunchModal` shell + Esc handling; `RestoreInProgressDialog` warning treatment; `outputScreenName`
- **Done when:** Renders the situation line, the irreversibility warning in the `warning` token family with an icon, the question, one button per member of `presentingOutputs` labelled with its monitor name, "Parar todas", and Cancel. Touches **no** store and issues **no** command — every action is a prop callback. Esc calls `onCancel`.
- **Tests:** `StopPresentationModal.test.tsx` — renders one stop button per presenting output; button labels use configured monitor names; each callback fires with the right output; Esc and the `X` call `onCancel`; the warning copy is present.
- **Requirements:** P16-19, P16-20, P16-23

## T8 — Wire the gate into both stop entry points

- **What:** Route Stop and Esc/rebind through one decision path that can open the modal.
- **Where:** `src/windows/operator/OperatorApp.tsx`, `src/components/presentation/OperatorPresentationLayout.tsx`
- **Depends on:** T6, T7
- **Done when:** `OperatorApp` owns `stopChoiceOpen` and a `requestStop()` that (1) clears an overlay if present and returns, (2) otherwise consults `needsStopChoice` with live values read through refs/stores, (3) either performs today's `exitPresentation` + `fanOutToMirror` or opens the modal. `handleExit` calls `requestStop()`. `OperatorPresentationLayout` takes `onRequestStop` and its `handleStop` delegates to it while keeping `setEditingSongId(null)`. Modal callbacks call `exitPresentation` once per chosen output.
- **Tests:** `OperatorApp.test.tsx` — mirror ON stops both with no modal; single-screen stops immediately; multi-screen + mirror off + 2 presenting opens the modal; picking one output calls `exitPresentation` once with that output and never with the other; "Parar todas" calls it once per presenting output; Cancel calls it zero times; an active overlay clears the overlay and never opens the modal.
- **Requirements:** P16-21, P16-22, P16-24, P16-25

## T9 — Stop-flow regression sweep

- **What:** Confirm no existing stop/exit test drifted.
- **Where:** `src/windows/operator/OperatorApp.test.tsx`, `OperatorPresentationLayout.test.tsx`, `PresentationLaunchProvider.test.tsx`
- **Depends on:** T8
- **Done when:** Every pre-existing exit assertion still passes or has been updated with a written reason; `PresentationLaunchProvider`'s `exitPresentation("one")` reset path is unaffected.
- **Requirements:** P16-18, P16-24

## T10 — Simultânea placement and colour

- **What:** Tabs always rendered, button adjacent, distinct ON colour, per design §16C.
- **Where:** `src/components/presentation/OutputSwitcher.tsx`
- **Done when:** the `!mirrorEnabled &&` guard and `ml-auto` are gone; mirror-ON tabs carry `data-mirrored="true"` and drop `aria-current`; the toggle's ON style uses the `warning` token family, never `bg-primary`; `aria-pressed` retained; tab click still calls `setFocusedOutput` and does not disengage mirror.
- **Tests:** `OutputSwitcher.test.tsx` — both tabs render with mirror ON and with it OFF; the toggle is the last element and no longer carries `ml-auto`; ON classes contain no `bg-primary`; clicking a tab while mirroring calls `setFocusedOutput` and leaves `mirrorEnabled` true and requests no launch for a presenting output.
- **Requirements:** P16-09, P16-10, P16-11, P16-12

## T11 — Version bump to 1.3.0

- **What:** Bump every version file.
- **Where:** `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`
- **Depends on:** T1..T10
- **Done when:** `node scripts/bump-version.mjs 1.3.0` run and `node scripts/check-version.mjs` passes.
- **Requirements:** P16-26

## T12 — Full gate + release tag

- **What:** Run the complete gate, commit, tag.
- **Depends on:** T11
- **Done when:** all five gate commands are green; a `chore(release): bump version to 1.3.0` commit exists; annotated tag `v1.3.0` points at it.
- **Requirements:** P16-27, P16-28

## T13 — Hardware verification (manual, operator)

- **What:** The four checks in design §"Verification Beyond Unit Tests" — Alt+Tab over two projections, the windowed fallback stays reachable, the stop modal with mirror off, no modal with mirror on.
- **Depends on:** T12
- **Note:** Cannot be automated. 16A in particular is only provable on a real two-monitor Windows setup, per the standing project gotcha on OS-dependent monitor behaviour.
- **Requirements:** P16-01, P16-02, P16-03, P16-17, P16-18
