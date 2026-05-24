# Phase 8 — Presentation Fix-ups — Tasks

**Spec:** `.specs/features/phase8-presentation-fixes/spec.md` (8 requirements P8-01..P8-08)
**Design:** `.specs/features/phase8-presentation-fixes/design.md`
**Status:** Draft
**Created:** 2026-05-23

---

## Execution Plan

```
Phase 1 — URL scheme foundation (parallel)
   T1 [P]  Rust:     asset::url_for + sweep `asset://localhost/...`
   T2 [P]  Frontend: mediaUrl() helper + sweep `asset://localhost/...`

Phase 2 — State sync (after T2)
   T2 → T3   StrophesGrid + SetItemList click-time store reads + emit_state tracing

Phase 3 — ESC freeze (after T3)
   T3 → T4   exit_presentation idempotency + reorder + frontend exitInflight dedup

Phase 4 — Countdown fallback (after T1)
   T1 → T5   PresentationApp no-config countdown fallback message

Phase 5 — ESC label sweep (parallel after T1)
   T1 → T6 [P]  Keycap special-cases (Escape → ESC, arrows, Space)
   T1 → T7 [P]  KeyBindings boot-time normaliser for exitPresentation hardcoded binding

Phase 6 — Media UX (parallel after T1)
   T1 → T8 [P]  MediaCard thumb-pending overlay + i18n key

Phase 7 — Button consolidation (sequential)
   T1 → T9       SetBuilder hidePresentButton prop + threading from HomeSetBuilder
   T9 → T10      Unify SetBuilder's bottom button + remove/relabel set-player dead view

Phase 8 — Background presets (sequential, isolated)
   T11           Migration 007 — add columns to songs + song_sections
   T11 → T12     Rust domain types: BackgroundPreset / FontFamily / FontSize / Typography
   T12 → T13     services::background::resolve_for_slide preset-mode branch
   T13 → T14     commands::song DB read/write + Section/Create payloads
   T14 → T15     Frontend types + presentation renderers (SongBackground, SongSlide, LivePreview)
   T15 → T16     SongEditor BackgroundPicker → 3-tab (Inherit | Preset | Media)

Phase 9 — Final gate (after all above)
   T4, T5, T6, T7, T8, T10, T16 → T17   Full gate + STATE/ROADMAP update
```

---

## Task Breakdown

### T1: Rust `asset::url_for` helper + sweep `asset://localhost/...` (P8-06 root cause, backend) [P]

**What:** Centralise asset URL formatting in a single helper. Replace every `format!("asset://localhost/media/{…}")` in the Rust tree with `asset::url_for(…)`. The helper emits the Windows-correct `http://asset.localhost/media/...` form documented at `protocol/asset.rs:8`.

**Where:**
- `src-tauri/src/protocol/asset.rs` — add `pub fn url_for(file_name: &str) -> String { format!("http://asset.localhost/media/{file_name}") }`
- `src-tauri/src/services/background.rs:39, 69` — replace inline `format!` with `crate::protocol::asset::url_for(&fname)`
- Grep for any other `asset://localhost` literal in `src-tauri/src/` and replace (likely none beyond background.rs and tests)
- `src-tauri/src/domain/background.rs:26` — update the round-trip test to expect `http://asset.localhost/media/bg.mp4`

**Depends on:** None

**Reuses:**
- Existing `protocol::asset` module (asset handler is already registered in `lib.rs:45`)
- Existing `services/background` resolver tests

**Tools:** None

**Done when:**
- [ ] `protocol::asset::url_for("foo.png")` returns `"http://asset.localhost/media/foo.png"` (unit test)
- [ ] `services/background.rs` emits the new URL form for both section-level and song-level branches
- [ ] `Grep "asset://localhost" src-tauri/` returns zero matches (excluding documentation files)
- [ ] Existing `background_info_round_trips_with_camel_case` test updated; cargo test green
- [ ] `cargo build --manifest-path src-tauri/Cargo.toml` clean

**Tests:** unit (`protocol::asset` + updated `domain::background` round-trip)
**Gate:** quick (`cargo test --manifest-path src-tauri/Cargo.toml`)
**Commit:** `fix(presentation): P8-06 — Rust asset::url_for helper + Windows-correct scheme`

---

### T2: Frontend `mediaUrl()` helper + sweep `asset://localhost/...` (P8-06 root cause, frontend) [P]

**What:** Create `src/api/assets.ts` exporting `mediaUrl(fileName)`. Sweep every `asset://localhost/media/${…}` literal in the React tree and replace with `mediaUrl(…)`. Same Windows-correct scheme as T1.

