# Plan & Design — Launch splash · 16:10 strophe-grid overflow · scheduled-countdown takeover

Status: proposed · Date: 2026-06-03 · Branch target: feature branch off `main`

Three independent changes, batched:

1. **Feature** — A short branded **opening splash** on operator launch (black, animated
   wordmark in a bundled display font). *Frontend + one font asset.*
2. **Fix** — The operator **strophe-grid slide preview** overlaps vertically on a
   16:10 panel (fine on 16:9). *Frontend-only, CSS.*
3. **Behaviour change** — A **scheduled countdown should take over the screen**: the
   moment it's armed it overlays whatever is presenting (song / blackout / aviso),
   and if nothing is presenting it opens the presentation; at 00:00 it auto-clears
   and the previous content returns. Arming surfaces an **info toast** for the
   operator. *Rust state + IPC + frontend.*
4. **Cleanup** — **Remove** the unmounted dead-code `CountdownPanel.tsx`.

### Confirmed decisions (from review)
- **3a — Takeover timing:** *immediately on arm.* The scheduled countdown overlays the
  screen as soon as it's armed (showing "Começa em mm:ss"), then rolls into the
  running countdown at the wall-clock time.
- **3b — On finish (00:00):** *auto-clear, restore previous.* The overlay disappears
  and the screen returns to whatever was underneath (song / blank / aviso).
- **3c — Arm feedback:** arming shows a transient **local info toast** (e.g.
  "Cronômetro agendado para 19:30 — vai assumir a tela") **plus a persistent "armed"
  badge** in the operator presentation header that stays until the countdown clears.
  Toast = "got it"; badge = "still pending" (a toast alone fades while the takeover
  can be pending for minutes/hours). This is the "warn" the operator needs.
- **3d — `CountdownPanel`:** confirmed dead → **delete** it (do not revive).
- **2 — Overflow surface:** the **strophe grid while presenting** (`StrophesGrid`).
- **1 — Splash style:** *bundle a distinctive display font* (offline-safe), gradient
  indigo→violet wordmark, blur+scale entrance, letter-spacing settle, fade out.

---

## 1. Opening splash screen

### Current behaviour (findings)
- `src/main.tsx` resolves the window label, applies theme/locale, then mounts
  `OperatorApp` (operator) or `PresentationApp` (presentation). There is **no**
  intro/splash anywhere — the operator UI paints immediately.
- App name is **"Lyrizzy"** (`index.html` title, `enter_presentation` window title
  `window.rs:265`). CLAUDE.md still calls the project "Lyrizzy (formerly Trinity
  Lyrics v2)".
- Only three font families are wired (`FONT_CLASS` in
  `src/components/presentation/layout.ts:15` → Tailwind `font-sans/serif/mono`); no
  display/brand face is bundled, and `src/index.css` only does `@import "tailwindcss"`
  — no `@font-face`, no keyframes.
- A global motion preference already exists: `useSettingsStore().reduceMotion`
  (consumed by `TransitionStage`/`PresentationApp`). The splash must honour it.

### Design
**New asset:** self-host one display face under `src/assets/fonts/` as **woff2**
(OFL/Apache so bundling is fine). Candidates: *Space Grotesk*, *Unbounded*, *Syne*,
*Clash/Cabinet Grotesk* (Fontshare). Recommend a geometric heavy weight (e.g.
Space Grotesk 700 or Unbounded variable). **Must be local** — Tauri runs offline and
the CSP forbids remote `@font-face` (no Google Fonts CDN).

- Register it in `src/index.css` with `@font-face { font-family: "Brand"; src: url(...) format("woff2"); font-display: block; }` and a small utility class `.font-brand`.
- Add splash keyframes in `index.css`: `@keyframes splash-in` (opacity 0→1,
  `scale(0.92)`→1, `blur(8px)`→0, `letter-spacing` wide→settled) and
  `@keyframes splash-out` (opacity 1→0). Gate behind `@media (prefers-reduced-motion: no-preference)` as a CSS fallback in addition to the JS `reduceMotion` check.

**New component `src/components/system/SplashScreen.tsx`:**
- Fixed full-screen overlay, `z-[100]`, solid `bg-black`, flex-centered.
- Wordmark **"Lyrizzy"** in `.font-brand`, very large, gradient fill
  (`bg-gradient-to-r from-primary to-[#a78bfa] bg-clip-text text-transparent` — reuse
  the indigo `--app-primary` token + a violet stop) with the entrance animation.
  Optional muted tagline under it (i18n key, see below).
