# Phase 22 live song edit and strophe grid screens

**Verifier**: independent sub-agent (author != verifier)
**Round**: 1
**HEAD**: 8f4e4e7

The picture was taken at `cfb5823`. Per the dispatch, the commits after it up to `8f4e4e7` touch no screen code.

| Screen | Compared with | Verdict | Finding |
| --- | --- | --- | --- |
| `captures/operator-many-slides.running.png` | `captures/operator-many-slides.png` | diverges | 1 row differs |

### `captures/operator-many-slides.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| window: top strip with the `Lyrizzy` icon and name on the left, minimize/maximize/close on the right | same | Not drawn. Per `## Sources`, this is the Windows title bar, which the OS draws outside the webview. Note: the picture's webview fills all 1140 px, so every region sits about 30 px higher and the grid shows about 30 px more. No label the capture also draws reads smaller, so the picture is not resized |
| nav row: `Início` (selected, filled pill), `Biblioteca`, `Mídia`, `Backup`, `Configurações`, divider line below | same | Note: a Linux sans typeface replaces Segoe UI throughout the picture, and the selected tab's label is regular weight, not semibold |
| toolbar: `Parar` (square), `Tela preta` (crossed monitor), `Imagem` (picture), `Aviso` (megaphone), `Apresentação` (document), left-aligned pill buttons, divider line below | same | Note: labels are regular weight, so the buttons are slightly wider |
| arrangement: `Conjunto` pane on the left (~300 px), strophes pane in the centre, `Ao vivo` pane on the right (~380 px) | same | |
| set pane header `Conjunto` | same | |
| `+ Adicionar música`: full-width filled button under the header | same | Note: regular weight label |
| row `Tela preta`: square icon, trash on the right | same | |
| row `Regressivo`: stopwatch icon, trash on the right | same | |
| row on screen: music-note icon, play triangle, `AJUNTAMENTO` / `Jorge Camargo, 1996` inside a blue-bordered highlight box, dimmed trash outside the box | same | With Difference 1 applied: an enabled pencil sits between the box and the dimmed trash, the artist truncates to `Jorge Camargo, …`, and the box ends before the pencil |
| row `O AMOR DE DEUS` / `Rachel Novaes, 2022`, music-note icon, trash | same | With Difference 1 applied: pencil left of the trash |
| row `OS MEUS LÁBIOS TE LO…` / `Daniel Ludtke`, music-note icon, trash | same | With Difference 1 applied: pencil left of the trash, title `OS MEUS LÁBIO…` |
| row `ORAÇÃO` / `Purples, 2016`, music-note icon, trash | same | With Difference 1 applied: pencil left of the trash |
| strophes header: `Estrofes — AJUNTAMENTO — Jorge Camargo, 1996` on the left | same | |
| `Editar letra`: filled blue button with a pencil icon at the right end of the strophes header | same | Note: regular weight label |
| strophes grid: 4 equal columns, ~10 px gaps, black cards with a thin grey border and rounded corners, in row-major order (title card, `ESTROFE 1`…`ESTROFE 28`, `TELA PRETA`) | same | |
| card rows: each row overlaps the bottom of the row above (95 CSS px pitch, 127 CSS px cards) | same | With Difference 2 applied: rows are as tall as their cards (~160 px at 16:9 for ~283 px width, ~170 px pitch), and no card overlaps another |
| active card: the title card with a blue ring, its bottom hidden by the next row | same | The full ring shows, which follows from Difference 2 |
| title card: `__TITLE__` label top-left, `AJUNTAMENTO` bold and centred near the top, small `(Jorge Camargo, 1996)` below | same | Note: the text sits closer to the card top |
| strophe card content: the `ESTROFE N` label sits top-left, just above the lyric's first line, touching only the top of its first letters. The lyric is bold uppercase, 1-2 lines centred near the top, and every first line reads in full | differs | The label is larger and sits level with the lyric's first line, so it hides that line's first letters on most cards. `ESTROFE 1` covers `V` (`…EM E SOPRA SOBRE`), `ESTROFE 2` covers `REUNID` (`…OS NESTE AJUNTAMENTO`), `ESTROFE 3` covers `H`, `ESTROFE 5` covers `F`, `ESTROFE 6` covers `D`, `ESTROFE 7` covers `E A U` (`…MA VOZ OFERECER-TE`), `ESTROFE 10` covers `H`, `ESTROFE 11` covers `NO CO`, `ESTROFE 12` covers `DEUS BEND` (`…ITO REI E SALVADOR (2X)`), and so on through `ESTROFE 23`. The lyric text is also smaller and sits closer to the card top |
| card copy: labels `ESTROFE 1`…`ESTROFE 28` and the lyric lines (`VEM E SOPRA SOBRE / NÓS TEU SOPRO`, `REUNIDOS NESTE AJUNTAMENTO`, …, `DEUS BENDITO REI E SALVADOR (2X)`) | same | Where the label does not cover it (row above), the text matches |
| last row: `ESTROFE 28` and the `TELA PRETA` closing card, cut off at the pane bottom | same | With Difference 2 applied: rows 1-5 show in full and row 6 (`ESTROFE 20`-`23`) is cut off at the pane bottom. `ESTROFE 24`-`28` and `TELA PRETA` lie below and are reached by scrolling |
| grid scrollbar: right of the grid, up/down arrows, light grey thumb | same | The thumb is shorter (more to scroll), which follows from Difference 2 |
| live pane header `Ao vivo` | same | |
| live preview: bordered 16:9 black box, `AJUNTAMENTO` in heavy bold with `(Jorge Camargo, 1996)` below, centred near the top | same | Note: the typeface is lighter and smaller, and the text sits ~18 px closer to the box top |
| empty area under the live preview | same | |
