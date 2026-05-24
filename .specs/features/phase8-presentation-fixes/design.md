# Phase 8 — Design

**Created:** 2026-05-23
**Status:** Drafted
**Spec:** [spec.md](spec.md) (8 requirements P8-01..P8-08)
**Codebase:** Tauri 2.11.2, React 18, sqlx 0.8 (verified `Cargo.lock`)

---

## 1. Architectural Overview

Phase 8 is a fix-up pass, not a redesign. Most stories are localised changes inside existing files; only P8-07 (background presets) adds new schema/columns and touches the renderer contract. No new IPC commands or windows. No changes to the 3-pane operator shell shipped by Phase 7.

Three classes of change:

1. **Bug-fix correctness** (P8-01, P8-02, P8-03, P8-04, P8-05, P8-06 image-presents-half) — point edits in existing Rust commands, the keyboard runtime, and one URL builder.
2. **Pipeline gap-closing** (P8-06 thumbnails) — a UI affordance + a banner-driven hint when ffmpeg is missing.
3. **Schema + domain extension** (P8-07) — one migration, two new columns on `song_sections` and `songs`, new `BackgroundConfig` variant, three-tab `BackgroundPicker` UI.

```
┌─────────────────────────────────────────────────────────────────────┐
│ AppState.presentation (RwLock<PresentationState>) ─ single source   │
│                                                                     │
│   mutations: next_slide │ prev_slide │ go_to_item │ set_mode │      │
│              load_set   │ exit_presentation       │ set_overlay     │
│                                                                     │
│   ALL of them must:                                                 │
│     1) drop the write lock BEFORE app.emit("state_changed")         │
│     2) call app.emit (not window.emit) so BOTH windows receive it   │
│                                                                     │
│   Phase 8 audit confirms (1) holds; verifies (2); adds tracing.     │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼ Tauri event (broadcast)
                  ┌──────────────────────────────┐
                  │ usePresentationStore         │
                  │   subscribed in both windows │
                  └──────────────────────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
    operator window                  presentation window
    - OperatorPresentationLayout     - PresentationApp
    - SetItemList   click ────▶ go_to_item(idx, 0)
    - StrophesGrid  click ────▶ go_to_item(curIdx, slideIdx)
    - LivePreview   read-only
```

---

## 2. Root-Cause Confirmation (verified from code)

Reading the actual Rust + React code, the suspected root causes from the spec resolve as follows:

| Story | Suspected cause (spec) | Actual cause (verified) | Evidence |
|---|---|---|---|
| P8-01 | broadcast vs lock-holding vs closure-staleness | Closure-staleness in `StrophesGrid.tsx:133`; lock pattern is already correct in Rust | `presentation.rs:131-134, 301-306, 338-343` drop locks before emit; `app.emit` broadcasts in Tauri 2 |
| P8-03 | serialization gap | `SetItem` already carries `countdown_config: Option<CountdownConfig>`; gap is in **media URL** for the optional background, not in config | `domain/set.rs:43`; `commands/presentation.rs:181` emits `Slide::pseudo("countdown")` correctly |
| P8-04 | `w.close()` blocking under write-lock | `w.close()` IS called BEFORE the write lock (line 201–203), so it isn't blocking the lock; freeze comes from **double-dispatch race** between operator and projection keydown handlers + projection-window unmount tearing down `<video>` mid-state-event | `window.rs:197-220`; `runtime/keyboard.ts:65-75`; `PresentationApp.tsx:95-104` |
| P8-06 | `useMediaStore` not loaded in time | Real cause: **wrong URL scheme**. Code uses `asset://localhost/media/…` in 5+ places; Tauri 2 on Windows requires `http://asset.localhost/media/…` (docstring at `protocol/asset.rs:8` confirms) | `LivePreview.tsx:31`; `PresentationApp.tsx:28`; `domain/background.rs:26 (test)`; `services/background.rs:39, 69` |
| P8-07 | n/a | section-level `background_id` column already exists (migration 005); the UI to edit it was lost in Phase 4/5 (regression) | `domain/song.rs:27`; `migrations/005_phase3.sql:11` |
| P8-08 | bottom button calls different command | Confirmed: `set/SetBuilder.tsx:246-258` `handleLoadForPresentation` only calls `loadSetForPresentation` + `setView("set-player")` — no `enterPresentation` | `set/SetBuilder.tsx:665-670` |

This changes the design significantly from the spec's hypotheses:

