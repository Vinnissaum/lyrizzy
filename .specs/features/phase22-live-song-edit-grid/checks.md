# Edit any song from the live set, and strophe cards that never overlap checks

Mutations: 3
Build: `npx tsc --noEmit`; `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
Plan: `.specs/features/phase22-live-song-edit-grid/plan.md`

22 checks in 3 slices (3 appended after verification) · 0 one-way doors · 0 open

## Checks

### S1 - Edit any song from the set pane

**C1** - In the editable set pane, every `song` row has an edit control whose accessible name is `Editar música <title>` and whose tooltip is `Editar música`, the row on screen included; rows of type `media`, `countdown`, `web_view`, `blank` and `slide_show` have none; the read-only list (not `editable`) has no edit control on any row (AC 1)
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "edit control on every song row and no other row"`
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "the read-only list has no edit control"`

**C2** - Using a song row's edit control hands that row's song id to the host and selects nothing: no `go_to_item` is sent, the set pane keeps its highlight, and with the layout live on song 1, editing song 2 opens the `Editar música` dialog showing song 2's title while the strophes header still names song 1 (AC 2)
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "edit control hands the song id and never navigates"`
Proof: `npx vitest run src/components/presentation/LiveSongRowEdit.test.tsx -t "row edit opens that song without moving the wall"`

**C3** - `Salvar` in the dialog opened from a row sends `update_song` with that row's song id, and the dialog closes (AC 3)
Proof: `npx vitest run src/components/presentation/LiveSongRowEdit.test.tsx -t "row edit saves that song and closes"`

**C4** - After a song that is not the current item is saved with a strophe added, every output whose set holds it gets the new slides for that item (2 strophes → 3, so 4 slides → 5), and keeps its `current_item_index`, `current_slide_index` and `current_slide`; an output on another set gets nothing (AC 3)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_song_edit_keeps_each_output_in_place`

**C5** - After the song on the wall is saved with the text of the strophe on screen changed (slide 5 of a 6-strophe song), the output stays on slide 5 and its `current_slide` carries the new text (AC 3)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_song_edit_on_air_keeps_the_strophe`
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib domain::slide::tests::resolve_anchor_current_slide_text_edited_falls_back_to_clamped_old_index`

**C6** - Saving a song renamed in the row's dialog relabels its set pane row with the new title and artist without a restart; renaming the current item's song also relabels the strophes header (AC 4)
Proof: `npx vitest run src/components/presentation/LiveSongRowEdit.test.tsx -t "renamed song relabels its row and the strophes header"`

**C7** - Closing the dialog opened from a row with its close control sends no `update_song` and no `go_to_item`, and the set pane and strophes header are as before (AC 5)
Proof: `npx vitest run src/components/presentation/LiveSongRowEdit.test.tsx -t "row edit closed with X writes nothing"`
Proof: `npx vitest run src/components/presentation/LiveSongEditModal.test.tsx -t "cancel \(X button\) closes without calling update_song"`

**C8** - `Parar` closes the dialog opened from a row (AC 6)
Proof: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "Parar closes the editor opened from a row"`

**C9** - `Editar letra` opens the dialog for the current item's song (`song-1` when the current item is song 1), and is disabled when the current item is a media item (AC 7)
Proof: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "Editar letra opens the current item's song"`
Proof: `npx vitest run src/components/presentation/OperatorPresentationLayout.test.tsx -t "enables the live-edit button on a Song item and disables it on a Media item"`

**C10** - The edit control's labels exist in both locales: pt-BR `Editar música`, en-US `Edit song`, and the locale key sets stay identical (AC 1)
Proof: `npx vitest run src/i18n/locales.test.ts -t "en-US and pt-BR have identical key sets in both directions"`
Proof: `npx vitest run src/i18n/locales.test.ts -t "row edit label in both locales"`

**C20** - After the song on the wall is saved with a strophe inserted above the strophe on screen, the output follows that strophe: a 6-strophe song live on slide 5 gets a new second strophe, so `current_slide_index` becomes 6, `current_slide` reads "estrofe 5" and `next_slide` "estrofe 6" (AC 3; appended after verification)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_song_edit_on_air_follows_an_inserted_strophe`

