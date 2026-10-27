# phase21-live-countdown-setlist proofs

**HEAD**: 8547048
**Tree**: clean
**Result**: 62 pass, 0 fail; mutations 3 killed, 0 not

| Check | Proof | Ran | Passed | Result |
| --- | --- | --- | --- | --- |
| C1 | `npx vitest run src/utils/countdownControls.test.ts -t "countdown on the wall"` | 1 | 1 | pass |
| C1 | `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "live countdown controls app` | 1 | 1 | pass |
| C2 | `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "live countdown controls out` | 1 | 1 | pass |
| C2 | `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "shows the remaining time"` | 1 | 1 | pass |
| C3 | `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "plus buttons send"` | 1 | 1 | pass |
| C4 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_adds_time` | 1 | - | pass |
| C5 | `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "minus button sends"` | 1 | 1 | pass |
| C5 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_subtracts_a_minute` | 1 | - | pass |
| C6 | `npx vitest run src/utils/countdownControls.test.ts -t "minus disabled at or below a minute"` | 1 | 1 | pass |
| C6 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_refuses_below_mini` | 1 | - | pass |
| C7 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_moves_the_target` | 1 | - | pass |
| C8 | `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "pause and resume"` | 1 | 1 | pass |
| C8 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_resume_continues_from_hel` | 1 | - | pass |
| C8 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_while_paused_stays` | 1 | - | pass |
| C9 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_reruns_a_finished_` | 1 | - | pass |
| C9 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_ticker_needed_only_when_s` | 1 | - | pass |
| C10 | `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "restart button sends"` | 1 | 1 | pass |
| C10 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_restart_target` | 2 | - | pass |
| C10 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_restart_runs_from_target` | 1 | - | pass |
| C11 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_keeps_configured_d` | 1 | - | pass |
| C12 | `npx vitest run src/utils/countdownControls.test.ts -t "idle and scheduled disable every control"` | 1 | 1 | pass |
| C12 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_refuses_idle_and_s` | 1 | - | pass |
| C12 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_resume_refuses_when_not_p` | 1 | - | pass |
| C12 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_restart_refuses_idle_and_` | 1 | - | pass |
| C13 | `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "mirror sends to both screens"` | 2 | 2 | pass |
| C14 | `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "shows the command error"` | 1 | 1 | pass |
| C15 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "add song opens the picker"` | 1 | 1 | pass |
| C16 | `npx vitest run src/components/presentation/LiveSongPicker.test.tsx -t "lists and filters"` | 1 | 1 | pass |
| C16 | `npx vitest run src/components/presentation/LiveSongPicker.test.tsx -t "empty and no match"` | 1 | 1 | pass |
| C17 | `npx vitest run src/components/presentation/LiveSongPicker.test.tsx -t "picks anchor"` | 1 | 1 | pass |
| C18 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_after_current_keeps_the_w` | 1 | - | pass |
| C19 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_after_last_item_updates_l` | 1 | - | pass |
| C20 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_keeps_pick_order` | 1 | - | pass |
| C21 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_generates_slides_like_apr` | 1 | - | pass |
| C22 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_records_a_play_only_while` | 1 | - | pass |
| C23 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_refuses_a_foreign_anchor` | 1 | - | pass |
| C24 | `npx vitest run src/components/presentation/LiveSongPicker.test.tsx -t "shows the add error"` | 1 | 1 | pass |
| C25 | `npx vitest run src/utils/onScreen.test.ts -t "on screen item ids"` | 2 | 2 | pass |
| C25 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::presentation::tests::on_screen_item` | 1 | - | pass |
| C26 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "remove disabled on screen"` | 1 | 1 | pass |
| C27 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "confirm before removing"` | 1 | 1 | pass |
| C28 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_keeps_the_wall` | 1 | - | pass |
| C29 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_refuses_on_screen` | 1 | - | pass |
| C29 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_refuses_an_unknown_ite` | 1 | - | pass |
| C30 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_checks_under_the_prese` | 2 | - | pass |
| C31 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_keeps_the_play_row` | 1 | - | pass |
| C32 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_resets_its_countdown` | 2 | - | pass |
| C33 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::presentation::tests::splice_` | 10 | - | pass |
| C34 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_reaches_every_output_with` | 2 | - | pass |
| C35 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_remove_leaves_a_running_count` | 1 | - | pass |
| C35 | `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "item before the countdown changes"` | 1 | 1 | pass |
| C36 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_add_appends_on_every_output` | 1 | - | pass |
| C37 | `npx vitest run src/tests/i18n/live-errors.test.ts -t "live presentation error codes"` | 8 | 8 | pass |
| C38 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_pause_only_pauses_a_runni` | 1 | - | pass |
| C38 | `npx vitest run src/stores/countdown.test.ts -t "pause mirrors only when asked"` | 1 | 1 | pass |
| C39 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "first pick anchors on the current item"` | 1 | 1 | pass |
| C40 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_restart_refuses_a_passed_` | 1 | - | pass |
| C40 | `npx vitest run src/utils/countdownControls.test.ts -t "restart disabled once a clock time has passed"` | 1 | 1 | pass |
| C40 | `npx vitest run src/components/presentation/LiveCountdownControls.test.tsx -t "restart disabled once a clock ti` | 1 | 1 | pass |
| C40 | `npx vitest run src/tests/i18n/live-errors.test.ts -t "target passed message"` | 1 | 1 | pass |
| Build | `npx tsc --noEmit` | - | - | pass |
| Build | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | - | - | pass |

## Mutations

| Mutation | Location | Killed |
| --- | --- | --- |
| C17 picker anchor: focused current item -> the item after it (song lands one slot late) | `src/components/presentation/SetItemList.tsx:84` | yes |
| C32 removed countdown item: a paused countdown is no longer reset to idle | `src-tauri/src/commands/countdown.rs:507` | yes |
| C33 insert at the frozen item's index: frozen_at no longer shifts (>= -> >) | `src-tauri/src/domain/presentation.rs:127` | yes |