- **P8-06 becomes a URL-scheme bug fix**, not a media-pipeline timing fix. One-line change in 5 files.
- **P8-04 needs both a dedup guard AND a graceful projection-window unmount** — not just one.
- **P8-01 is mostly a frontend fix** in `StrophesGrid.tsx`; the Rust path is correct as-shipped.

---

## 3. Backend Changes

### 3.1 Asset URL scheme — single source of truth (P8-06 root cause)

**Problem.** `protocol/asset.rs:8` documents the URL format as `http://asset.localhost/media/filename.ext`. But `services/background.rs:39, 69` emit `asset://localhost/media/{fname}`. On Windows the `asset://` form does not resolve through the registered protocol handler — the WebView2 backend only resolves `http://asset.localhost/*` (see Tauri 2 Windows asset-protocol notes). Images, videos, and per-song backgrounds all 404 silently.

**Fix.** Introduce a single helper:

```rust
// src-tauri/src/protocol/asset.rs (new public fn)
pub fn url_for(file_name: &str) -> String {
    format!("http://asset.localhost/media/{file_name}")
}
```

Replace every `format!("asset://localhost/media/...")` in the Rust tree (background.rs, anywhere else found) with `asset::url_for(&fname)`. This standardises one scheme across the backend and gives us a place to swap if Tauri changes the convention.

**Frontend mirror.** Add `src/api/assets.ts`:

```ts
export function mediaUrl(fileName: string): string {
  return `http://asset.localhost/media/${fileName}`;
}
```

Replace every inline `asset://localhost/media/${fileName}` (LivePreview.tsx, PresentationApp.tsx, SongEditor.tsx, OperatorPresentationLayout.tsx, MediaDetailPanel.tsx, BackgroundPicker, etc.) with `mediaUrl(fileName)`. MediaCard already uses the correct form — it stays.

The `BackgroundInfo.asset_url` field continues to come from the backend; backend now emits the correct scheme, frontend renderers read it verbatim.

### 3.2 `exit_presentation` — idempotent + graceful (P8-04)

Current implementation `window.rs:197-220` works on the happy path but two failure modes cause the perceived freeze:

1. **Concurrent invocation.** Operator's hardcoded ESC handler AND the projection window's own keydown handler both fire `exit_presentation`. Two concurrent calls race for the write lock; second call may emit a duplicate `state_changed` after the window is gone.
2. **Mid-unmount state event.** `w.close()` is synchronous-but-async-completing. Right after it returns, we mutate state and emit `state_changed` — the still-alive projection window receives the event during its own teardown and tries to render `mode = idle`, which runs through `PresentationApp`'s idle branch (`Aguardando apresentação…`). React begins committing while the window is closing — observable as a visible hang for ~1–2 frames.

**Fix — Rust side.** Make the command itself idempotent by short-circuiting when already idle:

```rust
#[tauri::command]
pub async fn exit_presentation(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), ErrorPayload> {
    // Short-circuit: already idle AND window already gone → no-op.
    let already_idle = {
        let pres = state.presentation.read().await;
        pres.mode == PresentationMode::Idle && pres.overlay.is_none()
    };
    let window_gone = app.get_webview_window("presentation").is_none();
    if already_idle && window_gone {
        return Ok(());
    }

    // Mutate state BEFORE closing the window — projection window will not
    // observe a state_changed after it begins teardown.
    {
        let mut pres = state.presentation.write().await;
        pres.mode = PresentationMode::Idle;
        pres.frozen_at = None;
        pres.overlay = None;
    }
    let state_snapshot = state.presentation.read().await.clone();
    app.emit("state_changed", &state_snapshot)
        .map_err(|e| ErrorPayload::from(e.to_string()))?;

    // Now close the window (after the state event has been sent).
    if let Some(w) = app.get_webview_window("presentation") {
        w.close().map_err(|e| ErrorPayload::from(e.to_string()))?;
    }

    app.emit("presentation_lifecycle", PresentationLifecyclePayload { phase: "exited" })
        .map_err(|e| ErrorPayload::from(e.to_string()))?;
    tracing::info!("exit_presentation: completed");

    Ok(())
}
```

Two changes:
- Idempotency guard at the top.
- Reorder: state mutation + `state_changed` emit first, then `w.close()`. Both windows agree on the new state BEFORE the projection window starts tearing down.

**Fix — Frontend side.** Add a debounce in `src/api/commands.ts`:

```ts
let exitInflight: Promise<void> | null = null;
export const exitPresentation = () => {
  if (exitInflight) return exitInflight;
  exitInflight = invoke<void>("exit_presentation").finally(() => {
    exitInflight = null;
  });
  return exitInflight;
};
```