**C21** - A frozen wall showing the edited song keeps its strophe with the new text: frozen on slide 5 while the operator is on another song, strophe 5's text fixed → `frozen_at` stays (0, 5) and `current_slide` carries the new text; frozen on slide 5 while the operator is on slide 2 of the same song, a strophe inserted above both → `frozen_at` (0, 6) still showing "estrofe 5", and the operator on slide 3 (AC 3; appended after verification)
Proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib commands::set::tests::live_song_edit_keeps_a_frozen_wall_on_its_strophe`

### S2 - Strophe cards never overlap

**C11** - The strophes grid sizes each row to its cards' content (`grid-auto-rows: max-content`), keeps its 220 px minimum column, 8 px gap and vertical scroll, and every card keeps its 16:9 spacer (AC 8)
Proof: `npx vitest run src/components/presentation/StrophesGrid.test.tsx -t "rows sized to their cards"`

**C12** - In Chromium, no two strophe cards overlap and each card's height is its width × 9/16 (± 1 px): 30 cards at a 1536×912 window (125% scale) → 0 overlaps and the last card reachable by scrolling; 60 cards at 1280×720 → 0 overlaps; 3 cards → at the top of the pane at full height (AC 8)
Proof: walk - present the 30-card song at 1536×912, then a 60-card song at 1280×720, then a 3-card song, measuring every card's box

**C22** - In Chromium, a song whose cards fit in 2 or more rows packs them at the top: 9 cards at a 1536×912 window → rows one card height plus 8 px apart (± 1 px), the first row 8 px below the pane's top, no scroll (user decision 2026-10-28, "Pack at the top"; appended after verification)
Proof: walk - present a 9-card song at 1536×912, measuring the row pitch

**C13** - When the current slide index changes, the strophes grid scrolls the newly active card into view (AC 9)
Proof: `npx vitest run src/components/presentation/StrophesGrid.test.tsx -t "scrolls the new active card into view"`

**C14** - The operator screen presenting a 30-card song matches `.specs/features/phase22-live-song-edit-grid/captures/operator-many-slides.png`, except for the departures in the plan's `## Differences from the source` (AC 10)
Proof: browser - reach the state, save `captures/operator-many-slides.running.png`

**C15** - The controls the capture draws, other than the new edit control, still work: a set row selects its item, the remove control asks before removing, `Adicionar música` opens the picker, a strophe card selects its slide, `Imagem`, `Aviso` and `Apresentação` call their handlers, the nav tabs are disabled while presenting, and `Parar` and `Tela preta` stop and black out the wall (AC 10)
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "calls selectSlide\(idx, 0\) when a non-active row is clicked"`
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "confirm before removing"`
Proof: `npx vitest run src/components/presentation/SetItemList.test.tsx -t "add song opens the picker"`
Proof: `npx vitest run src/components/presentation/StrophesGrid.test.tsx -t "calls selectSlide with \(currentItemIndex, slideIndex\) when a card is clicked"`
Proof: `npx vitest run src/components/presentation/OverlayActionBar.test.tsx -t "calls onOferta when Image button is clicked"`
Proof: `npx vitest run src/components/presentation/OverlayActionBar.test.tsx -t "calls onAviso when Aviso button is clicked"`
Proof: `npx vitest run src/components/presentation/OverlayActionBar.test.tsx -t "calls onPdf when PDF button is clicked"`
Proof: `npx vitest run src/windows/operator/OperatorApp.test.tsx -t "nav buttons are disabled while presenting"`
Proof: walk - in the 30-card state, use `Tela preta` and `Parar` and read the commands they send

### S3 - Release v1.9.0

