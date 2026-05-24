# Phase 5 — PPTX/PDF Presentation Set Items

**Created:** 2026-05-21  
**Status:** Specifying  
**Scope:** Large — crosses Rust backend, React frontend, LibreOffice sidecar, IPC

---

## Problem Statement

The operator regularly uses PowerPoint/PDF files for announcements, liturgy, and event
presentations alongside songs in the Sunday service. Currently they must manually switch
to a separate app to show those files, breaking the single-app workflow. The placeholder
"Em breve" PDF button has shipped in Phase 4 — Phase 5 makes it real.

---

## Goals

- [ ] Operator imports a `.pptx`, `.pdf`, `.ppt`, or `.odp` file and it appears in the media library
- [ ] A presentation file can be added to the service set as a first-class set item
- [ ] Slides from the presentation navigate with Space / arrow keys exactly like song strophes
- [ ] LibreOffice (bundled) handles the conversion invisibly — no configuration required
- [ ] The PDF "Em breve" button in the home overlay bar becomes the import entry-point

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Opt-in Sentry crash reporting | User explicitly excluded from Phase 5 |
| PPTX editing inside the app | View-only; LibreOffice is conversion-only |
| Slide animations / transitions in PPTX | Rendered as static PNG images |
| Multiple simultaneous conversion jobs | Single-file import is sufficient for Sunday workflow |
| Automatic LibreOffice update checks | Not needed for bundled binary |

---

## Architecture Overview

```
Operator imports .pptx/.pdf
       ↓
import_presentation command (Rust)
  ├─ Copy source → <media_dir>/<uuid>.pptx
  ├─ mkdir <media_dir>/<uuid>/
  ├─ spawn soffice --headless --convert-to png --outdir <uuid_dir> <source>
  ├─ sort+rename PNGs → slide_000.png, slide_001.png …
  ├─ slide_count = number of PNGs
  ├─ thumbnail_file = "<uuid>/slide_000.png"
  └─ INSERT into media (kind = "presentation", slide_count)

Operator adds to set
  ↓ SetItemType::SlideShow (media_id = uuid)

load_set_for_presentation (Rust)
  → queries slide_count from media WHERE id = uuid
  → generates Vec<Slide::pseudo_slideshow(0..N)>

PresentationApp (React) — SlideShow item
  → section_label == "slide_show" → SlideshowRenderer
  → slide index = parseInt(currentSlide.sectionId)
  → renders asset://media/<uuid>/slide_<NNN>.png
```

**Key invariant:** Slide navigation is unchanged — `next_slide` / `prev_slide` already handle multi-slide items. SlideShow plugs in as N pseudo-slides per item, same as songs.

**Asset protocol:** Subdirectory paths like `<uuid>/slide_000.png` already work in the existing handler — the canonical path check passes for any path inside `<media_dir>`.

---

## LibreOffice Sidecar Strategy

- **Bundled path (runtime):** `app.path().resource_dir().join("soffice/program/soffice.exe")`
- **Dev fallback:** `SOFFICE_PATH` env var → then `soffice` on PATH
- **Build:** `src-tauri/resources/soffice/` is gitignored (too large); CI script downloads
  LibreOffice headless and extracts the `program/` directory there before `tauri build`
- **Detection command:** `check_libreoffice()` returns `bool` (same pattern as `check_ffprobe`)
- **Banner:** `LibreOfficeBanner` shown in operator when detection fails (same pattern as `FfmpegBanner`)

---

## User Stories

### P5-01: `MediaKind::Presentation` + `slide_count` + DB migration ⭐ MVP

**User Story:** As the system, when a presentation file is imported it is stored as a
`Presentation` media item with a known slide count so navigation can be pre-computed.

**Why P5-01:** Foundation for all other requirements. Sets up the type system and schema.

**Acceptance Criteria:**

1. WHEN a `Media` record has `kind = "presentation"` THEN it SHALL serialize to `"presentation"` in JSON (snake_case, consistent with `"image"` / `"video"`)
2. WHEN a `Media` record is created for a presentation THEN `slide_count: Option<i64>` SHALL be populated with the number of converted PNG slides
3. WHEN migration 006 runs THEN the `media` table SHALL have a nullable `slide_count` column
4. WHEN `MediaKind::Presentation` is added THEN all exhaustive `match` sites on `MediaKind` SHALL be updated (compiler-checked)

**Implementation notes:**
- Add `Presentation` to `MediaKind` enum in `domain/media.rs`
- Add `slide_count: Option<i64>` to `Media` struct
- Create `src-tauri/migrations/006_phase5.sql`: `ALTER TABLE media ADD COLUMN slide_count INTEGER;`
- Update `db/media.rs` INSERT and SELECT queries to include `slide_count`
- All `match kind` sites: `import_media`, `media_probe`, `list_media` filter must accept `Presentation`