This coalesces concurrent calls into a single round-trip. The same-window double-press case is naturally handled by Rust's idempotency guard; this guards the cross-window race where operator and projection both fire simultaneously.

### 3.3 Tracing observability for state mutations (P8-01)

Add `tracing::info!` at every emit point in `commands/presentation.rs`:

```rust
async fn emit_state(app: &AppHandle, state: &PresentationState) -> Result<(), ErrorPayload> {
    tracing::info!(
        item = state.current_item_index,
        slide = state.current_slide_index,
        mode = ?state.mode,
        overlay = state.overlay.is_some(),
        "emit state_changed"
    );
    app.emit("state_changed", state)
        .map_err(|e| ErrorPayload::from(e.to_string()))
}
```

Centralised in the existing `emit_state` helper (`presentation.rs:88`) so every mutator gets it for free. No new dependencies — `tracing` is already in `Cargo.toml`.

### 3.4 No new IPC, no new commands

P8-01 is a frontend closure-staleness fix (§4.1 below). P8-02 and P8-03 are downstream of P8-01 + P8-06 URL fix. No backend command additions.

---

## 4. Frontend Changes

### 4.1 `StrophesGrid` click handler — live store read (P8-01)

`src/components/presentation/StrophesGrid.tsx:70-87` reads `currentItemIndex` once at render and closes over it in `SlideCard.onClick`:

```tsx
const currentItemIndex = state?.currentItemIndex ?? 0;
…
<SlideCard … onClick={() => goToItem(currentItemIndex, slideIdx).catch(console.error)} />
```

If the operator advances slides via keyboard between render and click, the closure fires with a stale `currentItemIndex`. More importantly, Zustand's selector subscription should have re-rendered the component — but if the state arrived during an event-loop tick where React's scheduler is busy, the click handler can run with the old closure. Defence:

```tsx
onClick={() => {
  const live = usePresentationStore.getState().state;
  const liveItemIdx = live?.currentItemIndex ?? 0;
  goToItem(liveItemIdx, slideIdx).catch(console.error);
}}
```

Same pattern for `SetItemList.tsx:22` (also reads `currentItemIndex` from the at-render store snapshot; the click handler should snapshot at click time).

This is the canonical Zustand pattern for "I need the latest value at the moment of an event, not at render time" — call `useStore.getState()` inside the handler. Documented in Zustand's FAQ.

### 4.2 `usePresentationStore.jumpToItem` — explicit default slideIndex (P8-01 AC 5)

`src/stores/presentation.ts:74-81`:

```ts
jumpToItem: async (itemIndex: number) => {
  try {
    const newState = await goToItem(itemIndex);  // ← second arg undefined
    set({ state: newState });
  } catch (err) { … }
},
```

`goToItem` in `src/api/commands.ts:236` is `(itemIndex: number, slideIndex?: number)` → `invoke("go_to_item", { itemIndex, slideIndex })`. When `slideIndex` is `undefined`, serde deserialises it as `None` on the Rust side; `go_to_item` in `presentation.rs:326` already handles that: `pres.current_slide_index = slide_index.unwrap_or(0)`. **The Rust side is correct.**

But to make intent explicit and remove the undefined-vs-null ambiguity, change the frontend signature:

```ts
jumpToItem: async (itemIndex: number) => {
  const newState = await goToItem(itemIndex, 0);
  set({ state: newState });
},
```

This is a small clarity-only change. Functionally equivalent.

### 4.3 ESC + Space keyboard rendering (P8-05)

The user reports a button labelled `ESCAPE/SPACE`. The codebase has no such literal — the closest match is `KeyBindingsScreen.tsx:171-185`, which renders the user's bound shortcuts as a row of `<Keycap>` boxes. The default `advanceSlide` binding is `[{key: " "}, {key: "ArrowRight"}]` and `exitPresentation` is `[{key: "Escape"}]`. If the user manually bound `Space` to `exitPresentation`, OR if a prior schema migration left both bindings, the row would render two cap boxes side-by-side. Visually that reads as `Escape Space`. The user describes it as `ESCAPE/SPACE`.

**Fix.** Three things:

1. **Audit the live `settings` row** for `key_bindings.exitPresentation` — confirm shipped default is `[{Escape}]` only. The migration at `005_phase3.sql:126` confirms it. If a user has a customised binding with Space added, the `READONLY_ACTIONS` set in `KeyBindingsScreen.tsx:31` should prevent edits, BUT old data may have leaked through. Reset `exitPresentation` to `[{Escape}]` at app boot if it deviates, since P7-02 made it readonly.

   ```ts
   // src/stores/keyBindings.ts (boot-time normalisation)
   if (bindings.bindings.exitPresentation?.length !== 1
       || bindings.bindings.exitPresentation[0].key !== "Escape") {
     // Force-reset the hardcoded action to its canonical binding.
     bindings.bindings.exitPresentation = [{ key: "Escape", ctrl: false, shift: false, alt: false }];
     await setKeyBindings(bindings);
   }
   ```