**C16** - The version reads `1.9.0` in `package.json`, both `package-lock.json` fields, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` (AC 11)
Proof: `node scripts/check-version.mjs v1.9.0`

**C17** - Tag `v1.9.0` is on GitHub and points at the local `v1.9.0` commit (AC 12)
Proof: `test "$(git -c core.sshCommand='ssh -p 443' ls-remote ssh://git@ssh.github.com:443/Vinnissaum/lyrizzy.git refs/tags/v1.9.0 | cut -f1)" = "$(git rev-parse v1.9.0)"`

**C18** - The published `latest.json` serves version `1.9.0` with both `windows-x86_64` and `linux-x86_64` entries, and every installer URL in it points under `/releases/download/v1.9.0/` and answers 200, which is what the publish-manifest workflow leaves behind (AC 12)
Proof: `node -e "fetch('https://github.com/Vinnissaum/lyrizzy/releases/latest/download/latest.json').then(r=>r.json()).then(async m=>{const p=m.platforms||{};if(m.version!=='1.9.0'||!p['windows-x86_64']||!p['linux-x86_64'])process.exit(1);for(const e of Object.values(p)){if(!e.url.includes('/releases/download/v1.9.0/'))process.exit(2);const r=await fetch(e.url,{method:'HEAD'});if(!r.ok)process.exit(3)}}).catch(()=>process.exit(4))"`

**C19** - The project roadmap carries a Phase 22 entry marked released as `v1.9.0` (AC 13)
Proof: `grep -Eq '^## Phase 22: .* — RELEASED \(`v1\.9\.0`\)$' .specs/project/ROADMAP.md`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| set item types for the edit control, AC 1 (6) | `song` C1 · `media` C1 · `countdown` C1 · `web_view` C1 · `blank` C1 · `slide_show` C1, table-driven over all 6 | - |
| set lists, AC 1 (2) | editable C1 · read-only C1 | - |
| AC 2 example (4 parts) | dialog shows song 2 C2 · no `go_to_item` C2 · highlight kept C2 · strophes header kept C2 | - |
| AC 3 examples (6) | not on air, strophe added, wall stays C4 · on air, word changed, stays on strophe 5 C5 · other set untouched C4 · on air, strophe inserted above C20 · frozen on another item, text fixed C21 · frozen on the same song, strophe inserted above C21 | - |
| dialog exits (3) | `Salvar` C3 · close control C7 · `Parar` C8 | - |
| relabel readers, AC 4 (2) | set pane row C6 · strophes header C6 | - |
| locales (2) | pt-BR C10 · en-US C10 | - |
| AC 8 examples (4) | 30 cards at 1536×912 C12, C14 · 60 cards at 1280×720 C12 · 3 cards C12 · 9 cards in 3 rows C22 | - |
| source controls: `operator-many-slides.png` (14) | edit control (new) C2 · set row C15 · remove control C15 · `Adicionar música` C15 · strophe card C15 · `Editar letra` C9 · `Parar` C15 · `Tela preta` C15 · `Imagem` C15 · `Aviso` C15 · `Apresentação` C15 · nav tabs C15 · strophes scroll C12 · `Tela preta` row and `Regressivo` row (no edit control) C1 | - |
| release artefacts, AC 11-13 (4) | five version files C16 · tag C17 · published manifest on both platforms C18 · roadmap C19 | - |

## Swept

- validation: n/a - the feature adds no input; the dialog is the unmodified `SongEditor`, whose own validation does not change
- failure modes: existing - `SongEditor.handleSave` catches a failed `update_song`, shows the error toast and keeps the dialog open with the edits (`SongEditor.tsx:285`)
- idempotency: n/a - a second `Salvar` rewrites the same song with the same content
- authorization: existing - the edit control renders only in the editable set list, which only `OperatorPresentationLayout` mounts; the presentation window mounts neither (CLAUDE.md read-only invariant)
- concurrency: C4 - one save refreshes both outputs; existing - `refresh_song_in_outputs` takes the slides lock before the presentation lock and drops both before emitting (`presentation.rs:525`)
- data lifecycle: existing - `update_song` replaces the song's sections in one write, and `LiveSongEditModal.test.tsx` "saving inside SongEditor calls update_song" round-trips the loaded song; C4 and C5 read the stored song back through slide generation
- dependency failure: n/a - no external call; the release proofs C17 and C18 read GitHub, and a network failure there fails the proof
- state transitions: C3, C7, C8 - the dialog's three exits; C21 - a frozen output keeps its frozen strophe across a refresh
- observability: n/a - no logging requirement; the existing save toast stays

## Handoff

- **Settled mid-build:** Short songs - user, 2026-10-28, asked after the Verifier found that rows which fit now pack at the top instead of spreading over the pane: "Pack at the top (Recommended)" (plan `Changes underneath` corrected, C22). Publishing - user, 2026-10-28, asked "How should publishing work?" (no `gh` CLI, GitHub API rate-limited): "You publish, I confirm (Recommended)". The agent pushes `main` and `v1.9.0`; the user publishes the draft once CI has built both installers; the agent then runs C17 and C18. C17-C19 are red until the release, so the full `check_proofs.py` run that closes the gate comes after the user publishes
- **Dispatched:** Verifier (independent sub-agent) at `8f4e4e7`, 2026-10-28 - returned: FAIL, 3 findings, 2/3 mutations killed; screens round 1 (independent sub-agent) at `8f4e4e7`, pictures taken at `cfb5823` (later commits touch no screen code), 2026-10-28 - returned: diverges, 1 row (the `ESTROFE N` badge hides the first letters of the first lyric line; the capture shows them in full)
- **Boundary:** C1-C15 closed at `cfb5823` (C4, C5 at `80f42aa`; C1-C3, C6-C10 at `8483eb5`; C11-C15 at `cfb5823`); C16 closed at `0a3ce29`; C17-C19 wait for the release
- **Abandoned:** none. One proof selector fixed after the first `check_proofs.py` run: C7's second `-t` filter had unescaped parentheses, which vitest reads as a regex group, so it selected no test; the claim is unchanged
- **Walked:** 2026-10-28 at `cfb5823`, in Chrome Headless Shell 151 driven over CDP against the real operator app (`src/main.tsx`) served by Vite, with the backend replaced by `@tauri-apps/api/mocks` (a local harness under `.harness/`, excluded from git). The user reaches each state by presenting a set whose current song has that many slides. (1) 30 cards at a 1536×912 window, 125% scale: 4 columns, cards 226.3×128.1 px, row pitch 136.1 px, 0 overlaps, 0 cards off 16:9, the last card reachable by scrolling, computed `grid-auto-rows: max-content`; the same state at the parent commit measured a 97.8 px pitch and 26 overlapping pairs. (2) 60 cards at 1280×720: 2 columns, 332.5×187.9 px, 0 overlaps, last card reachable. (3) 3 cards at 1536×912: one row at the top of the pane (8 px offset), full 230×130.3 px, no scroll. (4) 30 cards at 1024×700: 1 column, 0 overlaps. (5) In the 30-card state, `Tela preta` sent `set_presentation_mode {mode: "blank", output: "one"}` and `Parar` sent `exit_presentation {output: "one"}`. (6) The row edit: the pencil on O AMOR DE DEUS opened `Editar música` with that song, sent only `get_song {id: s-amor}` (no `go_to_item`), and the set pane still marked AJUNTAMENTO current; X closed it and sent nothing; the pencil on AJUNTAMENTO (on screen) then `Salvar` sent `update_song` and `list_songs` and closed the dialog. `captures/operator-many-slides.running.png` is state (1). The capture's top strip, the Windows title bar, is outside the webview, so the picture starts at the nav tabs. Fonts are the Linux fallbacks, not Windows' Segoe UI
