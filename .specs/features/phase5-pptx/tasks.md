# Phase 5 — PPTX/PDF Presentation Set Items — Tasks

**Spec:** `.specs/features/phase5-pptx/spec.md`
**Status:** Draft
**Created:** 2026-05-21

---

## Execution Plan

### Phase 1 — Parallel foundations

```
T1 [P]  Rust data model: MediaKind::Presentation + slide_count + migration 006
T2 [P]  LibreOffice service + check command + LibreOfficeBanner
```

### Phase 2 — SlideShow type (after T1)

```
T1 → T3  SetItemType::SlideShow + Slide::pseudo_slideshow + presentation.rs nav arm + TS types
```

### Phase 3 — Import pipeline (after T1 + T2 + T3)

```
T1, T2, T3 → T4  import_presentation command (async LibreOffice conversion pipeline)
```

### Phase 4 — Frontend (parallel, after T3 and T4)

```
T3     → T5 [P]  SlideshowRenderer + PresentationApp wiring
T3, T4 → T6 [P]  SlideshowSetItemEditor + set builder + PDF home button
```

### Phase 5 — Gate

```
T5, T6 → T7  Gate: tests + STATE/ROADMAP
```

---

## Task Breakdown

### T1: Rust data model — MediaKind::Presentation + slide_count + migration 006 [P]

**What:** Add `MediaKind::Presentation` variant; add `slide_count: Option<i64>` to `Media` struct;
create migration 006; update `db/media.rs` to persist/retrieve the new variant and column.

**Where:**
- `src-tauri/src/domain/media.rs` — add `Presentation` to `MediaKind`; add `slide_count` to `Media`
- `src-tauri/src/db/media.rs` — `kind_to_str` / `kind_from_str` for `Presentation`; add `slide_count` to all SELECT/INSERT queries; update `row_to_media`
- `src-tauri/migrations/006_phase5.sql` — `ALTER TABLE media ADD COLUMN slide_count INTEGER;`

**Depends on:** None

**Exhaustive match sites to update in db/media.rs:**
- `kind_to_str`: add `MediaKind::Presentation => "presentation"`
- `kind_from_str`: add `"presentation" => MediaKind::Presentation` before the wildcard fallback

**SELECT query strings that need `slide_count` added (all in db_media.rs):**
- `db_list_media` builder SELECT list
- `db_rename_media` fetch-back SELECT
- `db_get_media_by_id` SELECT
- `row_to_media`: add `slide_count: row.get("slide_count")`

**INSERT in db_insert_media:** add `slide_count` column and `.bind(media.slide_count)` at the end.

**Done when:**
- [ ] `MediaKind::Presentation` serializes to `"presentation"` (snake_case, matches image/video)
- [ ] `Media` struct has `slide_count: Option<i64>`
- [ ] Migration 006 adds `slide_count` column
- [ ] All db/media.rs queries include `slide_count` column
- [ ] `kind_from_str` correctly maps `"presentation"` → `MediaKind::Presentation` (not fallback to `Image`)
- [ ] Unit test: `media_kind_serializes_snake_case` covers `Presentation`
- [ ] Gate: `cargo test --manifest-path src-tauri/Cargo.toml` green

**Tests:** unit (domain/media.rs existing test extended + new round-trip for slide_count)
**Gate:** quick
**Commit:** `feat(media): P5-01 — MediaKind::Presentation + slide_count + migration 006`

---

### T2: LibreOffice service + check_libreoffice command + LibreOfficeBanner [P]

**What:** Create `services/libreoffice.rs` with path resolution + async conversion helper.
Add `check_libreoffice()` Tauri command. Add `LibreOfficeBanner` React component shown when
LibreOffice is not found — mirrors the existing `FfmpegBanner` pattern exactly.

