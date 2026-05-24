# Phase 8 — Presentation Rework Fix-ups

**Created:** 2026-05-23
**Status:** Specifying
**Scope:** Medium — 8 reproducible regressions surfaced during real-world use of the Phase 7 presentation surface. Touches Rust window/state code, two operator panes, the SongBackground/section background config, the SetBuilder bottom button, and one i18n label.

---

## Problem Statement

Phase 7 shipped the Holyrics-style 3-pane operator surface and the fullscreen-on-top single-monitor path, but the user is hitting eight blocking issues on the live build:

1. **Operator → projection state sync is broken.** Changing the strophe in the operator (via keyboard or click on a strophe card in `StrophesGrid`) updates the operator's local store but the projection window does not redraw. Clicking the strophe card also does nothing visible — neither the operator highlight nor the projection updates.
2. **`SetItemList` click is a no-op against the projection.** Clicking a non-active row in the LEFT "Conjunto" pane should replace the active item per P7-07 AC 3; the operator's `currentItemIndex` doesn't change AND the projection doesn't switch.
3. **Countdown item does not project.** When the active set item is a `countdown`, the projection window shows nothing (or stays on the previous content). The countdown clearly enters the operator state but the renderer is not being mounted in the projection.
4. **ESC freezes the app.** Inside presentation, pressing ESC should `exit_presentation` and route the operator back to `home`. Instead the window becomes unresponsive — confirms a deadlock or an event loop that never settles.
5. **Wrong key hint label.** A button somewhere on the projection (likely the idle-screen "press to close" hint) reads `ESCAPE/SPACE`. Per P7-02 ESC is the only canonical close key, so the hint must read **`ESC`** only.
6. **Media items don't project.** Image set items upload and list correctly in the Media Library, but when used as a set item they do not render in the projection. Video set items also don't generate a visible thumbnail in the library grid.
7. **Per-strophe background config lost; presets missing.** The user can no longer change a section/strophe background from the song editor (regression). Additionally, the desired UX is to pick from a small fixed set of presets — **`black-bg / white-text`**, **`white-bg / black-text`** — plus a font family and font size for the lyric text. Today only an arbitrary media-image background with a scrim opacity slider exists.
8. **Two `Apresentar` buttons behave differently.** The top button (HomeSetBuilder → `OverlayActionBar`, calls `handleApresentar` → `loadSetForPresentation` + `enterPresentation`) starts the presentation correctly. The bottom button (inside the nested `SetBuilder`, calls `handleLoadForPresentation`) only switches the operator view to `set-player` and never opens the projection window. Both buttons read "Apresentar" so the user expects identical behavior.

---

## Goals

- [ ] Operator strophe/item navigation reliably mutates the Rust `PresentationState` AND every connected window receives the new state within one event tick
- [ ] Clicking a strophe card or a set-item row updates BOTH the operator's local highlight AND the projection content
- [ ] Countdown set items render in the projection window with their configured digits/message
- [ ] ESC during presentation cleanly exits to `home` with no UI freeze, on both single-monitor and dual-monitor configurations
- [ ] The close-hint label reads `ESC` (uppercase, no separator, no `SPACE`)
- [ ] Image set items render full-frame in the projection; video items render an auto-generated thumbnail in the library grid and play in the projection
- [ ] Section/strophe background is restored as an editable property, with a preset selector offering at minimum `black-bg / white-text` and `white-bg / black-text`, plus font-family and font-size controls that flow through to the projection text
- [ ] Both `Apresentar` buttons start the live presentation identically — either consolidate the bottom button into the top button's behavior, OR remove the bottom button if redundant

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Adding new media kinds (audio, GIF animation) | Today's media model covers image+video+slide_show; fixing the existing render path is the goal |
| Per-line / per-word text styling inside a strophe | Font + size + bg preset is enough for the church-presentation use case; rich text is future |
| Animated transitions between strophe backgrounds | P2 transitions still apply; the preset switch reuses existing `TransitionStage` |
| Custom user-defined background presets (palette editor) | The two presets above are the explicit ask; opening to user-defined is future scope |
| Refactor of the IPC `state_changed` event payload | Bug is in dispatch, not in shape; the payload is fine |
| Closing presentation via SPACE | Spec P7-02 chose ESC; ESC stands as the only close key |
| Re-running the dark-theme color sweep | Phase 7 P7-03 covered this; revisits only if a fix introduces a new hardcoded color |
| Multi-window screen capture / true mirror | LivePreview already renders from state; no change to that strategy |

