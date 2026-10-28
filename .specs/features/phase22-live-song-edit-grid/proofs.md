# phase22-live-song-edit-grid proofs

**HEAD**: aff66a2
**Tree**: clean
**Result**: 35 pass, 3 fail; mutations 3 killed, 0 not

| Check | Proof | Ran | Passed | Result |
| --- | --- | --- | --- | --- |
| C1 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "edit control on every song row and no othe` | 1 | 1 | pass |
| C1 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "the read-only list has no edit control"` | 1 | 1 | pass |
| C2 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "edit control hands the song id and never n` | 1 | 1 | pass |
| C2 | `npx vitest run src/components/presentation/LiveSongRowEdit.test.tsx -t "row edit opens that song without movin` | 1 | 1 | pass |
| C3 | `npx vitest run src/components/presentation/LiveSongRowEdit.test.tsx -t "row edit saves that song and closes"` | 1 | 1 | pass |
| C4 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_song_edit_keeps_each_output_i` | 1 | - | pass |
| C5 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_song_edit_on_air_keeps_the_st` | 1 | - | pass |
| C5 | `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::slide::tests::resolve_anchor_current_slide_text_` | 1 | - | pass |
| C6 | `npx vitest run src/components/presentation/LiveSongRowEdit.test.tsx -t "renamed song relabels its row and the ` | 1 | 1 | pass |
| C7 | `npx vitest run src/components/presentation/LiveSongRowEdit.test.tsx -t "row edit closed with X writes nothing"` | 1 | 1 | pass |
| C7 | `npx vitest run src/components/presentation/LiveSongEditModal.test.tsx -t "cancel \(X button\) closes without c` | 1 | 1 | pass |
| C8 | `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "Parar closes the editor ope` | 1 | 1 | pass |
| C9 | `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "Editar letra opens the curr` | 1 | 1 | pass |
| C9 | `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "enables the live-edit butto` | 1 | 1 | pass |
| C10 | `npx vitest run src/i18n/locales.test.ts -t "en-US and pt-BR have identical key sets in both directions"` | 1 | 1 | pass |
| C10 | `npx vitest run src/i18n/locales.test.ts -t "row edit label in both locales"` | 1 | 1 | pass |
| C20 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_song_edit_on_air_follows_an_i` | 1 | - | pass |
| C21 | `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_song_edit_keeps_a_frozen_wall` | 1 | - | pass |
| C11 | `npx vitest run src/components/presentation/StrophesGrid.test.tsx -t "rows sized to their cards"` | 1 | 1 | pass |
| C12 | `walk - present the 30-card song at 1536×912, then a 60-card song at 1280×720, then a 3-card song, measuring ev` | - | - | pass (Walked) |
| C22 | `walk - present a 9-card song at 1536×912, measuring the row pitch` | - | - | pass (Walked) |
| C13 | `npx vitest run src/components/presentation/StrophesGrid.test.tsx -t "scrolls the new active card into view"` | 1 | 1 | pass |
| C14 | `browser - reach the state, save captures/operator-many-slides.running.png` | - | - | pass |
| C15 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "calls selectSlide\(idx, 0\) when a non-act` | 1 | 1 | pass |
| C15 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "confirm before removing"` | 1 | 1 | pass |
| C15 | `npx vitest run src/components/presentation/SetItemList.test.tsx -t "add song opens the picker"` | 1 | 1 | pass |
| C15 | `npx vitest run src/components/presentation/StrophesGrid.test.tsx -t "calls selectSlide with \(currentItemIndex` | 1 | 1 | pass |
| C15 | `npx vitest run src/components/presentation/OverlayActionBar.test.tsx -t "calls onOferta when Image button is c` | 1 | 1 | pass |
| C15 | `npx vitest run src/components/presentation/OverlayActionBar.test.tsx -t "calls onAviso when Aviso button is cl` | 1 | 1 | pass |
| C15 | `npx vitest run src/components/presentation/OverlayActionBar.test.tsx -t "calls onPdf when PDF button is clicke` | 1 | 1 | pass |
| C15 | `npx vitest run src/windows/operator/OperatorApp.test.tsx -t "nav buttons are disabled while presenting"` | 1 | 1 | pass |
| C15 | `walk - in the 30-card state, use Tela preta and Parar and read the commands they send` | - | - | pass (Walked) |
| C16 | `node scripts/check-version.mjs v1.9.0` | count unknown | - | pass |
| C17 | `test "$(git -c core.sshCommand='ssh -p 443' ls-remote ssh://git@ssh.github.com:443/Vinnissaum/lyrizzy.git refs` | count unknown | - | **fail** |
| C18 | `node -e "fetch('https://github.com/Vinnissaum/lyrizzy/releases/latest/download/latest.json').then(r=>r.json())` | count unknown | - | **fail** |
| C19 | `grep -Eq '^## Phase 22: .* — RELEASED \(v1\.9\.0\)$' .specs/project/ROADMAP.md` | count unknown | - | **fail** |
| Build | `npx tsc --noEmit` | - | - | pass |
| Build | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | - | - | pass |

## Mutations

| Mutation | Location | Killed |
| --- | --- | --- |
| C1 - edit control hidden on the row on screen (copies the remove lock) | `src/components/presentation/SetItemList.tsx:126` | yes |
| C2 - edit control also selects its row (go_to_item) | `src/components/presentation/SetItemList.tsx:129` | yes |
| C4/C5 - live refresh ignores the anchor of the strophe on screen | `src-tauri/src/commands/presentation.rs:564` | yes |
