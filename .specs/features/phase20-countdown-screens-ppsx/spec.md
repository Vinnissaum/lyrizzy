# Phase 20 — Countdown Agrees on Both Screens, `.ppsx` Import

**Status:** IMPLEMENTED and RELEASED as `v1.7.0` (2026-10-01). P20-01..P20-10 done; the hardware checklist below is still open.
**Gate:** 772 Vitest + 1 skipped (92 files), 382 Rust + 1 ignored, `tsc --noEmit` clean, `cargo clippy --all-targets -D warnings` clean
**Depends on:** Phase 14 (dual outputs), Phase 17 (countdown appearance mirrored into state), Phase 19 (`v1.6.0`)
**Release target:** `v1.7.0` (minor: a new importable format plus a countdown correctness fix; no migration, no destructive change)
**Scope:** Medium-Large. Design inline below; tasks in `tasks.md` (the step count exceeded the inline threshold).

---

## Problem Statement

Two reports from the operator after the last service.

1. **Two screens, two different countdowns.** With both screens presenting, a *Regressivo* (countdown) item
   targeting a fixed end time showed the right remaining time on one screen and a wrong one on the other. This
   happened on every presentation that day. Stopping and re-presenting did not fix it; only quitting and
   relaunching the app did.
2. **`.ppsx` files cannot be imported.** PowerPoint "slide show" files (`.ppsx`) are rejected, even though
   LibreOffice, which the import already uses, opens them.

---

## Root-Cause Analysis

Every row was traced to specific lines before this spec was written.

| # | Report | Root cause | Evidence |
|---|--------|-----------|----------|
| RC-1 | Only an app restart fixed it | `exit_presentation` tears down a countdown **only when `takeover` is set**. A countdown started by landing on the item is the manual-present path, which starts with `takeover = false`. It stays `Running` (or `Paused`/`Finished`) in that output's `AppState` after Stop and lives as long as the process does. | `commands/window.rs:531-558` (the `if …takeover` gate), `PresentationApp.tsx:193-216` (manual start passes no `takeover`) |
| RC-2 | The wrong time persists across presentations | When a presentation window lands on a countdown item, it does nothing if that output's countdown is `scheduled` **or `running`**. The guard exists so a schedule that just fired is not clobbered, but it checks `mode` only. It cannot tell "this item's countdown" from a leftover from an earlier run, an edited item, or a different countdown item. The leftover from RC-1 therefore wins on every relaunch. | `PresentationApp.tsx:195-196` |
| RC-3 | Why only **one** screen was wrong | Saving the countdown editor calls `useCountdownStore.getState().reset()`. The operator window has a single countdown store bound to the **focused** output, and focus snaps back to Tela 1 whenever presenting stops (`d81179a`). The editor is on Home, which is only reachable when nothing is presenting, so every save clears Tela 1's leftover and **never Tela 2's**. Tela 1 then restarts from the edited item (correct) while Tela 2 keeps its old target (wrong). | `CountdownScheduleModal.tsx:150-151`, `stores/countdown.ts:41,95-102` (`get().output`), `OperatorApp.tsx:302-309` |
| RC-4 | Non-deterministic: which screen goes wrong can vary | The guard reads the window's *store*, not the backend. The presentation state and the countdown state are fetched by two independent async calls on mount. If the presentation state wins the race, the guard sees the store's default `idle` and restarts. If the countdown state wins, it sees `running` and keeps it. | `PresentationApp.tsx:106-108`, `stores/countdown.ts:52-55` |
| F-1 | Found while tracing RC-2, unreported | The same guard means that in a set with two countdown items, landing on the second while the first is still running (`takeover = false`) shows the **first** item's remaining time under the second item. | `PresentationApp.tsx:195-196` |
| RC-5 | `.ppsx` rejected | `import_presentation` allow-lists `pptx | ppt | pdf | odp`, and both file pickers offer only `pptx`, `ppt` and `pdf`. Nothing downstream needs extending: the deck is rasterised to `slide_NNN.png` (LibreOffice → PDF → pdfium), and nothing branches on the stored MIME type. | `commands/media.rs:309-316,396-402`; `SetBuilder.tsx:315`, `OperatorPresentationLayout.tsx:220`; `services/libreoffice.rs:110-160` |
| F-2 | Found while tracing RC-5 | The backend accepts `.odp`, but neither picker offers it, so it can only be reached by typing a filename. | same lines as RC-5 |

**LibreOffice support for `.ppsx` (Knowledge Verification Chain, step 4):** LibreOffice registers an
*Impress MS PowerPoint 2007 XML AutoPlay* import filter for `.ppsx`
(`application/vnd.openxmlformats-officedocument.presentationml.slideshow`) that uses the same
`com.sun.star.comp.Impress.oox.PowerPointImport` service as `.pptx`. `.pps` is the PowerPoint 97 sibling
(*MS PowerPoint 97 AutoPlay*). I found no report of AutoPlay files stalling a headless `--convert-to pdf`,
**but LibreOffice is not installed on the dev box, so a real conversion has not been run.** That is the first
item on the hardware checklist.

