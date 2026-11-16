# Presenter mode: song names, image upload, reorder, video controls, countdown editor checks

Mutations: 5
Build: `npx tsc --noEmit`; `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
Plan: `.specs/features/phase23-presenter-video-countdown-reorder/plan.md`

66 checks in 6 slices (2 appended during the build) · 1 one-way door · 0 open

## Checks

### S1 - Song rows keep their titles

**C1** - With the Biblioteca search set to "amor", to "zzz" (no match) and to nothing, the presenter's set pane shows the title and the artist of both songs of the set [AJUNTAMENTO, O AMOR DE DEUS], never "—" (AC 1)
Proof: `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "song rows keep their titles under a library search"`

**C2** - With the Biblioteca search set to "amor" and AJUNTAMENTO on screen, the strophes header reads `Estrofes — AJUNTAMENTO — <artist>` and the remove confirmation for GALILEU, a song not on screen that does not match the search either, names it (AC 2)
Proof: `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "strophes header names the song under a library search"`
Proof: `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "remove confirmation names the song under a library search"`

**C3** - With the Biblioteca search set to "amor" and 3 songs in the library, `Adicionar música` lists 3 songs (AC 3)
Proof: `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "the song picker lists every library song under a library search"`

**C4** - With the Biblioteca search set to "amor", a `songs_changed` event after AJUNTAMENTO was renamed AJUNTAMENTO 2 makes its row read AJUNTAMENTO 2 without a restart (AC 4)
Proof: `npx vitest run src/components/presentation/LiveSongTitles.test.tsx -t "a renamed song relabels its row under a library search"`

**C5** - Loading the presenter's titles leaves the library store's `search` text and its filtered `songs` as they were: search "amor" with 1 match stays "amor" with 1 song (AC 5)
Proof: `npx vitest run src/stores/library.test.ts -t "loading presenter titles leaves the search and its result alone"`

**C6** - A song item whose song is not in the unfiltered list labels as "—" (AC 6)
Proof: `npx vitest run src/components/presentation/itemMeta.test.tsx -t "a song missing from the library falls back to the dash"`

### S2 - Upload a photo from the Imagem dialog

**C7** - The `Selecionar imagem` dialog shows the control `Enviar imagem do computador` when the library holds images and when it holds none (AC 7)
Proof: `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "upload control shows with images and with none"`

**C8** - Using `Enviar imagem do computador` opens the file dialog with the extensions `png`, `jpg`, `jpeg`, `webp`, `gif` and `multiple: true` (AC 8)
Proof: `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "upload opens the file dialog for images, several files"`

**C9** - Picking 2 files sends 2 `import_media` calls with those paths, the dialog stays open with the 2 new thumbnails first in its grid, and no `set_media_overlay` is sent (AC 9)
Proof: `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "picked files are imported and listed first without projecting"`

**C10** - In the presenter, clicking an image uploaded from the dialog sends `set_media_overlay` with that image's id on the focused output and closes the dialog (AC 10)
Proof: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "an image uploaded in the dialog projects on click"`

**C11** - While the first of 2 picked files is importing, the upload control is disabled and reads `Importando 1/2…` (AC 11)
Proof: `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "upload shows its progress and is disabled meanwhile"`

**C12** - With 3 files picked and the second failing with `media.copy_error`, the other 2 are imported, the dialog stays open, and an alert reads `1 arquivo não foi importado` (AC 12)
Proof: `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "a failed file is counted and the others are imported"`

**C13** - Cancelling the file dialog sends no `import_media` and leaves the grid as it was (AC 13)
Proof: `npx vitest run src/components/presentation/ImageOverlayDialog.test.tsx -t "cancelling the file dialog imports nothing"`

**C65** - The wall shows an image imported after its window opened: when the overlay names a media id its media list does not hold, it reloads the list, and renders the image once it is there (AC 10; appended during the build - the presentation window loads media once, at mount)
Proof: `npx vitest run src/components/presentation/QuickMediaRenderer.test.tsx -t "an overlay for media the wall has not loaded reloads the library"`