**Where:**
- `src/api/assets.ts` (NEW) — `export function mediaUrl(fileName: string) { return \`http://asset.localhost/media/${fileName}\`; }`
- `src/components/presentation/LivePreview.tsx:30-32` — replace `buildAssetUrl` with `mediaUrl` import (delete the local helper)
- `src/windows/presentation/PresentationApp.tsx:27-29` — same replacement
- `src/components/presentation/OperatorPresentationLayout.tsx:334` — image src in media picker
- `src/components/library/SongEditor.tsx:56-58, 130-131` — thumbUrl + picker grid
- `src/components/media/MediaDetailPanel.tsx` — grep for any `asset://localhost` usage
- Any other `.tsx` file containing the literal — full grep sweep

**Depends on:** None

**Reuses:**
- Existing media-store + `thumbnailFile`/`fileName` fields on the `Media` type

**Tools:** None

**Done when:**
- [ ] `Grep "asset://localhost" src/` returns zero matches
- [ ] `src/api/assets.ts` exports `mediaUrl(fileName: string): string`
- [ ] LivePreview's deleted local `buildAssetUrl` replaced; PresentationApp's deleted local `buildAssetUrl` replaced
- [ ] All updated files import from `src/api/assets`
- [ ] `tsc --noEmit` clean
- [ ] Vitest snapshot updates (if any) regenerated to reflect new URLs

**Tests:** unit (one trivial test on `mediaUrl` in `src/api/assets.test.ts`)
**Gate:** quick (`tsc --noEmit && npx vitest run src/api`)
**Commit:** `fix(presentation): P8-06 — frontend mediaUrl helper + scheme sweep`

---

### T3: StrophesGrid + SetItemList click-time store reads + emit_state tracing (P8-01, P8-02)

**What:** Fix closure-staleness in two click handlers (the user-visible "click does nothing" bug). Read `currentItemIndex` from `usePresentationStore.getState()` at click time, not at render time. Also normalise `jumpToItem` to pass an explicit `0` as `slideIndex`. Add `tracing::info!` to Rust's `emit_state` for observability.

**Where:**
- `src/components/presentation/StrophesGrid.tsx:133` — change onClick from
  `() => goToItem(currentItemIndex, slideIdx).catch(console.error)`
  to
  `() => { const live = usePresentationStore.getState().state; const idx = live?.currentItemIndex ?? 0; goToItem(idx, slideIdx).catch(console.error); }`
- `src/components/presentation/SetItemList.tsx:22-23` — same pattern for the `goToItem(idx, 0)` call; the `idx` here is the row's static index, but verify `currentItemIndex` is read live in `isActive` comparison via selector
- `src/stores/presentation.ts:74-81` — `jumpToItem(itemIndex)` calls `goToItem(itemIndex, 0)` (explicit zero)
- `src-tauri/src/commands/presentation.rs:88-91` — extend `emit_state` with `tracing::info!(item=…, slide=…, mode=?, overlay=…, "emit state_changed")`
- Add Vitest case: render `StrophesGrid` with `currentItemIndex=0`, mutate store to `currentItemIndex=2` BEFORE clicking, click slide-card #3; assert dispatched `go_to_item(2, 3)` not `(0, 3)`

**Depends on:** T2 (need correct URL scheme for any visual smoke test downstream)

**Reuses:**
- Existing `usePresentationStore` Zustand store
- Existing `goToItem` API command

**Tools:** None

**Done when:**
- [ ] `StrophesGrid.tsx` click handler reads store via `getState()`
- [ ] `SetItemList.tsx` click handler reads store via `getState()`
- [ ] `usePresentationStore.jumpToItem` passes explicit `0` for slideIndex
- [ ] Rust `emit_state` logs `item, slide, mode, overlay` at info level
- [ ] New Vitest cases: closure-staleness regression test for StrophesGrid AND SetItemList
- [ ] `tsc --noEmit` clean
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` green
- [ ] `npx vitest run src/components/presentation` green

**Tests:** unit (Vitest for both panes); Rust unchanged behaviour (tracing is non-functional)
**Gate:** quick
**Commit:** `fix(presentation): P8-01 — live store reads in pane click handlers + emit_state tracing`

---

### T4: exit_presentation idempotency + reorder + frontend exitInflight dedup (P8-04)

**What:** Eliminate the ESC-freeze by (1) making `exit_presentation` idempotent on the Rust side, (2) reordering it so `state_changed` emits BEFORE `w.close()`, and (3) coalescing concurrent frontend calls.

**Where:**
- `src-tauri/src/commands/window.rs:197-220` — rewrite `exit_presentation` per design §3.2:
  - Early return when already idle AND window already gone (idempotency)
  - Mutate state + emit `state_changed` FIRST
  - Then `w.close()`
  - Then emit `presentation_lifecycle exited`
  - Add `tracing::info!("exit_presentation: completed")`
- `src/api/commands.ts:45-46` — wrap `exitPresentation` in module-level `exitInflight` promise:
  ```ts
  let exitInflight: Promise<void> | null = null;
  export const exitPresentation = () => {
    if (exitInflight) return exitInflight;
    exitInflight = invoke<void>("exit_presentation").finally(() => { exitInflight = null; });
    return exitInflight;
  };
  ```
- Rust unit test: call `exit_presentation` twice in sequence on a clean idle state; second call returns Ok and does NOT emit a second `state_changed` (assertable via a counter on a test emitter, OR by checking that the second invocation short-circuits before the emit branch — use the `already_idle && window_gone` guard as the assertable behaviour)

**Depends on:** T3 (tracing + state-sync correctness must be in place to verify ESC behaviour end-to-end)

**Reuses:**
- Existing `ErrorPayload`, `PresentationLifecyclePayload`
- Existing `state.presentation.write()` lock pattern (correct as-shipped)

**Tools:** None

**Done when:**
- [ ] `exit_presentation` returns `Ok(())` immediately when state is already idle AND no projection window exists
- [ ] State mutation + `state_changed` emit happens BEFORE `w.close()`
- [ ] Frontend `exitPresentation` coalesces concurrent calls
- [ ] Manual smoke: press ESC, then immediately ESC again — no console error, projection closes once, operator returns to home
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` green; new idempotency test passes
- [ ] `npx vitest run src/api` green