---

## User Stories

### P8-01: Restore operator → projection state sync ⭐ MVP

**User Story:** As an operator, when I press an arrow key or click a strophe card, I want the projection window to update within ~200ms, and the operator's own highlight to reflect the new slide immediately.

**Why P8-01:** The user reports the projection window is "stuck" — operator-side actions silently update local state but never reach the projection. This is the highest-impact regression because it makes the entire live-projection feature non-functional. The likely root causes are (in order of probability):
- `state_changed` is emitted on the operator window only, not broadcast to all windows (Tauri 2 changed the default emit scope)
- A `state.presentation.write().await` lock is held across the `app.emit()` call (CLAUDE.md gotcha), so the operator never observes its own change
- `goToItem(idx)` (no `slideIdx`) in `usePresentationStore.jumpToItem` is calling a backend that doesn't accept an undefined second arg, throwing silently
- `StrophesGrid` `goToItem(currentItemIndex, slideIdx)` uses the at-mount snapshot of `currentItemIndex` rather than the live store value when invoked from the click handler

**Acceptance Criteria:**

1. WHEN the operator invokes `next_slide`, `prev_slide`, or `go_to_item` THEN the Rust state change SHALL be committed before `app.emit("state_changed", ...)` is called AND the write lock SHALL be released before the emit (per CLAUDE.md invariant)
2. WHEN any command mutates `PresentationState` THEN the `state_changed` event SHALL be emitted to **all** Tauri windows (the projection window's `usePresentationStore.subscribe()` must receive it)
3. WHEN the operator clicks a strophe card in `StrophesGrid` THEN within 200ms the active card SHALL switch highlight AND the projection SHALL display the clicked strophe's lines
4. WHEN the operator presses Arrow/Space/Arrow-Left to advance/retreat THEN the operator highlight AND the projection SHALL move in lockstep
5. WHEN `goToItem(itemIndex)` is called WITHOUT a `slideIndex` THEN it SHALL be equivalent to `goToItem(itemIndex, 0)` (Rust side normalizes `None` → `0`)
6. WHEN a strophe-card click handler runs THEN `currentItemIndex` SHALL be read from the live store at click-time, not closed over at mount-time
7. WHEN diagnostics are enabled THEN a `tracing::info!` line at every `state_changed` emit SHALL log the new `(currentItemIndex, currentSlideIndex)` for verification

**Implementation notes:**
- Inspect `src-tauri/src/commands/presentation.rs` (or wherever `next_slide`, `prev_slide`, `go_to_item` live) — verify the pattern `let new_state = { let mut guard = state.presentation.write().await; …; guard.clone() }; app.emit("state_changed", &new_state)?;` (write-lock dropped before emit).
- Check that `app.emit(...)` is used (broadcast) rather than `window.emit(...)` (single-window). In Tauri 2, `app.emit(event, payload)` broadcasts; `window.emit(event, payload)` does NOT.
- `src/stores/presentation.ts` — `jumpToItem` calls `goToItem(itemIndex)` with no second arg → ensure the Rust handler accepts `slide_index: Option<usize>` and defaults to `Some(0)` when `None`.
- `src/components/presentation/StrophesGrid.tsx` line 87/133 — `currentItemIndex` is captured into the component scope; the click handler closes over it. Use `usePresentationStore.getState().state?.currentItemIndex ?? 0` inside the click handler to always read the live value (defensive even if the closure is correct).
- Add an integration test: mock `onStateChanged` listeners in both windows; firing `next_slide` SHALL deliver the event to both subscribers.

**Independent Test:** Start presentation, project visible on second monitor (or fullscreen-on-top). Click strophe card #3 in `StrophesGrid`. Within one frame the operator highlights card #3 AND the projection shows the strophe #3 text.

---

### P8-02: `SetItemList` click → projection switches item ⭐ MVP

**User Story:** As an operator presenting, when I click a non-active row in the LEFT "Conjunto" pane, I want the projection to switch to that set item's first slide (replace semantics, per P7-07 AC 3).

**Why P8-02:** Tightly related to P8-01 but distinct: `SetItemList` already calls `goToItem(idx, 0)` (verified `src/components/presentation/SetItemList.tsx:23`), but the user reports the click has no observable effect. After P8-01 fixes the state-broadcast path, verify item-switching works end-to-end AND check that switching to a `countdown`/`media`/`web_view` item correctly resets `currentSlideIndex` to 0 and re-resolves any auto-start logic (e.g. countdown ticker restart).

**Acceptance Criteria:**

1. WHEN the operator clicks a non-active row in `SetItemList` THEN `goToItem(targetIdx, 0)` SHALL fire AND the projection SHALL switch to that item within 200ms
2. WHEN the target item is a `countdown` THEN the countdown ticker SHALL auto-(re)start with that item's configured target (existing `PresentationApp.tsx` useEffect on `currentItem.id` change must trigger)
3. WHEN the target item is `media` THEN the media renderer (image or video) SHALL mount with the correct `assetUrl`
4. WHEN the target item is `web_view` THEN the WebView renderer SHALL mount with the configured URL
5. WHEN the operator clicks the currently-active row THEN it SHALL be a no-op (no flash, no state change) — current code path is `if (!isActive) goToItem(...)`; verify still correct
6. WHEN the projection is in `blank` or `frozen` mode AND the operator clicks a set item THEN the item switch SHALL still commit to state, but `mode` SHALL remain blank/frozen until explicitly toggled (no implicit return to `live`)

**Implementation notes:**
- This story depends on P8-01; many of its symptoms will be resolved automatically once the broadcast path is fixed.
- Verify `src/windows/presentation/PresentationApp.tsx:118-123` — the `useEffect` keyed on `currentItem?.id` for countdown auto-start. Confirm it fires when `currentItem.id` changes (not just the index).
- Verify `src-tauri/src/commands/.../go_to_item` resets `currentSlideIndex` to 0 (or the explicit slideIndex arg) when the item index changes.

**Independent Test:** Set has Song A, Countdown B, Image C. Start presentation on Song A. Click row "B" — projection shows the countdown timer counting down. Click row "C" — projection shows the image.

---

### P8-03: Countdown set item projects correctly ⭐ MVP

**User Story:** As an operator with a countdown item in my set, when I navigate to it, I want the timer to display fullscreen on the projection with its configured message and digits.

**Why P8-03:** The user reports the counter "doesn't present". `PresentationApp.tsx:198-221` already branches into `CountdownRenderer` when `itemType === "countdown"`, but only if `currentItem.countdownConfig` is present. Two likely root causes:
- The set-item payload sent to the presentation window is missing `countdownConfig` (serialization bug in the IPC payload — verify `SetItem` JSON includes the nested config)
- The countdown ticker is not auto-started because the `currentItem.id` change isn't firing the effect (related to P8-01 broadcast bug)

**Acceptance Criteria:**

1. WHEN a `countdown` item becomes active THEN `PresentationApp.tsx` SHALL render `<CountdownRenderer config={currentItem.countdownConfig} background={...} frozen={mode === "frozen"} />`
2. WHEN the countdown item lacks a `countdownConfig` THEN the projection SHALL render a clear placeholder (`"Contagem regressiva não configurada"`) rather than a black void
3. WHEN navigating to a countdown item THEN `useCountdownStore.start({ target, message, endBehavior })` SHALL be invoked exactly once per item-id transition
4. WHEN the countdown reaches zero THEN the `endBehavior` (advance / loop / blank / stay) SHALL execute per the existing P2-E logic
5. WHEN the countdown is active AND the operator presses freeze (F) THEN the timer SHALL stop ticking visually but remain on screen
6. WHEN the operator switches away from the countdown to another item THEN the countdown ticker SHALL pause (no background tick burning CPU) per existing `useCountdownStore` lifecycle

**Implementation notes:**
- Verify Rust side: in `presentation_state.rs` (or equivalent), the `SetItem::Countdown` variant must serialize with its full `countdown_config` payload. Quick check: `serde_json::to_string(&state)` and grep for `countdownConfig`.
- Confirm the operator's `setItems` payload includes nested configs (probably already does, since P2-E shipped this).
- The fix is largely a consequence of P8-01; this story exists to keep the user-facing acceptance criteria distinct.

**Independent Test:** Create a set with a 5:00 countdown + "Início do culto" message. Click `Apresentar`. Navigate to the countdown item. Projection shows "Início do culto" centered above "05:00" digits, ticking down.

---

### P8-04: ESC exits presentation cleanly, no freeze ⭐ MVP

**User Story:** As an operator, when I press ESC during presentation, I want the projection window to close AND the operator to return to the home screen with no UI freeze, within 500ms.

**Why P8-04:** The user reports ESC freezes the app. Root-cause candidates:
- `exitPresentation()` invokes a Rust command that holds `state.presentation.write()` while awaiting `window.close()` — async Tauri operations under a write lock deadlock if the close handler emits an event that requires reading state
- The `presentation_lifecycle exited` event is awaited synchronously on the operator side, but the event arrives before the listener subscribes (race), so the operator's `setView("home")` never runs and the keyboard handler keeps refiring ESC into a broken state
- `exit_presentation` re-enters itself (operator window's `onEscape` calls `exitPresentation()`, projection window's `onEscape` also calls `exitPresentation()`, both fire when the key is forwarded) — concurrent close attempts

**Acceptance Criteria:**

1. WHEN the operator OR the projection window observes ESC during presentation THEN exactly ONE `exit_presentation` Tauri call SHALL be dispatched (deduplicated; subsequent calls within 500ms are ignored)
2. WHEN `exit_presentation` runs THEN it SHALL: (a) update `PresentationState.mode = idle`, (b) emit `state_changed`, (c) emit `presentation_lifecycle { phase: "exited" }`, (d) close the projection window — in that order, with the write lock dropped before any emit
3. WHEN the operator receives `presentation_lifecycle exited` THEN `useLibraryStore.setView("home")` SHALL fire AND `OperatorApp` SHALL render `<HomeSetBuilder />` again
4. WHEN the projection window is closed THEN the operator's `usePresentationStore` SHALL no longer attempt to relay key events to it (forwarded keydown listener handles `window-closed` gracefully)
5. WHEN ESC is pressed and the projection window is NOT open (already closed) THEN `exit_presentation` SHALL be a no-op (idempotent)
6. WHEN measured end-to-end THEN the time from ESC keydown to `OperatorApp` rendering home SHALL be < 500ms on a development build

**Implementation notes:**
- Inspect `src-tauri/src/commands/window.rs::exit_presentation` for `write()` held across `.close().await`. Pattern fix: clone the window handle, drop the lock, then close.
- `src/runtime/keyboard.ts` hardcoded ESC handler calls `hardcoded.onEscape()` in BOTH windows; `OperatorApp.tsx:153` calls `exitPresentation().catch(console.error)` and `PresentationApp.tsx:96` calls `exitPresentation().catch(console.error)`. Add a 500ms debounce at the API level (`src/api/commands.ts`) or a backend idempotency check (if already idle, return Ok early).
- The `forwardKeydown` path can re-dispatch ESC from projection → operator → operator handles it again. Add a re-entrancy guard in `usePresentationStore` so `setMode("idle")` AND `exitPresentation` only fire once per ESC.
- Add a Rust unit test: call `exit_presentation` twice in quick succession — second call must return Ok with no error and no double-emit.

**Independent Test:** Start presentation. Press ESC. Within half a second: projection window is gone, operator shows home screen, no console error, app is interactive.

---

### P8-05: Replace "ESCAPE/SPACE" hint with "ESC" ⭐ MVP

**User Story:** As an operator, when I see the projection's idle/close hint, I want it to read `ESC` only — not `ESCAPE/SPACE` (the SPACE binding was removed in P7-02).

**Why P8-05:** Search the codebase for the literal string `ESCAPE/SPACE` (or `ESCAPE` and `SPACE` rendered side-by-side) — the user has seen this on screen. Likely candidates: an i18n string, a hardcoded label in `PresentationApp.tsx`'s idle screen, or a keybindings hint in `SettingsScreen`.

**Acceptance Criteria:**

1. WHEN any rendered UI in the operator OR projection windows references the close-presentation key THEN the label SHALL read `ESC` (uppercase three-letter abbreviation, no slash, no "SPACE")
2. WHEN `Grep "ESCAPE/SPACE|ESCAPE.*SPACE"` is run against `src/` THEN it SHALL return zero hits
3. WHEN the projection is in idle mode AND no countdown is active THEN any visible close hint SHALL be the single string `ESC` or its i18n equivalent (`pressKey` key in locales)
4. WHEN the user has remapped the exit-presentation action in settings to a different key combination THEN the hint SHALL still display `ESC` as the hardcoded fallback (per P7-02: ESC is not user-rebindable; it's the PowerPoint-parity hardcoded key)

**Implementation notes:**
- First locate the offending string. If it's an i18n key, update both `pt-BR.json` and `en-US.json`. If it's hardcoded in a `.tsx`, change in place.
- This is a P3 mechanical fix; the bulk of the work is locating the string.

**Independent Test:** Take a screenshot of the projection idle screen — the close-hint reads `ESC`, not `ESCAPE/SPACE`.

---

### P8-06: Image presents, video thumbnails generate ⭐ MVP

**User Story:** As an operator, when I add an image to a set and project it, I want it to fill the projection. When I add a video, I want its thumbnail visible in the Media Library grid.

**Why P8-06:** Two related media bugs:
- **Image-presents:** Set item type `media` with `mediaKind: "image"` → `PresentationApp.tsx:178-197` builds an `assetUrl` from `media.find((m) => m.id === currentItem.mediaId)?.fileName`. If the `media` list isn't loaded yet in the projection window's `useMediaStore`, `assetUrl` is empty → the "Mídia não encontrada" fallback renders. The projection window calls `refreshMedia()` once on mount but may not be synced when state arrives.
- **Video-thumbs:** The Media Library `MediaCard` displays `m.thumbnailFile` via `asset://localhost/media/{thumbnailFile}`. If thumbnail generation failed (ffprobe missing OR the import path skipped the thumbnail step), `thumbnailFile` is null and the card falls back to a generic icon. The user reports they "can't even see the thumb".

**Acceptance Criteria:**

1. WHEN the projection window mounts THEN it SHALL load `useMediaStore.refresh()` before the first `state_changed` event is processed (or block image rendering until media is loaded — a placeholder is acceptable for the first ~300ms but the image MUST appear once media loads)
2. WHEN a set item of type `media` with `mediaKind=image` becomes active AND its referenced media exists in the store THEN the projection SHALL render `<MediaSlideRenderer assetUrl=... kind="image" />` with the image filling the viewport via `object-contain` or `object-cover` (per the item's `mediaOptions.fit`)
3. WHEN a video file is imported via `import_media` THEN a thumbnail SHALL be generated via ffprobe + ffmpeg AND `media.thumbnail_file` SHALL be persisted to the DB
4. WHEN ffprobe is unavailable THEN the import SHALL NOT silently fail — instead, the user SHALL see a banner (existing `FfmpegBanner`) AND the video imports with `thumbnail_file = null`, falling back to the icon
5. WHEN `MediaCard` renders a video with `thumbnail_file = null` THEN it SHALL display a clear "thumbnail pending" badge instead of just the icon, so the user knows the issue is thumbnail generation, not import
6. WHEN the projection plays a video set item THEN it SHALL autoplay, loop per `mediaOptions`, and respect the `frozen` flag (pause on freeze)

**Implementation notes:**
- `src/windows/presentation/PresentationApp.tsx:88` — already calls `refreshMedia()` in the mount effect; verify the timing relative to `state_changed`. Consider adding an explicit `await refreshMedia()` before mounting renderers, OR rendering a tiny "Carregando mídia…" placeholder for the first frame.
- `src-tauri/src/services/media_probe.rs` (or similar) — confirm the thumbnail-generation pipeline runs for videos AND check whether it requires ffmpeg in addition to ffprobe. The current Phase 2-B service may shell out to ffmpeg `-ss 00:00:01 -vframes 1 -f image2 thumb.jpg`.
- `src/components/media/MediaCard.tsx` — add a `"thumbnail-pending"` UI hint when `thumbnail_file` is null AND the media is a video.
- This story includes a small Rust unit test: import a video without ffprobe present → expect the row to be inserted with `thumbnail_file = null` AND no panic.

**Independent Test:** (a) Import `church.jpg`. Add to set as media. Click Apresentar, navigate to it — image fills projection. (b) Import `worship.mp4`. Open Media Library — the card shows either a generated frame OR a "Thumbnail pendente" label, never just a generic icon.

---

### P8-07: Strophe background — preset selector + font controls ⭐ MVP

**User Story:** As a song editor, I want to choose a strophe background from a preset list (Black bg + White text, White bg + Black text) and pick the lyric font family and size, so I can quickly style verses without fiddling with media uploads.

**Why P8-07:** Today the song editor has a media-backed `BackgroundPicker` (image/video + scrim opacity slider). The user has also lost the per-section background override (regression — `SongSection.background_id` exists in the domain but may have been disconnected from the UI during Phase 7 refactors). They want a simpler model: a small fixed set of color presets + typography controls. This becomes a new background variant alongside media-backed backgrounds.

**Acceptance Criteria:**

1. WHEN the song editor opens a section THEN it SHALL show a background control with three modes: `inherit` (use song-level), `preset` (color preset), `media` (existing image/video picker)
2. WHEN `preset` mode is chosen THEN the user SHALL choose from at least two named presets: **`Preto/Branco`** (bg `#000000`, fg `#FFFFFF`) and **`Branco/Preto`** (bg `#FFFFFF`, fg `#000000`)
3. WHEN preset mode is active THEN the user SHALL also pick a font family from a curated list (e.g. `Sans` (Inter / system-ui), `Serif` (Georgia), `Mono` (JetBrains Mono)) AND a font-size scale (`sm`, `md`, `lg`, `xl` — mapped to `clamp()` ranges so it adapts to the projection viewport)
4. WHEN a section has a preset background THEN the projection SHALL render the section's lyric text in that preset's foreground color, on that preset's background color, using the chosen font family and size
5. WHEN a section's background mode is `inherit` AND the song has no song-level background THEN the projection SHALL render with a sensible default: black bg, white text, sans-serif, size `lg`
6. WHEN the song-level background is also a preset THEN every section inheriting it SHALL render with that preset; sections with their own preset/media override theirs
7. WHEN a preset is in use AND the user transitions to a new section with a different preset THEN the existing `TransitionStage` crossfade SHALL play (no new transition needed)
8. WHEN `Grep "background_id" src-tauri/src/domain/` is run THEN the existing column SHALL be preserved (no DB migration needed for the section-level override; we add additional columns or a JSON config column for the preset+typography fields)

**Data model additions:**
- New columns on `song_sections` (and `songs` for the song-level default): `background_mode TEXT` (`inherit` | `preset` | `media`), `background_preset TEXT` (e.g. `"preto-branco"` | `"branco-preto"`), `font_family TEXT` (`sans` | `serif` | `mono`), `font_size TEXT` (`sm` | `md` | `lg` | `xl`).
- OR a single `background_config JSON` column per section/song carrying `{ mode, preset, fontFamily, fontSize }` — pick whichever is cheaper in the design phase.
- The existing `background_id` + `scrim_opacity` columns remain valid for media mode.
- A new migration `007_section_background_presets.sql` adds the columns with sensible defaults (`mode = "inherit"`).

**Implementation notes:**
- Rust: extend `BackgroundInfo` (domain/background.rs) with an optional `preset: Option<BackgroundPreset>` enum AND `typography: Option<Typography>` substruct. `BackgroundPreset::PretoBranco { fg: "#FFFFFF", bg: "#000000" }`, etc.
- Rust: update `resolve_for_slide` to walk the section → song → default chain and return either media-info or preset-info.
- Frontend: extend `BackgroundInfo` TypeScript type with the new fields. `SongBackground.tsx` renders the preset (solid `bg-color`) or the media (existing branch). `PresentationApp.tsx`'s `SongSlide` reads `typography` and applies `font-{family}` + `text-{size-clamp}`.
- UI: `SongEditor` → `BackgroundPicker` becomes a three-tab control (Inherit / Preset / Media). The preset tab shows two big swatches; the media tab is the existing picker.
- Out of scope: a custom color-picker UI; users get the curated presets only.

**Independent Test:** Open a section. Choose preset `Preto/Branco`, font `Serif`, size `lg`. Save. Apresentar. Navigate to that section — projection shows the verse text in white serif on solid black, at large size. Switch to a section with `Branco/Preto` — projection inverts to black-on-white.

---

### P8-08: Consolidate the two `Apresentar` buttons ⭐ MVP

**User Story:** As an operator, when I click any button labeled "Apresentar", I want the live presentation to start exactly the same way — projection window opens AND the operator transitions to the 3-pane layout.

**Why P8-08:** Two buttons today:
- TOP: `src/components/setbuilder/HomeSetBuilder.tsx:235` → `OverlayActionBar.onApresentar` → `handleApresentar` → `loadSetForPresentation` + `enterPresentation` → projection opens, operator swaps view. **Works.**
- BOTTOM: `src/components/set/SetBuilder.tsx:665` → `handleLoadForPresentation` → only calls `loadSetForPresentation` + `setView("set-player")`. **Does not open the projection window.** User is confused because the label is identical.

**Acceptance Criteria:**

1. WHEN the user clicks EITHER `Apresentar` button THEN the behavior SHALL be identical: `loadSetForPresentation` + `enterPresentation` + lifecycle swap to `OperatorPresentationLayout`
2. WHEN `loadSetForPresentation` fails (e.g. empty set) THEN BOTH buttons SHALL surface the same error toast (P7-01 pattern, the existing `errorToast` in `HomeSetBuilder`)
3. WHEN the bottom `Apresentar` button is consolidated THEN the now-orphan view `set-player` SHALL be evaluated: either keep it as a "rehearsal" mode (no projection) under a different label (e.g. "Pré-visualizar") OR remove it entirely if redundant — decided in design.md
4. WHEN both buttons appear on the same page (today: HomeSetBuilder embeds SetBuilder which has its own bottom button) THEN consider hiding the duplicate: pass a `hidePresentButton` prop down to `SetBuilder` when it's embedded in HomeSetBuilder, so only the top button remains. Alternatively, the bottom button stays but its handler is unified.
5. WHEN tests run THEN existing tests asserting the bottom button's `setView("set-player")` behavior SHALL be updated to assert the new unified behavior

**Implementation notes:**
- `src/components/set/SetBuilder.tsx:246-258` — `handleLoadForPresentation` is the offender. Refactor it to delegate to a shared `startPresentation(setId)` helper that does load + enter + error-toast. Place the helper in `src/runtime/presentation.ts` (new file) or extend `usePresentationStore` with an `enter(setId)` action.
- Add a `hidePresentButton` prop on `SetBuilder` and set it to `true` when used inside `HomeSetBuilder` (line 261 of HomeSetBuilder). This removes UI duplication.
- Decide the fate of `set-player` view: if it's only invoked from the bottom button, removing the button leaves it dead code. Drop it.
- Tests to update: `src/components/setbuilder/HomeSetBuilder.test.tsx`, `src/windows/operator/OperatorApp.smoke.test.tsx`.

**Independent Test:** Open home. The bottom `Apresentar` button is either gone or, if kept, clicking it produces the same result as the top button (projection window opens, operator shows 3-pane layout).

---

## Edge Cases

- WHEN the user clicks a strophe card during a `state_changed` round-trip (rapid double-click) THEN the second click SHALL be a no-op if the target slide equals the new current slide (no extra round-trip)
- WHEN the projection window is closed manually via the title-bar X button THEN the operator's `presentation_lifecycle exited` listener SHALL still fire AND `setView("home")` SHALL still trigger (test that close-via-X is handled identically to ESC)
- WHEN the set contains a media item referencing a deleted media row THEN the projection SHALL render a "Mídia indisponível" placeholder rather than crashing or showing a broken image icon (extends current P8-06 fallback)
- WHEN a section has `background_mode = "preset"` AND `background_preset` is unknown (e.g. data migrated from an older schema) THEN the projection SHALL fall back to `Preto/Branco` and log a warning
- WHEN the user presses ESC twice rapidly (e.g. accidentally double-tapping) THEN exactly one exit SHALL fire (P8-04 AC 1 dedup); the second is silent
- WHEN no projection window exists AND the user presses ESC from the operator window THEN nothing SHALL happen (no error, no double exit)
- WHEN the LIVE preview is rendering a video AND the projection switches to a countdown THEN the LIVE preview SHALL also switch to the countdown renderer (already covered by P7-06, regression-test here)
- WHEN the user is in the song editor selecting a preset background AND clicks `Cancelar` THEN the section row's preview SHALL revert to the previous background mode (no orphan dirty state)

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
|---------------|-------|----------|--------|
| P8-01 | Restore operator → projection state sync | P1 | Pending |
| P8-02 | `SetItemList` click switches projection item | P1 | Pending |
| P8-03 | Countdown set item projects correctly | P1 | Pending |
| P8-04 | ESC exits presentation cleanly, no freeze | P1 | Pending |
| P8-05 | Replace `ESCAPE/SPACE` hint with `ESC` | P3 | Pending |
| P8-06 | Image presents; video thumbnails generate | P1 | Pending |
| P8-07 | Strophe background — preset selector + font | P1 | Pending |
| P8-08 | Consolidate the two `Apresentar` buttons | P2 | Pending |

**Coverage:** 8 requirements (6× P1, 1× P2, 1× P3).

---

## Success Criteria

- [ ] Operator and projection windows stay synchronized: arrow-key navigation, strophe-card click, and set-item click all reflect within 200ms on both surfaces (P8-01, P8-02)
- [ ] Countdown set items project the configured timer + message (P8-03)
- [ ] ESC closes presentation and returns the operator to home in < 500ms with no freeze, idempotent on double-press (P8-04)
- [ ] `Grep "ESCAPE/SPACE"` in `src/` returns zero hits; close-hint reads `ESC` (P8-05)
- [ ] Image set items render in projection; video items show a thumbnail OR a clear "pending" badge in the library grid (P8-06)
- [ ] Song editor offers `Inherit` / `Preset` / `Media` background modes with at least two presets and font family + size controls; projection respects all three (P8-07)
- [ ] Both `Apresentar` buttons start the live presentation identically; orphan code paths cleaned up (P8-08)
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` green; new tests cover P8-01 broadcast emit, P8-04 idempotent exit, P8-06 video import without ffprobe, P8-07 preset + typography resolution
- [ ] `npx vitest` green; new tests cover P8-01 click handler reading live store value, P8-05 string absence, P8-07 SongEditor preset tabs
- [ ] `tsc --noEmit` clean
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` clean

---

## Implementation Order (suggested)

1. **P8-01** (state-sync broadcast) — blocks everything else; without it P8-02, P8-03, P8-06 cannot be verified end-to-end
2. **P8-04** (ESC freeze) — needs to be fixable before extended manual testing; otherwise every test session ends with an app restart
3. **P8-02** (set-item click) — verify resolved after P8-01; mostly a sanity check
4. **P8-03** (countdown projection) — verify resolved after P8-01; if a serialization gap is found, fix it
5. **P8-06** (media render + thumbnails) — partly state-sync, partly media-pipeline; can run in parallel with P8-07
6. **P8-08** (button consolidation) — pure frontend refactor; independent
7. **P8-07** (background presets + typography) — largest scope; new schema columns, new UI tabs, projection wiring
8. **P8-05** (label rename) — mechanical; do last to avoid merge conflicts during the bigger changes

---

## Gray Areas — To Resolve in Design

- **P8-01 root cause:** exact bug location (broadcast vs lock-holding vs closure-staleness) — must be confirmed by reading `src-tauri/src/commands/presentation.rs` in the design phase, before estimating effort
- **P8-04 dedup strategy:** debounce at frontend API layer vs. idempotency check in Rust handler — pick one and document
- **P8-06 thumbnail pipeline:** verify if ffmpeg is currently bundled or required separately; document the dependency
- **P8-07 data model:** four discrete columns vs. one JSON `background_config` column — design.md should pick based on query patterns and migration cost
- **P8-08 set-player fate:** keep as a hidden "rehearsal" mode or remove entirely — decide based on whether any other entry point references it
