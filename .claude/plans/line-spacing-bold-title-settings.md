# Design — Line spacing & bold controls, title sizing, Settings tabs

Status: proposed · Date: 2026-06-01 · Branch target: feature branch off `main`

## Scope

Three connected changes:

1. **Feature** — Two new global appearance controls: *line spacing* (gap between
   lyric lines) and *bold level* (lyric font weight, **never** the title). Same
   two controls added to the announcement ("Aviso"/warn) configuration.
2. **Fix** — The title slide is rendered one size notch larger than lyrics. Make
   the title the **same size** as lyric lines, just **slightly bolder**.
3. **UX** — Adding controls makes the already-long `SettingsScreen` scroll worse.
   Reorganize Settings into **horizontal top tabs** so one section shows at a time.

No Rust/DB changes are required: the `settings` table is a generic key/value store
and `get_setting`/`set_setting` (`src-tauri/src/commands/settings.rs`) already pass
arbitrary keys through. New keys flow through unchanged — **no migration**.

---

## 1. New controls: line spacing + bold level

### New enum types (`src/types/index.ts`)

```ts
export type LineSpacing = 'tight' | 'normal' | 'relaxed' | 'loose';
export type BoldLevel   = 'normal' | 'medium' | 'semibold' | 'bold';
```

### Rendering maps (`src/components/presentation/layout.ts`)

Today lyric lines use the Tailwind classes `space-y-2` (inter-line gap) and
`leading-relaxed` (line-height), and weight `font-medium`. We replace these with
parametric inline styles driven by the new enums so they can be configured.

```ts
// Gap between separate lines (em, scales with font size) + line-height within a
// wrapped line. Defaults chosen so `normal` stays close to today's look.
export const LINE_SPACING: Record<LineSpacing, { lineHeight: number; gapEm: number }> = {
  tight:   { lineHeight: 1.15, gapEm: 0.20 },
  normal:  { lineHeight: 1.40, gapEm: 0.45 }, // ≈ current leading-relaxed + space-y-2
  relaxed: { lineHeight: 1.60, gapEm: 0.75 },
  loose:   { lineHeight: 1.85, gapEm: 1.10 },
};

export const BOLD_WEIGHT: Record<BoldLevel, number> = {
  normal: 400, medium: 500, semibold: 600, bold: 700, // matches `font-medium` default
};
```

`gapEm` is applied via a flex column (`display:flex; flexDirection:column;
gap: ${gapEm}em`) replacing the static `space-y-*` utility, so the gap is dynamic.
`lineHeight` and `fontWeight` are applied as inline styles on each `<p>`.

### Settings store (`src/stores/settings.ts`)

Add keys, state, setters, defaults, and load wiring (mirrors existing fields):

| Key constant | string key | default |
|---|---|---|
| `PRESENTATION_LINE_SPACING_KEY` | `presentation.line_spacing` | `normal` |
| `PRESENTATION_BOLD_LEVEL_KEY`   | `presentation.bold_level`   | `medium` |
| `ANNOUNCEMENT_LINE_SPACING_KEY` | `announcement.line_spacing` | `normal` |
| `ANNOUNCEMENT_BOLD_LEVEL_KEY`   | `announcement.bold_level`   | `medium` |

- Add the four keys to `PRESENTATION_SETTING_KEYS` so both windows hot-reload on
  change (the presentation window already listens and reloads on these).
- Add value arrays `LINE_SPACING_VALUES`, `BOLD_LEVEL_VALUES` for `parseEnum`.
- Add fields `presentationLineSpacing`, `presentationBoldLevel`,
  `announcementLineSpacing`, `announcementBoldLevel` + their setters.
- Extend `loadPresentationSettings()`'s `Promise.all` and `set({...})`.

### Carry through `ChipAppearance` (`src/components/presentation/SlideChip.tsx`)