**Tests:** unit (Rust idempotency); manual smoke for the ESC-freeze fix
**Gate:** quick
**Commit:** `fix(presentation): P8-04 — exit_presentation idempotency + state-before-close + frontend dedup`

---

### T5: PresentationApp no-config countdown fallback message (P8-03)

**What:** Replace the silent black `<div className="h-screen bg-black" />` fallback at `PresentationApp.tsx:219-221` with a user-facing message when a countdown set item has no `countdownConfig`. P8-03's main symptom is downstream of P8-01 — fix the visible cliff while we're here.

**Where:**
- `src/windows/presentation/PresentationApp.tsx:198-221` — replace the silent-black else branch with:
  ```tsx
  content = cdConfig ? (
    <CountdownRenderer config={cdConfig} background={cdBackground} frozen={frozen} />
  ) : (
    <div className="h-screen bg-black flex items-center justify-center">
      <p className="text-white text-sm">{t("presentation.countdown.noConfig")}</p>
    </div>
  );
  ```
- `src/i18n/locales/pt-BR.json` — add `presentation.countdown.noConfig: "Contagem regressiva não configurada"`
- `src/i18n/locales/en-US.json` — `presentation.countdown.noConfig: "Countdown not configured"`
- Update i18n key-completeness test if it's strict

**Depends on:** T1 (URL scheme correctness for any background asset on the countdown)

**Reuses:**
- Existing `CountdownRenderer`
- i18n infrastructure

**Tools:** None

**Done when:**
- [ ] Countdown set item without `countdownConfig` renders the new message instead of black void
- [ ] Both i18n locales include the new key
- [ ] `npx vitest run src/tests/i18n` green
- [ ] `tsc --noEmit` clean
- [ ] Manual smoke: temporarily clear a set item's countdown_config in the DB; navigate to it during presentation — message shows

**Tests:** existing PresentationApp test updated for the new branch (if covered); i18n completeness
**Gate:** quick
**Commit:** `fix(presentation): P8-03 — countdown no-config fallback message`

---

### T6: Keycap special-cases (Escape → ESC, arrows, Space) (P8-05) [P]

**What:** Make `Keycap` render canonical short labels for keys that the user reads many times per session. Notably `Escape → ESC`. Arrows get glyphs.

**Where:**
- `src/components/common/Keycap.tsx:13-17` — introduce `SPECIAL_LABELS` map per design §4.3:
  ```ts
  const SPECIAL_LABELS: Record<string, string> = {
    "Escape": "ESC",
    " ": "Space",
    "ArrowRight": "→",
    "ArrowLeft": "←",
    "ArrowUp": "↑",
    "ArrowDown": "↓",
  };
  ```
- New unit test in `src/components/common/Keycap.test.tsx` (NEW): asserts the six mappings render as expected

**Depends on:** T1 (no functional dep; can run as soon as Phase 1 lands)

**Reuses:**
- Existing `Keycap` consumers (`KeyBindingsScreen`)

**Tools:** None

**Done when:**
- [ ] `<Keycap shortcut={{key: "Escape"}} />` renders the literal text `ESC`
- [ ] `<Keycap shortcut={{key: "ArrowRight"}} />` renders `→`
- [ ] `<Keycap shortcut={{key: " "}} />` renders `Space`
- [ ] New `Keycap.test.tsx` passes
- [ ] No regressions in `KeyBindingsScreen.test.tsx`
- [ ] `tsc --noEmit` clean

