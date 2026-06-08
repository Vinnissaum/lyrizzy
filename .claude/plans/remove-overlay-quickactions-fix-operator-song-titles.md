# Plan & Design — Camera removal, image/slideshow overlay fixes, operator song titles

Status: implemented (uncommitted) · Date: 2026-06-08 · Branch target: feature branch off `main`

Gates green: `cargo test` (all pass), `cargo clippy --all-targets -- -D warnings` clean,
`npx vitest run` 339✓, `tsc --noEmit` clean.

## Requested changes (final scope)

1. **Remove the Camera** quick-action from the overlay action bar (operator +
   home/set screens) and drop the global **Camera URL** setting. **Keep** the
   Image (formerly "Offering") and Slideshow (pptx/pdf) actions — they are meant
   to be usable after a presentation has already started.
2. **Image overlay click did nothing** — fix it.
3. **Verify/fix the pptx/pdf slideshow** added mid-presentation.
4. **Operator song titles (name + author) weren't showing** — fix.

---

## Root-cause findings (two real bugs)

### Image overlay never rendered — serde field-rename bug
`OverlayState` is `#[serde(tag = "type", rename_all = "camelCase")]`, but
`rename_all` on an enum renames only the **variants**, not the fields inside
struct variants. So `Media { media_id }` serialized the field as **`media_id`**,
while the frontend type and `QuickMediaRenderer` read **`mediaId`** → always
`undefined` → black screen. (`Announcement.text`/`WebView.url` are single words,
so they happened to be unaffected.)

### Slideshow added mid-presentation didn't appear
`add_set_item` only inserted into the DB and emitted `set_changed`; it never
patched the in-memory `state.presentation` snapshot, which is the single source
of truth the operator view **and** projector render. A pptx/pdf imported while
presenting was therefore invisible until a full reload. (`update_set_item`
already patches the snapshot; `add_set_item` did not.)

### Operator song titles showed "—"
`OperatorPresentationLayout`/`SetItemList` label songs from
`useLibraryStore().songs`, which is filled only by the `onSongsChanged`
listener. The home screen keeps its **own local** song list and never populates
the store, so on the home→present path the store is empty → `itemLabel` falls
back to "—". Also `itemLabel` never included the artist.

---

## Implementation

### Backend (`src-tauri`)
- `domain/presentation.rs`: `OverlayState::Media` now has
  `#[serde(rename = "mediaId")] media_id`. Added a regression test asserting the
  JSON key is `mediaId`.
- `commands/presentation.rs`: extracted `SlideGenSettings`,
  `load_slide_gen_settings`, and `compute_item_slides` (the per-item slide build,
  previously inline in `load_set_for_presentation`). Added
  `append_item_to_live_presentation(state, app, item)`: if the item's set is the
  one currently loaded, compute its slides, push to `presentation_slides`, append
  the item + slide count to the snapshot, recompute `next_slide`, and emit
  `state_changed`. Non-disruptive (appends at the end; navigation unchanged).
  Same lock order as `do_next_slide`; locks dropped before emit.
- `commands/set.rs`: `add_set_item` calls `append_item_to_live_presentation`
  after the DB insert so mid-presentation adds (e.g. slideshow import) show up
  immediately.

### Frontend (`src`)
- `OverlayActionBar.tsx`: removed the Camera button + `onCamera` prop; renamed
  the Offering button to use `home.overlay.image`. Image + Slideshow kept.
- `OperatorPresentationLayout.tsx` & `HomeSetBuilder.tsx`: removed
  `handleCamera`/`handleConfirmCameraUrl`, the Camera URL prompt modal, its
  state, and the `setWebviewOverlay`/settings-store camera wiring. Operator now
  loads library songs on mount (`if (songs.length === 0) refreshSongs()`).
  HomeSetBuilder: also fixed malformed JSX on the media-picker close button.
- `itemMeta.tsx`: added pure `songArtist(item, songs)`.
- `SetItemList.tsx`: song rows show title + muted artist line.
- Operator strophes-pane header appends the artist when present.
- `settings/SettingsScreen.tsx` + `stores/settings.ts`: removed the Camera URL
  field, `cameraUrl` state, `setCameraUrl`, `loadCameraUrl` (orphaned DB row
  `camera.url` left as harmless data — no migration).
- i18n (`en-US`, `pt-BR`): `home.overlay.oferta`→`image`, removed `camera`,
  `cameraNoUrl`, `goToSettings`, `cameraUse`, `settings.windows.cameraUrl`;
  `selectMedia` reworded to generic. Slideshow keys kept.

### Tests updated
`OverlayActionBar.test.tsx` (image rename + camera-removed assertion),
`OperatorPresentationLayout.test.tsx` (image label, `refresh` in lib mocks).

### Out of scope (unchanged)
WebView set-item camera *modes* (SRT/RTSP/RTMP/multicast/MJPEG) + MediaMTX proxy;
dead `SlideController.tsx`.