- Lifecycle: visible ~**1.4 s**, then ~**350 ms** fade-out, then `onDone()` to unmount
  (total ≈ 1.75 s). Driven by two `setTimeout`s; **cleared on unmount** (no leaks).
- **Skippable:** any `keydown`/click starts the fade immediately (power users).
- **reduceMotion:** when set, skip the animations (static wordmark) and shorten to a
  single short hold (~600 ms) before `onDone` — never block the operator.
- Non-blocking: while it fades, set `pointer-events-none` so the app underneath is
  already interactive.

**Mount — `src/windows/operator/OperatorApp.tsx`:**
- `const [showSplash, setShowSplash] = useState(true)` and render
  `{showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}` at the top of
  the returned tree. Operator-only by construction (the presentation window mounts
  `PresentationApp`, which gets **no** splash — projector must stay clean).
- Once-per-process: component state only (not persisted) — every cold launch shows it,
  re-renders don't.

**i18n (only if a tagline is shown):** add `splash.tagline` to every locale under
`src/i18n/locales/*` (the wordmark itself is a brand string, untranslated). The
i18n key-completeness test enforces parity across locales.

**Files touched**

| File | Change |
|---|---|
| `src/assets/fonts/<brand>.woff2` | **new** — bundled display face |
| `src/index.css` | `@font-face` + `.font-brand` + splash keyframes |
| `src/components/system/SplashScreen.tsx` | **new** — animated splash |
| `src/windows/operator/OperatorApp.tsx` | mount + `showSplash` state |
| `src/i18n/locales/*` | `splash.tagline` (only if tagline used) |

**Tests:** `SplashScreen.test.tsx` — renders the wordmark; with fake timers calls
`onDone` after the hold+fade; `reduceMotion` path omits animation classes; a
key/click triggers early dismissal; timers cleared on unmount.