**Independent Test:** `cargo test` — `media_kind_serializes_snake_case` includes `presentation`.

---

### P5-02: LibreOffice sidecar detection + `LibreOfficeBanner` ⭐ MVP

**User Story:** As an operator, if LibreOffice is not found on my machine I want a
clear banner explaining what to install, so I'm never left wondering why import fails.

**Why P5-02:** Prevents silent import failures. Matches the established `FfmpegBanner` pattern.

**Acceptance Criteria:**

1. WHEN `check_libreoffice()` is called THEN it SHALL return `true` if `soffice.exe` is found at the bundled path or on PATH, `false` otherwise
2. WHEN `check_libreoffice()` returns `false` THEN `LibreOfficeBanner` SHALL be visible in the operator window
3. WHEN LibreOffice is found THEN no banner is shown

**Implementation notes:**
- `commands/media.rs`: add `check_libreoffice()` command — probe bundled path first, then `SOFFICE_PATH` env, then `soffice -version` on PATH
- `LibreOfficeBanner.tsx` in `src/components/media/` — matches `FfmpegBanner` layout and copy
- `OperatorApp.tsx`: call `checkLibreOffice()` on mount alongside `checkFfprobe()`

**Independent Test:** Temporarily rename `soffice` — banner appears. Restore — banner gone.

---

### P5-03: `import_presentation` async command ⭐ MVP

**User Story:** As an operator, I want to import a PPTX/PDF file and have it converted
to slides automatically, with a visible progress indicator while it processes.

**Why P5-03:** The conversion step is unique to presentations (no equivalent in image/video import).
A separate command keeps `import_media` clean and makes the async conversion explicit.

**Acceptance Criteria:**

1. WHEN `import_presentation(source_path)` is called with a `.pptx`, `.pdf`, `.ppt`, or `.odp` file THEN it SHALL copy the source to `<media_dir>/<uuid>.<ext>` and run LibreOffice conversion
2. WHEN LibreOffice conversion completes THEN the PNG slides SHALL be normalized to `slide_000.png`, `slide_001.png`, … in `<media_dir>/<uuid>/`
3. WHEN conversion succeeds THEN a `Media` record SHALL be inserted with `kind = "presentation"`, `slide_count = N`, `thumbnail_file = "<uuid>/slide_000.png"`
4. WHEN conversion succeeds THEN `media_library_changed` SHALL be emitted
5. WHEN conversion is in progress THEN a `conversion_progress` event SHALL be emitted with `{ media_id: String, status: "converting" | "done" | "error", message: Option<String> }`
6. WHEN LibreOffice is not found THEN the command SHALL return `ErrorPayload` with code `"media.libreoffice_not_found"`
7. WHEN the source file has an unsupported extension THEN the command SHALL return `ErrorPayload` with code `"media.unsupported_container"`
8. WHEN conversion fails (LibreOffice error) THEN the copied source AND the output directory SHALL be cleaned up (no orphans) AND `ErrorPayload` code `"media.conversion_failed"` returned
9. WHEN a single-page PDF is imported THEN `slide_count = 1` and one slide PNG is stored

**Implementation notes:**
- `services/libreoffice.rs` (new): `fn soffice_path() -> Option<PathBuf>`, `async fn convert_to_png(src: &Path, out_dir: &Path) -> Result<Vec<PathBuf>, String>`
  - Resolution order: bundled resource path → `SOFFICE_PATH` → `soffice` on PATH
  - Command: `soffice --headless --convert-to png --outdir <out_dir> <src>`
  - After conversion: sort output PNGs by name (LibreOffice natural order = slide order), rename to `slide_NNN.png` (zero-padded to 3 digits)
- `commands/media.rs`: add `import_presentation` (async, same structure as `import_media`)
  - Emit `conversion_progress { status: "converting" }` before spawning LibreOffice
  - Emit `conversion_progress { status: "done" }` on success, `status: "error"` on failure
- `app.emit("conversion_progress", ...)` — frontend listens to show spinner

**Independent Test:** Import a 3-slide PPTX → media library shows it with slide count 3; `<media_dir>/<uuid>/` contains `slide_000.png`, `slide_001.png`, `slide_002.png`.

---

### P5-04: `SetItemType::SlideShow` + navigation ⭐ MVP

**User Story:** As an operator, I want to add a presentation file to the set and navigate
through its slides with the same Space / arrow keys I use for songs.

