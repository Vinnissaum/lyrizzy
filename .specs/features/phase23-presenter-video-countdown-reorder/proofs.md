# phase23-presenter-video-countdown-reorder proofs

**HEAD**: 0c8ce1c
**Tree**: clean
**Result**: 108 pass, 3 fail; mutations 5 killed, 0 not

| Check | Proof | Ran | Passed | Result |
| --- | --- | --- | --- | --- |
| C1 | `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "song rows keep their titles under a lib` | 3 | 3 | pass |
| C2 | `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "strophes header names the song under a ` | 1 | 1 | pass |
| C2 | `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "remove confirmation names the song unde` | 1 | 1 | pass |
| C3 | `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "the song picker lists every library son` | 1 | 1 | pass |
| C4 | `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "a renamed song relabels its row under a` | 1 | 1 | pass |
| C5 | `npx vitest run src/stores/library.test.ts -t "loading presenter titles leaves the search and its result alone"` | 1 | 1 | pass |
| C67 | `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "a song saved in the live editor under a` | 1 | 1 | pass |
| C67 | `npx vitest run src/stores/library.test.ts -t "a library refresh under a search keeps the whole library current` | 1 | 1 | pass |
| C73 | `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "a set song past the first 200 by title ` | 1 | 1 | pass |
| C73 | `cargo test --manifest-path src-tauri/Cargo.toml --test songs list_songs_with_no_cap_returns_every_song` | 1 | - | pass |
| C6 | `npx vitest run src/components/presentation/itemMeta.test.tsx -t "a song missing from the library falls back to` | 1 | 1 | pass |
| C7 | `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "upload control shows with images an` | 1 | 1 | pass |
| C8 | `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "upload opens the file dialog for im` | 1 | 1 | pass |
| C9 | `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "picked files are imported and liste` | 1 | 1 | pass |
| C10 | `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "an image uploaded in the di` | 1 | 1 | pass |
| C11 | `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "upload shows its progress and is di` | 1 | 1 | pass |
| C12 | `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "a failed file is counted and the ot` | 1 | 1 | pass |
| C13 | `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "cancelling the file dialog imports ` | 1 | 1 | pass |
| C65 | `npx vitest run src/components/presentation/QuickMediaRenderer.test.tsx -t "an overlay for media the wall has n` | 1 | 1 | pass |
| C14 | `npx vitest run src/i18n/locales.test.ts -t "phase 23 labels in both locales"` | 1 | 1 | pass |
| C14 | `npx vitest run src/i18n/locales.test.ts -t "en-US and pt-BR have identical key sets in both directions"` | 1 | 1 | pass |
| C15 | `npx vitest run src/components/presentation/LiveSetReorder.test.tsx -t "a drag handle on every row of the edita` | 1 | 1 | pass |
| C16 | `npx vitest run src/components/presentation/LiveSetReorder.test.tsx -t "a drop reorders the pane and sends the ` | 1 | 1 | pass |
| C17 | `walk - present a 4-item set, drag the last row's handle onto the second row, then move a row with Space, Arrow` | - | - | pass (Walked) |
| C18 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::presentation::tests::reorder_keeps_the_current_a` | 1 | - | pass |
| C19 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_reorder_keeps_each_output_in_` | 1 | - | pass |
| C20 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_reorder_navigation_follows_th` | 1 | - | pass |
| C21 | `npx vitest run src/components/presentation/LiveSetReorder.test.tsx -t "clicking a row still selects it"` | 1 | 1 | pass |
| C22 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::reorder_refuses_a_list_that_is_not` | 1 | - | pass |
| C23 | `npx vitest run src/components/presentation/LiveSetReorder.test.tsx -t "a failed reorder restores the order and` | 1 | 1 | pass |
| C24 | `npx vitest run src/components/presentation/LiveSetReorder.test.tsx -t "an armed schedule follows its item thro` | 1 | 1 | pass |
| C25 | `walk - present a set with a song, a countdown and a video at both window sizes and measure the pane and each r` | - | - | pass (Walked) |
| C26 | `npx vitest run src/components/presentation/TransitionStage.test.tsx -t "the outgoing layer is unmounted when i` | 1 | 1 | pass |
| C26 | `npx vitest run src/components/presentation/TransitionStage.test.tsx -t "an instant cut unmounts the outgoing l` | 1 | 1 | pass |
| C27 | `npx vitest run src/components/presentation/TransitionStage.test.tsx -t "an outgoing video is paused in the upd` | 1 | 1 | pass |
| C28 | `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "an item that left the wall leaves no medi` | 1 | 1 | pass |
| C28 | `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "one video replaces another and a return m` | 1 | 1 | pass |
| C66 | `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "a shift of the current item's index leave` | 1 | 1 | pass |
| C71 | `npx vitest run src/components/presentation/WebViewRenderer.test.tsx -t "a web page or camera leaving the wall ` | 1 | 1 | pass |
| C71 | `npx vitest run src/components/presentation/SongBackground.test.tsx -t "a background video leaving the wall is ` | 1 | 1 | pass |
| C72 | `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "the next strophe of a song keeps its vide` | 1 | 1 | pass |
| C72 | `npx vitest run src/components/presentation/TransitionStage.test.tsx -t "a change within the same group updates` | 1 | 1 | pass |
| C72 | `npx vitest run src/components/presentation/TransitionStage.test.tsx -t "returning to the group on screen drops` | 1 | 1 | pass |
| C72 | `npx vitest run src/components/presentation/SongBackground.test.tsx -t "the next strophe of the same song keeps` | 1 | 1 | pass |
| C29 | `walk - on the presentation window with a real video file: play the looping video item, go to the Tela preta it` | - | - | pass (Walked) |
| C30 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "shows time, bar and every control for a ` | 1 | 1 | pass |
| C30 | `npx vitest run src/utils/videoControls.test.ts -t "formats elapsed, total, remaining and fraction"` | 1 | 1 | pass |
| C31 | `npx vitest run src/utils/videoControls.test.ts -t "the strip shows only while the wall plays a video"` | 1 | 1 | pass |
| C31 | `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "the video strip comes and g` | 1 | 1 | pass |
| C32 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "unmounting reports that no video is` | 1 | 1 | pass |
| C33 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "reports playback at least every 500` | 1 | 1 | pass |
| C34 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "Pausar sends pause and Retomar sends res` | 1 | 1 | pass |
| C34 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "pause and resume drive the element ` | 1 | 1 | pass |
| C35 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "Reiniciar sends restart"` | 1 | 1 | pass |
| C35 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "restart plays from zero from every ` | 1 | 1 | pass |
| C36 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "the skip buttons send ten seconds either` | 1 | 1 | pass |
| C36 | `npx vitest run src/utils/videoControls.test.ts -t "a skip is clamped to the video"` | 1 | 1 | pass |
| C36 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "skip and seek set the clamped posit` | 1 | 1 | pass |
| C37 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "clicking the bar seeks to that fraction"` | 1 | 1 | pass |
| C37 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "dragging the bar seeks on release only"` | 1 | 1 | pass |
| C38 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "Silenciar and Ativar som send the mute c` | 1 | 1 | pass |
| C38 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "mute is for this run and a new land` | 1 | 1 | pass |
| C39 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "controls reach both outputs while Simult` | 1 | 1 | pass |
| C40 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "a frozen output disables the playback co` | 1 | 1 | pass |
| C40 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "playback commands are ignored while` | 1 | 1 | pass |
| C41 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "an unknown duration shows dashes and dis` | 1 | 1 | pass |
| C42 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "a video that cannot play reports fa` | 1 | 1 | pass |
| C42 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "a failed video shows the error and disab` | 1 | 1 | pass |
| C43 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "an ended video reports ended and st` | 1 | 1 | pass |
| C43 | `npx vitest run src/components/presentation/VideoControls.test.tsx -t "an ended video keeps Reiniciar only"` | 1 | 1 | pass |
| C44 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "ignores commands for another output` | 1 | 1 | pass |
| C45 | `npx vitest run src/api/commands.test.ts -t "video events use the documented names and payloads"` | 1 | 1 | pass |
| C46 | `walk - operator and presentation pages side by side with a real video file: use each control and read the wall` | - | - | pass (Walked) |
| C47 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "edit control on song and countdown rows an` | 1 | 1 | pass |
| C47 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "the read-only list has no edit control"` | 1 | 1 | pass |
| C48 | `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "row edit opens that countdown wit` | 1 | 1 | pass |
| C49 | `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "row edit saves the countdown and ` | 1 | 1 | pass |
| C70 | `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "the dialog opened from a row load` | 1 | 1 | pass |
| C70 | `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "a clock-time countdown opens on i` | 1 | 1 | pass |
| C70 | `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "saving unchanged sends back every` | 1 | 1 | pass |
| C50 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::item_edit_restyles_without_tou` | 1 | - | pass |
| C51 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::item_edit_restarts_when_the_ta` | 1 | - | pass |
| C52 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::countdown_edit_reaches_every_outpu` | 1 | - | pass |
| C53 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::countdown_edit_refuses_a_passed_cl` | 1 | - | pass |
| C54 | `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "a refused save keeps the dialog o` | 1 | 1 | pass |
| C55 | `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "a renamed countdown relabels its ` | 1 | 1 | pass |
| C56 | `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "live: schedule fields are disabled while` | 2 | 2 | pass |
| C56 | `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "live: a save while counting keeps the st` | 1 | 1 | pass |
| C57 | `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "live: a schedule arms when nothing is co` | 1 | 1 | pass |
| C57 | `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "live: turning off this item's armed sche` | 1 | 1 | pass |
| C57 | `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "live: another item's armed schedule is l` | 1 | 1 | pass |
| C58 | `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "Save with schedule ON calls updateSetIte` | 1 | 1 | pass |
| C58 | `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "Save with schedule OFF calls updateSetIt` | 1 | 1 | pass |
| C59 | `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "Cancelar writes nothing"` | 1 | 1 | pass |
| C59 | `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "Parar closes the countdown dialog` | 1 | 1 | pass |
| C60 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::restart_after_an_item_edit_ret` | 1 | - | pass |
| C60 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_moves_the_target` | 1 | - | pass |
| C74 | `npx vitest run src/utils/songSearch.test.ts -t "ignores accents, ç and case on both sides"` | 1 | 1 | pass |
| C74 | `npx vitest run src/utils/songSearch.test.ts -t "folds every Portuguese accented letter"` | 1 | 1 | pass |
| C75 | `npx vitest run src/components/setbuilder/HomeSetBuilder.test.tsx -t "song search ignores accents and ç"` | 1 | 1 | pass |
| C76 | `npx vitest run src/components/presentation/LiveSongPicker.test.tsx -t "search ignores accents and ç"` | 1 | 1 | pass |
| C77 | `cargo test --manifest-path src-tauri/Cargo.toml --test fts search_ignores_accents_and_cedilla` | 2 | - | pass |
| C77 | `cargo test --manifest-path src-tauri/Cargo.toml --test fts fallback_search_ignores_accents_and_cedilla` | 1 | - | pass |
| C78 | `cargo test --manifest-path src-tauri/Cargo.toml --lib services::fts_query::tests::fold_for_search_drops_accent` | 1 | - | pass |
| C61 | `node scripts/check-version.mjs v1.10.0` | count unknown | - | pass |
| C62 | `test "$(git -c core.sshCommand='ssh -p 443' ls-remote ssh://git@ssh.github.com:443/Vinnissaum/lyrizzy.git refs` | count unknown | - | **fail** |
| C63 | `node -e "fetch('https://github.com/Vinnissaum/lyrizzy/releases/latest/download/latest.json').then(r=>r.json())` | count unknown | - | **fail** |
| C64 | `grep -Eq '^## Phase 23: .* — RELEASED \(v1\.10\.0\)$' .specs/project/ROADMAP.md` | count unknown | - | **fail** |
| C64 | `grep -q 'video_report' CLAUDE.md && grep -q 'video_command' CLAUDE.md` | count unknown | - | pass |
| Build | `npx tsc --noEmit` | - | - | pass |
| Build | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | - | - | pass |

## Mutations

| Mutation | Location | Killed |
| --- | --- | --- |
| S1 C4: refresh() under a search stores the filtered list as allSongs | `src/stores/library.ts:78` | yes |
| S2 C65: the wall reloads its media only when its list is empty | `src/components/presentation/QuickMediaRenderer.tsx:19` | yes |
| S3 C18: current and frozen re-pointed by the permutation instead of its inverse | `src-tauri/src/domain/presentation.rs:200` | yes |
| S4 C27: an outgoing video keeps playing until its layer unmounts | `src/components/presentation/MediaSlideRenderer.tsx:113` | yes |
| S5 C52: an item edit skips a finished countdown counting from the item | `src-tauri/src/commands/countdown.rs:558` | yes |
