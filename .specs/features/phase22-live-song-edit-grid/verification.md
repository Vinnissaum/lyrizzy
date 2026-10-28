# Edit any song from the live set, and strophe cards that never overlap verification

**Verdict**: FAIL
**Mutations**: 3 - probed C1, C2, C4/C5 (2 killed, 1 not)
**Proofs**: `proofs.md` at 962c71d
**Verifier**: independent sub-agent (author != verifier)

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| When the song on screen is saved with a strophe inserted above the one on screen, the wall stays on the right strophe at `HEAD`, but no test fails if the refresh stops following the anchor and the wall jumps to another strophe (AC 3, and the assumption "saving the song on screen updates the wall and keeps its strophe") | mutation `resolve_anchor(new_item_slides, anchor.as_ref(), …)` -> `resolve_anchor(new_item_slides, None, …)` (`presentation.rs:556`) is not killed by C4/C5 (`commands::set::tests::live_song_edit`). It is not killed by the full `cargo test --lib` (385 tests) either. C5 changes the text of the strophe on screen, so it falls back to the old index with or without the anchor. C4 appends a strophe after the one on screen | add an AC 3 check: a 6-strophe song live on strophe 5 gets a new strophe at position 2, so the output moves to `current_slide_index` 6 with `current_slide` "estrofe 5" and `next_slide` "estrofe 6". At `HEAD` this throwaway example gives exactly that || `43fa952` - C20 (`live_song_edit_on_air_follows_an_inserted_strophe`) kills the anchor mutation |
| AC 3 and D-88 break on a frozen output. When the wall is frozen on the edited song, it shows stale text or the wrong strophe | throwaway Rust tests over `refresh_song_in_outputs_core` with a 6-strophe song S: (a) wall frozen on S strophe 5 (`frozen_at (0,5)`), operator on another song T, strophe 5 corrected to "estrofe cinco" -> the wall's `current_slide` still reads "estrofe 5" while the stored slide reads "estrofe cinco" (`current_slide` is recomputed only when the operator's current item was regenerated). (b) Wall frozen on S strophe 5, operator on S slide 2, strophe inserted above -> `frozen_at` stays `(0,5)` and the wall now shows "estrofe 4" (`frozen_at` is never anchored). The row edit control makes (a) one click away: freezing first is the workflow the plan's Problem describes | in `refresh_song_in_outputs_core`, when `frozen_at.0` is a regenerated item, take its anchor against the old slides, resolve it against the new ones into `frozen_at.1`, and recompute `current_slide`/`next_slide` when either the current item or the frozen item was regenerated. Add a check covering (a) and (b) || `43fa952` - the refresh re-anchors `frozen_at` and recomputes the wall's slide when the frozen item is regenerated; C21 (`live_song_edit_keeps_a_frozen_wall_on_its_strophe`) covers (a) and (b) |
| The plan's `Changes underneath` says "With few slides nothing changes". That is false for every song whose cards fit in 2 or more rows, the common case | headless Chromium (chrome-headless-shell 1234), using the grid's compiled CSS (Tailwind 4.3.0 `auto-rows-max` -> `grid-auto-rows: max-content`, checked). 9 cards in a 944×760 pane: with the old `auto` rows the grid stretched each row to fill the pane, a 243 px row pitch for 128 px cards (about 115 px of empty space under each row). With `max-content` rows they pack at the top, a 136 px pitch. Only the 1-row case (AC 8's "3 cards") looks the same | correct the plan's `layout` row (rule 4) to say songs that fit now pack at the top instead of spreading over the pane, and tell the user. The walk can add a 2- or 3-row song || `43fa952` - plan `Changes underneath` corrected; user chose "Pack at the top (Recommended)" (2026-10-28, checks.md Settled mid-build); C22 walks 9 cards packed at a 138.3 px pitch |

Probed without a finding:
- The no-overlap rule (AC 8) held at four sizes neither the plan nor the checks name. In each case `max-content` rows gave 0 overlapping cards, every card was 16:9 within 1 px, and the last card could be reached by scrolling. Old `auto` rows overlapped in every case:
  - 120 cards in a 700×400 pane (2 columns)
  - 40 cards in a 460×500 pane (1 column)
  - 200 cards in a 944×760 pane
  - 30 cards in a 1200×300 pane
- The live refresh (AC 3) behaved correctly in two cases:
  - On-air, strophe inserted above the one on screen: the output stays on that strophe (`current_slide_index` 5 -> 6).
  - The same song appears twice in the set: both items regenerate (`item_slide_counts` `[9, 4, 9]`) and the live occurrence keeps its strophe.
- The mutations hiding the edit control on the row on screen (C1) and making it also select its row (C2) were both killed.
- The plan matches `operator-many-slides.png` on every label and control it draws. The two departures are confirmed (AD-091, AD-092).