**C14** - Every label this feature adds exists in pt-BR and en-US with the wording in the plan's `Assumptions`, the two locales keep identical key sets, and `set.reorder_mismatch` and `countdown.target_passed` have a message in both (AC 7, 11, 12, 14, 26, 37, 39, 46)
Proof: `npx vitest run src/i18n/locales.test.ts -t "phase 23 labels in both locales"`
Proof: `npx vitest run src/i18n/locales.test.ts -t "en-US and pt-BR have identical key sets in both directions"`

### S3 - Reorder set items by drag and drop

**C15** - In the editable set pane every row has a drag handle named `Reordenar <label>`, the row on screen included; the read-only list has none (AC 14)
Proof: `npx vitest run src/components/presentation/LiveSetReorder.test.tsx -t "a drag handle on every row of the editable list only"`

**C16** - Dropping D on B's position in [A, B, C, D] shows [A, D, B, C] in the pane and sends `reorder_set_items` with the set id and the ids in that order (AC 15)
Proof: `npx vitest run src/components/presentation/LiveSetReorder.test.tsx -t "a drop reorders the pane and sends the ids in the new order"`

**C17** - In Chromium, dragging a row by its handle with the pointer moves it and sends `reorder_set_items` with the new order and no `go_to_item`; focusing a handle and using Space, ArrowDown, Space does the same (AC 15, 18, 19)
Proof: walk - present a 4-item set, drag the last row's handle onto the second row, then move a row with Space, ArrowDown, Space, reading the commands sent each time

**C18** - Reordering a loaded set keeps the current item and slide, the frozen item and slide, and each item's slides: live on B slide 3 in [A, B, C], C moved first → [C, A, B] with `current_item_index` 2; B itself moved last → [A, C, B] with `current_item_index` 2; frozen on A slide 2 while current is C, A moved last → `frozen_at` (2, 2) and current on C (AC 16)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::presentation::tests::reorder_keeps_the_current_and_frozen_items`

**C19** - `reorder_set_items` writes the new `sort_order`, and every output with the set loaded gets the new order while keeping the item, slide index and `current_slide` it showed: Tela 1 live on B, Tela 2 live on C, A moved last → Tela 1 still B, Tela 2 still C; an output on another set is untouched (AC 15, 16)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_reorder_keeps_each_output_in_place`

**C20** - After a reorder, navigation follows the new order: in [A, C, B] with B on its last slide, next stays on B; from B's first slide, previous lands on C's last slide (AC 17)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_reorder_navigation_follows_the_new_order`

**C21** - Clicking a row's title in the editable pane still sends `go_to_item` for that row (AC 18)
Proof: `npx vitest run src/components/presentation/LiveSetReorder.test.tsx -t "clicking a row still selects it"`

**C22** - For the set [A, B, C], `reorder_set_items` refuses [A, B], [A, B, C, X] and [A, A, B] with `set.reorder_mismatch`, leaving the stored order and every output's order unchanged, and accepts [C, B, A] (AC 20)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::reorder_refuses_a_list_that_is_not_a_permutation`

**C23** - When `reorder_set_items` rejects, the pane shows the stored order again and the error in its alert line (AC 21)
Proof: `npx vitest run src/components/presentation/LiveSetReorder.test.tsx -t "a failed reorder restores the order and shows the error"`

**C24** - After [Song, Countdown (armed), Song] is reordered to put the countdown first, the armed reference the scheduled widget's `Editar` and `Cancelar` resolve points at index 0 (AC 22)
Proof: `npx vitest run src/components/presentation/LiveSetReorder.test.tsx -t "an armed schedule follows its item through a reorder"`

**C25** - In Chromium at 1024×700 and at 1536×912, the set pane is 240 px wide and each row's handle, title, edit control and remove control are inside it (AC 23)
Proof: walk - present a set with a song, a countdown and a video at both window sizes and measure the pane and each row's controls

### S4 - A video stops when the wall leaves it, and the operator controls it

**C26** - `TransitionStage` removes the outgoing layer's content from the page once its fade is over: at 200 ms the old content is gone no later than 230 ms after the change; at 0 ms it is gone in the same update (AC 24, 25)
Proof: `npx vitest run src/components/presentation/TransitionStage.test.tsx -t "the outgoing layer is unmounted when its fade ends"`
Proof: `npx vitest run src/components/presentation/TransitionStage.test.tsx -t "an instant cut unmounts the outgoing layer at once"`

