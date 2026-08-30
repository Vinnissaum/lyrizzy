# Phase 16 — Multi-Screen Focus Integrity, Simultaneous Control & Import/Naming Fixes

**Status:** IMPLEMENTED (2026-08-30) — 28/28 requirements done, released as `v1.3.0`. Gate: 641 Vitest, 349 Rust (1 ignored), `tsc --noEmit` clean, `cargo clippy -D warnings` clean, theme-token lint clean. See `tasks.md` for per-task status.
**Depends on:** Phase 14 (dual independent outputs, multi-screen launch modal), Phase 15 (free-text lyrics, monitor naming), D-47 (dual independent outputs)
**Release target:** its own tag, `v1.3.0` (minor — new operator-facing behaviour + fixes, no schema change)

---

## Problem Statement

Field use of the dual-output presentation (Phase 14) surfaced one hard defect and four usability gaps.

The hard defect: with two screens presenting, **any other Windows app the operator brings forward with Alt+Tab draws on top of a presentation screen**. The congregation sees Windows Explorer instead of the slide. This is not a rendering bug — the presentation windows are simply not pinned above other windows whenever more than one monitor is attached.

The four gaps are all about the operator understanding what the app is doing: a set item named for the wrong colour, a Simultânea toggle that reads exactly like a screen tab and sits far from the tabs it relates to, an importer that rejects a perfectly valid single-song Holyrics export, and a Stop button that silently kills one of two independently-driven screens with no warning that the screen cannot be brought back.

---

## Root-Cause Analysis

Each report was traced to a specific line before this spec was written. No requirement below is speculative.

| # | Report | Root cause | Evidence |
|---|--------|-----------|----------|
| RC-1 | Alt+Tab lets another window (e.g. Explorer) take over a screen that is presenting | `should_pin_on_top` returns `monitor_count == 1`. The always-on-top flag is applied **only** on a single-monitor setup (where it is needed to sit above the operator window). With 2+ monitors *no* presentation window is topmost, so the shell is free to activate any other window over the fullscreen presentation. Nothing ever re-asserts the flag either, so even a pinned window can be demoted by the WM after a focus change. | `commands/window.rs:296-300` (`should_pin_on_top`), `:399` (call site), `:414` (`builder.always_on_top(true)` only when `pin_on_top`), `lib.rs:116` (`Focused(false)` is logged and otherwise ignored) |
| RC-2 | The "Em branco" set item should be called "Tela preta" | Three strings name the `blank` **set item type** by the wrong colour: `builder.blank` and `presentation.blankSlide` say "Tela em branco", `builder.add.blank` says "Branco". The app already calls the *blackout mode* "Tela Preta" (`presentation.mode.blank`) and the shortcut "Alternar tela preta" — the set item label is the odd one out, and the slide it projects is black. | `i18n/locales/pt-BR.json:142,150,226` vs. the already-correct `:221,799`; consumed at `SetBuilder.tsx:482,865`, `SlideController.tsx:126,159` |
| RC-3 | Simultâneo should sit next to the screen switches and stand out more | `{!mirrorEnabled && OUTPUTS.map(...)}` removes the screen tabs the moment mirror engages, and `ml-auto` on the toggle pushes it to the opposite end of the bar — so turning Simultânea on makes the whole control group jump. The ON state also uses `bg-primary text-fg-on-primary`, byte-identical to an active screen tab, so "Simultânea is engaged" and "Tela 2 is focused" render the same. | `OutputSwitcher.tsx:73-74` (tabs hidden), `:96` (`ml-auto`), `:82` vs `:98` (identical ON styling) |
| RC-4 | Holyrics import fails when a single song is exported | `parse` calls `raw.as_array().ok_or_else(...)` and hard-fails `UnexpectedShape` on anything that is not a JSON array. Holyrics exports a bare object (no array wrapper) when exactly one song is selected. | `services/holyrics_parser.rs:60-66`; surfaced through `commands/import.rs:82-91` |
| RC-5 | Stopping with two independently-controlled screens should ask which screen | `handleStop` and `handleExit` both run `exitPresentation(focusedOutput)` + `fanOutToMirror(...)`. With mirror **off**, `fanOutToMirror` expands to nothing, so Stop silently ends only whichever screen happens to be focused — with no prompt, no indication that the other screen is still live, and no way back: `exit_presentation` sets the output to `Idle`, clears the overlay and destroys the window, so the screen can only return by presenting from scratch. | `OperatorPresentationLayout.tsx:210-218`, `OperatorApp.tsx:263-274`, `utils/outputDispatch.ts:33-42` (`mirrorTargets` is empty when mirror is off), `commands/window.rs:494-515` (exit resets to `Idle`) |