**Tests:** unit (`Keycap.test.tsx`)
**Gate:** quick (`npx vitest run src/components/common`)
**Commit:** `fix(presentation): P8-05 — Keycap canonical labels (ESC, arrows, Space)`

---

### T7: KeyBindings boot-time normaliser for hardcoded exitPresentation (P8-05) [P]

**What:** Force `exitPresentation` to the canonical `[{ key: "Escape" }]` binding at app boot if it deviates (e.g. legacy data from before P7-02 marked it readonly). Prevents "ESCAPE Space" double-cap rendering for users with non-default bindings.

**Where:**
- `src/stores/keyBindings.ts` — in the `load()` method (or wherever the bindings are read from disk), after fetching, check `bindings.bindings.exitPresentation`:
  ```ts
  const exitBinding = bindings.bindings.exitPresentation;
  const isCanonical = exitBinding?.length === 1
    && exitBinding[0].key === "Escape"
    && !exitBinding[0].ctrl && !exitBinding[0].shift && !exitBinding[0].alt;
  if (!isCanonical) {
    bindings.bindings.exitPresentation = [{ key: "Escape", ctrl: false, shift: false, alt: false }];
    await setKeyBindings(bindings);
  }
  ```
- Add a Vitest case mocking a non-canonical binding and asserting it's reset on load
- The corresponding row in `KeyBindingsScreen` already shows a 🔒 (readonly) icon — no UI change needed

**Depends on:** T1 (no real dep; can land as soon as Phase 1)

**Reuses:**
- Existing `setKeyBindings` Tauri command
- Existing readonly action UI in `KeyBindingsScreen`

**Tools:** None

**Done when:**
- [ ] A user with `exitPresentation: [{Escape}, {Space}]` has it auto-reset to `[{Escape}]` on next app boot
- [ ] A user with the canonical binding sees no extra DB write
- [ ] New Vitest case in `src/stores/keyBindings.test.ts` (or equivalent) passes
- [ ] `tsc --noEmit` clean

**Tests:** unit
**Gate:** quick
**Commit:** `fix(presentation): P8-05 — normalise exitPresentation hardcoded binding on boot`

---

### T8: MediaCard thumb-pending overlay + i18n (P8-06 UX half) [P]

**What:** When a video media row has `thumbnailFile = null` (ffmpeg missing or thumbnail generation failed), show a small "Thumb pendente" label below the icon so the user knows the issue is thumbnail generation, not import failure. Complements the existing `FfmpegBanner` (Phase 2-J).

**Where:**
- `src/components/media/MediaCard.tsx:44-48` — extend the fallback branch:
  ```tsx
  ) : (
    <div className="flex h-full flex-col items-center justify-center text-muted gap-1">
      <Film className="w-8 h-8" />
      {media.kind === "video" && (
        <span className="text-[10px] uppercase tracking-wide">{t("media.thumbPending")}</span>
      )}
    </div>
  )
  ```
- `src/i18n/locales/pt-BR.json` — add `media.thumbPending: "Thumb pendente"`
- `src/i18n/locales/en-US.json` — `media.thumbPending: "Thumb pending"`
- Update `MediaCard.test.tsx` (NEW or update existing) to cover the video-with-null-thumbnail case

**Depends on:** T1 (no real dep; can run in parallel after Phase 1)

**Reuses:**
- Existing `lucide-react` `Film` icon
- Existing media-card styling
- Existing `FfmpegBanner` for the top-level hint

**Tools:** None

**Done when:**
- [ ] Video with `thumbnailFile=null` renders the icon + "Thumb pendente" label
- [ ] Image with `thumbnailFile=null` falls back to `fileName` URL (existing behaviour preserved)
- [ ] Both i18n locales include the new key
- [ ] Vitest case asserts the label renders
- [ ] `tsc --noEmit` clean
- [ ] `npx vitest run src/components/media` green

**Tests:** unit
**Gate:** quick
**Commit:** `fix(media): P8-06 — MediaCard thumb-pending label for videos without thumbnails`

---

### T9: SetBuilder `hidePresentButton` prop + thread from HomeSetBuilder (P8-08 part 1)

**What:** Add a new prop `hidePresentButton?: boolean` to `SetBuilder`. When true, the bottom "Apresentar" button is omitted entirely. `HomeSetBuilder` sets `hidePresentButton` when embedding `SetBuilder`, so the home view shows ONLY the top `OverlayActionBar` Apresentar button (which works correctly today).