2. **Tweak `Keycap.tsx:13-17`** to render the special-cased `Escape` as `ESC`:

   ```ts
   const SPECIAL_LABELS: Record<string, string> = {
     "Escape": "ESC",
     " ": "Space",
     "ArrowRight": "→",
     "ArrowLeft": "←",
     "ArrowUp": "↑",
     "ArrowDown": "↓",
   };
   const keyLabel =
     SPECIAL_LABELS[shortcut.key] ??
     (shortcut.key.length === 1
       ? shortcut.key.toUpperCase()
       : shortcut.key.charAt(0).toUpperCase() + shortcut.key.slice(1));
   ```

3. **Hardcoded hint in projection idle screen.** If `PresentationApp.tsx`'s idle screen (`Aguardando apresentação…` at line 148) ever shows a close-hint, ensure it reads `ESC` only. Audit the current idle render — today it's just the text "Aguardando apresentação…" with no close hint, so no change needed. Document this in §6 Risk Register.

The `Grep "ESCAPE/SPACE" src/` test (P8-05 AC 2) passes by construction since no such literal exists; the real success criterion is the on-screen rendering after fix #1 + #2.

### 4.4 Bottom `Apresentar` button consolidation (P8-08)

`src/components/set/SetBuilder.tsx:246-258`:

```ts
const handleLoadForPresentation = async () => {
  if (!serviceSet) return;
  setIsLoading(true);
  try {
    await loadSetForPresentation(serviceSet.id);
    usePresentationStore.getState().syncState();
    setView("set-player");  // ← only switches view, no enterPresentation
  } catch (err) {
    console.error("load presentation failed:", err);
  } finally {
    setIsLoading(false);
  }
};
```

**Decision.** Hide the bottom button when `SetBuilder` is embedded inside `HomeSetBuilder` (which has its own top `Apresentar`). Keep it for the standalone `set-builder` view (entered from the Sets list) — but in that context, change its handler to call the unified `enterPresentation` path so the behaviour matches the top button.

**Implementation:**

```ts
// SetBuilder.tsx — extend Props
interface Props {
  setId: string | null;
  hideBack?: boolean;
  hidePresentButton?: boolean;   // ← new
}
```

```tsx
// HomeSetBuilder.tsx:261
<SetBuilder setId={fixedSetId} hideBack hidePresentButton />
```

Within `SetBuilder`, change `handleLoadForPresentation` to the unified flow:

```ts
const handleLoadForPresentation = async () => {
  if (!serviceSet || serviceSet.items.length === 0) return;
  setIsLoading(true);
  try {
    await loadSetForPresentation(serviceSet.id);
    await enterPresentation();
  } catch (err) {
    const payload = err as { code?: string; params?: Record<string, string> };
    setLoadError(t(`error.${payload.code ?? "unknown"}`, payload.params));
    setTimeout(() => setLoadError(null), 5000);
  } finally {
    setIsLoading(false);
  }
};
```

Dead-code cleanup: `currentView === "set-player"` branch in `OperatorApp.tsx:330-340` — verify no other code path can route to this view. If still reachable from external entry points (Sets list double-click), keep `set-player` as a "rehearsal" mode and leave `SlideController` mounted. Otherwise delete the view + the `SlideController` mount + its unit tests.

Search before deleting:

```bash
grep -rn 'set-player' src/
grep -rn '"set-player"' src/
```

Cleanup if zero results outside the dead view.

### 4.5 Set item-list click (P8-02)

Same closure-staleness fix as §4.1 — read store at click time. After §4.1 + §3.1 (URL scheme) lands, the existing `SetItemList.onClick` already dispatches `goToItem(idx, 0)` and the backend already does the right thing. P8-02 becomes a sanity-check, not a code change. The Vitest in `SetItemList.test.tsx` already asserts this behaviour; re-run after merge.

### 4.6 Countdown projection (P8-03)

After §3.1 (URL scheme fix) + §4.1 (closure fix), the countdown projection should "just work" — `PresentationApp.tsx:198-221` already mounts `<CountdownRenderer>` when `itemType === "countdown"`. The visible regression is most likely caused by `state_changed` not propagating (P8-01) AND/OR the countdown-background asset URL being wrong (`asset://`). Add a defensive guard for the no-config case (per AC 2):

