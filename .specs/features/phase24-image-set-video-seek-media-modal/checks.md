# Presenter image to the set, video seeking on Windows, Home media dialog checks

Mutations: 3
Build: `npx tsc --noEmit`; `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
Plan: `.specs/features/phase24-image-set-video-seek-media-modal/plan.md`

39 checks in 6 slices (5 appended after verification, 1 with S6) · 1 one-way door · 1 open, of which 0 block

## Checks

### S1 - A picked image joins the set and the wall stays

**C1** - In the presenter, `Imagem` opens the dialog `Adicionar imagem ao conjunto`; with the set [A, B (current), C], clicking the image "Pix" sends `add_set_item` with the set's id, `itemType: "media"`, Pix's id, `mediaOptions` `{ loop: false, mute: false, autoAdvanceOnEnd: true }` and `afterItemId` B, sends no `set_media_overlay`, no `go_to_item` and no slide command, keeps the dialog open and marks Pix `Adicionada` (AC 1, 5)
Proof: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "a picked image is added after the current item and never projected"`
Proof: `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "a clicked image is added after the anchor and marked Adicionada"`

**C2** - Adding an image item after B in [A, B, C] stores [A, B, image, C] and puts the image, of kind `image` with one slide, in every output with the set loaded, each keeping what it shows: Tela 1 live on B slide 2 stays on item 1 slide 2 with the same current slide; Tela 2 live on C moves from index 2 to 3 with the same current slide; Tela 2 frozen on A slide 1 while browsing B keeps `frozen_at` (0, 1) and its current slide (AC 1, 2)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_image_add_keeps_every_output_in_place`

**C3** - Clicking "Pix" and then "Logo" sends the second `add_set_item` with `afterItemId` equal to the id the first one returned, also when "Logo" is clicked before the first add has returned; both read `Adicionada` and the dialog stays open (AC 3)
Proof: `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "a second pick lands right after the first, even while the first is pending"`

**C4** - Uploading two files with `Enviar imagem do computador` imports both, lists them first in the grid and sends no `add_set_item` (AC 4)
Proof: `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "uploaded images are listed first and nothing is added to the set"`

**C5** - With an `Aviso` up, `Fechar overlay` sends `clear_overlay` for the focused output, and <kbd>Esc</kbd> clears the overlay before anything else, as before (AC 5)
Proof: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "Fechar overlay still clears an Aviso"`
Proof: `npx vitest run src/windows/operator/OperatorApp.test.tsx -t "an active overlay is cleared first and never raises the chooser"`

**C6** - While presenting, with the Mídia view's list holding only videos (filter `Vídeos`, search "abc") and the whole library loaded, the image item "Pix" is named "Pix" in the set pane row, the strophes header, the remove confirmation, the strophes pane's item card and the Tela 2 launch list, and the live preview shows Pix's image; loading the whole library leaves the Mídia view's filter, search and list as they were (AC 6)
Proof: `npx vitest run src/components/presentation/LiveMediaLabels.test.tsx -t "an image item is named from the whole library under a Mídia filter"`
Proof: `npx vitest run src/components/presentation/LiveMediaLabels.test.tsx -t "the live preview shows an image the Mídia view does not list"`
Proof: `npx vitest run src/stores/media.test.ts -t "loading the whole library leaves the Mídia view alone"`

