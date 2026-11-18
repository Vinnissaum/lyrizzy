# phase24-image-set-video-seek-media-modal proofs

**HEAD**: 14b1401
**Tree**: clean
**Result**: 58 pass, 0 fail; mutations 3 killed, 0 not

| Check | Proof | Ran | Passed | Result |
| --- | --- | --- | --- | --- |
| C1 | `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "a picked image is added aft` | 1 | 1 | pass |
| C1 | `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "a clicked image is added after the anc` | 1 | 1 | pass |
| C2 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_image_add_keeps_every_output_` | 1 | - | pass |
| C3 | `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "a second pick lands right after the fi` | 1 | 1 | pass |
| C4 | `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "uploaded images are listed first and n` | 1 | 1 | pass |
| C5 | `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "Fechar overlay still clears` | 1 | 1 | pass |
| C5 | `npx vitest run src/windows/operator/OperatorApp.test.tsx -t "an active overlay is cleared first and never rais` | 1 | 1 | pass |
| C6 | `npx vitest run src/components/presentation/LiveMediaLabels.test.tsx -t "an image item is named from the whole ` | 1 | 1 | pass |
| C6 | `npx vitest run src/components/presentation/LiveMediaLabels.test.tsx -t "the live preview shows an image the Mí` | 1 | 1 | pass |
| C6 | `npx vitest run src/stores/media.test.ts -t "loading the whole library leaves the Mídia view alone"` | 1 | 1 | pass |
| C7 | `npx vitest run src/stores/media.test.ts -t "the whole library is asked with no cap"` | 1 | 1 | pass |
| C7 | `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "an image item the wall has not loaded rel` | 1 | 1 | pass |
| C7 | `npx vitest run src/windows/presentation/PresentationApp.test.tsx -t "the wall reloads its media when the libra` | 1 | 1 | pass |
| C7 | `cargo test --manifest-path src-tauri/Cargo.toml --test media list_media_with_no_cap_returns_every_media` | 1 | - | pass |
| C8 | `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "a refused add keeps the dialog open wi` | 1 | 1 | pass |
| C9 | `walk - present a set, open Imagem with 30 images in the library at both window sizes, and measure every card's` | - | - | pass (Walked) |
| C34 | `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "the first pick follows the current ite` | 1 | 1 | pass |
| C34 | `npx vitest run src/components/presentation/LiveImagePicker.test.tsx -t "a later pick still follows the first a` | 1 | 1 | pass |
| C35 | `npx vitest run src/components/presentation/LiveMediaLabels.test.tsx -t "an upload during the service names its` | 1 | 1 | pass |
| C36 | `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "a pick while the wall is fr` | 1 | 1 | pass |
| C38 | `npx vitest run src/components/presentation/LiveMediaLabels.test.tsx -t "the Tela 2 launch list names an image ` | 1 | 1 | pass |
| C10 | `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::a_range_is_answered_with_206_and` | 1 | - | pass |
| C37 | `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::a_one_byte_range_is_answered_wit` | 1 | - | pass |
| C11 | `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::without_a_usable_range_the_whole` | 1 | - | pass |
| C12 | `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::a_range_past_the_end_is_answered` | 1 | - | pass |
| C13 | `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::path_rules_hold_with_and_without` | 1 | - | pass |
| C13 | `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::content_type_follows_the_extensi` | 1 | - | pass |
| C14 | `cargo test --manifest-path src-tauri/Cargo.toml --lib protocol::asset::tests::the_file_is_read_off_the_calling` | 1 | - | pass |
| C14 | `grep -q 'register_asynchronous_uri_scheme_protocol("asset"' src-tauri/src/lib.rs` | count unknown | - | pass |
| C15 | `walk - operator and wall pages with a real 20 s video served by protocol::asset over HTTP: read the wall's see` | - | - | pass (Walked) |
| C16 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "pause and resume drive the element ` | 1 | 1 | pass |
| C16 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "restart plays from zero from every ` | 1 | 1 | pass |
| C16 | `npx vitest run src/components/presentation/MediaSlideRenderer.test.tsx -t "mute is for this run and a new land` | 1 | 1 | pass |
| C16 | `walk - in the C15 visit, use Pausar, Retomar, Reiniciar, Silenciar and Ativar som, reading the wall's paused, ` | - | - | pass (Walked) |
| C17 | `npx vitest run src/components/set/SetBuilder.test.tsx -t "Mídia opens the media dialog"` | 1 | 1 | pass |
| C17 | `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "lists the library newest first under Todos, Imag` | 1 | 1 | pass |
| C18 | `walk - on Home with 30 media items, open Mídia at both window sizes, measure every card's box and thumbnail wi` | - | - | pass (Walked) |
| C19 | `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "lists the whole library whatever the Mídia view ` | 1 | 1 | pass |
| C20 | `npx vitest run src/components/set/SetBuilder.test.tsx -t "a card picked in the media dialog is added by its ki` | 1 | 1 | pass |
| C21 | `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "the delete control asks before deleting and pick` | 1 | 1 | pass |
| C22 | `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "Excluir deletes the media and drops its card"` | 1 | 1 | pass |
| C22 | `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "Cancelar deletes nothing"` | 1 | 1 | pass |
| C23 | `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "media in use is refused with Mídia em uso"` | 1 | 1 | pass |
| C24 | `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "a failed delete shows the error and keeps the ca` | 1 | 1 | pass |
| C25 | `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "an empty library or filter shows Nenhuma mídia d` | 1 | 1 | pass |
| C26 | `npx vitest run src/components/set/MediaAddDialog.test.tsx -t "the close control adds and deletes nothing"` | 1 | 1 | pass |
| C27 | `npx vitest run src/i18n/locales.test.ts -t "phase 24 labels in both locales"` | 1 | 1 | pass |
| C27 | `npx vitest run src/i18n/locales.test.ts -t "en-US and pt-BR have identical key sets in both directions"` | 1 | 1 | pass |
| C28 | `grep -q 'Adicionar imagem ao conjunto' docs/guia/aviso-imagem-tela-preta.md && grep -q 'Adicionar imagem ao co` | count unknown | - | pass |
| C28 | `npm run docs:build` | count unknown | - | pass |
| C39 | `NODE_OPTIONS="--require ./src/tests/lateNightClock.cjs" npx vitest run src/components/set/CountdownScheduleMod` | 2 | - | pass |
| C29 | `node scripts/check-version.mjs v1.10.1` | count unknown | - | pass |
| C30 | `test "$(git -c core.sshCommand='ssh -p 443' ls-remote ssh://git@ssh.github.com:443/Vinnissaum/lyrizzy.git refs` | count unknown | - | pass |
| C31 | `node -e "fetch('https://github.com/Vinnissaum/lyrizzy/releases/latest/download/latest.json').then(r=>r.json())` | count unknown | - | pass |
| C32 | `grep -Eq '^## Phase 24: .* — RELEASED \(v1\.10\.1\)$' .specs/project/ROADMAP.md` | count unknown | - | pass |
| C33 | `walk - the user, on Windows with v1.10.1, presents a set with a video and uses each control of the strip; thei` | - | - | pass (Walked) |
| Build | `npx tsc --noEmit` | - | - | pass |
| Build | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | - | - | pass |

## Mutations

| Mutation | Location | Killed |
| --- | --- | --- |
| S1 anchor: Imagem anchors on the frozen wall item, not the browsed current item (AC 2: frozen on A, browsing B -> after B) | `src/components/presentation/OperatorPresentationLayout.tsx:455` | yes |
| S2 range: a one-byte range bytes=a-a is taken as invalid and answered 200 with the whole file (end >= start -> end > start) | `src-tauri/src/protocol/asset.rs:216` | yes |
| S3 delete: a media used only by a song section is not counted as in use (sections dropped from the reference sum) | `src/components/set/MediaAddDialog.tsx:51` | yes |