---

## Requirements

### 20A — Countdown leftovers (RC-1..RC-4, F-1)

| ID | Requirement |
|----|-------------|
| P20-01 | Stopping a screen (Stop, Esc, the exit binding, the multi-screen stop chooser) returns that output's countdown to `Idle` whenever it is `Running`, `Paused` or `Finished`, whether or not it was a takeover. A `Scheduled` countdown (armed for later) is left alone, as today. |
| P20-02 | The countdown state records which set item started it (`sourceItemId`). A manual start sets it; arm, reset and the exit teardown clear it. |
| P20-03 | Landing on a countdown item decides in the backend, atomically, whether to keep or restart the output's countdown. **Keep** if it is `Scheduled`, or `Running` as a takeover (a schedule that fired), or `Running` and started by **this same item**. **Restart** from the item's config otherwise, which covers leftovers, a different countdown item (F-1), and `Paused`/`Finished`/`Idle`. |
| P20-04 | The presentation window no longer reads its local countdown store to make that decision (RC-4). It always calls `start_countdown` with `sourceItemId` and `preserveActive: true`. |
| P20-05 | Unchanged: navigating away from a running countdown item and back continues the same countdown; a schedule that fired is not restarted when the projector jumps to its item; a pending schedule is never disarmed by landing on any countdown item. |

### 20B — `.ppsx` import (RC-5, F-2)

| ID | Requirement |
|----|-------------|
| P20-06 | `.ppsx` imports as a presentation through the existing LibreOffice path, with MIME type `application/vnd.openxmlformats-officedocument.presentationml.slideshow`. |
| P20-07 | `.pps` (the PowerPoint 97 slide-show format) is accepted too, with MIME `application/vnd.ms-powerpoint`. It is the same filter family and costs one match arm. |
| P20-08 | Both presentation pickers (Home set builder, live presentation layout) offer `pptx, ppsx, ppt, pps, odp, pdf` from **one** shared frontend constant. The backend's accepted list and MIME mapping live in one pure function with unit tests. |
| P20-09 | The "Import" tooltip and the user guide name `.ppsx`. |

### 20C — Release

| ID | Requirement |
|----|-------------|
| P20-10 | Version `1.7.0` across the five version sources, committed on `main`, tagged `v1.7.0` and pushed. |

---

## Design (inline)

- **`CountdownState.source_item_id: Option<String>`** (`#[serde(default)]`, camelCase `sourceItemId`). Set only
  by `start_countdown`. `arm_countdown`, `reset_countdown` and the exit teardown set it to `None`. Rust struct
  literals in tests gain the field.
- **`should_preserve_countdown(state, source_item_id) -> bool`**, pure, in `commands/countdown.rs`:
  `Scheduled → true`; `Running && (takeover || state.source_item_id == source_item_id) → true`, where a `None`
  source on either side never matches; everything else is `false`.
- **`start_countdown(.., source_item_id, preserve_active)`**: when `preserve_active == Some(true)`, take the
  task lock, read the state, and if `should_preserve_countdown` holds, return the current snapshot without
  aborting the ticker or emitting anything. Otherwise continue exactly as today. Lock order stays task, then
  countdown, the same as `exit_presentation`.
- **`should_reset_countdown_on_exit(state) -> bool`**, pure, in `commands/window.rs`:
  `takeover || mode ∈ {Running, Paused, Finished}`. It replaces the `takeover`-only gate. The teardown block
  also clears `source_item_id`, plus `message_scale`/`digits_scale` back to 100 to match `reset_countdown`.
- **Frontend:** `StartCountdownParams` gains `sourceItemId?` and `preserveActive?`, and `CountdownState` gains
  `sourceItemId?`. `PresentationApp`'s landing effect drops the `useCountdownStore.getState()` read and passes
  both new params.
- **`.ppsx`:** `presentation_mime(ext) -> Option<&'static str>` in `commands/media.rs` is both the allow-list
  (`None` → `media.unsupported_container`) and the MIME mapping. `PRESENTATION_EXTENSIONS` in
  `src/utils/presentationFiles.ts` feeds both pickers.

**Out of scope, recorded as deferred:**
- The countdown editor resets/arms only the operator's *focused* output (RC-3's mechanism). After P20-01 that
  no longer produces a wrong screen, because nothing is left running when Home is reachable. A schedule armed
  while Tela 2 is focused would still live on Tela 2 only. That is a separate multi-output-arming question.
- Closing a presentation window with the OS (Alt+F4) bypasses `exit_presentation` entirely, including its
  presentation-state reset. Pre-existing and not specific to the countdown.

## Hardware checklist (manual, after release)

1. Import a real `.ppsx` on the church machine. Slides appear and no `soffice` process is left behind.
2. Two screens, both presenting a set with a fixed-end-time *Regressivo*. Both screens show the same remaining
   time. Stop both, edit the end time on Home, present again: both show the new time without restarting the app.
3. A set with two countdown items: landing on the second shows the second's time.
4. A scheduled countdown still fires, takes over, and is not restarted when the projector jumps to its item.