**C7** - The wall asks for the whole library when it opens (`list_media` with `limit: -1`, no kind, no search), reloads it on `media_library_changed`, and when the current image item names a media id it does not hold it reloads once and then shows the image, never `Mídia não encontrada` once the image is there; `list_media` with a negative limit returns all 250 of 250 media items and without one the newest 200 (AC 7)
Proof: `npx vitest run src/stores/media.test.ts -t "the whole library is asked with no cap"`
Proof: `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "an image item the wall has not loaded reloads the library and shows it"`
Proof: `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "the wall reloads its media when the library changes"`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --test media list_media_with_no_cap_returns_every_media`

**C8** - When `add_set_item` rejects with `set.item_not_found`, the dialog stays open, shows the alert `Item não encontrado`, and the image is not marked `Adicionada` (AC 8)
Proof: `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "a refused add keeps the dialog open with the error"`

**C9** - In Chromium at 1024×700 and at 1536×912, the presenter's `Imagem` dialog with 30 images shows no card overlapping another and every thumbnail at least 160 px wide (AC 9)
Proof: walk - present a set, open `Imagem` with 30 images in the library at both window sizes, and measure every card's box and thumbnail width

**C34** - A pick in `Imagem` lands after the focused output's current item as it is when the pick is made: with the dialog opened on item-b and the current item moved to item-c, the first pick sends `afterItemId` item-c; a second pick made after the current item moved still lands after the first pick's new item (AC 1, 3; appended after verification - the anchor was read once, when the dialog opened)
Proof: `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "the first pick follows the current item at the click"`
Proof: `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "a later pick still follows the first after the current item moves"`

**C35** - While presenting, an image item whose media the presenter's whole library does not list yet - uploaded and added mid-service - is named `Mídia` until `media_library_changed`, and then reads "Pix" in its set pane row and in the strophes header, and the live preview shows it (AC 6, 7; appended after verification - nothing proved the operator's reload)
Proof: `npx vitest run src/components/presentation/LiveMediaLabels.test.tsx -t "an upload during the service names its row once the library changes"`

**C36** - With the focused output frozen on item-1 while the operator browses item-2, a pick in `Imagem` sends `afterItemId` item-2 (AC 2; appended after verification - the frozen anchor was proven only in Rust, with the anchor given)
Proof: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "a pick while the wall is frozen follows the browsed item"`

**C38** - The Tela 2 launch list names the image item "Pix" from the whole library, never `Mídia` (AC 6; appended after verification - C6 named this list but none of its proofs ran it)
Proof: `npx vitest run src/components/presentation/LiveMediaLabels.test.tsx -t "the Tela 2 launch list names an image item from the whole library"`

### S2 - Seeking a video works and loading one does not freeze the app

**C10** - The asset protocol answers a `Range` with `206`, exactly the asked bytes up to 1 048 576 of them, `Content-Range: bytes <a>-<last>/<size>`, `Content-Length` equal to the body's length and `Accept-Ranges: bytes`: on a 10 MiB file `bytes=0-` gives bytes 0-1048575 with `Content-Range: bytes 0-1048575/10485760`, `bytes=5000-5999` those 1 000 bytes, `bytes=-500` the last 500, `bytes=10485759-` the last byte, `bytes=0-99999999` bytes 0-1048575; on a 300-byte file `bytes=0-` all 300 bytes with `Content-Range: bytes 0-299/300` (AC 10)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::a_range_is_answered_with_206_and_those_bytes`

**C37** - A one-byte range is answered with that byte: on a 10 MiB file `bytes=5000-5000` gives `206`, byte 5000, `Content-Range: bytes 5000-5000/10485760` and `Content-Length: 1`; `bytes=0-0` gives byte 0 with `Content-Range: bytes 0-0/10485760` (AC 10; appended after verification)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::a_one_byte_range_is_answered_with_that_byte`

**C11** - A request with no `Range`, or with `Range: items=0-5` or `bytes=5-1`, gets `200`, the whole file, `Content-Length` and `Accept-Ranges: bytes` (AC 11)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::without_a_usable_range_the_whole_file_is_answered`

**C12** - On a 10 MiB file, `bytes=10485760-` and `bytes=20000000-20000099` get `416` with `Content-Range: bytes */10485760` and an empty body (AC 12)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::a_range_past_the_end_is_answered_with_416`

**C13** - With and without `Range: bytes=0-`, a path with `..` gets `403`, a file reached through a link that leaves the media directory gets `403`, a missing file gets `404`; `Content-Type` is `video/mp4`, `video/webm`, `image/png`, `image/jpeg`, `image/gif`, `image/webp` for mp4, webm, png, jpg, gif, webp (AC 13)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::path_rules_hold_with_and_without_a_range`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::content_type_follows_the_extension_in_every_answer`

**C14** - The protocol hands the request to another thread: asked for a named pipe nobody writes to (opening it blocks), the handler returns to its caller while the pipe is still unopened, and the answer arrives on a thread other than the caller's once a writer opens it; `lib.rs` registers `asset` with `register_asynchronous_uri_scheme_protocol` (AC 14)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::the_file_is_read_off_the_calling_thread`
Proof: `grep -q 'register_asynchronous_uri_scheme_protocol("asset"' src-tauri/src/lib.rs`