**Where:**
- `src/components/set/SetBuilder.tsx` — add `hidePresentButton?: boolean` to `Props`; guard the bottom button JSX (`SetBuilder.tsx:664-670`) with `{!hidePresentButton && (<button …>{t("builder.present")}</button>)}`
- `src/components/setbuilder/HomeSetBuilder.tsx:261` — pass `hidePresentButton` alongside the existing `hideBack`
- Update `SetBuilder.test.tsx` if exists, or `HomeSetBuilder.test.tsx`: assert with `hidePresentButton`, the bottom button is NOT in the DOM
- Update `OperatorApp.smoke.test.tsx:69, 87` if the Apresentar button assertion broke (should still pass — there's still ONE Apresentar button at the top)

**Depends on:** T1 (no real dep; sequential with T10)

**Reuses:**
- Existing `SetBuilder` + `HomeSetBuilder` composition

**Tools:** None

**Done when:**
- [ ] `<SetBuilder setId={…} hidePresentButton />` renders without the bottom Apresentar button
- [ ] `<SetBuilder setId={…} />` (no flag) still renders it (standalone set-builder view stays intact)
- [ ] HomeSetBuilder embeds with `hidePresentButton`
- [ ] OperatorApp smoke test still passes (one Apresentar in DOM, top-bar version)
- [ ] `tsc --noEmit` clean
- [ ] `npx vitest run src/components/set src/components/setbuilder` green

**Tests:** unit
**Gate:** quick
**Commit:** `fix(presentation): P8-08 — hide bottom Apresentar when SetBuilder is embedded in home`

---

### T10: Unify SetBuilder bottom button handler + remove or relabel set-player (P8-08 part 2)

**What:** For the standalone `set-builder` view (entered from the Sets list, NOT from home), make the bottom Apresentar button start the live presentation identically to the top button — `loadSetForPresentation` + `enterPresentation` + error toast. Then audit the `set-player` view: if nothing else routes to it, remove the view + `SlideController` mount. Otherwise relabel the bottom button to "Pré-visualizar".

**Where:**
- `src/components/set/SetBuilder.tsx:246-258` — rewrite `handleLoadForPresentation`:
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
- `src/components/set/SetBuilder.tsx` — import `enterPresentation` from `src/api/commands`
- Audit `set-player` view: grep `'set-player'` across `src/`. If only referenced in `OperatorApp.tsx:330-340` and the now-removed `setView("set-player")` call, delete:
  - `src/windows/operator/OperatorApp.tsx:330-340` — the `set-player` branch
  - The `SlideController` import + mount if no other consumers
  - The `set-player` ViewName type in `src/stores/library.ts` (if applicable)
- If `set-player` is still reachable elsewhere, KEEP the view but rename its tab label / route name to clarify it's preview-only

**Depends on:** T9

**Reuses:**
- Existing `enterPresentation` + `loadSetForPresentation` APIs
- Existing error-toast pattern from `HomeSetBuilder.handleApresentar` (P7-01)

**Tools:** None

**Done when:**
- [ ] Standalone `set-builder` view: bottom Apresentar button now opens the projection window AND switches operator to 3-pane layout (verified by manual smoke)
- [ ] `Grep "set-player" src/` returns either zero matches (if removed) OR only the relabel-justifying matches (if kept)
- [ ] No dead code left behind (`tsc --noEmit` catches unused imports)
- [ ] `cargo build --manifest-path src-tauri/Cargo.toml` clean (in case any Rust-side `View` enum referenced it)
- [ ] `npx vitest` green; smoke tests updated for the removed/relabeled view

**Tests:** unit + smoke
**Gate:** quick
**Commit:** `fix(presentation): P8-08 — unify SetBuilder bottom Apresentar handler; clean up set-player`

---

### T11: Migration 007 — add background-preset columns to songs + song_sections (P8-07)

**What:** Add 4 new columns to `songs` and `song_sections` per design §5.2. All nullable, no CHECK constraints, no data migration. Existing rows have `background_mode = NULL` and behave exactly as before (media-backed or none).

**Where:**
- `src-tauri/migrations/007_background_presets.sql` (NEW):
  ```sql
  -- migration 007: Phase 8 — background presets + typography
  ALTER TABLE songs           ADD COLUMN background_mode    TEXT;
  ALTER TABLE songs           ADD COLUMN background_preset  TEXT;
  ALTER TABLE songs           ADD COLUMN font_family        TEXT;
  ALTER TABLE songs           ADD COLUMN font_size          TEXT;

  ALTER TABLE song_sections   ADD COLUMN background_mode    TEXT;
  ALTER TABLE song_sections   ADD COLUMN background_preset  TEXT;
  ALTER TABLE song_sections   ADD COLUMN font_family        TEXT;
  ALTER TABLE song_sections   ADD COLUMN font_size          TEXT;
  ```
- Re-run sqlx migration on dev DB to verify it applies cleanly

**Depends on:** None (can land independently of all other Phase 8 tasks)

**Reuses:**
- Existing sqlx migration mechanism (Phase 5 added migration 006 the same way)

**Tools:** None

**Done when:**
- [ ] `src-tauri/migrations/007_background_presets.sql` exists with the 8 ALTER TABLE statements
- [ ] `cargo run --manifest-path src-tauri/Cargo.toml` (or `cargo test`) applies the migration without error
- [ ] PRAGMA `table_info(songs)` and `table_info(song_sections)` show the new columns (verify via a tiny sqlx test if useful)

**Tests:** integration (the existing background.rs test harness already calls `sqlx::migrate!`; any new column-aware test exercises this)
**Gate:** quick
**Commit:** `feat(songs): P8-07 — migration 007 add background-preset + typography columns`

---

### T12: Rust domain types — BackgroundPreset / FontFamily / FontSize / Typography (P8-07)

**What:** Add the new enums + extended `BackgroundInfo` per design §5.3. `BackgroundInfo.media_kind` and `BackgroundInfo.asset_url` become `Option<…>` so a pure preset background can omit them.

**Where:**
- `src-tauri/src/domain/background.rs`:
  - Add `BackgroundPreset { PretoBranco, BrancoPreto }` (kebab-case serde)
  - Add `FontFamily { Sans, Serif, Mono }` (snake_case)
  - Add `FontSize { Sm, Md, Lg, Xl }` (snake_case)
  - Add `Typography { font_family, font_size }` (camelCase)
  - Update `BackgroundInfo`: `media_kind: Option<MediaKind>`, `asset_url: Option<String>`, plus `preset: Option<BackgroundPreset>`, `typography: Option<Typography>`
- Add serde round-trip tests for the three new enums + Typography + the extended `BackgroundInfo` (legacy media case + new preset case)
- Sweep call sites that pattern-match on `background.media_kind` directly — they need `if let Some(kind) = bg.media_kind` now:
  - `src-tauri/src/services/background.rs` — extract into Options
  - Any test referencing `media_kind: MediaKind::…` directly — wrap in `Some(...)`

**Depends on:** T11 (migration must precede the read code)

**Reuses:**
- Existing `MediaKind` enum
- Existing serde patterns in `domain/background.rs`

**Tools:** None

**Done when:**
- [ ] All new enums + Typography compile with serde round-trip tests passing
- [ ] `BackgroundInfo` builds with media_kind/asset_url as Option
- [ ] All Rust callers compile (sweep with `cargo build` and `cargo clippy`)
- [ ] `cargo test` green

**Tests:** unit (serde round-trips for each new type)
**Gate:** quick
**Commit:** `feat(background): P8-07 — domain types for background presets + typography`

---

### T13: services::background::resolve_for_slide preset-mode branch (P8-07)

**What:** Extend the resolver to read the new columns + return a preset-mode `BackgroundInfo` when `background_mode = 'preset'`. The existing section → song → None fallback chain remains; the new branch sits inside each level.

**Where:**
- `src-tauri/src/services/background.rs::resolve_for_slide`:
  - Update the section-level SELECT to include `background_mode, background_preset, font_family, font_size`
  - If section's `background_mode = 'preset'`: build `BackgroundInfo { media_kind: None, asset_url: None, preset: Some(parsed), typography: Some(...), … }`
  - Else if section's `background_id` is set: existing media branch
  - Else fall through to song-level (apply same logic)
- Add tests:
  - Section with preset mode wins over song media
  - Song-level preset returned when section has nothing
  - Legacy row (background_mode=NULL, background_id IS NULL) returns `None`
  - Legacy row with only background_id still resolves as media

**Depends on:** T12

**Reuses:**
- Existing test harness (`open_db`, `db_create_song`, `db_insert_media`)

**Tools:** None

**Done when:**
- [ ] Resolver returns preset-mode `BackgroundInfo` when section has `background_mode='preset'`
- [ ] Legacy resolution path unchanged (media + scrim)
- [ ] All 4 new test cases pass (section-preset, song-preset, legacy-media, none)
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml -- background` green

**Tests:** integration (uses sqlite in-memory)
**Gate:** quick
**Commit:** `feat(background): P8-07 — resolve_for_slide preset-mode branch`

---

### T14: commands::song DB read/write + Section/Create payloads (P8-07)

**What:** Wire the new columns through every Rust read/write path. CreateSongPayload, SectionPayload, db_create_song, db_update_song, load_sections all need the new fields.

**Where:**
- `src-tauri/src/commands/song.rs`:
  - `CreateSongPayload` — add `background_mode, background_preset, font_family, font_size: Option<...>`
  - `SectionPayload` — same four fields
  - `db_create_song` INSERT — append the 4 columns to the songs + song_sections INSERTs
  - `db_update_song` UPDATE — same
  - `load_sections` SELECT — pull the 4 columns
- `src-tauri/src/domain/song.rs::Song` and `SongSection`:
  - Add `background_mode: Option<String>`, `background_preset: Option<String>`, `font_family: Option<String>`, `font_size: Option<String>`
  - OR (cleaner) add `background_config: Option<BackgroundConfig>` typed struct — design.md picked discrete fields; stay consistent
- Update serde round-trip tests in `domain/song.rs`

**Depends on:** T13

**Reuses:**
- Existing payload-binding pattern in `db_create_song`

**Tools:** None

**Done when:**
- [ ] CreateSongPayload + SectionPayload include the 4 new fields
- [ ] `db_create_song` persists them
- [ ] `db_update_song` updates them
- [ ] `load_sections` returns them
- [ ] Domain `Song` + `SongSection` round-trip tests cover the new fields
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml -- song` green
- [ ] `cargo clippy -- -D warnings` clean

**Tests:** unit + integration (song CRUD)
**Gate:** quick
**Commit:** `feat(songs): P8-07 — persist background-preset + typography fields`

---

### T15: Frontend types + presentation renderers (SongBackground, SongSlide, LivePreview) (P8-07)

**What:** Mirror the Rust types in TS. Make the song/section renderers honour the preset + typography. The SongBackground component branches on `background.preset` vs `background.assetUrl`. SongSlide reads typography to apply font-family + font-size. LivePreview mirrors both.

**Where:**
- `src/types/index.ts`:
  - Add `BackgroundPreset = "preto-branco" | "branco-preto"`
  - Add `FontFamily = "sans" | "serif" | "mono"`
  - Add `FontSize = "sm" | "md" | "lg" | "xl"`
  - Add `Typography { fontFamily, fontSize }`
  - Update `BackgroundInfo`: `mediaKind?, assetUrl?, scrimOpacity, restartOnSectionBoundary, preset?, typography?`
- `src/components/presentation/SongBackground.tsx` — branch on `background.preset`; render solid color if preset, otherwise existing media branch
- `src/windows/presentation/PresentationApp.tsx::SongSlide` — read `background?.preset` for fg color; read `background?.typography` for font + size; constants `PRESET_STYLES`, `FONT_CLASS`, `SIZE_STYLE` from design §5.5
- `src/components/presentation/LivePreview.tsx::SongSlidePreview` — same preset + typography logic at preview scale (the lyric text gets the same font/color, just smaller via existing fluid sizing)
- Update Vitest:
  - `LivePreview.test.tsx` covers preset rendering
  - `PresentationApp.test.tsx` covers song with preset background

**Depends on:** T14

**Reuses:**
- Existing `usePresentationStore`
- Existing Tailwind `font-sans/serif/mono` classes (already in default theme)

**Tools:** None

**Done when:**
- [ ] TS types mirror Rust domain
- [ ] SongBackground renders a solid-color div for preset mode
- [ ] SongSlide applies font-family + size + color per typography + preset
- [ ] LivePreview mirrors the same rendering at preview scale
- [ ] New Vitest cases (preset background rendering) pass
- [ ] `tsc --noEmit` clean
- [ ] `npx vitest run src/components/presentation src/windows/presentation` green

**Tests:** unit
**Gate:** quick
**Commit:** `feat(presentation): P8-07 — renderers honour background preset + typography`

---

### T16: SongEditor BackgroundPicker → 3-tab (Inherit | Preset | Media) (P8-07)

**What:** Refactor the existing media-only `BackgroundPicker` into a three-tab control: Inherit (sections only) / Preset / Media. Preset tab shows two swatches + Font + Size pickers. Inherit shows an info text. Media tab is the existing UI lightly refactored.

**Where:**
- `src/components/library/SongEditor.tsx` — replace inline `BackgroundPicker` (lines 28-160) with a new composite component (could live in same file or be extracted to `src/components/library/BackgroundEditor.tsx`)
- New subcomponents:
  - `BackgroundModeTabs` — radio tab strip
  - `BackgroundPresetTab` — 2 swatch buttons (`Preto/Branco`, `Branco/Preto`) + Font radio (Sans / Serif / Mono) + Size radio (Sm / Md / Lg / Xl)
  - `BackgroundMediaTab` — current picker body extracted
  - `BackgroundInheritTab` — single info text
- Wire the new state into the existing song save flow: `backgroundMode`, `backgroundPreset`, `fontFamily`, `fontSize` join `backgroundId`, `scrimOpacity` in the `useState` + `payload` in `handleSave`
- Same component used at song level AND section level (section level adds the Inherit option)
- Update i18n with the new labels:
  - `editor.bg.mode.inherit`, `editor.bg.mode.preset`, `editor.bg.mode.media`
  - `editor.bg.preset.pretoBranco`, `editor.bg.preset.brancoPreto`
  - `editor.bg.font.family`, `editor.bg.font.size`, `editor.bg.font.sans`, …
- Vitest: new tabs render, switching tabs preserves draft state, saving persists all 6 fields (4 new + 2 legacy)

**Depends on:** T15

**Reuses:**
- Existing media-picker modal (`showPicker`, grid of media thumbnails)
- Existing `updateSong` API command
- Tab component pattern (build inline if no shared tabs component exists)

**Tools:** None

**Done when:**
- [ ] SongEditor section card shows three tabs
- [ ] Selecting Preset + a preset + Font + Size → save → reopen → values persist
- [ ] Selecting Media → existing picker still works
- [ ] Selecting Inherit on a section → backend stores `background_mode = NULL` (legacy behaviour)
- [ ] Section-level Inherit + song-level Preset → projection uses song's preset (validated via T13's resolver tests)
- [ ] `tsc --noEmit` clean
- [ ] `npx vitest run src/components/library` green
- [ ] Manual smoke: edit a song, set Preset Preto/Branco Serif Lg, save, project — verse renders white serif on black