**Where:**
- `src-tauri/src/services/libreoffice.rs` (new)
- `src-tauri/src/services/mod.rs` — expose `libreoffice`
- `src-tauri/src/commands/media.rs` — add `check_libreoffice()`
- `src-tauri/src/lib.rs` — register `check_libreoffice` in `invoke_handler![]`
- `src/components/media/LibreOfficeBanner.tsx` (new)
- `src/windows/operator/OperatorApp.tsx` — call `checkLibreOffice()` on mount
- `src/api/commands.ts` — add `checkLibreOffice(): Promise<boolean>`
- `src/i18n/locales/pt-BR.json` — add `"media.libreoffice.*"` keys
- `src/i18n/locales/en-US.json` — same

**Depends on:** None

**LibreOffice path resolution (priority order):**
1. Bundled: `app.path().resource_dir()?.join("soffice/program/soffice.exe")` (Windows)
2. `SOFFICE_PATH` env var
3. `soffice` on PATH

**`services/libreoffice.rs` public API:**
```rust
pub fn soffice_path(app_handle: &AppHandle) -> Option<PathBuf>
pub async fn convert_to_png(soffice: &Path, src: &Path, out_dir: &Path) 
    -> Result<Vec<PathBuf>, String>
```
`convert_to_png`: spawn `soffice --headless --convert-to png --outdir <out_dir> <src>`, wait for exit, collect all `.png` files from `out_dir`, sort by name (natural/lexicographic), rename them to `slide_000.png`, `slide_001.png`, … Return the renamed paths.

**`check_libreoffice()` command:** calls `soffice_path()`, returns `true` if `Some` and the path exists.

**LibreOfficeBanner.tsx:** Same layout as `FfmpegBanner` — yellow warning bar with install link text. Shown in `OperatorApp` below the update banner, before main content.

**Done when:**
- [ ] `soffice_path()` resolves bundled path first, then env, then PATH
- [ ] `check_libreoffice` Tauri command registered in `lib.rs`
- [ ] `LibreOfficeBanner` renders when `checkLibreOffice` returns false
- [ ] `LibreOfficeBanner` is hidden when LibreOffice found
- [ ] Unit test: `soffice_path` with bundled path present returns `Some`
- [ ] Unit test: `soffice_path` with no bundled path + `SOFFICE_PATH` env set returns `Some`
- [ ] Gate: `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run` green

**Tests:** unit (libreoffice service path resolution) + component (LibreOfficeBanner render)
**Gate:** quick
**Commit:** `feat(media): P5-02 — LibreOffice sidecar detection + LibreOfficeBanner`

---

### T3: SetItemType::SlideShow + Slide::pseudo_slideshow + navigation + TS type

**What:** Add `SlideShow` set item type variant. Add `Slide::pseudo_slideshow(index: usize)` constructor.
Wire the `SlideShow` arm in `load_set_for_presentation` to query slide_count and generate N slides.
Add the TypeScript enum value.

**Where:**
- `src-tauri/src/domain/set.rs` — add `SlideShow` to `SetItemType`
- `src-tauri/src/domain/slide.rs` — add `Slide::pseudo_slideshow(index: usize) -> Slide`
- `src-tauri/src/commands/presentation.rs` — add `SetItemType::SlideShow` arm in `load_set_for_presentation`
- `src-tauri/src/commands/set.rs` — add `SlideShow` to all exhaustive match arms (e.g., item-type creation)
- `src/api/commands.ts` — add `SlideShow = "slide_show"` to the TS `SetItemType` enum

**Depends on:** T1 (slide_count column must exist in migration for the query to work in tests)

**Slide::pseudo_slideshow:**
```rust
pub fn pseudo_slideshow(index: usize) -> Self {
    Self {
        lines: vec![],
        section_label: "slide_show".to_string(),
        section_id: index.to_string(),
    }
}
```