```tsx
} else if (itemType === "countdown") {
  const cdConfig = currentItem?.countdownConfig;
  …
  content = cdConfig ? (
    <CountdownRenderer config={cdConfig} background={cdBackground} frozen={frozen} />
  ) : (
    <div className="h-screen bg-black flex items-center justify-center">
      <p className="text-white text-sm">Contagem regressiva não configurada</p>
    </div>
  );
}
```

The existing fallback is `<div className="h-screen bg-black" />` (silent black) — replace with the user-facing message.

### 4.7 Media thumbnail UI affordance (P8-06 AC 5)

When ffmpeg is missing, `services/thumbnail.rs::generate` returns `ToolMissing` and the import path stores `thumbnail_file = NULL` (line 142, `commands/media.rs`). `MediaCard.tsx:44-48` currently shows a generic `<Film>` icon — the user can't tell whether import failed, thumbnail is generating, or thumbnail just isn't supported.

Add a small label overlay:

```tsx
{thumbUrl ? (
  <img … />
) : (
  <div className="flex h-full flex-col items-center justify-center text-muted gap-1">
    <Film className="w-8 h-8" />
    {media.kind === "video" && (
      <span className="text-[10px] uppercase tracking-wide">
        {t("media.thumbPending")}
      </span>
    )}
  </div>
)}
```

i18n: `pt-BR: "Thumb pendente"`, `en-US: "Thumb pending"`. The `FfmpegBanner` already exists (`src/components/media/FfmpegBanner.tsx` — Phase 2-J) so the user already gets a top-level hint that ffmpeg is missing; this card-level hint complements it.

No backend change needed — the import already gracefully degrades when ffmpeg is absent (verified `commands/media.rs:135-148`).

---

## 5. Background Presets + Typography (P8-07)

This is the biggest piece of new design. Below is the full schema/domain/UI design.

### 5.1 Data model — single JSON column or discrete columns?

**Decision: discrete columns.** Reasoning:
- The fields (`mode`, `preset`, `font_family`, `font_size`) are bounded enums, not free-form
- SQLite has no JSON1 indexing in our build profile → JSON column hides query semantics
- Migration is simple: 4 `ALTER TABLE ADD COLUMN` per table (songs + song_sections), all with NULL default
- Existing `background_id` + `scrim_opacity` columns stay; preset mode just means `background_id IS NULL AND background_mode = 'preset'`

### 5.2 Migration `007_background_presets.sql`

```sql
-- migration 007: Phase 8 — background presets + typography
--
-- Adds preset-mode background + font controls to song-level AND section-level.
-- Existing `background_id` + `scrim_opacity` continue to power media-backed mode.
-- Default mode = NULL = inherit/legacy media mode (no behaviour change for existing rows).

ALTER TABLE songs           ADD COLUMN background_mode    TEXT;  -- 'preset' | 'media' | NULL (inherit/none)
ALTER TABLE songs           ADD COLUMN background_preset  TEXT;  -- 'preto-branco' | 'branco-preto' | NULL
ALTER TABLE songs           ADD COLUMN font_family        TEXT;  -- 'sans' | 'serif' | 'mono' | NULL
ALTER TABLE songs           ADD COLUMN font_size          TEXT;  -- 'sm' | 'md' | 'lg' | 'xl' | NULL

ALTER TABLE song_sections   ADD COLUMN background_mode    TEXT;
ALTER TABLE song_sections   ADD COLUMN background_preset  TEXT;
ALTER TABLE song_sections   ADD COLUMN font_family        TEXT;
ALTER TABLE song_sections   ADD COLUMN font_size          TEXT;
```

No CHECK constraints — validation happens in Rust deserialisation (enum-on-read). This keeps the migration trivially reversible and avoids SQLite CHECK gotchas.

### 5.3 Domain types

```rust
// src-tauri/src/domain/background.rs

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Copy)]
#[serde(rename_all = "kebab-case")]
pub enum BackgroundPreset {
    PretoBranco,   // bg #000000, fg #FFFFFF
    BrancoPreto,   // bg #FFFFFF, fg #000000
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Copy)]
#[serde(rename_all = "snake_case")]
pub enum FontFamily { Sans, Serif, Mono }

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Copy)]
#[serde(rename_all = "snake_case")]
pub enum FontSize { Sm, Md, Lg, Xl }

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Typography {
    pub font_family: FontFamily,
    pub font_size: FontSize,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundInfo {
    // Existing — kept for media backgrounds
    pub media_kind: Option<MediaKind>,
    pub asset_url: Option<String>,
    pub scrim_opacity: u8,
    pub restart_on_section_boundary: bool,
    // New — populated when mode = preset; None when mode = media
    pub preset: Option<BackgroundPreset>,
    // New — applies to ANY mode (preset or media)
    pub typography: Option<Typography>,
}
```