**C15** - In Chromium, with the wall's video served through the protocol's own answering function, the video's seekable range is its whole length, and the strip moves a 20 s video to the asked position: at 00:02 a click at 50% of the bar → 00:10; `+10 s` from 00:10 → 00:20; `−10 s` from 00:15 → 00:05 (AC 15)
Proof: walk - operator and wall pages with a real 20 s video served by `protocol::asset` over HTTP: read the wall's `seekable`, then use the bar, `+10 s` and `−10 s`, reading the wall's `currentTime`

**C16** - On the ranged answers, `Pausar`/`Retomar`, `Reiniciar` and `Silenciar`/`Ativar som` still drive the wall's video as phase 23 specified (AC 16)
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "pause and resume drive the element and keep its position"`
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "restart plays from zero from every state"`
Proof: `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "mute is for this run and a new landing uses the saved option"`
Proof: walk - in the C15 visit, use `Pausar`, `Retomar`, `Reiniciar`, `Silenciar` and `Ativar som`, reading the wall's `paused`, `currentTime` and `muted`

### S3 - Home's `Mídia` button opens a media dialog with large thumbnails and delete

**C17** - On Home, `Mídia` opens the dialog `Adicionar mídia ao conjunto` with `Todos` pressed, `Imagens` and `Vídeos`, listing every media item newest first; `Imagens` lists only the images, `Vídeos` only the videos, `Todos` every item, presentations included (AC 17)
Proof: `npx vitest run src/components/set/SetBuilder.test.tsx -t "Mídia opens the media dialog"`
Proof: `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "lists the library newest first under Todos, Imagens and Vídeos"`

**C18** - In Chromium at 1024×700 and at 1536×912, Home's media dialog with 30 media items shows no card overlapping another and every thumbnail at least 160 px wide, and scrolled to its last card it still shows its title, its filters and its close control (AC 18)
Proof: walk - on Home with 30 media items, open `Mídia` at both window sizes, measure every card's box and thumbnail width, scroll to the last card and check the title, filters and close control are in view

**C19** - The dialog asks for `list_media` with `limit: -1` and no kind or search whatever the Mídia view's store holds (filter `Vídeos`, search "abc"), and lists all 250 cards of a 250-item library (AC 19)
Proof: `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "lists the whole library whatever the Mídia view holds"`

**C20** - Picking a card adds it by its kind and closes the dialog: an image or a video sends `add_set_item` with `itemType: "media"`, its id and `{ loop: false, mute: false, autoAdvanceOnEnd: true }`, a presentation sends `itemType: "slide_show"` with its id; a video's options open afterwards (AC 20)
Proof: `npx vitest run src/components/set/SetBuilder.test.tsx -t "a card picked in the media dialog is added by its kind and the dialog closes"`

**C21** - Every card has a control named `Excluir <name>`; using it asks `Excluir mídia` - `Excluir "<name>"? Esta ação não pode ser desfeita.` with `Cancelar` and `Excluir`, and picks nothing (AC 21)
Proof: `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "the delete control asks before deleting and picks nothing"`

**C22** - `Excluir` sends `delete_media` with the card's id, the card leaves the grid and the dialog stays open; `Cancelar` sends no `delete_media` and keeps the card (AC 22)
Proof: `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "Excluir deletes the media and drops its card"`
Proof: `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "Cancelar deletes nothing"`

**C23** - A media item used by one song, by one song section, or by one set item shows `Mídia em uso` with `Esta mídia está em uso por 1 música(s), 0 item(s) de conjunto e 0 seção(ões). Remova as referências antes de excluir.` (and its counts for the other two) and `Entendido`; no `delete_media` is sent and the card stays (AC 23)
Proof: `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "media in use is refused with Mídia em uso"`

**C24** - When `delete_media` rejects with `media.db_error` (detail "disk"), the dialog shows `Erro no banco de dados: disk` and keeps the card (AC 24)
Proof: `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "a failed delete shows the error and keeps the card"`

**C25** - With no media, and with only images under `Vídeos`, the dialog shows `Nenhuma mídia disponível.` (AC 25)
Proof: `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "an empty library or filter shows Nenhuma mídia disponível"`

**C26** - The close control closes the dialog and sends neither `add_set_item` nor `delete_media` (AC 26)
Proof: `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "the close control adds and deletes nothing"`