**load_set_for_presentation SlideShow arm:**
```rust
SetItemType::SlideShow => {
    if let Some(media_id) = &item.media_id {
        let n: Option<i64> = sqlx::query_scalar!(
            "SELECT slide_count FROM media WHERE id = ? AND deleted_at IS NULL",
            media_id
        ).fetch_optional(pool).await?.flatten();
        let count = n.unwrap_or(1).max(1) as usize;
        (0..count).map(Slide::pseudo_slideshow).collect()
    } else {
        vec![blank_slide()]
    }
}
```

**Done when:**
- [ ] `SetItemType::SlideShow` serializes to `"slide_show"` (snake_case)
- [ ] `Slide::pseudo_slideshow(3)` produces `{ lines: [], section_label: "slide_show", section_id: "3" }`
- [ ] `load_set_for_presentation` with a SlideShow item generates N slides (N = slide_count from DB)
- [ ] All exhaustive `match item.item_type` / `match kind` arms across `commands/` updated
- [ ] Unit test: `set_item_type_serializes_snake_case` covers `SlideShow`
- [ ] Unit test: `Slide::pseudo_slideshow` round-trips correctly
- [ ] Gate: `cargo test --manifest-path src-tauri/Cargo.toml` green

**Tests:** unit (domain types)
**Gate:** quick
**Commit:** `feat(set): P5-04 — SetItemType::SlideShow + pseudo_slideshow + navigation arm`

---

### T4: import_presentation async command

**What:** New Tauri command that: validates extension; copies source; creates output dir;
runs LibreOffice conversion; normalizes PNG filenames; inserts `Media` record with
`kind = Presentation`, `slide_count`; emits `conversion_progress` and `media_library_changed`.

**Where:**
- `src-tauri/src/commands/media.rs` — add `import_presentation` async function
- `src-tauri/src/lib.rs` — register `import_presentation`
- `src/api/commands.ts` — add `importPresentation(sourcePath: string): Promise<Media>`
- `src/i18n/locales/pt-BR.json` — add conversion-related i18n keys

**Depends on:** T1 (MediaKind::Presentation, slide_count), T2 (libreoffice service), T3 (SetItemType::SlideShow exists so compiler checks pass)

**Command flow:**
1. Validate extension: `.pptx`, `.pdf`, `.ppt`, `.odp` → else `ErrorPayload "media.unsupported_container"`
2. Check `soffice_path()` → else `ErrorPayload "media.libreoffice_not_found"`
3. Emit `conversion_progress { mediaId: uuid, status: "converting" }`
4. Copy source to `<media_dir>/<uuid>.<ext>`
5. `std::fs::create_dir_all(<media_dir>/<uuid>/)`
6. Call `libreoffice::convert_to_png(soffice, &copied_source, &out_dir)` → on error: cleanup + `ErrorPayload "media.conversion_failed"`
7. `slide_count` = number of renamed PNGs; if 0 → cleanup + error
8. `thumbnail_file = format!("{uuid}/slide_000.png")`
9. Insert `Media { kind: Presentation, slide_count: Some(n), thumbnail_file: Some(...), ... }`
10. Emit `media_library_changed`
11. Emit `conversion_progress { status: "done" }`
12. Return `Ok(media)`

**Cleanup rule:** On any error after step 4, delete `<media_dir>/<uuid>.<ext>` and `<media_dir>/<uuid>/` (same pattern as `import_media`).

**conversion_progress event payload:**
```rust
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConversionProgress {
    pub media_id: String,
    pub status: String,   // "converting" | "done" | "error"
    pub message: Option<String>,
}
```

**Done when:**
- [ ] Command registered in lib.rs
- [ ] Happy path: 3-slide PPTX → `slide_count = 3`, `thumbnail_file = "<uuid>/slide_000.png"` inserted in DB
- [ ] Unsupported extension → `ErrorPayload "media.unsupported_container"`
- [ ] LibreOffice missing → `ErrorPayload "media.libreoffice_not_found"`
- [ ] LibreOffice failure → cleanup + `ErrorPayload "media.conversion_failed"`
- [ ] TS `importPresentation` wrapper in `commands.ts`
- [ ] Gate: `cargo test --manifest-path src-tauri/Cargo.toml` green