**C27** - A video item's `<video>` is paused in the update that replaces it as the wall's content, before its fade ends (AC 24)
Proof: `npx vitest run src/components/presentation/TransitionStage.test.tsx -t "an outgoing video is paused in the update that replaces it"`

**C28** - On the wall, leaving an item leaves nothing of it mounted after the fade: a video item, a camera item, a song with a video background and a countdown with a video background each leave no `<video>` behind a `Tela preta` item; video A → video B leaves one `<video>`, B's; returning to the video mounts a `<video>` again (AC 24, 25)
Proof: `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "an item that left the wall leaves no media behind"`
Proof: `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "one video replaces another and a return mounts it again"`

**C66** - On the wall, a change that only shifts the current item's index (a live reorder, add or remove before it) does not re-run the transition: the content stays mounted, so a playing video's `<video>` element is the same one (AC 16; appended during the build - the transition was keyed by item index)
Proof: `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "a shift of the current item's index leaves its content mounted"`

**C29** - In Chromium, with a looping video item playing on the wall, going to a `Tela preta` item leaves no `<video>` element and nothing playing within 230 ms; going back plays the video from 00:00 (AC 24)
Proof: walk - on the presentation window with a real video file: play the looping video item, go to the `Tela preta` item, read the page's `<video>` elements after 300 ms, then go back

**C30** - For a playing video the strip shows `01:05 / 03:20`, `−02:15`, a bar at 32.5%, and the controls `Pausar`, `Reiniciar`, `−10 s`, `+10 s` and `Silenciar`, given a report of 65 000 ms of 200 000 ms (AC 26, 28)
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "shows time, bar and every control for a playing video"`
Proof: `npx vitest run src/utils/videoControls.test.ts -t "formats elapsed, total, remaining and fraction"`

**C31** - The presenter shows the strip only while the focused output's wall reports a video: it appears with a report naming an item, and goes with a report of `itemId: null`, with the output's mode `idle` or `blank`, with an overlay, and with a countdown takeover (AC 27)
Proof: `npx vitest run src/utils/videoControls.test.ts -t "the strip shows only while the wall plays a video"`
Proof: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "the video strip comes and goes with the wall's video"`

**C32** - The wall's video item reports `itemId: null` for its output when it unmounts, so blackout, an overlay, a takeover, the next item and `Parar` all clear the strip (AC 27)
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "unmounting reports that no video is on the wall"`

**C33** - While playing, the wall reports its output, item id, status `playing`, position, duration and mute state at least once every 500 ms, and at once on pause, play, seek, mute change, end and error (AC 28)
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "reports playback at least every 500 ms and on every change"`

**C34** - `Pausar` sends the `pause` command and, once the wall reports `paused`, the control reads `Retomar`, which sends `resume`; on the wall `pause` pauses the element and `resume` plays it without changing its position (AC 29)
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "Pausar sends pause and Retomar sends resume"`
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "pause and resume drive the element and keep its position"`

**C35** - `Reiniciar` sends `restart`; on the wall it sets the position to 0 and plays, from playing, from paused and from ended (AC 30)
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "Reiniciar sends restart"`
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "restart plays from zero from every state"`

**C36** - `−10 s` and `+10 s` send `skip` with −10 000 and +10 000 ms; the wall moves by that much clamped to the video: 4 000 ms − 10 s → 0; 195 000 of 200 000 ms + 10 s → 200 000; 60 000 + 10 s → 70 000 (AC 31)
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "the skip buttons send ten seconds either way"`
Proof: `npx vitest run src/utils/videoControls.test.ts -t "a skip is clamped to the video"`
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "skip and seek set the clamped position"`

**C37** - Clicking the bar at 25% of a 200 000 ms video sends `seek` with 50 000 ms; dragging shows the target time in the strip and sends `seek` only on release, once (AC 32)
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "clicking the bar seeks to that fraction"`
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "dragging the bar seeks on release only"`