**C27** - The labels this feature adds exist in pt-BR and en-US with the plan's wording - `Adicionar imagem ao conjunto` / `Add an image to the set`, `Adicionar mídia ao conjunto` / `Add media to the set`, `Excluir` / `Delete` - and the two locales keep identical key sets (AC 5, 17, 21)
Proof: `npx vitest run src/i18n/locales.test.ts -t "phase 24 labels in both locales"`
Proof: `npx vitest run src/i18n/locales.test.ts -t "en-US and pt-BR have identical key sets in both directions"`

### S4 - The user guide describes the change

**C28** - The guide names `Adicionar imagem ao conjunto` in `aviso-imagem-tela-preta.md` and `apresentar.md`, no longer lists `Imagem ligada`, names `Adicionar mídia ao conjunto` and `Mídia em uso` in `conjuntos.md` and `Adicionar mídia ao conjunto` in `midia.md`, and the site builds (AC 27)
Proof: `grep -q 'Adicionar imagem ao conjunto' docs/guia/aviso-imagem-tela-preta.md && grep -q 'Adicionar imagem ao conjunto' docs/guia/apresentar.md && ! grep -q 'Imagem ligada' docs/guia/aviso-imagem-tela-preta.md && grep -q 'Adicionar mídia ao conjunto' docs/guia/conjuntos.md && grep -q 'Mídia em uso' docs/guia/conjuntos.md && grep -q 'Adicionar mídia ao conjunto' docs/guia/midia.md`
Proof: `npm run docs:build`

### S6 - The countdown-schedule tests pass at any hour (appended with the plan's S6, 2026-11-18)

**C39** - With the process clock at 23:59:30 local, every test in `CountdownScheduleModal.test.tsx` and `LiveCountdownRowEdit.test.tsx` passes: 29 of 29, the four that failed on the tag's CI included (AC 32)
Proof: `NODE_OPTIONS="--require ./src/tests/lateNightClock.cjs" npx vitest run src/components/set/CountdownScheduleModal.test.tsx src/components/presentation/LiveCountdownRowEdit.test.tsx`

### S5 - Release v1.10.1 and the Windows check