**Tests:** unit + manual smoke
**Gate:** quick
**Commit:** `feat(songs): P8-07 — SongEditor 3-tab BackgroundPicker (Inherit | Preset | Media)`

---

### T17: Full gate + STATE/ROADMAP update (cleanup)

**What:** Run the complete test suite and static checks; verify acceptance criteria across the 8 stories; update project STATE.md + ROADMAP.md with Phase 8 completion notes.

**Where:**
- Run all gates:
  - `cargo test --manifest-path src-tauri/Cargo.toml` — green
  - `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` — clean
  - `npx vitest run` — green
  - `tsc --noEmit` — green
  - `Grep "asset://localhost"` — zero matches outside docs (P8-06 invariant)
  - `Grep "ESCAPE/SPACE"` — zero matches (P8-05 invariant)
- Manual smoke checklist (design §7.3): all 14 items pass
- `STATE.md` — add Phase 8 section: 8/8 P8 done, all 4 acceptance criteria sets verified
- `ROADMAP.md` — mark Phase 8 complete; if applicable, add P9 placeholder
- Update `memory/MEMORY.md` index pointer to a new `project_phase8.md` snapshot memory

**Depends on:** T4, T5, T6, T7, T8, T10, T16 (every previous task)

**Reuses:**
- Existing STATE.md / ROADMAP.md structure (per Phase 6 / Phase 7 entries)