`media_kind` and `asset_url` become `Option<…>` so a pure preset background can omit them. Update all callers in `services/background.rs`, presentation renderers, and tests.

**Backwards compatibility.** Existing rows have `background_mode = NULL`. The resolver treats NULL as "media if `background_id` is set, else none" — exact current behaviour. No data migration needed.

### 5.4 Resolver — section → song → default

`services/background.rs::resolve_for_slide` already implements the section → song fallback. Extend it:

```rust
pub async fn resolve_for_slide(
    pool: &SqlitePool,
    song_id: &str,
    section_id: &str,
) -> Result<Option<BackgroundInfo>, sqlx::Error> {
    // 1. Section-level — read background_mode, background_preset, font_*, background_id
    // 2. If section.background_mode = 'preset' → return preset BackgroundInfo
    //    Else if section.background_id present → return media (existing logic)
    //    Else fall through to song-level
    // 3. Song-level — same logic, with restart_on_section_boundary = false
    // 4. None → caller renders default (black bg, white sans-lg text)
}
```

The default-when-None case (AC 5) is handled at the renderer: if `BackgroundInfo` is `None`, `SongSlide` falls back to `{ preset: PretoBranco, typography: { Sans, Lg } }` constants.

### 5.5 Frontend renderer changes

`src/components/presentation/SongBackground.tsx` becomes type-dispatched:

```tsx
export const SongBackground: React.FC<{ background: BackgroundInfo; frozen?: boolean }> = ({ background, frozen }) => {
  if (background.preset) {
    return <PresetBackground preset={background.preset} />;
  }
  if (background.assetUrl) {
    return <MediaBackground background={background} frozen={frozen} />;  // existing logic
  }
  return null;
};
```

`PresetBackground` is trivial:

```tsx
const PRESET_STYLES: Record<BackgroundPreset, { bg: string; fg: string }> = {
  "preto-branco": { bg: "#000000", fg: "#FFFFFF" },
  "branco-preto": { bg: "#FFFFFF", fg: "#000000" },
};

const PresetBackground: React.FC<{ preset: BackgroundPreset }> = ({ preset }) => (
  <div className="absolute inset-0" style={{ backgroundColor: PRESET_STYLES[preset].bg }} />
);
```

The lyric text colour comes from `state.background.preset` resolved in `PresentationApp.tsx::SongSlide`:

```tsx
const fg = background?.preset ? PRESET_STYLES[background.preset].fg : "#FFFFFF";
const fontClass = FONT_CLASS[background?.typography?.fontFamily ?? "sans"];
const sizeStyle = SIZE_STYLE[background?.typography?.fontSize ?? "lg"];
…
<p style={{ color: fg, ...sizeStyle }} className={fontClass}>{line}</p>
```