**C29** - The version reads `1.10.1` in `package.json`, both `package-lock.json` fields, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` (AC 28)
Proof: `node scripts/check-version.mjs v1.10.1`

**C30** - Tag `v1.10.1` is on GitHub and points at the local `v1.10.1` commit (AC 29)
Proof: `test "$(git -c core.sshCommand='ssh -p 443' ls-remote ssh://git@ssh.github.com:443/Vinnissaum/lyrizzy.git refs/tags/v1.10.1 | cut -f1)" = "$(git rev-parse v1.10.1)"`

**C31** - The published `latest.json` serves version `1.10.1` with `windows-x86_64` and `linux-x86_64` entries, every installer URL under `/releases/download/v1.10.1/` answering 200 (AC 29)
Proof: `node -e "fetch('https://github.com/Vinnissaum/lyrizzy/releases/latest/download/latest.json').then(r=>r.json()).then(async m=>{const p=m.platforms||{};if(m.version!=='1.10.1'||!p['windows-x86_64']||!p['linux-x86_64'])process.exit(1);for(const e of Object.values(p)){if(!e.url.includes('/releases/download/v1.10.1/'))process.exit(2);const r=await fetch(e.url,{method:'HEAD'});if(!r.ok)process.exit(3)}}).catch(()=>process.exit(4))"`

**C32** - The project roadmap carries a Phase 24 entry marked released as `v1.10.1` (AC 30)
Proof: `grep -Eq '^## Phase 24: .* — RELEASED \(`v1\.10\.1`\)$' .specs/project/ROADMAP.md`

**C33** - On the user's Windows machine with v1.10.1, the bar, `−10 s`, `+10 s`, `Pausar`/`Retomar`, `Reiniciar` and `Silenciar`/`Ativar som` each drive the wall's video, and neither the bar nor a skip sends it to 00:00 (AC 31; settles the plan's open question 1)
Proof: walk - the user, on Windows with v1.10.1, presents a set with a video and uses each control of the strip; their report is written on the `**Walked:**` line

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| AD-096 examples (5) | first pick after the current item C1, C2 · second pick after the first C3 · frozen output C2, C36 · two outputs on different items C2 · the current item moves while the dialog is open C34 | - |
| outputs a live image add must keep (3) | live on the anchor C2 · live on another item C2 · frozen C2, anchored on the browsed item C36 | - |
| commands a pick must not send (3) | `set_media_overlay` C1 · `go_to_item` C1 · slide commands C1 | - |
| presenter readers of the whole media library (6) | set pane row C6, C35 · strophes header C6, C35 · remove confirmation C6 · strophes pane card C6 · Tela 2 launch list C38 · live preview C6, C35 | - |
| Mídia view states the presenter and the Home dialog ignore (2) | filter `Vídeos` C6, C19 · search "abc" C6, C19 | - |
| media list sources (5) | the wall's whole library at open C7 · the wall's reload on an unknown id C7 · the wall's reload on `media_library_changed` C7 · past 200 C7 · the operator's reload on `media_library_changed` C35 | - |
| presenter dialog outcomes (4) | added C1 · second add C3 · upload adds nothing C4 · refused add C8 | - |
| door 1 answers (7) | `206` C10 · `200` C11 · `416` C12 · `403` for `..` C13 · `403` for a link out C13 · `404` C13 · worker thread C14 | - |
| AC 10 examples (6) | `bytes=0-` C10 · `bytes=5000-5999` C10 · `bytes=-500` C10 · `bytes=10485759-` C10 · `bytes=0-99999999` C10 · 300-byte file C10, table-driven over all 6 | - |
| range widths at the boundaries (2) | one byte (`a-a`) C37 · over the 1 MiB cap C10 | - |
| ranges answered whole (3) | no `Range` C11 · `items=0-5` C11 · `bytes=5-1` C11 | - |
| content types (6) | mp4 C13 · webm C13 · png C13 · jpg C13 · gif C13 · webp C13, table-driven over all 6 | - |
| strip controls over ranged answers (6) | bar C15 · `+10 s` C15 · `−10 s` C15 · `Pausar`/`Retomar` C16 · `Reiniciar` C16 · `Silenciar`/`Ativar som` C16 | - |
| strip controls on Windows (6) | bar C33 · `−10 s` C33 · `+10 s` C33 · `Pausar`/`Retomar` C33 · `Reiniciar` C33 · `Silenciar`/`Ativar som` C33 | - |
| Home dialog filters (3) | `Todos` C17 · `Imagens` C17 · `Vídeos` C17 | - |
| media kinds a Home pick adds (3) | image C20 · video C20 · presentation C20, table-driven over all 3 | - |
| delete outcomes (5) | asked, nothing picked C21 · confirmed C22 · cancelled C22 · in use C23 · failed C24 | - |
| in-use reference kinds (3) | song C23 · song section C23 · set item C23, table-driven over all 3 | - |
| Home dialog exits (2) | a pick C20 · the close control C26 | - |
| empty states (2) | empty library C25 · empty filter C25 | - |
| grid layouts at window sizes (4) | presenter dialog 1024×700 C9 · presenter dialog 1536×912 C9 · Home dialog 1024×700 C18 · Home dialog 1536×912 C18 | - |
| locales (2) | pt-BR C27 · en-US C27 | - |
| guide pages (4) | `aviso-imagem-tela-preta.md` C28 · `apresentar.md` C28 · `conjuntos.md` C28 · `midia.md` C28 | - |
| countdown-schedule test files run at 23:59:30 (2) | `CountdownScheduleModal.test.tsx` C39 · `LiveCountdownRowEdit.test.tsx` C39 | - |
| release artefacts (5) | version files C29 · tag C30 · published manifest C31 · roadmap C32 · Windows check C33 | - |

## Swept

- validation: C11, C12 - a malformed or past-the-end range is answered as RFC 9110 says, never trusted; C13 - every answer stays inside the media directory; existing - `delete_media` refuses media in use on the server (`media.in_use`), so a stale reference list in the dialog cannot delete it; existing - `import_media`'s extension allow-list
- failure modes: C8 - a refused add leaves the dialog and the set as they were; C24 - a failed delete keeps the card; C13 - a missing file is `404`; C10 - `Content-Length` is the length of the body actually read, so a file that shrinks mid-read never announces bytes it does not send
- idempotency: n/a - a repeated range request answers the same bytes; a second click on the same image adds it again, as `Adicionar música` does with a song
- authorization: existing - the presentation window invokes no mutating command and the pickers render only in the operator window; C13 - the protocol serves only files inside the media directory
- concurrency: C3 - a pick made while the previous add is pending still lands after it, so picks apply in the order made; C14 - each request is answered on a worker with its own file handle, nothing shared between them; existing - `add_set_item_core` takes each output's locks as D-88's adds do
- data lifecycle: C22 - a deleted media item leaves the dialog and the library (soft delete, `deleted_at`); C7 - the wall reloads its list on `media_library_changed`
- dependency failure: C13 - a file the disk cannot give is `404`; existing - a thumbnail that fails to load is hidden and the card keeps its name, as the panel does today
- state transitions: C21, C22, C23 - the delete control's ask, then confirmed, cancelled or refused; C1, C3 - a listed image becomes `Adicionada`
- observability: n/a - no logging requirement; errors surface in the dialogs' alert lines (C8, C24)

## Handoff

- **Settled mid-build:** user, 2026-11-17, at the stop before the push: "push it" - the go-ahead for pushing `main` and tag `v1.10.1` (AC 29)
- **Dispatched:** Verifier (independent sub-agent, fresh context) at `ec04e4a`, 2026-11-17 - diff range `db8fcfc..ec04e4a`; no screens sub-agent (no capture binds) - returned: FAIL, 6 findings, 1/3 mutations killed (C1's frozen anchor and C10's one-byte range not)
- **Boundary:** S2 (C10-C16) closed at `8cc00f1`; S1 (C1-C8) closed at `e9b9d7d` and C9 by the walk at that code; S3 (C17-C27) closed at `cd681de`; S4 (C28) closed at `43579d8`; C29 (version 1.10.1) at `db5e653`. Verification fix pass at `3eb4fcd` (C34-C38 appended, findings 1-5 closed); `check_proofs.py --mutations` at `89c0d9b`: 54 pass, 3 fail (C30-C32), mutations 3 killed, 0 not. `main` and tag `v1.10.1` pushed at `7f460c2` on 2026-11-17 at 23:57 UTC over ssh.github.com:443, after the user's "push it" (C30 pass: the tag on GitHub is the local `v1.10.1`); release run 22 queued at 23:58 UTC; it completed `success` at 00:19 UTC (run 44203910862, Windows and Linux), as did CI on `main` (44203911356) and the docs site (44203911225). CI on the tag (44203910896) failed in `Frontend tests`: four countdown-schedule tests from phases 20-23 (`CountdownScheduleModal.test.tsx` 105, 250, 353; `LiveCountdownRowEdit.test.tsx` 355). Its job ran 23:58-00:00 UTC, across midnight, and their helpers (`futureHHMM`, `laterToday`) pick "now + 90 min, clamped to 23:59", a time that has passed by then; `main`'s CI on the same commit passed. S6 (C39) closed at `d43285f`. At 00:33 UTC on 2026-11-18, after the user said the release was published, GitHub still served `latest.json` 1.10.0, listed v1.10.0 as the latest release with no v1.10.1 among the published ones, and had run no publish-manifest workflow, so C31 fails; asked the user to check the draft. Open: the user publishing the draft (C31), the roadmap entry (C32), the user's Windows report (C33, finding 6), `check_proofs.py` at the final `HEAD`, the gate, and the lessons. `proofs.md` marks C33 `pass (Walked)` only because a `**Walked:**` line exists; the user has not reported from Windows yet, so C33 is open
- **Settled after the release:** user, 2026-11-18: "published it now, push the commits" - v1.10.1 published at 00:33:56 UTC (publish-manifest run 44208853892), and the go-ahead for pushing `main` with the spec records, the S6 fix and the roadmap entry. Before that, user, 2026-11-18: "published the release, fix the countdown tests too" - S6 (plan amended, C39). The four tests named above fail with the process clock at 23:59:30 (reproduced with `src/tests/lateNightClock.cjs`), because their "later today" helpers clamp to 23:59; both files now pin `Date` at 12:00, and the whole frontend suite passes at 23:59:30. A preload given by a relative path does not reach the CLI tests' child processes, which run in other folders; with an absolute path they pass too
- **Abandoned:** none. Corrected during the build: the presenter's `refreshMedia()` when it opens looked orphaned once its labels moved to `allMedia`, and was removed; phase 23's C70 test failed (the countdown dialog's background picker, `MediaPicker`, names its choice from that list), so it stays. Test changes that follow a changed claim, not a weakened one: phase 23's `ImageOverlayDialog.test.tsx` became `LiveImagePicker.test.tsx` with the component; its "clicking a thumbnail hands its id to the host" (phase 23 AC 10) is replaced by C1's "a clicked image is added after the anchor and marked Adicionada" (AD-096 supersedes AC 10), its title assertion reads `Adicionar imagem ao conjunto` (AC 5), and the upload tests keep their assertions with the new props and grid id; `OperatorPresentationLayout.test.tsx`'s "an image uploaded in the dialog projects on click" (phase 23 C10) is replaced by C1's host test. Fixtures gained `subscribeAllMedia`, `refreshAllMedia` and `allMedia` where the code now calls them. After verification: the `listen` stub in `LiveMediaLabels.test.tsx` gained a real unlisten (it removes the callback), so C35 fails when the presenter drops its subscription - with the old no-op stub it did not; the two mutations not killed in round 1 have their `proof` re-aimed at C36 and C37, the narrowest tests that hold the rules they change, as the Verifier's fixes proposed
- **Walked:** 2026-11-17, in Chrome Headless Shell (Playwright build 1234) over CDP, against the real app (`src/main.tsx`) served by Vite, mounted twice by the local harness under `.harness/` (excluded from git) as the operator window and the presentation window on one mocked backend, as in phase 23. (C15, C16) `asset.localhost` mapped to the ignored test `protocol::asset::tests::serve_media_for_a_walk`, which serves a directory over HTTP through `protocol::asset::answer`, the function the app's protocol answers with; the walk video is a 20 s, 7.3 MB VP8 WebM of random noise (so it cannot fit in one answer), the set's looping `Abertura` item. The wall's `seekable` read `[[0,20]]`. `Pausar` at 1.82 s; a real mouse click at 50% of the bar: 10.0 s; `+10 s`: 20.0 s; a click at 75%: 15.2 s (the thumb's inset, as in phase 23); `−10 s`: 5.2 s; `Retomar`: 6.2 s a second later, playing; `Pausar`: 6.21 s and still 6.21 s a second later; `Reiniciar`: 0.39 s and playing; `Silenciar`: muted; `Ativar som`: unmuted. The bridge logged 11 requests for the video, every one `206` and at most 1 MiB: `bytes=0-` twice, then 1048576-, 2097152-, 3145728-, 4194304-, 5242880- while loading, and 7241728-, 7110656-, 5668864-, 6717440- for the seeks. (C9, S1 end to end, C18) with `?many=30`, the harness lists 30 images (the newest first after the two videos), every thumbnail the same 640×360 PNG served by the same bridge. Presenter on AJUNTAMENTO, `Imagem`: the dialog `Adicionar imagem ao conjunto` with 30 cards, 0 overlapping, 5 columns, thumbnails 177 px wide at 1024×700 and 183 px at 1536×912, rows 12 px apart. Clicking `Imagem 30` then `Imagem 29` sent `add_set_item` with `afterItemId` `i-ajunt` and then with the first add's new id; the set pane read [AJUNTAMENTO, Imagem 30, Imagem 29, Regressivo, …], the highlight stayed on AJUNTAMENTO, both cards read `Adicionada`, and the wall still showed AJUNTAMENTO. `Fechar`, then the `Imagem 30` row: the wall showed the image (`pic.png`). Home with the same library, `Mídia`: the dialog `Adicionar mídia ao conjunto` with 32 cards, 0 overlapping, thumbnails 177 px and 183 px wide at the two sizes; scrolled to the end (480 px and 325 px), the title, the close control, `Todos`, `Imagens`, `Vídeos` and the last card were all in view. `Excluir Imagem 1` asked `Excluir mídia` - `Excluir "Imagem 1"? Esta ação não pode ser desfeita.` with `Cancelar` and `Excluir`; `Excluir` sent `delete_media` for it and left 31 cards; clicking `Abertura` sent `add_set_item` (media, loop off, mute off, auto-advance on) and closed the dialog. How the user reaches each state: present a set, `Imagem` in the top bar; on Home, `Mídia` under the set