**C38** - `Silenciar` sends `mute` with `true` and, once the wall reports muted, the control reads `Ativar som`, which sends `false`; the wall mutes its element without any `update_set_item`, and a new landing on the item starts from the item's saved mute option (AC 33)
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "Silenciar and Ativar som send the mute command"`
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "mute is for this run and a new landing uses the saved option"`

**C39** - While Simultânea is on, a video control sends its command for both outputs; while it is off, for the focused output only (AC 34)
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "controls reach both outputs while Simultânea is on"`

**C40** - While the output is frozen, `Pausar`/`Retomar`, `Reiniciar`, `−10 s`, `+10 s` and the bar are disabled, and the wall ignores `resume`, `restart`, `seek` and `skip` commands (AC 35)
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "a frozen output disables the playback controls"`
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "playback commands are ignored while frozen"`

**C41** - With a report whose `durationMs` is null, the strip shows `--:--` for the total and the remaining time and disables the bar, `−10 s` and `+10 s`; `Pausar` and `Reiniciar` stay usable (AC 36)
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "an unknown duration shows dashes and disables seeking"`

**C42** - When the wall's `<video>` fires `error` it reports `failed`, and the strip then shows `Não foi possível reproduzir o vídeo` with every control disabled (AC 37)
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "a video that cannot play reports failed"`
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "a failed video shows the error and disables every control"`

**C43** - When a video with no loop ends the wall reports `ended`; the strip then shows `−00:00`, keeps `Reiniciar` usable and disables `Pausar`/`Retomar`; with auto-advance on, the item's end still advances the set (AC 38)
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "an ended video reports ended and still auto-advances"`
Proof: `npx vitest run src/components/presentation/VideoControls.test.tsx -t "an ended video keeps Reiniciar only"`

**C44** - The wall obeys a `video_command` only when its `output` and `itemId` are its own: a command for the other output, or for another item id, changes nothing (door 1)
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "ignores commands for another output or another item"`

**C45** - `src/api/commands.ts` emits `video_report` and `video_command` under those names with the payload shapes door 1 gives, and filters a listener by output (door 1)
Proof: `npx vitest run src/api/commands.test.ts -t "video events use the documented names and payloads"`

**C46** - In Chromium the strip's controls drive a real video on the wall: `Pausar` stops its clock, `Retomar` continues it, `Reiniciar` returns it to 00:00, a click on the bar moves it, and the strip is reachable at 1024×700 and 1536×912 (AC 26, 28-32)
Proof: walk - operator and presentation pages side by side with a real video file: use each control and read the wall's `<video>` `paused` and `currentTime`, at both window sizes

### S5 - Edit a countdown from its set row

**C47** - In the editable set pane the `song` and `countdown` rows have an edit control, the countdown's named `Editar cronômetro <name>`, the rows on screen included; `media`, `web_view`, `blank` and `slide_show` rows have none; the read-only list has none (AC 39)
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "edit control on song and countdown rows and no other row"`
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "the read-only list has no edit control"`

**C48** - Using a countdown row's edit control opens the dialog `Configurar cronômetro` loaded with that item's name, duration and message, and sends no `go_to_item` and no countdown command (AC 40)
Proof: `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "row edit opens that countdown without moving the wall"`

**C49** - `Salvar` in that dialog sends `update_set_item` with the row's item id and the edited configuration, and the dialog closes (AC 41)
Proof: `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "row edit saves the countdown and closes"`

**C50** - An item edit that leaves the target as it was keeps the countdown's mode, `remaining_ms` and `target_epoch_ms` and copies the message, sizes, position, background and end action: running at 03:12 with a new message; paused at 02:00 with a new position; running at 03:12 with the end action changed to blackout; the same 10:00 duration saved again (AC 42, 43)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::item_edit_restyles_without_touching_the_time`

**C51** - An item edit that changes the target restarts the countdown running from the new target with the new `duration_ms`: running at 03:12, 10:00 → 07:30; paused at 02:00 → 05:00; finished → 01:00; duration → clock time 19:30 at 19:10 gives 20:00 left (AC 43)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::item_edit_restarts_when_the_target_changed`

**C52** - `update_set_item` applies the edit to every output whose countdown's source is the item and to no other: both outputs counting from it restart, an output counting from another item keeps its time, and editing an item nothing counts from changes no countdown; the stored `countdown_config` is the edited one (AC 41, 43)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::countdown_edit_reaches_every_output_counting_from_it`