**Why P5-04:** Core runtime integration. Plugs SlideShow into the existing navigation engine
without modifying `next_slide` / `prev_slide` — only `load_set_for_presentation` changes.

**Acceptance Criteria:**

1. WHEN a `SlideShow` set item is loaded THEN `load_set_for_presentation` SHALL generate one `Slide::pseudo_slideshow(i)` per slide (i = 0..slide_count−1)
2. WHEN `item_slide_counts` is serialized THEN SlideShow items SHALL report their actual slide count (not 1)
3. WHEN the operator presses Space / arrow on the last slide of a SlideShow item THEN navigation SHALL advance to the first slide of the next set item (existing boundary semantics)
4. WHEN `SetItemType::SlideShow` is added THEN all exhaustive `match` arms on `SetItemType` SHALL be updated (compiler-checked)

**Implementation notes:**
- `domain/set.rs`: add `SlideShow` to `SetItemType`
- `domain/slide.rs`: add `Slide::pseudo_slideshow(index: usize) -> Slide` — sets `section_label = "slide_show"`, `section_id = index.to_string()`
- `commands/presentation.rs` `load_set_for_presentation`: add `SetItemType::SlideShow` arm — query `SELECT slide_count FROM media WHERE id = ?`, generate `(0..n).map(Slide::pseudo_slideshow).collect()`
- `commands/set.rs` (wherever `SetItemType` is matched for set item creation): add `SlideShow` arm
- `src/api/commands.ts`: add `SlideShow = "slide_show"` to the `SetItemType` enum

**Independent Test:** Load a set with a 5-slide presentation → `item_slide_counts` shows 5 for that item; navigating through emits `state_changed` 5 times with distinct `currentSlideIndex` values.

---

### P5-05: `SlideshowRenderer` presentation component ⭐ MVP

**User Story:** As a congregation member, I want to see the presentation slides fullscreen
on the projector, fitting the screen without distortion.

**Why P5-05:** The visible output of all prior work. The renderer is intentionally minimal —
it's just a full-screen fitted image, same as `MediaSlideRenderer` for images.

**Acceptance Criteria:**

1. WHEN a SlideShow slide is active THEN the presentation window SHALL render the correct PNG image fullscreen via `asset://media/<uuid>/slide_NNN.png`
2. WHEN the image is wider than the viewport THEN it SHALL be scaled down to fit without cropping (object-fit: contain, black letterbox)
3. WHEN the slide transitions THEN the image SHALL update immediately (no visible state flash)
4. WHEN the media record is not found in the store THEN the renderer SHALL show a black screen (no error thrown)

**Implementation notes:**
- `src/components/presentation/SlideshowRenderer.tsx` (new)
  - Props: `mediaId: string, slideIndex: number`
  - Renders `<img src={assetUrl(\`${mediaId}/slide_${String(slideIndex).padStart(3,'0')}.png\`)} className="w-full h-full object-contain bg-black" />`
- `PresentationApp.tsx`: when current set item is `SlideShow` (check `item.itemType === 'slide_show'`), render `SlideshowRenderer` instead of normal content
  - Slide index comes from `parseInt(currentSlide.sectionId)`
  - `mediaId` comes from `currentItem.mediaId`
- `StageRenderer.tsx`: show thumbnail image of current slide (same `SlideshowRenderer`, or just the first slide thumbnail)

**Independent Test:** Present a 3-slide deck → advance through slides → each shows the correct PNG fullscreen.

---

### P5-06: `SlideshowSetItemEditor` + set builder integration ⭐ MVP

**User Story:** As an operator, I want to add a presentation file to the set from the set
builder and see its slide count and title in the set list.

**Why P5-06:** Operators need to see and manage SlideShow items in the set like any other item.

**Acceptance Criteria:**

1. WHEN the operator clicks "+ Apresentação" in the set builder THEN a file picker dialog SHALL open accepting `.pptx`, `.pdf`, `.ppt`, `.odp` files
2. WHEN a file is selected THEN the app SHALL call `importPresentation` and show a progress indicator
3. WHEN import completes THEN the new SlideShow set item SHALL appear in the set with the file's display name and slide count
4. WHEN the operator opens the set item editor for a SlideShow item THEN it SHALL show: display name, slide count, thumbnail of first slide
5. WHEN the operator clicks "Substituir arquivo" in the editor THEN a new file picker opens to reimport (replaces the converted slides and updates slide_count)
6. WHEN a SlideShow item is in the set THEN its row SHALL show a presentation icon and "N slides" subtitle