**Tests:** command — none directly (integration path); service-level tested via libreoffice.rs unit tests in T2
**Gate:** quick
**Commit:** `feat(media): P5-03 — import_presentation command + conversion pipeline`

---

### T5: SlideshowRenderer + PresentationApp wiring [P]

**What:** New `SlideshowRenderer` component that shows a single slide PNG full-screen.
Wire it into `PresentationApp.tsx` so SlideShow items render correctly.
Update `StageRenderer` to show current slide image for SlideShow items.

**Where:**
- `src/components/presentation/SlideshowRenderer.tsx` (new)
- `src/windows/presentation/PresentationApp.tsx` — add SlideShow branch
- `src/windows/stage/StageRenderer.tsx` — add SlideShow rendering in current/next

**Depends on:** T3 (SlideShow type in TS; `sectionLabel === "slide_show"` convention)

**SlideshowRenderer props:** `{ mediaId: string; slideIndex: number }`

**URL pattern:** `asset://localhost/media/${mediaId}/slide_${String(slideIndex).padStart(3,'0')}.png`

**Rendering:** `<img className="w-full h-full object-contain bg-black" />`

**PresentationApp wiring:**
- Current detection pattern for SlideShow: `currentItem?.itemType === 'slide_show'`
- `slideIndex = parseInt(currentSlide.sectionId)`
- `mediaId = currentItem.mediaId`
- Branch renders `<SlideshowRenderer>` instead of normal song/media/etc content

**StageRenderer:** For current and next slide when `sectionLabel === "slide_show"`, render a small `<img>` thumbnail instead of text lines.

**Done when:**
- [ ] `SlideshowRenderer` renders the correct PNG URL for given mediaId + slideIndex
- [ ] Missing media renders black screen without error thrown
- [ ] `PresentationApp` renders `SlideshowRenderer` when `currentItem.itemType === 'slide_show'`
- [ ] Vitest: `SlideshowRenderer` renders correct `src` attribute for slideIndex 0 and 5
- [ ] Vitest: missing mediaId renders `<div className="...bg-black...">` placeholder (no crash)
- [ ] Gate: `npx vitest run` green

**Tests:** component
**Gate:** quick
**Commit:** `feat(presentation): P5-05 — SlideshowRenderer + PresentationApp wiring`

---

### T6: SlideshowSetItemEditor + set builder integration + PDF home button [P]

**What:**
1. New `SlideshowSetItemEditor` component (display name, slide count, first-slide thumbnail).
2. Add "Apresentação" to the set builder item-type picker — click opens a file dialog, runs import, creates set item.
3. Wire the PDF home button in `HomeSetBuilder` to the same import flow.
4. Listen to `conversion_progress` event while importing to show/hide a spinner.

**Where:**
- `src/components/set/SlideshowSetItemEditor.tsx` (new)
- `src/components/set/SetBuilder.tsx` — add "Apresentação" option to item-type add flow
- `src/components/setbuilder/HomeSetBuilder.tsx` — remove `disabled` from PDF button; add import handler
- `src/api/commands.ts` — add `onConversionProgress(cb)` event listener wrapper
- `src/i18n/locales/pt-BR.json` — keys: `slideshow.import`, `slideshow.importing`, `slideshow.slides`
- `src/i18n/locales/en-US.json` — same

**Depends on:** T3 (SlideShow type) + T4 (importPresentation API)

**SlideshowSetItemEditor:**
- Shows: display name (text), slide count (`${slideCount} slides`), thumbnail `<img src="asset://localhost/media/${thumbnailFile}" />`
- No settings to change (Phase 5: read-only editor)

