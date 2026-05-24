# Phase 3 — Manual Verification Checklist

**Date:** 2026-05-20  
**Branch:** main  
**Build:** `npm run tauri build` (≤ 30 MB installer)

This checklist covers T32's "Done when" criteria. Each item must be manually verified on real hardware before the field period is considered open.

---

## Pre-flight

- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` — all green (≥ 109 tests)
- [ ] `npx vitest run` — all green (≥ 74 tests, including key-completeness + i18n tests)
- [ ] `tsc --noEmit` — clean
- [ ] `npm run tauri build` — succeeds, installer ≤ 30 MB

---

## Phase A — Stage Display (P3-01, P3-02)

- [ ] Open stage window from Settings > Janelas (or toolbar button) — stage.html loads, StageRenderer visible
- [ ] Stage window shows current slide preview (left) and next slide preview (right)
- [ ] Stage window shows notes panel when section/item has notes
- [ ] Clock bottom-right shows wall-clock time (HH:MM:SS)
- [ ] When current item is a countdown, clock switches to mm:ss digits
- [ ] "Tela apagada" badge appears when mode = blank; "Tela congelada" when frozen
- [ ] "Fim do culto" placeholder appears when on the last slide of the last item
- [ ] Stage window does NOT reopen automatically on next launch (TD-14)
- [ ] Monitor preference persists for next open

---

## Phase B — Notes (P3-03, P3-04, P3-05)

- [ ] Song editor: "Notas" button per section; expands a textarea; text saved on 300 ms debounce
- [ ] Section notes collapse when cleared; expand when content is non-empty
- [ ] Notes >2000 chars shows warning ("Nota longa — considere dividir em seções")
- [ ] Set-item editor: notes textarea visible for media, countdown, webview, blank items
- [ ] Song set items do NOT show a notes textarea in the set builder (TD-13)
- [ ] Operator notes panel (right sidebar) shows current section's or item's notes during playback
- [ ] Panel collapses when there are no notes; width toggle persists across mounts
- [ ] Stage notes panel shows the same notes in large type; resets scroll on content change
- [ ] **Privacy check:** Projector window NEVER shows notes text (notes not in presentation slide payload)

---

## Phase C — Section Background (P3-06, P3-07)

- [ ] Song editor: "Fundo" button per section; opens media picker (images + videos only)
- [ ] Section with override shows a 24×14 thumbnail badge
- [ ] "Limpar fundo" removes the override
- [ ] During presentation: section-level video RESTARTS from 0 when advancing to a new section with a different media
- [ ] Consecutive sections sharing the same background ID: video does NOT restart
- [ ] Song-level background: video continues uninterrupted across slide advances within the same song
- [ ] Deleting media blocked when a section references it; confirm dialog includes section count

---

## Phase D — Keyboard Shortcuts (P3-08, P3-09, P3-10)

- [ ] Settings > Atalhos: all 17 actions listed with current shortcuts
- [ ] Click "Adicionar atalho": next keydown captured and appended; multiple shortcuts per action work
- [ ] Press modifier-only key during capture: inline error "Inclua uma tecla principal…" shown
- [ ] Conflict: inline error per row ("Conflito com '...'"), not a generic banner
- [ ] Click "×" next to a shortcut to remove it individually
- [ ] "Restaurar padrões" → confirm dialog → defaults restored
- [ ] Space (or configured key) on focused presentation window advances the slide (keydown forwarding)
- [ ] Space on focused stage window also advances the slide

---

## Phase E — CCLI (P3-11, P3-12, P3-13, P3-14)

- [ ] Song editor: "Direitos / Licença" collapsible panel with CCLI #, Autor, Direitos autorais
- [ ] Panel collapsed by default when all three fields empty; expands when any is set
- [ ] Searching by author name returns songs with that author (FTS)
- [ ] Loading a set for presentation inserts one `song_plays` row per song item (check via Settings > Relatório CCLI)
- [ ] Loading same set twice on same calendar day: still only one row per song (idempotency)
- [ ] Settings > Relatório CCLI: date range picker defaults to last 90 days; preview table populates
- [ ] "Exportar CSV" → save dialog → file opens in Excel/LibreOffice with correct UTF-8-with-BOM + Portuguese headers
- [ ] Zero-range export shows toast "Nenhuma música encontrada — CSV exportado apenas com cabeçalho"

---

## Phase F — Theme (P3-15, P3-16)

- [ ] Settings > Geral > Tema: "Claro" / "Escuro" toggle
- [ ] Switching to dark: operator window flips immediately with no reload, no flash
- [ ] Switching to light: all surfaces readable (text contrast ≥ 4.5:1)
- [ ] After restart: persisted theme reapplies before React renders (no flash of wrong theme)
- [ ] Presentation window and stage window are UNAFFECTED by theme toggle (always dark)

---

## Phase G — Auto-Update (P3-17, P3-18)

- [ ] On launch: `checkForUpdates(false)` runs once; if update available, banner appears at top
- [ ] "Mais tarde" (Dismiss): banner hidden for session; reappears after 24h / next launch
- [ ] "Atualizar": UpdateDialog opens with release notes + "Baixar e instalar" button
- [ ] Settings > Sobre > Verificar atualizações: manual check; if up to date, toast "Você já está na versão mais recente."
- [ ] Auto-update dry run: maintainer publishes fake `0.0.0 → 0.0.1` release; verifies banner, signature validation, and app restart

---

## Phase H — Cross-cutting (P3-cross)

- [ ] All new strings in pt-BR and en-US locale files (run `npx vitest run src/tests/i18n/`)
- [ ] `scripts/check-theme-tokens.ps1` passes (no unpaired color classes in operator components)
- [ ] STATE.md updated with Phase 3 Completion Summary
- [ ] ROADMAP.md: all P3-01..P3-18 items marked Done
- [ ] 8-week field period start date recorded (2026-05-20 → 2026-07-15)

---

## End-to-End Smoke Run

Build a set that exercises all Phase 3 features in one flow:

1. Create a song with 3 sections, each with:
   - Different section backgrounds (one image, one video, one none)
   - Section notes with >200 chars
2. Add the song to a set, plus one countdown item (with notes) and one webview item
3. Open stage window on monitor 2, presentation window on monitor 3
4. Load the set for presentation
5. Advance through sections — verify section video restarts, notes appear on operator + stage
6. Switch to countdown item — verify clock shows mm:ss on stage
7. Custom keybinding: rebind "Next slide" to a non-default key; verify it works from presentation window
8. Flip theme mid-test (operator only flips; projector + stage unaffected)
9. Export CCLI CSV; inspect in spreadsheet

**Sign-off:** _________________________ Date: _________