**Implementation notes:**
- `src/components/set/SlideshowSetItemEditor.tsx` (new)
  - Shows display name, slide count (`${item.slideCount} slides`), first-slide thumbnail
  - "Substituir arquivo" button triggers re-import (calls `importPresentation` with media_id to replace)
- `SetBuilder.tsx` / add-item flow: add "Apresentação" option alongside Song / Media / Countdown / WebView / Blank
  - On click: `dialog.open({ filters: [{name:'Apresentação', extensions:['pptx','pdf','ppt','odp']}] })`
  - On file selected: show conversion spinner → on `conversion_progress` event with `status:"done"` → create set item
- `HomeSetBuilder.tsx` `p4h-07e` PDF button: wire to the same import flow (remove "Em breve" disabled state)

**Independent Test:** SetBuilder → "+ Apresentação" → select file → import completes → item appears in set with slide count.

---

### P5-07: PDF "Em breve" button becomes functional

**User Story:** As an operator, I want the PDF button on the home screen to trigger the
presentation import flow so I can add slides without switching to a separate builder view.

**Why P5-07:** This button has been a placeholder since P4H-07e shipped. Making it functional
closes the loop on the home screen workflow.

**Acceptance Criteria:**

1. WHEN the operator clicks the "PDF/PPTX" button on the home overlay bar THEN the file picker dialog SHALL open (same flow as P5-06)
2. WHEN a file is imported via this path THEN the new SlideShow item SHALL be appended to the fixed set
3. WHEN import is in progress THEN the button SHALL be disabled with a spinner

**Implementation notes:**
- `HomeSetBuilder.tsx` / `HomeOverlayBar.tsx`: remove `disabled` + "Em breve" from the PDF button, wire click to the same import handler as P5-06
- On conversion_progress `status:"done"`: call `addSetItem` for the new SlideShow media

**Independent Test:** Home → PDF button → pick file → item added to set.

---

### P5-08: Gate — tests + STATE/ROADMAP update

**What:** Full gate pass before Phase 5 is marked complete.

**Acceptance Criteria:**

1. `cargo test --manifest-path src-tauri/Cargo.toml` SHALL pass with ≥ existing + new Rust tests
2. `npx vitest run` SHALL pass with ≥ existing + new Vitest tests
3. `tsc --noEmit` SHALL be clean
4. Manual smoke: import PPTX → add to set → present → navigate slides → all slides correct
5. STATE.md and ROADMAP.md updated with Phase 5 completion summary

---

## Edge Cases

- WHEN LibreOffice exits non-zero but created some PNGs THEN partial output SHALL be discarded and `conversion_failed` returned
- WHEN `slide_count = 0` (LibreOffice created no PNGs) THEN import SHALL return `conversion_failed`
- WHEN a SlideShow set item's `media_id` refers to a soft-deleted media record THEN `SlideshowRenderer` SHALL show a black placeholder (no crash)
- WHEN a `.pptx` with 1 page is imported THEN it presents as a single-slide item (no navigation UI change needed)
- WHEN the backup `.tlz` is created THEN all files under `<media_dir>/<uuid>/` SHALL be included (existing archive service traverses the full media dir)
- WHEN the operator navigates Blank → SlideShow item THEN background SHALL remain black (SlideShow items return `None` from `resolve_background_for_item`, same as Media)
- WHEN `check_libreoffice()` returns false THEN `import_presentation` SHALL still return `ErrorPayload` rather than crash

---

## Requirement Traceability

| Requirement ID | Story | Priority | Status |
|---------------|-------|----------|--------|
| P5-01 | MediaKind::Presentation + slide_count + migration | P1 | Pending |
| P5-02 | LibreOffice detection + LibreOfficeBanner | P1 | Pending |
| P5-03 | import_presentation command | P1 | Pending |
| P5-04 | SetItemType::SlideShow + navigation | P1 | Pending |
| P5-05 | SlideshowRenderer (presentation window) | P1 | Pending |
| P5-06 | SlideshowSetItemEditor + set builder | P1 | Pending |
| P5-07 | PDF button functional | P1 | Pending |
| P5-08 | Gate (tests + STATE/ROADMAP) | P1 | Pending |

**Coverage:** 8 requirements, all P1.

---

## Success Criteria

- [ ] Operator imports a 10-slide PPTX, adds it to set, presents — all 10 slides appear correctly
- [ ] LibreOffice banner shows when soffice not found; disappears when found
- [ ] Navigation (Space / arrows) through a SlideShow item works identically to song strophes
- [ ] All existing Rust tests pass + ≥ 5 new Rust tests added
- [ ] All existing Vitest tests pass + ≥ 6 new Vitest tests added
- [ ] `tsc --noEmit` clean