---

## Goals

- [ ] A screen that is presenting **stays** presenting — no Alt+Tab, no newly opened app, and no focus change can put another window in front of it
- [ ] Every label names the thing it actually projects: the black set item is "Tela preta" everywhere
- [ ] Simultânea reads as a distinct mode, not as a third screen tab, and never moves away from the switches it governs
- [ ] A Holyrics export imports whether it contains one song or many
- [ ] Stopping two independently-controlled screens is a deliberate, informed choice — the operator picks the screen and is told the control is unrecoverable

## Out of Scope

| Item | Reason |
|------|--------|
| Renaming the `blank` **set item type** in the DB / `SetItemType` union | Display-name change only (RC-2 is about wording). Renaming the discriminator would break existing sets, `.tlz` backups and the slide splitter for no user-visible gain |
| Renaming `presentation.mode.blank` ("Tela Preta") or the `blank` keybinding label | Already correct; only the set item strings are wrong |
| A "resume screen" / re-attach flow after Stop | `exit_presentation` is destructive by design (window destroyed, state `Idle`). P16-19 makes that *explicit* to the operator; building resume is a separate feature |
| Supporting `{"songs": [...]}` or other Holyrics wrappers | Not observed in any export. Group 16D accepts exactly the two documented shapes: array root and single-object root |
| Always-on-top for the operator window | The operator must remain able to Alt+Tab to other apps on their own screen — that is the workflow, not the bug |
| Changing the Simultânea *behaviour* (what it mirrors) | RC-3 is placement and colour only; `engageMirror` is untouched |

---

## User Stories

### 16A — Presentation screens stay in front

#### P1: Alt+Tab cannot cover a presenting screen (MVP)

> As an operator presenting on two screens, when I open Windows Explorer and Alt+Tab to it, I want the congregation's screens to keep showing the presentation, so that my own multitasking is never projected.

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| P16-01 | A presentation window that goes fullscreen is pinned above other windows **regardless of monitor count** | `should_pin_on_top` returns `true` for the fullscreen path on 1, 2 and 3 monitors |
| P16-02 | The windowed fallback (secondary output with no free monitor) is **not** pinned | `should_pin_on_top` returns `false` when the windowed fallback applies, so the operator can never be locked behind an unreachable window on their own screen |
| P16-03 | Losing focus re-asserts the pin on a presentation window | A `WindowEvent::Focused(false)` on a presentation label re-applies `set_always_on_top(true)`; the operator label is untouched |
| P16-04 | Re-asserting is decided by a pure, tested predicate — not inline in the event handler | `should_reassert_on_top(label)` is true for every `OutputId::ALL` window label and false for `"operator"` and unknown labels |

### 16B — The black set item is called "Tela preta"

#### P2: Consistent naming for the blank item

> As an operator building a set, I want the black-screen item to be called what it projects, so that I do not confuse it with a white slide.

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| P16-05 | The set item label reads "Tela preta" in the builder list | `builder.blank` = "Tela preta" (pt-BR) / "Black screen" (en-US) |
| P16-06 | The add-item button reads "Tela preta" | `builder.add.blank` = "Tela preta" / "Black screen" |
| P16-07 | The operator slide list reads "Tela preta" | `presentation.blankSlide` = "Tela preta" / "Black screen" |
| P16-08 | No user-visible surface still says "em branco" for this item | Repo-wide search finds no remaining "Tela em branco" / "Blank slide" string; the lyrics placeholder ("linha em branco entre as estrofes") is a different meaning and stays |

### 16C — Simultânea is adjacent and distinct

#### P1: The mirror toggle stays put and stands out (MVP)

> As an operator, I want the Simultânea button beside the screen switches and in its own colour, so that I can see at a glance whether I am driving one screen or both.

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| P16-09 | The screen tabs remain rendered while Simultânea is ON | `OutputSwitcher` renders both tabs in every state; with mirror ON both carry a `data-mirrored` marker so the operator sees that both screens are being driven |
| P16-10 | The Simultânea button sits immediately after the tabs in both states | `ml-auto` is removed; the button is the next sibling of the last tab, ON or OFF |
| P16-11 | Simultânea ON uses a colour distinct from an active screen tab | ON uses the `warning` (amber) accent token, never `bg-primary`; verified by assertion on the rendered class list, and `scripts/check-theme-tokens.ps1` stays green (semantic tokens only) |
| P16-12 | Clicking a tab while mirroring re-points the mirror master without disengaging it | `setFocusedOutput(o)` still runs; `mirrorEnabled` is unchanged and no launch modal is requested for an output already presenting |