`FONT_CLASS` maps to Tailwind: `sans → font-sans`, `serif → font-serif`, `mono → font-mono` (all three already in Tailwind's defaults; no config change).
`SIZE_STYLE` maps to `clamp()` ranges: `sm → clamp(1rem, 2.5vw, 1.875rem)`, `md → clamp(1.25rem, 3.5vw, 2.5rem)`, `lg → clamp(1.5rem, 4vw, 3rem)` (current default), `xl → clamp(2rem, 5vw, 4rem)`.

The `LivePreview` mirrors the same logic via the shared `SongBackground` + `SongSlidePreview` (existing `LivePreview.tsx:38-71` already has this — extend it with preset + typography branches).

### 5.6 Song editor UI

`src/components/library/SongEditor.tsx` already has `BackgroundPicker` (lines 28-160) for media-only. Extend it into a tabbed component:

```
┌──────────────────────────────────────────────────────────────┐
│ Background                                                   │
│ [ Inherit | Preset | Media ]   ← three radio-tabs            │
│                                                              │
│ — Inherit mode (default for sections):                       │
│   "Uses song-level background"                               │
│                                                              │
│ — Preset mode:                                               │
│   ┌──────────┐ ┌──────────┐                                  │
│   │ ⬛ Aa    │ │ ⬜ Aa    │  ← two swatches                  │
│   │ Preto/   │ │ Branco/  │                                  │
│   │ Branco   │ │ Preto    │                                  │
│   └──────────┘ └──────────┘                                  │
│   Font:  [Sans] [Serif] [Mono]                               │
│   Size:  [Sm] [Md] [Lg] [Xl]                                 │
│                                                              │
│ — Media mode (existing picker):                              │
│   [ thumbnail | "Change" button ]                            │
│   Scrim:  [——————●———————] 35%                              │
└──────────────────────────────────────────────────────────────┘
```

Component split:
- `BackgroundModeTabs` — radio tab strip
- `BackgroundPresetTab` — two swatch buttons + font/size pickers
- `BackgroundMediaTab` — existing `BackgroundPicker` body, lightly refactored
- `BackgroundInheritTab` — single info text

Song-level and section-level use the same composite — only "Inherit" is meaningful at the section level (the song level shows nothing under Inherit since it's the root).

### 5.7 DB plumbing

- `commands/song.rs::db_create_song` and `db_update_song` — add the new 4 fields to the `INSERT`/`UPDATE` parameter list.
- `commands/song.rs::SectionPayload` and `CreateSongPayload` — add the new fields.
- `commands/song.rs::load_sections` — `SELECT` the new columns.
- Frontend `CreateSongPayload` (in `src/api/commands.ts:71-85`) — add the matching fields.

Search-and-replace touches ~12 lines in Rust + ~6 lines in TS. Tests in `domain/song.rs` get new round-trip assertions for the new fields.

---

## 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| URL-scheme migration misses a callsite, image still 404 | Medium | High — feature broken | Grep `asset://localhost` after the sweep; assert zero matches; CI guard via the existing `check-theme-tokens.ps1` extended with a URL-scheme check |
| Reordering close vs emit in `exit_presentation` breaks the "lifecycle exited triggers home view swap" race | Low | Medium — operator stuck on layout | The `setView("home")` swap is already idempotent; emitting `state_changed` first means `isPresenting` flips before lifecycle arrives — both paths land at home |
| Migration 007 fails on an existing DB with conflicting column names | Very Low | Medium — DB unbootable | `ADD COLUMN` is additive; names are namespaced under the existing schema; sqlx run-each-on-startup is idempotent |
| Preset background loses scrim-opacity semantics for users who liked the dim overlay | Low | Low — visual preference | Preset mode has no scrim; users wanting scrim use Media mode. Document in i18n hint. |
| `BackgroundInfo` becoming Option-heavy breaks existing call sites that pattern-match on `media_kind` | High | Low — compile error, easy to fix | `cargo check` catches all; sweep done as part of P8-07 |
| ESC double-press triggers two different exit paths (idempotency guard fails under fast double tap) | Low | Medium — partial freeze persists | Frontend `exitInflight` dedup + Rust idempotency guard together = belt-and-braces |
| Removing `set-player` view breaks an entry point we missed | Low | Low — broken navigation | Grep + manual smoke before deletion; can keep the view and dead-code its content if uncertain |
| Tracing output spams the dev console | Low | Low — noise | `tracing::info!` level can be filtered via `RUST_LOG=trinity_lyrics=info` if needed |

---

## 7. Test Plan

### 7.1 Rust tests (new)

- `protocol::asset::url_for("foo.png")` returns `"http://asset.localhost/media/foo.png"` (golden test for the URL helper)
- `exit_presentation` idempotency: call twice in sequence on a clean state → both return `Ok`, only one `state_changed` event emitted (verify via a `tauri::test` harness with a mock emitter)
- `BackgroundInfo` serde round-trip with `preset = Some(PretoBranco)`, `assetUrl = None`
- `BackgroundInfo` serde round-trip legacy media case: `preset = None`, `assetUrl = Some("...")`, no typography
- `services::background::resolve_for_slide` with `background_mode = 'preset'` returns a preset `BackgroundInfo`
- `services::background::resolve_for_slide` section-preset + song-media: section preset wins
- Migration 007 applies cleanly on a fresh DB AND on a DB with existing data (smoke via `sqlx::migrate!`)

### 7.2 Vitest (new + updated)

- `StrophesGrid.test.tsx` (update): assert click handler reads `usePresentationStore.getState()` at click-time (mock the store, mutate it between render and click, assert the dispatched index is the LIVE value)
- `SetItemList.test.tsx` (update): same live-read test
- `MediaCard.test.tsx` (new): video with `thumbnailFile: null` renders the "Thumb pendente" label
- `Keycap.test.tsx` (new): `{ key: "Escape" }` renders as `ESC`
- `KeyBindingsScreen.test.tsx` (update): row for `exitPresentation` shows `ESC 🔒`, no Space cap
- `SongEditor.test.tsx` (update): three tabs (`Inherit`, `Preset`, `Media`); selecting `Preset` + `Preto/Branco` + `Serif` + `Lg` persists through save
- `PresentationApp.test.tsx` (update): countdown without config renders the fallback "Contagem regressiva não configurada" message
- `LivePreview.test.tsx` (update): preset background renders solid black, `text-fg: #FFFFFF`
- `SetBuilder.test.tsx` (new): with `hidePresentButton`, the bottom button is not in the DOM

### 7.3 Manual smoke

1. Start presentation. Press arrow keys repeatedly — operator AND projection move in lockstep.
2. Click a strophe card 3 — both windows jump to slide 3.
3. Click set item B — both windows switch to B's first slide.
4. With a countdown set item, navigate to it — projection shows ticking digits.
5. Press ESC — projection closes, operator returns to home, no freeze, < 500ms.
6. Press ESC twice rapidly — same as #5, no console error.
7. Add an image as a set item, navigate to it — image fills projection.
8. Add a video as a set item, open Media Library — card shows either a real thumbnail or "Thumb pendente" badge.
9. Edit a song. Section background → Preset → Preto/Branco → Serif → Lg → save → navigate to section in presentation. White serif on solid black.
10. Edit same song. Change another section to Branco/Preto → save → navigate. Black on white. Transition fades.
11. Open Settings → Keyboard. Row "Sair da apresentação" shows `ESC` (not `ESCAPE`, not `ESCAPE/SPACE`).
12. Run `cargo test --manifest-path src-tauri/Cargo.toml` — green.
13. Run `npx vitest` — green.
14. Run `tsc --noEmit` — green.

---

## 8. Out of Scope (re-confirmed)

- No new IPC commands or events (the spec stands; even `exit_presentation` only changes internal order, not the contract)
- No new Tauri windows
- No changes to the Phase 7 3-pane layout shell
- No new media kinds (audio, etc.)
- No custom user palette editor (only the two named presets)

---

## 9. Resolved Deferred Questions (from spec.md §Gray Areas)

| # | Question | Resolution | Section |
|---|---|---|---|
| 1 | P8-01 root cause | Frontend closure-staleness in StrophesGrid + SetItemList click handlers; Rust path already correct | §4.1, §2 |
| 2 | P8-04 dedup strategy | Belt-and-braces: Rust idempotency guard AND frontend in-flight coalescing | §3.2 |
| 3 | P8-06 thumbnail pipeline | Already correct (`services/thumbnail.rs`); add a UI affordance for the missing-tool case | §4.7 |
| 4 | P8-07 data model | Four discrete columns per table (songs + song_sections); no JSON blob | §5.1 |
| 5 | P8-08 set-player fate | Remove view if no external entry point; otherwise relabel as "Pré-visualizar" | §4.4 |
| 6 | **New** — asset URL scheme | Standardise on `http://asset.localhost/media/...` (Windows-correct); centralise behind `protocol::asset::url_for` + `src/api/assets.ts::mediaUrl` | §3.1 |

---

## 10. Implementation Order (refined from spec.md)

The spec's order stands except for swapping P8-06 forward — the URL-scheme fix is a one-line change with cascading effects, so it goes first:

1. **P8-06 (URL scheme half)** — fix `asset://` → `http://asset.localhost/` in all 5 callsites; centralise helper. Unblocks visual verification of every subsequent fix.
2. **P8-01 + P8-02** — closure-staleness fixes in `StrophesGrid` and `SetItemList`; jumpToItem explicit-zero. Adds tracing in `emit_state`.
3. **P8-04** — idempotency guard in Rust `exit_presentation`; reorder close vs emit; frontend `exitInflight` dedup.
4. **P8-03** — verify countdown projects after the above; add the no-config fallback message.
5. **P8-05** — Keycap special-cases (`Escape → ESC`); keybinding normaliser on boot; visual audit.
6. **P8-06 (thumb-pending half)** — `MediaCard` empty-state label + i18n.
7. **P8-08** — `hidePresentButton` prop on `SetBuilder`; unify the bottom-button handler; remove or relabel `set-player` view.
8. **P8-07** — migration 007 + domain types + resolver + editor tabs + renderer wiring. Largest piece; lands last to avoid cross-conflicts.

Each lands as its own atomic commit per the project's existing pattern. Full gate (`cargo clippy -- -D warnings`, `cargo test`, `npx vitest`, `tsc --noEmit`) on every commit.