**C53** - `update_set_item` refuses with `countdown.target_passed` a clock-time target already passed today when the item is the source of a countdown counting on an output, and writes nothing; the same edit on an item nothing counts from is saved (AC 44)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::countdown_edit_refuses_a_passed_clock_time_on_air`

**C54** - When `update_set_item` rejects, the dialog stays open and shows the error's message (AC 44)
Proof: `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "a refused save keeps the dialog open with the error"`

**C55** - After a countdown is saved with a new name, its set row shows the new name (AC 45)
Proof: `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "a renamed countdown relabels its row"`

**C56** - Opened while presenting with a countdown running or paused on the focused output, the dialog's schedule fields are disabled with the note `Indisponível enquanto um cronômetro está em andamento`; a save sends `update_set_item` carrying the item's stored `scheduledStart` unchanged and sends neither `arm_countdown` nor `reset_countdown` (AC 46)
Proof: `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "live: schedule fields are disabled while a countdown is counting"`
Proof: `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "live: a save while counting keeps the stored schedule and neither arms nor resets"`

**C57** - Opened while presenting with no countdown running or paused: a save with a schedule sends `arm_countdown`; a save that turns off this item's armed schedule sends `reset_countdown`; a save with no schedule while another item's schedule is armed sends no `reset_countdown` (AC 47)
Proof: `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "live: a schedule arms when nothing is counting"`
Proof: `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "live: turning off this item's armed schedule disarms it"`
Proof: `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "live: another item's armed schedule is left alone"`

**C58** - Opened on Home the dialog saves as before: with a schedule it arms, without one it resets (plan `Changes underneath`)
Proof: `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "Save with schedule ON calls updateSetItem AND arm with durationMs \+ scheduledStart"`
Proof: `npx vitest run src/components/set/CountdownScheduleModal.test.tsx -t "Save with schedule OFF calls updateSetItem and reset \(no arm\)"`

**C59** - `Cancelar` in the dialog opened from a row sends no `update_set_item`; `Parar` closes the dialog (AC 48)
Proof: `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "Cancelar writes nothing"`
Proof: `npx vitest run src/components/presentation/LiveCountdownRowEdit.test.tsx -t "Parar closes the countdown dialog"`

**C60** - After an item edit changed the target to 07:30, `restart` returns the countdown to 07:30; the strip's `+1 min` still moves only `target_epoch_ms` and `remaining_ms`, never `duration_ms` (AC 49)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::restart_after_an_item_edit_returns_to_the_new_target`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::countdown::tests::live_adjust_moves_the_target`

### S6 - Release v1.10.0

**C61** - The version reads `1.10.0` in `package.json`, both `package-lock.json` fields, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` (AC 50)
Proof: `node scripts/check-version.mjs v1.10.0`

**C62** - Tag `v1.10.0` is on GitHub and points at the local `v1.10.0` commit (AC 51)
Proof: `test "$(git -c core.sshCommand='ssh -p 443' ls-remote ssh://git@ssh.github.com:443/Vinnissaum/lyrizzy.git refs/tags/v1.10.0 | cut -f1)" = "$(git rev-parse v1.10.0)"`

**C63** - The published `latest.json` serves version `1.10.0` with both `windows-x86_64` and `linux-x86_64` entries, and every installer URL in it points under `/releases/download/v1.10.0/` and answers 200, which is what the publish-manifest workflow leaves behind (AC 51)
Proof: `node -e "fetch('https://github.com/Vinnissaum/lyrizzy/releases/latest/download/latest.json').then(r=>r.json()).then(async m=>{const p=m.platforms||{};if(m.version!=='1.10.0'||!p['windows-x86_64']||!p['linux-x86_64'])process.exit(1);for(const e of Object.values(p)){if(!e.url.includes('/releases/download/v1.10.0/'))process.exit(2);const r=await fetch(e.url,{method:'HEAD'});if(!r.ok)process.exit(3)}}).catch(()=>process.exit(4))"`

