# Project state

The project's decisions D-1..D-90 live in `.specs/project/STATE.md`. From phase 22 on, new
decisions are logged here as `AD-091` onward, because tlc-spec-lean's validators read this file.

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-091 | Phase 22: while presenting, every song row in the set pane has an edit control beside its remove control, the song on screen included; it opens the song editor dialog `Editar letra` already uses, with no extra confirm step, and changes neither the current item nor the wall. Other item types get no edit control. The set pane keeps its 240 px width, so a song row's title and artist truncate about 30 px sooner | Departs from `captures/operator-many-slides.png`, which draws song rows with the remove control only. User request 2026-10-28: "add a small button to edit and open a dialog to confirm". Asked "What should the small edit button open?" - chose "Editor directly (Recommended)"; asked "Which songs should get the edit button?" - chose "Every song, on-air too (Recommended)" | active | 2026-10-28 |
| AD-092 | Phase 22: strophe cards in the operator strophes pane never overlap. Each grid row is as tall as its cards (`grid-auto-rows: max-content`), so a long song scrolls instead of squeezing rows into the pane's height | Departs from `captures/operator-many-slides.png`, which draws rows 95 px apart for 127 px cards. User request 2026-10-28: "add to these feature the fix of song 'slides' show overflowing another when it has a large number of slides as you can see on printscreen" | active | 2026-10-28 |
