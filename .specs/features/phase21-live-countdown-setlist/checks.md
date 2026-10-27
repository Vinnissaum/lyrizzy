# Live countdown controls and live set list checks

Mutations: 3
Build: `npx tsc --noEmit`; `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
Plan: `.specs/features/phase21-live-countdown-setlist/plan.md`

40 checks in 4 slices (3 appended after verification) · 0 one-way doors · 0 open

## Checks

### S1 - Adjust the countdown on the wall

**C1** - The countdown controls show only while the focused output's countdown is on the wall: current item a countdown → shown; current item a song and no takeover → none; a takeover running or paused over a song → shown (AC 1)
Proof: `npx vitest run src/utils/countdownControls.test.ts -t "countdown on the wall"`
Proof: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "live countdown controls appear"`

**C2** - The controls render outside the live pane and outside every `hidden` container, so they are reachable below 1024 px, and they show the remaining time as the wall formats it (270 000 ms → `04:30`) (AC 1)
Proof: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "live countdown controls outside the live pane"`
Proof: `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "shows the remaining time"`

**C3** - Clicking `+1 min` sends `adjust_countdown` with `60000`, and `+5 min` with `300000`, for the focused output (AC 2)
Proof: `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "plus buttons send"`

**C4** - Adding time to a running countdown moves its end by the delta: 270 000 ms + 60 000 → 330 000 ms; + 300 000 → 570 000 ms; a countdown to 19:00 at 18:55, +60 000 → ends at 19:01 with 360 000 ms left (AC 2)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_adds_time`

**C5** - Clicking `−1 min` sends `-60000`, and subtracting from a running countdown takes 60 000 ms off: 270 000 → 210 000 ms; 60 001 → 1 ms and still `running` (AC 3)
Proof: `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "minus button sends"`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_subtracts_a_minute`

**C6** - With 60 000 ms or less remaining, `−1 min` is disabled (60 000 disabled, 60 001 enabled), and `-60000` returns `countdown.below_minimum` with the state unchanged at running 60 000, running 40 000, finished 0 and paused 60 000 (AC 4)
Proof: `npx vitest run src/utils/countdownControls.test.ts -t "minus disabled at or below a minute"`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_refuses_below_minimum`

**C7** - An adjustment moves `target_epoch_ms`, so the ticker counts from the new end: +60 000 at 270 000 ms remaining, then 2 000 ms later the wall-clock remaining is 328 000 ms (AC 5)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_moves_the_target`

**C8** - `Pausar` sends `pause_countdown`; while paused the button reads `Retomar` and sends `resume_countdown`; resuming a countdown paused at 270 000 ms runs it with 270 000 ms left and its end at now + 270 000; +60 000 while paused gives 330 000 ms and stays `paused` (AC 6)
Proof: `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "pause and resume"`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_resume_continues_from_held_time`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_while_paused_stays_paused`

**C9** - Adding time to a finished countdown runs it again from the delta (+60 000 → `running` with 60 000 ms; +300 000 → 300 000 ms), and a ticker is started exactly when the mode becomes `running` from anything else (AC 7)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_reruns_a_finished_countdown`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_ticker_needed_only_when_starting_to_run`

**C10** - `Reiniciar` sends `restart_countdown`. The restart target is the source item's configured target (a 600 000 ms duration item; a count-to-19:00 item → fixed time 19:00), or the state's own duration when the source is absent or no longer in the set (a fired 300 000 ms schedule). Restarting from running, paused or finished runs at that target, drops every adjustment, and keeps `takeover`, `position` and both scales (AC 8)
Proof: `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "restart button sends"`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_restart_target`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_restart_runs_from_target`

**C11** - A live adjustment never changes the configured duration: `duration_ms` stays 600 000 after +300 000, −60 000, pause and resume, so Stop's reset and `Reiniciar` return to it (AC 9)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_keeps_configured_duration`

