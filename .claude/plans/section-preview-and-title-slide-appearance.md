# Plan & Design — Section Preview + Title/Author Slide Appearance

Two changes to Trinity Lyrics v2, both **frontend-only** (no Rust, no schema, no IPC changes):

1. **Section preview** — show a little live "mini-slide" preview of each section while it's being edited in the song library.
2. **Title/author slide appearance** — make the song name + author intro slide honor the global **font size** and **screen position** settings instead of being hard-coded to centered / xxl / md.

---

## Current behavior (findings)

### Slide appearance pipeline
- Global appearance lives in `useSettingsStore`: `presentationFontFamily`, `presentationFontSize`, `presentationPreset`, `presentationPosition`, `presentationMargin` (`src/stores/settings.ts:68-72`).
- The maps that turn those enums into CSS are the single source of truth in `src/components/presentation/layout.ts`: `FONT_CLASS`, `SIZE_STYLE` (`sm`…`xxl`), `POSITION_CLASS` (9-point anchors), `MARGIN_CLASS`, `PRESET_COLORS`.
- The real presentation slide is rendered by `SongSlide` in `src/windows/presentation/PresentationApp.tsx:55-130`.
- Slides are generated in pure Rust (`slide_splitter::split_with_casing`, `src-tauri/src/services/slide_splitter.rs`): one written line = one display line, blank line forces a boundary, break at `max_lines` (default **4**, `src-tauri/src/domain/slide.rs:66`), repetition is either duplicated or annotated with `(Nx)`.

### Problem #2 — title slide ignores settings
In `PresentationApp.tsx`:
```ts
const TITLE_SIZE  = SIZE_STYLE.xxl;   // line 37 — hard-coded
const AUTHOR_SIZE = SIZE_STYLE.md;    // line 38 — hard-coded
...
isTitle ? POSITION_CLASS.center : POSITION_CLASS[appearance.position]  // line 87 — forced center
```
So when `isTitle` (section label === `TITLE_SLIDE_LABEL` = `"__title__"`, `slideMeta.ts:5`):
- position is forced to **center**, ignoring `appearance.position`;
- title text is always **xxl**, author always **md**, ignoring `appearance.fontSize`.

Lyric slides (the `else` branch) already use `appearance.position` + `appearance.fontSize` correctly.

### Problem #1 — no preview in the editor
- `SongEditor.tsx` renders a list of `SectionCard`s (`src/components/library/SectionCard.tsx`). A card is just label/type/repeat/notes + a `<textarea>` for the body. There is **no** visual indication of how the section will look on screen.
- The operator's `LivePreview.tsx` already proves the pattern (a scaled text-only slide thumbnail) but it is wired to the live `presentation` store, not to editor draft state, and it always centers content + uses fixed tiny font sizes (it's a thumbnail, not faithful to position/size).
- There is **no TS port** of the slide splitter or the casing transform yet — both currently live only in Rust.

---

## Design

### Shared piece: a faithful "slide chip" + a TS slide-splitter port

To make both features faithful and avoid duplicating CSS logic, introduce one small reusable renderer plus a tiny TS splitter that mirrors the Rust rules.

**New file: `src/utils/slidePreview.ts`**
- `applyCasing(line: string, casing: TextCasing): string` — port of `TextCasing::apply` (normal/upper/lower/title). Title-case lowercases then capitalizes each word.
- `splitSectionBody(body: string, opts: { maxLines?: number; casing?: TextCasing; repeatCount?: number; repeatMode?: RepeatMode }): string[][]` — port of `slide_splitter::split_with_casing`:
  - blank line ⇒ boundary, break at `maxLines` (default 4),
  - `repeatMode === "annotate"` ⇒ append `(Nx)` to the section's last slide; `"duplicate"` ⇒ repeat the slide array `repeatCount` times.
  - Returns an array of slides, each slide an array of display lines.
- Keep this intentionally small and **unit-tested against the same cases as the Rust tests** so the two stay in sync (note in a comment that Rust remains the source of truth for the live presentation; this port is preview-only).

**New file: `src/components/presentation/SlideChip.tsx`**
A presentational, self-contained mini-slide that takes explicit appearance props (not the live store) so it can render editor drafts:
```ts
interface SlideChipProps {
  lines: string[];
  variant: "title" | "lyric";
  appearance: Appearance;            // fontFamily, fontSize, preset, position, margin
  background?: BackgroundInfo;       // optional per-song media bg
  authorLine?: string;              // title variant only
}
```
- Reuses `FONT_CLASS`, `SIZE_STYLE`, `POSITION_CLASS`, `MARGIN_CLASS`, `PRESET_COLORS` from `layout.ts` — no new styling constants.
- Renders inside an `aspect-video` box; scale the type down with a CSS `transform: scale()` or by wrapping in a container with `font-size` based on `em`, so the `clamp()` sizes read as proportional within the chip rather than full-screen. (Simplest robust approach: render at a fixed virtual width with `transform: scale(chipWidth / virtualWidth)` so `vw`-based `clamp()` values stay proportional — same trick used by slide-thumbnail libraries.)
- This becomes the single faithful slide renderer that `SongSlide` (presentation) and the editor preview can both conceptually share. Minimum scope: use it for the editor preview now; optionally refactor `SongSlide`/`LivePreview` onto it later (out of scope unless we want the dedup).

### Feature #1 — section preview in the editor

