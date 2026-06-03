# Plan: Linux presentation placement, song text size, Welcome icons, countdown positioning

## Context

Four issues/features, mostly Linux-facing, in Trinity Lyrics v2 (Tauri 2 + React):

1. **Linux: presentation opens on the wrong monitor.** On Linux/WSLg the presentation
   window always lands on the primary monitor instead of the secondary one.
2. **No global way to change song text size.** A per-song size exists (sm/md/lg/xl in the
   Song editor), but there is no app-wide default. The user wants a global default size.
3. **"Welcome" (Set item list) icons don't render on Linux** — only song (Music) and media
   (Film/Image) show; countdown/web/slideshow/blank icons are blank.
4. **Countdown can only be centered.** The user wants to anchor the counter to edges/corners.

---

## Item 1 — Linux presentation monitor placement

**Root cause.** `enter_presentation` (`src-tauri/src/commands/window.rs:149`) builds the
window non-fullscreen, then `window.set_position()` + `window.set_fullscreen(true)`
(lines 207–230). On Linux/Wayland (WSLg) a client **cannot position its own top-level
window** — `set_position` is silently ignored — so the window stays on the primary monitor
and then fullscreens there. The existing code already anticipated this but the
position+fullscreen sequence is not honored by the compositor.

**Fix.** On Linux, fullscreen directly onto the *target monitor* using GTK's
`gtk_window_fullscreen_on_monitor`, which is the canonical X11/Xwayland way to put a
fullscreen window on a specific monitor (it does not rely on client positioning).

- Add a `#[cfg(target_os = "linux")]` branch in `enter_presentation` after the window is
  built. Get the GTK handle via `window.gtk_window()` (Tauri exposes this on Linux), get the
  `gdk::Screen`, and call `fullscreen_on_monitor(&screen, target_idx as i32)` using the
  resolved `target_idx`. Keep the existing `set_position` + `set_fullscreen(true)` path as
  the non-Linux (and fallback) behavior.