**Tools:** None

**Done when:**
- [ ] All gates green
- [ ] All manual smoke items pass
- [ ] STATE.md + ROADMAP.md updated
- [ ] Memory index updated
- [ ] No outstanding TODOs in Phase 8 spec / design / tasks

**Tests:** full suite
**Gate:** **full** — every gate
**Commit:** `chore(phase8): P8 — STATE/ROADMAP completion summary + memory snapshot`

---

## Coverage Matrix

| Requirement | Tasks | Notes |
|---|---|---|
| P8-01 — state sync | T3 | Closure-staleness fix + emit_state tracing |
| P8-02 — set-item click | T3 | Same fix; downstream of P8-01 |
| P8-03 — countdown projection | T5 | No-config fallback message; main bug resolves via T3+T1 |
| P8-04 — ESC freeze | T4 | Rust idempotency + reorder + frontend dedup |
| P8-05 — ESC label | T6, T7 | Keycap labels + boot normaliser |
| P8-06 — image/video media | T1, T2, T8 | URL scheme (root cause) + thumb-pending UX |
| P8-07 — background presets | T11, T12, T13, T14, T15, T16 | Migration + domain + resolver + commands + renderers + editor UI |
| P8-08 — Apresentar buttons | T9, T10 | Hide prop + unified handler |

**Total: 17 task commits + 1 gate commit = 18 atomic commits.**

---

## Parallelisation Opportunities

After Phase 1 (T1+T2) lands, these can run in parallel against fresh branches:
- T3 (state sync)
- T6 (Keycap)
- T7 (binding normaliser)
- T8 (MediaCard thumb-pending)
- T11 (migration 007 — pure SQL, starts the P8-07 chain)

T4 (ESC freeze) must follow T3 because verification depends on state sync working.
T5 (countdown fallback) is independent after T1.
T9 → T10 (button consolidation) is a sequential pair.
T11 → T12 → T13 → T14 → T15 → T16 (P8-07 chain) is strictly sequential.

---

## Rollback Notes

Each task is a single atomic commit. If a task introduces a regression, revert that single commit:
- T1, T2 (URL scheme) — revertable but breaks all media rendering on Windows; do not revert without re-introducing the bug
- T11 (migration 007) — additive ALTER TABLE; revert by `ALTER TABLE … DROP COLUMN` migration 008 (sqlite supports DROP COLUMN since 3.35; runtime check in setup)
- T12-T16 (P8-07 chain) — revert in reverse order; the migration's added columns are harmless if unused

All other tasks are pure code changes; `git revert` is safe.