**C64** - The project roadmap carries a Phase 23 entry marked released as `v1.10.0`, and CLAUDE.md's IPC contract names `video_report` and `video_command` (AC 52)
Proof: `grep -Eq '^## Phase 23: .* — RELEASED \(`v1\.10\.0`\)$' .specs/project/ROADMAP.md`
Proof: `grep -q 'video_report' CLAUDE.md && grep -q 'video_command' CLAUDE.md`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| library search states, AC 1 (3) | "amor" C1 · "zzz" C1 · none C1, table-driven over all 3 | - |
| readers of the unfiltered titles (4) | set pane row C1 · strophes header C2 · remove confirmation C2 · song picker C3 | - |
| upload outcomes, AC 9-13 (5) | all imported C9 · importing C11 · one failed C12 · cancelled C13 · click projects C10 | - |
| windows that must know an uploaded image (2) | operator dialog C9 · the wall C65 | - |
| upload control states, AC 7 (2) | library with images C7 · empty library C7 | - |
| AC 16 examples (4) | C moved before the current item C18 · the row on screen moved C18 · two outputs on different items C19 · frozen item moved C18 | - |
| AC 20 examples (4) | one missing C22 · one unknown C22 · one twice C22 · a true permutation C22 | - |
| reorder gestures (3) | pointer drag C17 · keyboard C17 · drop handler C16 | - |
| reorder readers (5) | stored order C19 · every output C19 · navigation C20 · armed schedule reference C24 · the wall's mounted content C66 | - |
| items leaving the wall, AC 24-25 (5) | video item C28 · camera item C28 · song with a video background C28 · countdown with a video background C28 · video to video C28 | - |
| transition durations (2) | 200 ms C26 · 0 ms C26 | - |
| strip visibility, AC 27 (6) | video reported C31 · `itemId: null` C31 · mode `idle` C31 · mode `blank` C31 · overlay C31 · takeover C31 | - |
| `video_command` actions, door 1 (6) | `pause` C34 · `resume` C34 · `restart` C35 · `seek` C37 · `skip` C36 · `mute` C38 | - |
| `video_report` statuses, door 1 (5) | `loading` C41 · `playing` C30, C33 · `paused` C34 · `ended` C43 · `failed` C42 | - |
| `video_command` addressing, door 1 (3) | own output and item C34 · other output C44 · other item C44 | - |
| AC 31 examples (3) | 00:04 − 10 s C36 · 03:15 + 10 s C36 · mid-video + 10 s C36 | - |
| restart from (3) | playing C35 · paused C35 · ended C35 | - |
| set item types for the edit control, AC 39 (6) | `song` C47 · `countdown` C47 · `media` C47 · `web_view` C47 · `blank` C47 · `slide_show` C47, table-driven over all 6 | - |
| AC 42 examples (3) | message changed while running C50 · position changed while paused C50 · end action changed C50 | - |
| AC 43 examples (5) | running, new duration C51 · paused, new duration C51 · finished, new duration C51 · duration to clock time C51 · same duration typed again C50 | - |
| AC 44 examples (2) | passed clock time on the wall C53 · the same edit off the wall C53 | - |
| outputs for a countdown edit (3) | counting from the item C52 · counting from another item C52 · nothing counting C52 | - |
| schedule fields while presenting, AC 46-47 (4) | a countdown counting C56 · idle, schedule on C57 · idle, own schedule off C57 · idle, another's schedule armed C57 | - |
| dialog hosts (2) | presenter C48, C56, C57 · Home C58 | - |
| countdown dialog exits (4) | `Salvar` C49 · refused save C54 · `Cancelar` C59 · `Parar` C59 | - |
| locales (2) | pt-BR C14 · en-US C14 | - |
| release artefacts, AC 50-52 (5) | five version files C61 · tag C62 · published manifest on both platforms C63 · roadmap C64 · CLAUDE.md contract C64 | - |

## Swept