**C12** - While idle or scheduled, every control is disabled, adjusting or restarting returns `countdown.not_active` with the state unchanged, and resuming anything that is not paused (running, idle, finished) returns `countdown.not_paused` (AC 10)
Proof: `npx vitest run src/utils/countdownControls.test.ts -t "idle and scheduled disable every control"`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_refuses_idle_and_scheduled`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_resume_refuses_when_not_paused`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_restart_refuses_idle_and_scheduled`

**C13** - With Simultânea on and Tela 1 focused, each control also sends its command for `two`; with it off, only `one` (AC 11)
Proof: `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "mirror sends to both screens"`

**C14** - A control whose command fails shows the error's localized message (`countdown.below_minimum` → its pt-BR text) (AC 4, AC 27)
Proof: `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "shows the command error"`

### S2 - Add a song to the live set

**C15** - Clicking `Adicionar música` in the set pane opens the song picker (AC 12)
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "add song opens the picker"`

**C16** - The picker lists every library song with title and artist. Typing filters case-insensitively by title (`gra` → `Grande é o Senhor`) or by artist (`fernandinho` → his songs). An empty library shows the empty message, a search with no match shows the no-results message, and the search box sits outside the scrolling list (AC 12)
Proof: `npx vitest run src/components/presentation/LiveSongPicker.test.tsx -t "lists and filters"`
Proof: `npx vitest run src/components/presentation/LiveSongPicker.test.tsx -t "empty and no match"`

**C17** - Picking a song sends `addSetItem({ setId, itemType: "song", songId, afterItemId })` with the focused output's current item id, and a second pick in the same session anchors on the first pick's returned id (AC 13, AC 14)
Proof: `npx vitest run src/components/presentation/LiveSongPicker.test.tsx -t "picks anchor"`

**C18** - Adding D after B to [A, B, C] live on B makes both the stored order and the live `set.items` [A, B, D, C], leaves `current_item_index` 1 and `current_slide` unchanged, and makes the lookahead from B's last slide D's first slide (AC 13, AC 26)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_after_current_keeps_the_wall`

**C19** - Adding D after the last item C, while on C's last slide, gives [A, B, C, D], and the lookahead changes from none to D's first slide (AC 13)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_after_last_item_updates_lookahead`

**C20** - Adding D after B, then E after D, gives [A, B, D, E, C], stored and live (AC 14)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_keeps_pick_order`

**C21** - A two-strophe song added with default settings gets 4 slides, title first and blackout last, and the emitted snapshot carries `all_slides_per_item` of length 4 with them at index 2 (AC 15)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_generates_slides_like_apresentar`

**C22** - A song added while its set is presenting gets one `song_plays` row for `(song, set, today)`; adding it twice still gives one row; adding it with nothing presenting gives none (AC 16)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_records_a_play_only_while_presenting`

**C23** - An `afterItemId` from another set returns `set.item_not_found`, writes no row and leaves every live set unchanged (AC 17)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_refuses_a_foreign_anchor`

**C24** - When adding fails, the picker shows the error's localized message (`set.item_not_found` → `Item não encontrado`) and adds nothing to its session (AC 17)
Proof: `npx vitest run src/components/presentation/LiveSongPicker.test.tsx -t "shows the add error"`

### S3 - Remove an item from the live set

**C25** - The items on screen are each presenting output's current item plus its frozen item while frozen, for the outputs showing that set; an idle output contributes none (AC 18)
Proof: `npx vitest run src/utils/onScreen.test.ts -t "on screen item ids"`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::presentation::tests::on_screen_item`

**C26** - Every row in the set pane has a remove control. It is disabled, with the tooltip `No ar — não pode ser removido`, for the focused current item, the frozen item, and Tela 2's current item when Tela 2 presents the same set; for every other item it is enabled (AC 18)
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "remove disabled on screen"`

**C27** - Clicking remove on an item asks `Remover “Aleluia” do conjunto?`; `Remover` sends `removeSetItem` with that item's id; `Cancelar` sends nothing and closes the dialog (AC 19)
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "confirm before removing"`

**C28** - Removing A from [A, B, C, D] live on C makes the stored and live list [B, C, D], `current_item_index` 1 and `current_slide` unchanged; removing D while on C's last slide makes the lookahead none (AC 19, AC 26)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_keeps_the_wall`