```ts
export interface ChipAppearance {
  fontFamily: FontFamily;
  fontSize: FontSize;
  preset: BackgroundPreset;
  position: ScreenPosition;
  margin: Margin;
  lineSpacing: LineSpacing; // NEW
  boldLevel: BoldLevel;     // NEW
}
```

`ChipAppearance` is built from the settings store at **four sites** — each must
populate the two new fields:

- `src/windows/presentation/PresentationApp.tsx` (live projector)
- `src/components/presentation/LivePreview.tsx` (operator live preview)
- `src/components/library/SongEditor.tsx` (editor preview)
- `src/components/presentation/StrophesGrid.tsx` (operator grid)

(`SongPreviewPane.tsx` receives `appearance` as a prop — no change.)

### Renderers that consume it

- **`SongSlideBody`** (`bodies.tsx`) — lyric branch: replace `space-y-2`/
  `leading-relaxed`/`font-medium` with flex-gap + inline `lineHeight`/`fontWeight`
  from `appearance.lineSpacing`/`appearance.boldLevel`. **Title branch untouched
  by bold/spacing** (handled in §2).
- **`SlideChip`** (`SlideChip.tsx`) — same change to its lyric branch so chips
  stay faithful to the live slide.
- **`WarningBody`** (`bodies.tsx`) and **`AnnouncementRenderer`**
  (`AnnouncementRenderer.tsx`) — read `announcementLineSpacing`/
  `announcementBoldLevel` from the store and apply the same inline styles
  (replacing their static `leading-relaxed`/`font-medium`).

---

## 2. Fix: title same size as lyrics, slightly bolder

Currently (in both `bodies.tsx` and `SlideChip.tsx`) the title uses
`PREVIEW_SIZE_PX[stepSize(fontSize, +1)]` and class `font-bold`.

Change:

- **Size:** title uses the **lyric size** — `PREVIEW_SIZE_PX[appearance.fontSize]`
  (drop the `stepSize(+1)`).
- **Weight:** title is **one step bolder than the lyric bold level**, so it always
  reads as "slightly bolder" regardless of the configured lyric weight:

  ```ts
  // layout.ts
  export const titleWeight = (b: BoldLevel) => Math.min(BOLD_WEIGHT[b] + 100, 800);
  ```

  Title is **not** governed by the lyric bold control directly — it derives from it.
- **Author line:** keep it subordinate. Today the two renderers disagree
  (`bodies.tsx` uses `stepSize(-1)`, `SlideChip.tsx` uses the lyric size). Unify
  both to `stepSize(-1)` so the author stays a notch below the (now lyric-sized)
  title in every preview. Update the stale comment in `layout.ts` (lines 40–42)
  that documents the old "title one notch above" rule.

---

## 3. Settings reorganized into horizontal top tabs

`SettingsScreen.tsx` is one vertical stack of cards: General, Windows,
Song appearance, Announcement, Key bindings, CCLI report, About. New controls make
this worse. Replace with a top tab bar; one panel visible at a time, panel area
scrolls independently.

### Tabs

| Tab id | Contents (existing cards) |
|---|---|
| `general` | General (language) + Windows (monitor, camera URL) |
| `projection` | Song appearance (incl. new line-spacing + bold-level rows) |
| `announcement` | Announcement (incl. new line-spacing + bold-level rows) |
| `keybindings` | Key bindings |
| `reports` | CCLI report |
| `about` | Update check / about |

### Approach

- Add `const [activeTab, setActiveTab] = useState<TabId>('general')`.
- Render a `role="tablist"` bar of buttons (reuse the existing pill button styles
  already in `ButtonGroup`); each `role="tab"` with `aria-selected`.
- Move each existing card's JSX into a small panel block selected by `activeTab`
  (a `switch`/object map; the reusable `ButtonGroup`/`BoolToggle`/`PositionGrid`
  helpers are unchanged).
- Keep the outer `overflow-y-auto` on the panel container so long panels (key
  bindings) still scroll, but the page no longer scrolls through *every* section.