**`SectionCard.tsx`**
- Add a collapsible preview region below the body `<textarea>` (default collapsed; toggle with an `Eye` lucide icon next to the existing notes toggle, persisted in component state like `notesOpen`).
- When open, compute slides with `splitSectionBody(section.body, { maxLines: 4, casing, repeatCount: section.repeatCount, repeatMode })` and render one `SlideChip variant="lyric"` per slide in a horizontally scrollable row (`flex gap-2 overflow-x-auto`), each ~160px wide `aspect-video`. Show a small "slide N/total" caption.
- Empty body ⇒ render nothing (or a muted "nothing to preview" hint), matching the splitter returning `[]`.

**`SongEditor.tsx`**
- The card needs appearance + casing + repeat mode + background to render faithfully. Thread these down as props to `SectionCard`:
  - `appearance` built from `useSettingsStore` (same five fields `PresentationApp` uses).
  - `casing` = the editor's current `textCasing` state (live, so toggling casing updates previews instantly).
  - `repeatMode` = `presentationRepeatMode` from settings.
  - `background` resolved from the editor's `backgroundId`/`backgroundMode`/`scrimOpacity` against `media` (build a `BackgroundInfo` like `LivePreview` does for countdown bg, `LivePreview.tsx:160-168`), so a per-song media background shows behind the preview.
- Pull `presentationFontFamily/Size/Preset/Position/Margin` + `presentationRepeatMode` from the settings store (already loaded app-wide via `loadPresentationSettings`).

**i18n**
- Add keys: `sectionCard.preview.toggle`, `sectionCard.preview.empty`, `sectionCard.preview.slideCounter` (`{{n}}/{{total}}`) to every locale file under `src/i18n/locales/*`.

### Feature #2 — title/author slide follows font size & position

**`PresentationApp.tsx`** (`SongSlide`):
- Remove the forced `POSITION_CLASS.center`; always use `POSITION_CLASS[appearance.position]` for the outer flex container (title and lyric alike).
- Replace the hard-coded `TITLE_SIZE`/`AUTHOR_SIZE` constants with sizes derived from `appearance.fontSize`:
  - **Title** = one notch *larger* than the configured size, for emphasis, but still scaling with the setting.
  - **Author** = the configured size. Add stepping helpers in `layout.ts`:
    ```ts
    export const FONT_SIZE_ORDER: FontSize[] = ["sm","md","lg","xl","xxl"];
    export const stepSize = (s: FontSize, by: number): FontSize => {
      const i = FONT_SIZE_ORDER.indexOf(s);
      return FONT_SIZE_ORDER[Math.min(FONT_SIZE_ORDER.length - 1, Math.max(0, i + by))];
    };
    ```
    Title size = `SIZE_STYLE[stepSize(appearance.fontSize, +1)]`, author size = `SIZE_STYLE[appearance.fontSize]`.
    (At `xxl` the title clamps to `xxl` since there's no larger step — acceptable.)
- The `text-*` alignment already comes from `POSITION_CLASS`, so left/right anchors will now read correctly for the title block too.

**`LivePreview.tsx`** (operator thumbnail) and the new **`SlideChip`**: apply the same rule (position from settings, title = configured size, author one step down) so the operator preview and editor preview match the projector. For `LivePreview` this is a small change to `SongSlidePreview` (currently always centered, fixed `text-sm`/`text-[10px]`); honoring position there is optional polish — call it out but keep it low-risk by reusing `POSITION_CLASS`.

**Decision (confirmed):** title = one notch *larger* than the configured size for emphasis (clamped at `xxl`), author = the configured size. Both scale with the font-size setting and honor the position setting.

---

## Files touched

| File | Change |
|---|---|
| `src/components/presentation/layout.ts` | add `FONT_SIZE_ORDER` + `stepSize` |
| `src/windows/presentation/PresentationApp.tsx` | title slide uses `appearance.position` + sized from `appearance.fontSize` |
| `src/components/presentation/LivePreview.tsx` | mirror title sizing/position (polish) |
| `src/utils/slidePreview.ts` | **new** — TS port of splitter + casing |
| `src/components/presentation/SlideChip.tsx` | **new** — faithful scaled mini-slide |
| `src/components/library/SectionCard.tsx` | preview toggle + chip row |
| `src/components/library/SongEditor.tsx` | thread appearance/casing/repeat/background to cards |
| `src/i18n/locales/*` | preview strings |

## Tests
- `src/utils/slidePreview.test.ts` — port the Rust splitter cases (blank-line boundary, max_lines=4, duplicate vs annotate `(Nx)`, casing upper/lower/title, empty body).
- Extend `SongEditor.test.tsx` / a new `SectionCard.test.tsx` — preview toggles open, renders one chip per slide, updates when body/casing change, renders nothing for empty body.
- `cargo test` unchanged (no Rust touched) but keep it green as a guard.

## Risks / notes
- **Splitter drift:** the TS port duplicates Rust logic. Mitigate with mirrored unit tests + a comment marking Rust as source of truth. Preview-only, so a small divergence is cosmetic, never affects projection.
- **Scaling fidelity:** `clamp()` sizes use `vw`; inside a small chip they need the scale-transform trick to look proportional. Verify visually.
- **Per-architecture rule:** all slide *generation* stays in Rust for the live path; the TS splitter is strictly for editor preview and is documented as such (does not violate "no slide logic in the frontend" for the presentation path).
- Two-window invariant untouched: preview is operator-only, read-only, no mutating commands.

## Suggested commit slices
1. `feat(layout): derive title-slide size from settings + honor position` (#2, smallest, high value).
2. `feat(preview): TS slide-splitter port + SlideChip` (shared infra + tests).
3. `feat(editor): per-section live preview in SongEditor` (#1, wires it together + i18n).