### 16D — Single-song Holyrics import

#### P2: An export with one song imports

> As an operator exporting one song from Holyrics, I want it to import like any other export, so that I do not have to hand-edit the JSON.

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| P16-13 | A JSON root that is a single song **object** parses as a one-song list | `parse` on an object root returns exactly one `ParsedHolyricsSong` with the same fields the array form produces |
| P16-14 | The array root keeps working unchanged | Every existing parser test passes untouched |
| P16-15 | A root that is neither an array nor an object is still rejected clearly | A number/string/bool root yields `UnexpectedShape`, and the message names both accepted shapes |
| P16-16 | An empty array is still rejected as "no songs" | `EmptyArray` behaviour unchanged |

### 16E — Informed stop with independent screens

#### P1: Choosing which screen to stop (MVP)

> As an operator running two screens independently, when I press Stop I want to be asked which screen to end and warned that it cannot be resumed, so that I never kill the congregation's screen by accident.

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| P16-17 | Stop opens a chooser **only** when multi-screen is on, mirror is OFF, and 2+ outputs are presenting | Pure predicate `needsStopChoice(multiScreenEnabled, mirrorEnabled, presentingOutputs)` — false for single screen, false while mirroring, false when only one output presents |
| P16-18 | Every other case stops immediately, exactly as today | Single-screen and mirror-ON paths keep the current `exitPresentation` + `fanOutToMirror` behaviour with no prompt |
| P16-19 | The modal states the situation and the consequence | Copy names the number of screens, says control is individual, and warns the stop is **irreversible** — the screen can only come back by presenting everything again |
| P16-20 | The modal offers one action per presenting screen, plus "Parar todas" and Cancel | Buttons are labelled with the operator's own monitor names (via `outputScreenName`), not hardcoded "Tela 1/2" |
| P16-21 | Choosing a screen stops that output only; the other keeps presenting | `exitPresentation(chosen)` is called once; the other output receives no call |
| P16-22 | "Parar todas" stops every presenting output | `exitPresentation` is called once per presenting output |
| P16-23 | Cancel / Esc closes the modal and stops nothing | No `exitPresentation` call is made |
| P16-24 | The rebindable exit action and Esc route through the same gate as the Stop button | `OperatorApp`'s `handleExit` and `OperatorPresentationLayout`'s `handleStop` share one decision path — no surface bypasses the prompt |
| P16-25 | An active overlay still takes priority over stopping | The existing "clear overlay first" branch runs before the stop chooser is considered |

### 16F — Release

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| P16-26 | Version bumped to `1.3.0` across all version files | `node scripts/check-version.mjs` passes; package.json, package-lock.json, tauri.conf.json, Cargo.toml and Cargo.lock agree |
| P16-27 | Full gate green before tagging | `npx vitest run`, `cargo test`, `tsc --noEmit`, `cargo clippy -D warnings`, `scripts/check-theme-tokens.ps1` all pass |
| P16-28 | Annotated tag `v1.3.0` created on `main` | `git tag -a v1.3.0` exists and points at the release commit |

---

## Traceability

| Group | Requirements | Primary surfaces |
|-------|--------------|------------------|
| 16A | P16-01..P16-04 | `src-tauri/src/commands/window.rs`, `src-tauri/src/lib.rs` |
| 16B | P16-05..P16-08 | `src/i18n/locales/pt-BR.json`, `src/i18n/locales/en-US.json` |
| 16C | P16-09..P16-12 | `src/components/presentation/OutputSwitcher.tsx` |
| 16D | P16-13..P16-16 | `src-tauri/src/services/holyrics_parser.rs` |
| 16E | P16-17..P16-25 | `src/utils/outputDispatch.ts`, new `StopPresentationModal.tsx`, `OperatorPresentationLayout.tsx`, `OperatorApp.tsx`, i18n |
| 16F | P16-26..P16-28 | `scripts/bump-version.mjs`, git tag |

## Gray Areas Resolved

| # | Question | Decision (user, 2026-08-30) |
|---|----------|------------------------------|
| GA-1 | Where does the Simultânea button go when engaged, and do the tabs stay? | **Tabs stay visible** and are marked as mirrored; the button sits immediately beside them in an accent colour, in both states |
| GA-2 | Which actions does the stop chooser offer? | **One button per presenting screen, plus "Parar todas"**, plus Cancel |