- Optional niceties (low priority): horizontal scroll/wrap for the tab bar on
  narrow widths; remember last tab in a `ui.settings_tab` setting.

### New i18n keys (`src/i18n/locales/en-US.json` + `pt-BR.json`)

```jsonc
"settings": {
  "tabs": {
    "general": "General",        // pt: "Geral"
    "projection": "Projection",  // pt: "Projeção"
    "announcement": "Announcement", // pt: "Aviso"
    "keybindings": "Shortcuts",  // pt: "Atalhos"
    "reports": "Reports",        // pt: "Relatórios"
    "about": "About"             // pt: "Sobre"
  },
  "appearance": {
    "lineSpacing": "Line spacing",            // pt: "Espaçamento entre linhas"
    "lineSpacings": { "tight": "Tight", "normal": "Normal", "relaxed": "Relaxed", "loose": "Loose" },
    "boldLevel": "Bold level",                // pt: "Nível de negrito"
    "boldLevels": { "normal": "Normal", "medium": "Medium", "semibold": "Semibold", "bold": "Bold" }
  }
}
```
(pt-BR: `tight/normal/relaxed/loose` → `Estreito/Normal/Relaxado/Amplo`;
`normal/medium/semibold/bold` → `Normal/Médio/Semi/Forte`.)

---

## Files touched

| File | Change |
|---|---|
| `src/types/index.ts` | add `LineSpacing`, `BoldLevel` |
| `src/components/presentation/layout.ts` | add `LINE_SPACING`, `BOLD_WEIGHT`, `titleWeight`; fix stale comment |
| `src/stores/settings.ts` | 4 keys, state, setters, defaults, load, value arrays, hot-reload list |
| `src/components/presentation/SlideChip.tsx` | extend `ChipAppearance`; title size/weight; lyric spacing/weight |
| `src/components/presentation/bodies.tsx` | `SongSlideBody` title + lyric; `WarningBody` spacing/weight |
| `src/components/presentation/AnnouncementRenderer.tsx` | spacing/weight from announcement settings |
| `PresentationApp.tsx`, `LivePreview.tsx`, `SongEditor.tsx`, `StrophesGrid.tsx` | populate 2 new `ChipAppearance` fields |
| `src/components/settings/SettingsScreen.tsx` | top-tab reorg + 2 new control rows in Projection & Announcement |
| `src/i18n/locales/{en-US,pt-BR}.json` | tabs + lineSpacing/boldLevel labels |

Tests to update: `SlideContent.test.tsx` (`defaultAppearance` gains 2 fields),
`bodies.test.tsx` (title size now == lyric, weight assertions), `settings.test.ts`
(load/set new keys), `SettingsScreen.test.tsx` (tab switching shows/hides panels).

---

## Implementation order

1. Types + `layout.ts` maps/helpers (no behavior change yet).
2. `bodies.tsx` + `SlideChip.tsx`: title sizing fix (§2) — standalone, verifiable.
3. Settings store: keys/state/load.
4. Wire `ChipAppearance` build sites + renderers for spacing/bold (§1).
5. Announcement renderers for spacing/bold (§1).
6. `SettingsScreen` top-tab reorg + new control rows (§3).
7. i18n keys (both locales).
8. Update tests; `npx vitest` + `cargo test`.
9. Manual check on two monitors per CLAUDE.md (monitor ordering caveat).

## Risks / notes

- **Two renderers must stay in sync** (`bodies.tsx` live vs `SlideChip.tsx`
  chips). The shared `layout.ts` maps are the single source of truth — keep all
  numeric values there, not inline.
- **Default must not change today's look** — `normal`/`medium` are tuned to
  approximate current `leading-relaxed` + `space-y-2` + `font-medium`. Verify the
  visual diff on existing songs is negligible after the change.
- i18n key-completeness test (`src/tests/i18n/key-completeness.test.ts`) enforces
  both locales define the same keys — add to both.
```