**Import flow in HomeSetBuilder PDF button handler:**
```typescript
const handleImportPresentation = async () => {
  const file = await open({ filters: [{ name: 'Apresentação', extensions: ['pptx','pdf','ppt','odp'] }] });
  if (!file || !fixedSetId) return;
  setImporting(true);
  try {
    const media = await importPresentation(file as string);
    await addSetItem({ setId: fixedSetId, itemType: 'slide_show', mediaId: media.id });
  } catch (err) { console.error(err); }
  finally { setImporting(false); }
};
```

**SetBuilder "+ Apresentação" button:** Same import flow, but `setId` comes from the `setId` prop.

**Done when:**
- [ ] PDF home button is enabled; clicking opens file dialog
- [ ] After successful import, a `slide_show` item appears in the set with correct name + slide count
- [ ] While importing, the button shows a spinner and is disabled
- [ ] `SlideshowSetItemEditor` shows display name, slide count, first-slide thumbnail
- [ ] Vitest: import handler calls `importPresentation` then `addSetItem`
- [ ] Gate: `npx vitest run` green

**Tests:** component
**Gate:** quick
**Commit:** `feat(home): P5-06/P5-07 — SlideshowSetItemEditor + import flow + PDF button`

---

### T7: Gate — tests + STATE/ROADMAP update

**What:** Full gate pass: run all tests, manual smoke, update docs.

**Where:** `.specs/project/STATE.md`, `.specs/project/ROADMAP.md`

**Depends on:** T5, T6

**Done when:**
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` green (≥ existing + new)
- [ ] `npx vitest run` green (≥ existing + new)
- [ ] `tsc --noEmit` clean
- [ ] Manual smoke: import 3-slide PPTX → add to set → present → navigate all 3 slides
- [ ] Manual smoke: LibreOffice banner shows when soffice not on PATH
- [ ] STATE.md updated with Phase 5 completion
- [ ] ROADMAP.md Phase 5 marked Done

**Tests:** none (validation + docs)
**Gate:** full
**Commit:** `chore(phase5): P5 — STATE/ROADMAP completion summary`

---

## Parallel Execution Map

```
Phase 1:
  T1 [P]  (domain/media.rs + db/media.rs + migration)
  T2 [P]  (services/libreoffice.rs + banner)

Phase 2:
  T1 → T3  (SlideShow type + nav arm + TS enum)

Phase 3:
  T1, T2, T3 → T4  (import_presentation command)

Phase 4:
  T3       → T5 [P]  (SlideshowRenderer + PresentationApp)
  T3, T4   → T6 [P]  (SlideshowSetItemEditor + builders)

Phase 5:
  T5, T6 → T7  (gate)
```

---

## Test Co-location Matrix

| Task | Layer | Matrix Requires | Assigned |
|------|-------|----------------|---------|
| T1 | domain/media.rs, db/media.rs | unit | unit — extend existing test |
| T2 | services/libreoffice.rs, component | unit + component | unit (path resolution) + component (banner render) |
| T3 | domain/set.rs, domain/slide.rs, commands/presentation.rs | unit | unit (serialization round-trips) |
| T4 | commands/media.rs | none (command) | none — covered by libreoffice service tests |
| T5 | components, windows | component | component (SlideshowRenderer happy + missing) |
| T6 | components, stores | component | component (import flow handler) |
| T7 | docs only | none | none |

---

## Commit Plan

1. `feat(media): P5-01 — MediaKind::Presentation + slide_count + migration 006`
2. `feat(media): P5-02 — LibreOffice sidecar detection + LibreOfficeBanner`
3. `feat(set): P5-04 — SetItemType::SlideShow + pseudo_slideshow + navigation arm`
4. `feat(media): P5-03 — import_presentation command + conversion pipeline`
5. `feat(presentation): P5-05 — SlideshowRenderer + PresentationApp wiring`
6. `feat(home): P5-06/P5-07 — SlideshowSetItemEditor + import flow + PDF button`
7. `chore(phase5): P5 — STATE/ROADMAP completion summary`