**C29** - Removing an item on screen returns `set.item_on_screen` and leaves the row and every live set unchanged (the focused current item, a frozen item, Tela 2's current item); an idle output with the set loaded blocks nothing; an unknown id returns `set.item_not_found` (AC 20)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_refuses_on_screen`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_refuses_an_unknown_item`

**C30** - The on-screen check and the delete run under the presentation write lock: a removal started while the lock is held waits, and when the holder moves the output onto that item before releasing it, the removal is refused (AC 20)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_checks_under_the_presentation_lock`

**C31** - Removing a song keeps its `song_plays` row (AC 21)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_keeps_the_play_row`

**C32** - Removing a countdown item that is counting off-screen returns that output's countdown to `idle`; a `scheduled` countdown stays `scheduled` (AC 22)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_resets_its_countdown`

### S4 - Every screen with the set agrees

**C33** - Splicing keeps every stored position on the same item: an insert at or before `current_item_index` or the frozen item shifts it up by one, and an insert after it does not; a remove before it shifts it down by one; removing an idle output's current item keeps the index clamped to the last item, with slide 0; slide counts and slide lists move with their items (AC 23)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::presentation::tests::splice_`

**C34** - An add reaches every output with that set loaded. With Tela 2 frozen on C while navigating on A, adding D after A gives Tela 2 [A, D, B, C] with `frozen_at` moved from 2 to 3 and its frozen slide unchanged; an output on another set stays untouched (AC 23)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_reaches_every_output_with_the_set`

**C35** - A countdown on screen keeps running when an item before it changes. Backend: removing an earlier item leaves the countdown state unchanged (mode, end, source). Window: after the shift, the countdown landing effect does not call `startCountdown` again (AC 24)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_leaves_a_running_countdown_alone`
Proof: `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "item before the countdown changes"`

**C36** - An item added with no `afterItemId` (the slideshow import) is appended on every output that has that set loaded, Tela 2 included (AC 25)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_appends_on_every_output`

**C37** - `error.set.item_on_screen`, `error.countdown.not_active`, `error.countdown.not_paused` and `error.countdown.below_minimum` each have a non-empty message in pt-BR and en-US (AC 27)
Proof: `npx vitest run src/tests/i18n/live-errors.test.ts -t "live presentation error codes"`

### Appended after verification

**C38** - Pausing changes only a running countdown: `pause_countdown` leaves an idle, scheduled, paused or finished countdown as it is (a scheduled one keeps its schedule), so `Pausar` with Simultânea on cannot disarm Tela 2; the existing `countdownPause` key still pauses the focused screen only, and only the live control mirrors (AC 6, AC 11)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_pause_only_pauses_a_running_countdown`
Proof: `npx vitest run src/stores/countdown.test.ts -t "pause mirrors only when asked"`

**C39** - In the set pane, the first pick anchors on the focused output's current item: live on index 1 (`Fundo Azul`), picking `Aleluia` sends `afterItemId` `item-2` (AC 13)
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "first pick anchors on the current item"`

**C40** - Once an "until HH:MM" target has passed today, `Reiniciar` is disabled and the restart returns `countdown.target_passed` with the countdown unchanged: until 19:00, at 19:02 → refused; at 18:59 → runs to 19:00; at exactly 19:00 → refused; a duration countdown restarts as before; an idle one still reports `countdown.not_active`; the message exists in pt-BR and en-US (AC 28)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_restart_refuses_a_passed_clock_time`
Proof: `npx vitest run src/utils/countdownControls.test.ts -t "restart disabled once a clock time has passed"`
Proof: `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "restart disabled once a clock time has passed"`
Proof: `npx vitest run src/tests/i18n/live-errors.test.ts -t "target passed message"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| countdown controls (6) | `+1 min` C3 · `+5 min` C3 · `−1 min` C5 · `Pausar` C8 · `Retomar` C8 · `Reiniciar` C10 | - |
| countdown mode under adjust (5) | `idle` C12 · `scheduled` C12 · `running` C4 · `paused` C8 · `finished` C9 | - |
| `adjust_countdown` outcomes (3) | `Ok` C4 · `countdown.not_active` C12 · `countdown.below_minimum` C6 | - |
| `resume_countdown` outcomes (2) | `Ok` C8 · `countdown.not_paused` C12 | - |
| `pause_countdown` by mode (5) | `running` C8 · `idle` C38 · `scheduled` C38 · `paused` C38 · `finished` C38 | - |
| `restart_countdown` outcomes (3) | `Ok` C10 · `countdown.not_active` C12 · `countdown.target_passed` C40 | - |
| `add_set_item` outcomes (3) | `Ok` with anchor C18 · `Ok` without anchor C36 · `set.item_not_found` C23 | - |
| `remove_set_item` outcomes (3) | `Ok` C28 · `set.item_on_screen` C29 · `set.item_not_found` C29 | - |
| −1 min floor, AC 4 (5 examples) | 60 000 refused C6 · 60 001 allowed C5 · 40 000 refused C6 · finished 0 refused C6 · paused 60 000 refused C6 | - |
| restart targets, AC 8 (3) | duration item C10 · fixed-time item C10 · fired schedule C10 | - |
| on-screen positions, AC 18 and AC 20 (4) | focused current C26 C29 · frozen item C26 C29 · Tela 2 current C26 C29 · idle output blocks nothing C25 C29 | - |
| splice index rule, AC 23 (8 cases) | C33, table-driven over all 8: insert after current · insert at end · insert before frozen · insert before another output's current · remove before current · remove after current · remove before frozen · remove an idle output's current | - |
| outputs reached by a splice (3) | focused output C18 · another output on the same set C34 · an output on another set C34 | - |
| AC 13 examples (2) | after B C18 · after the last item C19 | - |
| AC 19 examples (2) | remove A C28 · remove D, lookahead C28 | - |
| play rows, AC 16 (3) | presenting → 1 C22 · twice → 1 C22 · nothing presenting → 0 C22 | - |
| picker states, AC 12 (5) | listing C16 · filter by title C16 · filter by artist C16 · empty library C16 · no match C16 | - |
| localized error codes, AC 27 (8) | 4 codes × 2 locales: C37, table-driven over all 8 | - |

- `set.db_error` is the existing mapping on every query, unchanged by this feature, and is not in a set
- Claims naming an error code: C6, C12, C23, C29 - each proof calls the function that returns it and asserts the state left behind

## Swept

- validation: C6, C12 - the −1 min floor and the idle/scheduled refusal hold in the backend, not only on the disabled control; a positive delta saturates instead of overflowing (C4)
- failure modes: C23 - the anchor is validated before any write; the slides are computed before the transaction, and the `sort_order` shift and the insert share one transaction
- idempotency: C22 - the play row dedups on `(song, set, day)`; adding the same song twice is allowed by design (Assumptions)
- authorization: existing - only the operator window imports the new commands; the presentation window is read-only (CLAUDE.md)
- concurrency: C30, C9 - remove's check-then-delete runs under the presentation lock; an adjustment that lands on a countdown the ticker just finished re-runs it with a fresh ticker
- data lifecycle: C18, C28, C11 - the stored order matches the live list after add and remove; the configured countdown duration survives every adjustment
- dependency failure: n/a - no external service; a database error keeps the existing `set.db_error` mapping
- state transitions: C4, C8, C9, C10, C12, C29
- observability: existing - `emit_state` logs every `state_changed` with output, item, slide and mode

## Handoff

- **Settled mid-build:** 2026-10-26, on the Verifier's finding that Reiniciar on an "until HH:MM" countdown after HH:MM counts to tomorrow - user: "Disable Reiniciar after the time" (refused by the backend with a message; duration countdowns unaffected) → AC 28, C40
- **Dispatched:** Verifier (independent sub-agent) at `5025296` (HEAD `ffca439`, docs-only after it), 2026-10-26 - returned: FAIL, 6 findings, 0/3 mutations killed; no screens sub-agent - no criterion cites a capture
- **Boundary:** C1-C14, C37 closed at `5e0ae00`; C15-C36 closed at `5025296`; `proofs.md` 55/55 pass at `5025296`, tree clean
- **Abandoned:** none
- **Walked:** not walked - this session cannot drive the Tauri windows (no browser or display driver); the hands-on steps go to the user in the report: (1) present a set with a countdown item, use +1 min, +5 min, −1 min, Pausar/Retomar and Reiniciar, and confirm the wall follows; (2) with Simultânea on, confirm both screens move together; (3) add a song from `Adicionar música` and advance into it; (4) try to remove the item on screen (disabled), remove another one through the confirm dialog, and confirm the wall never changes; (5) stop and check Home shows the same list
- **Build decisions:** `SetItemList` gained an opt-in `editable` mode (the presentation layout turns it on) so the existing read-only tests, which count every button in the list, keep proving their unchanged claim; `append_item_to_live_presentation` was replaced by `insert_item_into_outputs`, which reaches every output