- validation: C22 - the reorder list is checked server-side, not only by the pane; C36 - skip and seek are clamped on the wall, which is where the command lands; C53 - a passed clock time is refused by the command; existing - the dialog's duration check (`countdown.editor.durationError`) and `import_media`'s extension allow-list (`media.unsupported_container`)
- failure modes: C12 - a failed file does not stop the others; C23 - a failed reorder restores the pane; C54 - a refused save keeps the dialog and the edits; C53 - the refusal happens before the write, so nothing is half-saved; existing - `reorder_set_items` writes inside one transaction
- idempotency: n/a - a repeated reorder with the same list writes the same order, a repeated `pause` or `mute` leaves the element as it is, and a repeated save of the same countdown is C50's "same duration typed again"
- authorization: existing - the controls render only in `OperatorPresentationLayout`; C44 - a presentation window obeys only commands addressed to its own output and item; the presentation window still invokes no mutating command (it emits `video_report`, C45)
- concurrency: C22 - a list made stale by a concurrent add or remove is refused rather than half-applied; C19 - the reorder holds every output's slides and presentation locks, in `OutputId::ALL` order, slides before presentation, as `remove_set_item_core` does; C52 - the countdown edit runs under the task lock then the countdown lock, as `apply_live_control` does
- data lifecycle: C19 - the stored order read back equals the order sent; C52 - the stored `countdown_config` read back equals the edited one; C56 - a save while counting gives the stored schedule back unchanged; C38 - mute is not stored
- dependency failure: C42 - a video the webview cannot play is reported and shown; C63 - the release proof reads GitHub and fails on a network error
- state transitions: C34, C35, C40, C43 - the video's playing, paused, ended and frozen transitions; C50, C51 - a countdown's running, paused and finished modes under an edit; C26 - a layer's fade ending
- observability: n/a - no logging requirement; errors surface in the pane's alert line (C23), the dialog (C54) and the strip (C42)

## Handoff

- **Settled mid-build:** none
- **Dispatched:** none yet
- **Boundary:** S1 (C1-C6) closed at `0a7c7b7`; S2 (C7-C13, C65) closed at `f15497d`; S3 (C15, C16, C18-C24) closed at `a36e35a`; S5 (C47-C60) closed at `3bd3882`. S4 is half built: the code is committed (TransitionStage two-slot rewrite, `video_report`/`video_command` wrappers, `MediaSlideRenderer` reporting and commands, `VideoControls`, `videoControls.ts`, `stores/video.ts`, the wall's transition keyed by item id) and the existing 872 Vitest tests, `tsc` and clippy pass, but **none of S4's own tests exist yet**: C26-C28, C30-C45 and C66 are open, and so are the test files `MediaSlideRenderer.test.tsx`, `VideoControls.test.tsx`, `src/utils/videoControls.test.ts`, the new cases in `TransitionStage.test.tsx`, `PresentationApp.test.tsx`, `commands.test.ts` and `OperatorPresentationLayout.test.tsx`. Also open: C14 (the `phase 23 labels in both locales` test; the labels themselves are in both locale files), the walks C17, C25, C29, C46, and all of S6 (C61-C64: version bump to 1.10.0, roadmap entry, CLAUDE.md IPC contract, push and publish - the push needs the user's go-ahead). Then `check_proofs.py`, the Verifier (5 mutations) and the gate. No capture binds, so no screens sub-agent
- **Abandoned:** none. Corrected during the build: C2's wording named AJUNTAMENTO for the remove confirmation while it is on screen, where remove is disabled (D-88); it now names GALILEU, a song not on screen that does not match the search. The obligation (AC 2) is unchanged. Test changes that follow a changed claim or a new store field, not a weakened one: `SetItemList.test.tsx` "edit control on every song row and no other row" became "edit control on song and countdown rows and no other row" (AD-093 replaces that part of AD-091, so phase 22's C1 selector no longer exists); fixtures gained `allSongs: null`, `refreshAllSongs`, `onSongsChanged`, `listMedia`, `importMedia`, `onVideoReport` where the layout now calls them
- **Found, outside scope:** the media store has the same flaw the song list had - `useMediaStore.media` is whatever the Mídia view last filtered or searched for, so with that filter on "Vídeos" an image item in the set labels as `Mídia` and the operator's live preview of an image overlay shows a placeholder. The `Imagem` dialog no longer depends on it; the rest is untouched
- **Walked:** not yet