- Add the `gtk` crate (and `gdk`, already pulled in transitively by Tauri's Linux backend)
  under `[target.'cfg(target_os = "linux")'.dependencies]` in `src-tauri/Cargo.toml`.
- Keep `resolve_target_index` / `filter_real_monitors` as-is — they already compute the
  correct monitor index; we only change *how* fullscreen is applied on Linux.
- Note the GTK monitor index ordering can differ from `available_monitors()` ordering
  (OS-dependent, per CLAUDE.md). The manual `MonitorPicker` override remains the escape
  hatch; verify ordering on real two-monitor hardware.

**Files:** `src-tauri/src/commands/window.rs`, `src-tauri/Cargo.toml`.

---

## Item 2 — Global default song text size

**Current.** `SongSlide` in `src/windows/presentation/PresentationApp.tsx:59` resolves size
as `SIZE_STYLE[background?.typography?.fontSize ?? "lg"]` — the `"lg"` literal is the only
global default. Settings are a generic key/value store (`get_setting`/`set_setting` in
`src-tauri/src/commands/settings.rs`), and the settings Zustand store
(`src/stores/settings.ts`) already follows a load-on-mount + setter pattern (see
`cameraUrl`).

**Approach.** Add a persisted global default `FontSize`, edited in Settings, used as the
fallback in the presentation renderer when a song doesn't override it.

- **Store** (`src/stores/settings.ts`): add `presentationFontSize: FontSize` (default
  `"lg"`), `loadPresentationFontSize()` (reads `getSetting("presentation.font_size")`), and
  `setPresentationFontSize(size)` (optimistic `set` + `setSetting`). Reuse the `FontSize`
  type from `src/types`.
- **Settings UI** (`src/components/settings/SettingsScreen.tsx`): add a 4-button
  size selector (sm/md/lg/xl) in the existing "windows"/presentation card, mirroring the
  `FONT_SIZE_OPTIONS` pattern already used in `src/components/library/SongEditor.tsx`.
- **Renderer** (`src/windows/presentation/PresentationApp.tsx`): read
  `presentationFontSize` from the settings store and use it as the fallback instead of the
  hardcoded `"lg"` (`background?.typography?.fontSize ?? presentationFontSize`).
- **Live propagation across windows.** Settings currently don't propagate to the
  presentation window at runtime. Add a lightweight `setting_changed` event emitted from
  `set_setting` (`src-tauri/src/commands/settings.rs`), mirroring the existing
  `locale_changed` emit. Both windows already listen to all events; have the settings store
  expose a subscribe helper (or PresentationApp listen) to refresh `presentationFontSize`.
  On mount, both `OperatorApp` and `PresentationApp` call `loadPresentationFontSize()`.

No DB migration needed — the `settings` table already exists.

**Files:** `src/stores/settings.ts`, `src/components/settings/SettingsScreen.tsx`,
`src/windows/presentation/PresentationApp.tsx`, `src/windows/operator/OperatorApp.tsx`,
`src-tauri/src/commands/settings.rs`, plus i18n strings in `src/i18n/index.ts`.

---

## Item 3 — "Welcome" / Set item list icons not rendering on Linux

**Investigation result (important).** All item icons already render through one component,
`ItemTypeIcon` (`src/components/presentation/itemMeta.tsx`), using **lucide-react SVG** for
every type (Music, Film, Image, Timer, Globe, FileText, Square). I verified:

- lucide-react is the official package at `1.17.0` (npm `latest`), not a bad fork.
- Every icon resolves correctly via **both** CJS and ESM, and each renders **structurally
  identical** SVG (same `path`/`circle`/`rect`/`line` primitives, same `currentColor`
  stroke). There is **no package- or markup-level difference** between the icons that show
  (Music/Film/Image) and those that don't (Timer/Globe/FileText/Square).
- The source has no leftover emoji/Unicode glyphs, and every item-icon call site goes
  through `ItemTypeIcon`.

Because the code is already correct and uniform, a per-icon failure cannot be reproduced
statically — it points to either a **stale build** (the icon migration in commit `5fe4e25`
not present in the binary the user tested) or a **WebKitGTK runtime quirk**.

**Approach — verify first, then harden:**

1. **Reproduce on a fresh Linux build** (`npm run tauri dev` / `build`) and inspect the live
   DOM in WebKitGTK devtools for one failing icon: confirm whether the `<svg>` is present
   but invisible (CSS/color/size) vs. missing entirely (build/tree-shaking).
2. If it's a **stale build**, no code change is needed — rebuilding resolves it; confirm and
   close.
3. If the `<svg>` is present but invisible, **harden `ItemTypeIcon`** by passing explicit
   `color="currentColor"`, an explicit numeric `size`, and `absoluteStrokeWidth`, and ensure
   the wrapping element sets a concrete color (avoid relying on inherited `text-muted` alone).
4. If icons are genuinely missing in the WebKitGTK bundle, switch these icons to a
   guaranteed-inline path: import each from its concrete subpath
   (`lucide-react/dist/esm/icons/<name>`) or inline the SVG nodes, removing any
   barrel/tree-shaking ambiguity in the Linux build.

This item is intentionally diagnostic — confirm category (1/3/4) on hardware before applying
a code change, since the current source is already correct.

**Files (if a fix is needed):** `src/components/presentation/itemMeta.tsx` (and possibly
`vite.config.ts` for optimizeDeps on lucide).

---

## Item 4 — Countdown edge/corner positioning

**Current.** `CountdownRenderer` (`src/components/presentation/CountdownRenderer.tsx:18`)
hardcodes `items-center justify-center`. `CountdownConfig`
(`src-tauri/src/domain/countdown.rs:37`) has no position field and uses a **custom
`Deserialize`** (lines 45–83) for backward compatibility — a new field must be parsed there
with a default.

**Approach.** Add an optional 9-position anchor to the countdown config, edited in the
countdown editor, applied as flex alignment classes in the renderer.

- **Domain** (`src-tauri/src/domain/countdown.rs`): add `position: CountdownPosition` to
  `CountdownConfig`, with a new enum (`TopLeft … Center … BottomRight`, 9 values,
  `serde(rename_all = "kebab-case")`). Parse it in the custom `Deserialize` with
  `.unwrap_or(CountdownPosition::Center)` so existing saved configs keep working; add it to
  the `Serialize` struct. Extend the round-trip tests (default-to-center on legacy JSON).
- **Frontend type** (`src/types/index.ts`): add `position?: CountdownPosition` to
  `CountdownConfig` and the `CountdownPosition` union.
- **Editor** (`src/components/set/CountdownSetItemEditor.tsx`): add a 3×3 position-grid
  picker; include `position` in `buildConfig()`.
- **Renderer** (`src/components/presentation/CountdownRenderer.tsx`): map the position to
  Tailwind `justify-*`/`items-*` classes (e.g. a lookup `POSITION_CLASS[position]`) on the
  inner flex container, plus edge padding. Default to center when unset. Reuse this same
  mapping pattern that `SongSlide` uses for alignment.
- (Optional, confirm with scope) the **idle global countdown** in `PresentationApp.tsx:154`
  is a separate, config-less path that stays centered; this feature targets the configured
  countdown set item.

**Files:** `src-tauri/src/domain/countdown.rs`, `src/types/index.ts`,
`src/components/set/CountdownSetItemEditor.tsx`,
`src/components/presentation/CountdownRenderer.tsx`, plus i18n strings.

---

## Verification

- **Rust:** `cargo test --manifest-path src-tauri/Cargo.toml` (countdown serde round-trips,
  window helpers). Confirm Linux build compiles with the new `gtk`/`cfg(linux)` branch.
- **Frontend:** `npx vitest` (settings store, countdown editor/renderer).
- **Manual on Linux with two monitors (critical, per CLAUDE.md):**
  - Item 1: load a set, Present → window appears fullscreen on the secondary monitor; test
    auto-detect and the manual MonitorPicker override.
  - Item 3: open a set containing countdown/web/slideshow/blank items → all type icons
    render in the set list.
- **Manual (any OS):**
  - Item 2: change the global size in Settings → present a song with no per-song size → text
    uses the new default; presentation window updates live after the change.
  - Item 4: set each of the 9 countdown positions → digits anchor to the chosen
    corner/edge; reload an old saved countdown → still centered (backward compat).