**Risks:** must never render on the presentation window; the font file inflates the
bundle a little (keep one weight, subset to Latin if practical); CSP must allow the
local font (it's app-origin, so fine — no remote URL).

---

## 2. Strophe-grid preview overlaps vertically on 16:10

### Current behaviour (findings)
- The overflowing surface is **`StrophesGrid`** (`src/components/presentation/StrophesGrid.tsx:206-224`),
  the middle pane's grid of slide thumbnails shown while presenting
  (`OperatorPresentationLayout.tsx:216`).
- Layout: `grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] items-start gap-2 p-2 overflow-y-auto h-full`; each card (`SlideCard`) is `aspect-video w-full … relative` with the section badge as an `absolute` child.
- **The slide text is *not* the problem.** Every thumbnail wraps its content in
  `SlideStage` (`SlideStage.tsx`), which maps a fixed **1280×720** virtual stage into
  the box with a `ResizeObserver` contain-scale + `overflow-hidden`. That math is
  aspect-ratio-independent, so internal content can't bleed. The defect is the **outer
  16:9 box**, i.e. `aspect-video` inside a CSS grid.
- Why 16:10 specifically: `aspect-video` derives the card *height* from its resolved
  column *width*. Combined with the grid's implicit row tracks and the notebook's
  fractional DPI/zoom, the aspect-derived height and the row track can disagree by a
  rounding margin, so cards visually overlap the row below. On a 16:9 panel the window
  geometry happens not to trigger the mismatch.

### Design — bulletproof 16:9 ratio box (aspect-ratio-independent)
Replace the fragile `aspect-video` grid items with the classic **padding-ratio box**,
which never depends on grid row resolution or the `aspect-ratio` property:

- Introduce a tiny shared helper **`src/components/presentation/RatioBox.tsx`**:
  a `relative w-full` element with a ratio spacer (`before:block before:pt-[56.25%]`
  or an inner `padding-top:56.25%` wrapper) and an `absolute inset-0` content layer
  (`overflow-hidden rounded`). Children render into the absolute layer.
- **`StrophesGrid` `SlideCard`:** make the `<button>` a `RatioBox` (drop
  `aspect-video`; keep `w-full`, ring/border states, the `SlideStage` + badge inside
  the absolute layer). Grid container unchanged.
- Apply the same `RatioBox` to the sibling preview boxes for consistency and to kill
  the pattern everywhere it could recur:
  - `LivePreview.tsx` (every `aspect-video w-full …` wrapper, ~9 sites) and
  - `SongPreviewPane.tsx:100` (`aspect-video w-full`).
  These weren't reported as broken, but they share the exact fragile idiom — folding
  them onto `RatioBox` removes the latent bug and de-dupes the markup.

**Files touched**

| File | Change |
|---|---|
| `src/components/presentation/RatioBox.tsx` | **new** — padding-ratio 16:9 box |
| `src/components/presentation/StrophesGrid.tsx` | `SlideCard` uses `RatioBox` |
| `src/components/presentation/LivePreview.tsx` | swap `aspect-video` boxes → `RatioBox` |
| `src/components/presentation/SongPreviewPane.tsx` | swap `aspect-video` box → `RatioBox` |

**Tests:** `RatioBox.test.tsx` — renders children in the absolute layer with the ratio
spacer; existing `StrophesGrid`/`LivePreview` tests stay green (testids unchanged).
Layout overlap can't be asserted in jsdom — **primary verification is manual on a real
16:10 panel** (consistent with CLAUDE.md's "test on real hardware" caveat). Confirm
no overlap at the laptop's native DPI/zoom and that the grid still scrolls.

**Risk:** the ratio-box markup nests one extra level — verify ring/hover/`aria-current`
states and the absolute badge still render correctly inside it.

---

## 3. Scheduled countdown takes over the presentation

### Current behaviour (findings)
- The **live** scheduling path is the **countdown *set item*** (not the standalone
  `CountdownPanel`, which is currently **unmounted dead code** — defined at
  `src/components/countdown/CountdownPanel.tsx` but referenced nowhere). Schedule is
  configured per item via `CountdownSetItemEditor.tsx` (`scheduledStart` HH:MM,
  `countdown.rs::ScheduledStart`).
- Arming only happens **when the operator navigates the presentation to that item**:
  `PresentationApp.tsx:160-180` effect (`[currentItem?.id]`) calls `armCountdown(...)`
  when the current item is a countdown with `scheduledStart`.
- Rendering: the countdown only paints when its item is the **current** item and mode
  is live/frozen (`PresentationApp.tsx:273` `itemType === "countdown"` →
  `CountdownRenderer`), **or** in the `mode === "idle"` branch
  (`PresentationApp.tsx:224-238`). It is **buried below** the precedence ladder:
  announcement-overlay → blank → media/webView overlay → idle → live content
  (`PresentationApp.tsx:187-244`). So a scheduled countdown can't show over a live
  song, a blackout, or an aviso, and won't appear at all unless you're parked on it.
- At fire, `tick_scheduled` (`commands/countdown.rs:158-233`) flips Scheduled→Running,
  emits `countdown_triggered {set_id,item_index}`; `OperatorApp.tsx:80-89` reacts with
  `enterPresentation()` + `jumpToItem(itemIndex)`.
- `enter_presentation` (`window.rs:215`) is **window-management only** — it opens/foci
  the presentation window and does **not** change mode or current item (errors with
  `presentation.empty_set` if the set is empty).
- `CountdownState` (`domain/countdown.rs:137-150`) already carries `mode`,
  `remaining_ms`, `scheduled_start_epoch_ms`, `message`, `end_behavior`.
  `CountdownRenderer` + `useCountdownDigits` already render scheduled/running/low/
  finished states with a position and optional background.

### Desired behaviour
- **Immediately on arm:** the scheduled countdown **overlays** whatever is presenting
  — song, blackout, aviso, media/webView overlay, *anything* — showing "Começa em
  mm:ss", then automatically rolls into the running countdown at the wall-clock time.
- **If nothing is presenting** when armed: **open the presentation** window and show
  the (scheduled→running) countdown.
- **At 00:00:** auto-clear the overlay; the screen **restores** to whatever was
  underneath.

### Design — a top-precedence "countdown takeover" layer

**Backend — `src/domain/countdown.rs`**
- Add `takeover: bool` to `CountdownState` (serde camelCase `takeover`), default
  `false` in `Default`. Extend the round-trip test to assert `"takeover":false`.

**Backend — `src/commands/countdown.rs`**
- `arm_countdown` and `start_countdown`: add `takeover: Option<bool>` param (default
  `false`); write it into state. The set-item auto-arm path passes `true`; any
  non-takeover caller (future standalone tool) can pass `false`.
- Preserve `takeover` across the Scheduled→Running handoff in `tick_scheduled` (it
  already clones state; just don't drop the flag).
- **Auto-clear on finish:** in `tick_countdown` when `remaining == 0`, set
  `takeover = false` in the same write that flips to `Finished`, *then* emit, so the
  overlay disappears and the underlying screen returns (decision 3b). The existing
  `end_behavior` branches (Blackout→`do_blank`, AdvanceSet→`do_next`) still run and
  now actually become visible because the takeover no longer covers them.
- `reset_countdown` / `pause_countdown` already rebuild state — ensure they leave
  `takeover` consistent (reset → `false`).

**IPC — `src/api/commands.ts`**
- `ArmCountdownParams` / `StartCountdownParams` gain `takeover?: boolean`; forward it
  in the `invoke` payloads. `CountdownState` type (`src/types`) gains `takeover`.

**Store — `src/stores/countdown.ts`:** pass-through only (params already opaque).

**Arm trigger (the "arm moment").** Because takeover overlays *immediately*, arming
must be a deliberate operator action near the event — **not** on set-enter (a 3-hour
pre-roll would cover the whole service). Recommended:
- Keep the existing `PresentationApp` auto-arm effect but make it pass
  `takeover: true`, **and** broaden when it fires: arm a scheduled countdown item as
  soon as the operator explicitly activates it (an **"Arm"** affordance on the
  countdown item in the operator UI — e.g. a button in `SetItemList`/the strophe pane
  for countdown items), rather than only when it becomes the current slide. The arm
  handler:
  1. if **not** presenting (`!isPresentationActive(state)`) → `await enterPresentation()`;
  2. `await armCountdown({ scheduledStart, durationMs, message, endBehavior, takeover: true, setId, itemIndex })`;
  3. **show an info toast** confirming the schedule (decision 3c).
  The takeover layer then renders over the current content (or on the freshly opened
  window). *(Open question below: exact placement of the Arm control.)*

**Arm feedback — local toast + armed badge (decision 3c).** There is **no shared
toast** in the app; it's an ad-hoc per-component pattern (local `useState` +
`setTimeout`, see `SongEditor.tsx:282-285`, `MediaLibrary.tsx:62-64`,
`CCLIReportScreen.tsx:26-28`). Follow the house style — **don't extract a shared
component** for this feature (a shared-`Toast` refactor is filed as separate cleanup so
the existing 3 sites can migrate together later).

- **Local toast** in `OperatorPresentationLayout.tsx`: a local `useState<string|null>`
  + `setTimeout(…, 3500)` (mirroring `CCLIReportScreen`), rendered as a fixed
  bottom-center pill with `role="status"` / `aria-live="polite"`. On arm, set
  `t("countdown.arm.toast", { time: "HH:MM" })`. The toast lives on the **operator**
  window, so it still shows in the not-presenting case (where arming opens the
  presentation on the other monitor).
- **Armed badge** (the persistent part): a small pill in the operator presentation
  header / `OverlayActionBar` shown whenever `countdown.takeover && countdown.mode` is
  `scheduled` or `running`. Label derives from the countdown store with **no new
  backend field** — format `scheduled_start_epoch_ms` (or `target_epoch_ms` once
  running) to HH:MM, e.g. "⏳ Cronômetro 19:30". Clicking it cancels (calls
  `reset_countdown`, which clears `takeover`). The badge disappears automatically when
  the countdown auto-clears at 00:00 (3b) or is reset.
- i18n: `countdown.arm.toast` + `countdown.arm.badge` in every locale under
  `src/i18n/locales/*`.

**Render — `src/windows/presentation/PresentationApp.tsx`**
- Add a render branch at the **very top** of the precedence ladder (above the
  announcement overlay): when `countdown.takeover && countdown.mode !== "idle"`,
  return a full-screen `CountdownRenderer`. This wins over song/blank/aviso/media —
  matching "overlap whatever it is".
- The standalone countdown has no `CountdownConfig`; build a **synthetic config** from
  `countdown` state: `{ target: …, message: countdown.message, endBehavior:
  countdown.end_behavior, position: "center", backgroundMediaId: null }`. (Or extend
  `CountdownRenderer` to accept loose props — synthetic config is the smaller change.)
  `useCountdownDigits` already reads the live store, so digits/scheduled-label/low/
  finished colours update automatically.
- When `takeover` flips back to `false` (auto-clear at 00:00, or reset), this branch
  stops returning and the normal ladder resumes → previous content restored (3b).
- Leave the existing set-item countdown branch (`itemType === "countdown"`) for the
  case where the operator parks on a countdown item without takeover.

**Render — `src/components/presentation/LivePreview.tsx`**
- Mirror the takeover: add a top branch when `countdown.takeover && mode !== idle`
  rendering the countdown into a `RatioBox`+`SlideStage`, so the operator's live
  preview reflects the overlay.

**Operator reaction — `src/windows/operator/OperatorApp.tsx`**
- `onCountdownTriggered` stays (Scheduled→Running at fire). With takeover already on
  screen since arm, the handler no longer *needs* to open/jump for the takeover case,
  but keeping `enterPresentation()` is harmless/idempotent. Do **not** force
  `jumpToItem` for takeover (it would disturb the underlying set position) — only the
  legacy non-takeover set-item path should jump. Guard on `takeover`/`item_index`.

**Files touched**

| File | Change |
|---|---|
| `src-tauri/src/domain/countdown.rs` | `takeover` field + default + test |
| `src-tauri/src/commands/countdown.rs` | `takeover` param on arm/start; preserve across handoff; clear on finish |
| `src/types/index.ts` | `CountdownState.takeover` |
| `src/api/commands.ts` | `takeover?` on Arm/Start params |
| `src/windows/presentation/PresentationApp.tsx` | top-precedence takeover branch (synthetic config); auto-arm passes `takeover:true` |
| `src/components/presentation/LivePreview.tsx` | mirror takeover branch |
| `src/windows/operator/OperatorApp.tsx` | trigger handler: no jump for takeover |
| `src/components/presentation/SetItemList.tsx` *(or strophe pane)* | "Arm" affordance for scheduled countdown items *(placement TBD)* |
| `src/components/presentation/OperatorPresentationLayout.tsx` | local toast (house pattern) fired on arm |
| `src/components/presentation/OverlayActionBar.tsx` | persistent "armed" badge (from countdown store) + cancel |
| `src/i18n/locales/*` | `countdown.arm.toast`, `countdown.arm.badge` |
| `src/components/countdown/CountdownPanel.tsx` | **delete** — dead code (no test, zero imports; `src/components/countdown/` becomes empty → remove dir) |

**Tests**
- Rust: `countdown.rs` — `takeover` round-trips; `arm_countdown` sets it; finish
  clears it (logic test mirroring the `remaining == 0` branch). Keep existing ticker
  tests green.
- Frontend: `PresentationApp.test.tsx` — takeover branch beats announcement/blank/
  overlay/live; disappears when `takeover=false`. Countdown store/commands pass
  `takeover` through. `OperatorPresentationLayout` — arm shows the local toast (fake
  timers) and the armed badge renders/cancels off `countdown` store state.

**Risks / notes**
- **Precedence inversion:** takeover deliberately covers the aviso overlay (per the
  request). Confirm the operator can still *clear* it — `reset_countdown` must drop
  `takeover` and the operator needs a reachable control (the Arm affordance should
  toggle to "Cancel/Reset").
- **Empty set:** the "open presentation if not presenting" path calls
  `enter_presentation`, which errors on an empty set. The set-item path always has the
  countdown item, so the set isn't empty — fine; surface the error otherwise.
- **CLAUDE.md invariant:** all `state.write().await` guards must drop before
  `app.emit()` (the countdown ticker already follows this — keep it when adding the
  finish-clear write).
- Two-window invariant intact: takeover is driven by Rust countdown state; both
  windows project it; presentation window never mutates.

### Open question to confirm during implementation
- **Where should the "Arm" control live** for a scheduled countdown item — a button on
  the countdown item in the set/strophe pane, a global control, or auto-arm on set
  enter with a confirm? (Affects only UX placement, not the takeover mechanics above.)

---

## Suggested commit slices
1. `fix(preview): RatioBox 16:9 box for strophe grid (16:10 overflow)` — smallest,
   high value, independently verifiable on hardware.
2. `feat(splash): animated launch wordmark (bundled display font)` — self-contained.
3. `feat(countdown): takeover overlay for scheduled countdowns` — Rust state + IPC +
   render layer; land the backend `takeover` flag first, then the render branches,
   then the Arm affordance + local toast + armed badge.
4. `chore(countdown): remove dead CountdownPanel` — standalone, can land anytime.

*(Filed separately, not in scope here: extract a shared `Toast`/`useToast` and migrate
the 3 existing ad-hoc sites + this one onto it.)*

## Cross-cutting checks
- `npx vitest` + `cargo test` green.
- i18n key-completeness across all locales (splash tagline, any new countdown/arm
  strings).
- Manual: splash never shows on the projector; strophe grid on a real 16:10 panel;
  countdown takeover over a live song / blackout / aviso, and the empty-screen
  open-and-start path, plus auto-clear at 00:00.
