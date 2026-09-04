# Phase 17 — Tasks

**Status:** Draft — 30 tasks (T1–T30), none started
**Spec:** `spec.md` (37 reqs P17-01..P17-37) · **Design:** `design.md`

**Gate (every task):** `npx vitest run` green · `npx tsc --noEmit` clean · `cargo test --manifest-path src-tauri/Cargo.toml` green · `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` clean

**Baseline — all four gates measured green on this tree before execution (2026-09-04):**

| Suite | Result | Detail |
|-------|--------|--------|
| `npx vitest run` | **663 passed + 1 skipped** (664) across 81 files, exit 0, 16s | ROADMAP's 641 is the `v1.3.0` figure — the tree has drifted +22 since |
| `cargo test --manifest-path src-tauri/Cargo.toml` | **349 passed + 1 ignored**, exit 0 | lib 302(+1 ignored) · fts 6 · import 2 · media 11 · migrations 13 · presentation 7 · songs 8 · doc 0 — matches the `v1.3.0` ROADMAP row exactly |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | **clean**, exit 0 | run with `--all-targets`, stricter than the phase gate |
| `npx tsc --noEmit` | **clean**, exit 0 | |

No task may reduce either count; every task states the tests it adds.

**Tooling:** No MCP servers are configured for this project. No task requires a skill.

**Environment:** both gates verified working here on **WSL/Linux** — `cargo test` builds and passes with no Windows toolchain. Phase 16's task list warned that Rust work needed the MSVC linker + Windows SDK; that applies to `npm run tauri build` (which links the app against WebView2), **not** to `cargo test`. Every task in this phase can therefore run in this environment; only T29's release build needs Windows.

**Sub-agent note (L-8):** any task whose gate is a full `cargo test` must run it synchronously in Bash and wait for the result in the same call — do not background or poll it.

---

## Shared-File Serialization (L-9)

These files are touched by more than one task and **must never be edited concurrently**, even when the tasks are otherwise independent:

| File | Tasks, in required order |
|------|--------------------------|
| `src/i18n/locales/{en-US,pt-BR}.json` | **T1 only** — every string this phase needs is collected there up front |
| `src/types/index.ts` | T11 → T12 |
| `src/api/commands.ts` | **T13 only** — absorbs both the countdown params and the play-count wrapper |
| `src/windows/operator/OperatorApp.tsx` | T23 → T24 |
| `src/components/set/SetBuilder.tsx` | T17 → T23 |
| `src-tauri/src/services/archive.rs` | T3 → T7 |
| `src/components/set/CountdownScheduleModal.tsx` | **T18 only** — name field and sliders land together |

---

## Dependency Graph

```
Phase 1 — foundations, fully parallel (no shared files)
  T1  i18n bundle
  T2  Rust countdown domain
  T3  Rust wipe_db
  T4  Rust camera domain
  T5  Rust set commands
  T6  library store activeSetId

Phase 2 — Rust completion + TS types
  T3 ─→ T7   (archive ordering)
  T2 ─→ T8   (countdown mirroring)
  T4 ─→ T9 ─→ T10   (mediamtx → stream command)
  T2 ─→ T11 ─→ T12  (TS types: countdown then camera — same file)

Phase 3 — IPC + shared helpers
  T5, T11 ─→ T13  (commands.ts + countdown store)
  T1      ─→ T14  (formatCommandError)

Phase 4 — components, parallel except where noted
  T11         ─→ T15  (CountdownRenderer)
  T1,T11,T12  ─→ T16  (itemLabel)
  T1,T11,T12  ─→ T17  (SetBuilder labels)
  T1,T11,T13  ─→ T18  (countdown modal)
  T11,T13     ─→ T19  (takeover synthetic configs)
  T14         ─→ T20  (BackupScreen)
  T1,T6,T13   ─→ T21  (SetPicker)
  T1,T12      ─→ T25  (camera editor)
  T12         ─→ T26  (WebViewRenderer)
  T12         ─→ T27  (profile switcher gate)

Phase 5 — wiring, strictly sequential (shared files)
  T21 ─→ T22 ─→ T23 ─→ T24
                 ↑
                T17 (SetBuilder.tsx must land first)

Phase 6 — release
  all ─→ T28 ─→ T29 ─→ T30
```

Parallelisable batches: **{T1..T6}**, then **{T7, T8, T9, T11}**, then **{T10, T13, T14}**, then **{T15, T16, T17, T18, T19, T20, T21, T25, T26, T27}**, then the T22→T24 chain, then release.

---

## 17C — Restore integrity (ship first if split)

## T1 — i18n bundle for the whole phase

- **What:** Add every string Phase 17 needs to both locales, in one pass, so no later task touches these files.
- **Where:** `src/i18n/locales/en-US.json`, `src/i18n/locales/pt-BR.json`
- **Depends on:** None
- **Reuses:** the existing `error.*` namespace shape (`error.media.db_error` etc.)
- **Done when:**
  - `countdown.defaultName` ("Countdown" / "Cronômetro"), `countdown.editor.name`, `countdown.editor.messageScale`, `countdown.editor.digitsScale`, `countdown.editor.scaleReset` exist
  - `error.generic` ("Something went wrong ({{code}})" / pt-BR equivalent) exists
  - `error.backup.{export_failed,inspect_failed,restore_failed,abort_failed,db_not_ready,path_error}` and `error.set.{db_error,not_found}` exist, each carrying `{{detail}}` where the Rust side sends one
  - `backup.import.ledgerCleared` exists
  - `sets.picker.{label,switch,create,rename,delete,deleteWithPlays,lastSetHint}` exist
  - `builder.add.webView` value becomes "Camera"/"Câmera"; `webview.editor.modes.{iframe,mjpeg,rtsp}` re-worded per design; `webview.editor.unsupportedMode` added; `webview.editor.modes.{rtmp,srt,multicast}`, `webview.editor.{srt,multicast,rtmp}.*` blocks deleted
  - `builder.countdownSummary` deleted
  - **Keys unchanged elsewhere** — the `webview.*` namespace is not renamed
- **Tests:** unit — `src/tests/i18n/key-completeness.test.ts` stays green (it fails on any key present in one file only). Add a guard asserting no locale value still contains "WebView".
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-17, P17-28 (strings half), and the string half of P17-02/03/05/08/18/19/25/26/32
- **Commit:** `feat(i18n): phase 17 strings — countdown naming/sizing, backup errors, set picker, camera rename`

## T2 — Rust: countdown domain fields

- **What:** Add `name`, `message_scale`, `digits_scale` to `CountdownConfig`, and the two scales to `CountdownState`.
- **Where:** `src-tauri/src/domain/countdown.rs`
- **Depends on:** None
- **Reuses:** the existing hand-written `Deserialize` for `CountdownConfig` (the established pattern for backward-compatible blob fields)
- **Done when:**
  - `CountdownConfig` carries `name: Option<String>` plus `message_scale: u16` / `digits_scale: u16`
  - the manual `Deserialize` reads `name` like `message`, and reads each scale as `.and_then(as_u64).map(|n| n.clamp(50,300) as u16).unwrap_or(100)`
  - `CountdownState` carries both scales with an explicit `#[serde(default = "…")]` helper returning **100** — not `u16::default()`
  - `CountdownState::default()` sets both to 100
- **Tests:** unit — (a) a pre-Phase-17 config blob deserializes with `name: None` and both scales 100; (b) a blob with `messageScale: 9999` clamps to 300 and `1` clamps to 50; (c) round-trip of a fully-populated config; (d) a serialized pre-Phase-17 `CountdownState` deserializes with both scales 100.
- **Gate:** quick (`cargo test --manifest-path src-tauri/Cargo.toml`)
- **Requirements:** P17-01, P17-06
- **Commit:** `feat(countdown): name and per-item message/digit scales on CountdownConfig`

## T3 — Rust: transactional, ledger-aware `wipe_db`

- **What:** Delete `song_plays` first and run the whole wipe in one transaction.
- **Where:** `src-tauri/src/services/archive.rs` (`wipe_db`)
- **Depends on:** None
- **Reuses:** the existing delete list and FTS rebuild statement
- **Done when:**
  - order is `song_plays → set_items → sets → songs → media → settings`, then the FTS rebuild, all inside `pool.begin()` … `commit()`
  - a failure anywhere rolls the whole wipe back
  - the doc comment states why `song_plays` is first (NO ACTION FKs) and why `tags` is deliberately left
- **Tests:** integration (sqlx, co-located) — **the regression test seeds `song_plays` before wiping**; without that seed it passes against the broken code. Assert: wipe succeeds with a populated ledger; every table listed is empty afterwards; FTS returns no rows.
- **Gate:** quick (`cargo test --manifest-path src-tauri/Cargo.toml`)
- **Requirements:** P17-11, P17-12
- **Commit:** `fix(backup): delete the play ledger before sets so a replace restore can wipe`

## T4 — Rust: camera domain, supported/legacy split

- **What:** Split `WebViewMode` into offered and legacy variants; remove the SRT and multicast config types and fields.
- **Where:** `src-tauri/src/domain/set.rs`
- **Depends on:** None
- **Reuses:** existing serde attributes on `WebViewConfig`
- **Done when:**
  - `WebViewMode` keeps all six variants; `pub fn is_supported(self) -> bool` returns true only for `Iframe`/`Mjpeg`/`Rtsp`; the three legacy variants carry a comment saying they are parse-only
  - `SrtConfig`, `SrtMode`, `MulticastConfig` are deleted, along with `WebViewConfig::srt_config` and `::multicast_config`
  - `profiles`, `active_profile_id`, `crop`, `rtsp_transport`, `basic_auth_*` are untouched
- **Tests:** unit — (a) a `v1.3.0` SRT blob (with `srtConfig` present) deserializes to `mode: Srt`, `is_supported() == false`, no panic, unknown keys ignored; (b) same for `multicast` and `rtmp`; (c) an rtsp config with profiles still round-trips byte-for-byte; (d) `is_supported()` truth table.
- **Gate:** quick (`cargo test --manifest-path src-tauri/Cargo.toml`)
- **Requirements:** P17-29, P17-30, P17-32
- **Commit:** `refactor(camera): split WebViewMode into offered and legacy, drop SRT/multicast configs`

## T5 — Rust: set deletion takes its ledger with it

- **What:** Make `delete_set` transactional and ledger-aware; add a read-only play-count command.
- **Where:** `src-tauri/src/commands/set.rs`, registration in `src-tauri/src/lib.rs`
- **Depends on:** None
- **Reuses:** the `set.db_error` / `set.not_found` error codes and the `set_changed` emit already in `delete_set`
- **Done when:**
  - `delete_set` runs `DELETE FROM song_plays WHERE set_id = ?` then `DELETE FROM sets WHERE id = ?` in one transaction, keeping the `rows_affected() == 0 → set.not_found` behaviour on the *sets* delete
  - `get_set_play_count(id) -> i64` exists, is registered in the `invoke_handler![]`, and never mutates
  - the write guard rule is unaffected (no `presentation` lock is taken here)
- **Tests:** integration (sqlx, co-located — this file already has 4 such tests) — (a) deleting a set with seeded `song_plays` succeeds and removes exactly that set's ledger rows, leaving another set's rows intact; (b) deleting an unknown id still returns `set.not_found`; (c) `get_set_play_count` returns the seeded count and 0 for a set with none.
- **Gate:** quick (`cargo test --manifest-path src-tauri/Cargo.toml`)
- **Requirements:** P17-26 (backend half)
- **Commit:** `fix(sets): delete a set's play-ledger rows with it, and expose the count`

## T6 — Frontend store: active set with persistence

- **What:** Replace `fixedSetId` with `activeSetId` plus the persisted-preference resolver.
- **Where:** `src/stores/library.ts`
- **Depends on:** None
- **Reuses:** `getSetting`/`setSetting` and the try/catch idiom at `api/commands.ts:71-79`
- **Done when:**
  - `ACTIVE_SET_KEY = "ui.active_set_id"` is exported
  - `loadActiveSet()` implements the chain: stored id → verify with `getSet` → fall back to `getOrCreateDefaultSet()`; a rejected `getSetting` (key absent) is caught, not thrown
  - `setActiveSet(id)` updates state immediately and persists; a failed persist logs and does not throw
  - `fixedSetId` / `loadFixedSet` are gone from the store's type and implementation
- **Tests:** unit (stores are in the coverage matrix) — (a) stored id that exists wins; (b) `getSetting` rejecting falls through to the default set; (c) stored id whose `getSet` rejects falls through; (d) `setActiveSet` writes the setting.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-21, P17-22
- **Commit:** `feat(sets): persist the operator's active set`

## T7 — Rust: validate before destroying

- **What:** Hoist the archive read ahead of the destructive branch and wipe the DB before deleting media.
- **Where:** `src-tauri/src/services/archive.rs` (`import`, `do_import`)
- **Depends on:** T3
- **Reuses:** `read_archive_data` (moved, not rewritten), `RESTORE_IN_PROGRESS_FLAG`
- **Done when:**
  - `import()` calls `read_archive_data` (in `spawn_blocking`) before the `mode == Replace` branch; `do_import` takes the parsed data instead of a path
  - Replace order is: write flag → `wipe_db` → **on `Err`, remove the flag and return** → delete media files → import → remove flag
  - Merge mode's behaviour is byte-identical to today
- **Tests:** integration (sqlx + tempdir, co-located — this file already has 6 such tests) — (a) **end-to-end Replace restore over a library with a populated `song_plays` ledger succeeds** and the summary counts match the manifest; (b) a truncated/entry-missing `.tlz` leaves songs, media rows and media files untouched and writes no flag; (c) after a successful Replace no flag file remains; (d) the existing Merge test is unchanged and still passes.
- **Gate:** full
- **Requirements:** P17-12, P17-13, P17-14
- **Commit:** `fix(backup): validate the archive and wipe the database before deleting media`

## T8 — Rust: mirror the countdown appearance

- **What:** Carry the two scales through `start_countdown` / `arm_countdown` onto `CountdownState`.
- **Where:** `src-tauri/src/commands/countdown.rs`
- **Depends on:** T2
- **Reuses:** the Phase 14 mirroring block that already assigns `s.position` / `s.background_media_id` (`:349-350`, `:489-490`) and the reset at `:426-427`
- **Done when:**
  - both commands take `message_scale: Option<u16>` and `digits_scale: Option<u16>`, defaulting to 100 when absent, clamped 50–300
  - both mirroring blocks and the reset block set them alongside `position`
  - the write guard is still dropped before `app.emit()` in every touched path
- **Tests:** unit (this file already has 10) — (a) arming with scales mirrors them onto the state; (b) omitting them yields 100/100; (c) out-of-range clamps; (d) reset returns both to 100.
- **Gate:** quick (`cargo test --manifest-path src-tauri/Cargo.toml`)
- **Requirements:** P17-09 (backend half)
- **Commit:** `feat(countdown): mirror message/digit scales onto CountdownState for takeovers`

## T9 — Rust: single-protocol MediaMTX source

- **What:** Collapse `Source` to RTSP and simplify `render_config`.
- **Where:** `src-tauri/src/services/mediamtx.rs`
- **Depends on:** T4
- **Reuses:** `yaml_quote`, `whep_url`, `PATH_NAME`, the existing rtsp path body
- **Done when:**
  - `Source` is replaced by `RtspSource { url: String, transport: Option<String> }`; the `Pull`/`SrtPull`/`SrtListen` arms and the SRT-server branch are gone
  - the rendered YAML for an RTSP source with and without a transport is unchanged from today
  - the module doc comment no longer claims RTMP/SRT/multicast support
- **Tests:** unit (services require unit tests) — keep and adapt the existing RTSP render assertions; add one asserting the config never emits an `srt:` server block.
- **Gate:** quick (`cargo test --manifest-path src-tauri/Cargo.toml`)
- **Requirements:** P17-31
- **Commit:** `refactor(camera): MediaMTX proxies RTSP only`

## T10 — Rust: `StreamSource` keeps one kind

- **What:** Narrow the stream command's payload to rtsp.
- **Where:** `src-tauri/src/commands/stream.rs`
- **Depends on:** T4, T9
- **Reuses:** the existing rtsp branch and its error codes
- **Done when:** the `rtmp`/`srt`/`multicast` variants and their match arms are gone; the command still returns the WHEP URL for an rtsp source; no `unreachable!()` or catch-all is left behind
- **Tests:** none (`commands/stream.rs` has no co-located tests today and the matrix assigns commands "none"; the behaviour is covered by T9's render tests and T26's renderer tests)
- **Gate:** quick (`cargo test --manifest-path src-tauri/Cargo.toml`)
- **Requirements:** P17-31
- **Commit:** `refactor(camera): StreamSource carries only rtsp`

## T11 — TS types: countdown

- **What:** Mirror T2's domain change in the TypeScript types.
- **Where:** `src/types/index.ts`
- **Depends on:** T2
- **Reuses:** the existing `CountdownConfig` / `CountdownState` interfaces
- **Done when:** `CountdownConfig` gains `name?: string`, `messageScale?: number`, `digitsScale?: number`; `CountdownState` gains both scales as required numbers; no other interface changes
- **Tests:** none (types only — not in the coverage matrix; `npx tsc --noEmit` is the check)
- **Gate:** quick (`npx tsc --noEmit && npx vitest run`)
- **Requirements:** P17-06 (frontend half)
- **Commit:** `feat(types): countdown name and scale fields`

## T12 — TS types: camera

- **What:** Mirror T4 — closed supported union, explicit legacy union, dropped configs.
- **Where:** `src/types/index.ts`
- **Depends on:** T4, **T11** (same file — must not run concurrently)
- **Reuses:** the existing `WebViewConfig` interface
- **Done when:**
  - `WebViewMode = "iframe" | "mjpeg" | "rtsp"` and `LegacyWebViewMode = "rtmp" | "srt" | "multicast"` are exported; `WebViewConfig.mode: WebViewMode | LegacyWebViewMode`
  - `SrtConfig`, `SrtMode`, `MulticastConfig` and the two config fields are removed
  - `StreamSource` keeps only its rtsp shape
  - `PROFILE_MODES: WebViewMode[] = ["rtsp", "mjpeg"]` is exported from `src/utils/streamProfile.ts`
- **Tests:** unit — `utils/streamProfile.ts` is in the matrix; add a case asserting `PROFILE_MODES` excludes `iframe`. Existing `streamProfile.test.ts` cases stay green.
- **Gate:** quick (`npx tsc --noEmit && npx vitest run`)
- **Requirements:** P17-29, P17-30, P17-33 (constant half)
- **Commit:** `feat(types): camera modes narrowed to rtsp/mjpeg/iframe`

## T13 — IPC wrappers and countdown store params

- **What:** Widen the countdown params and add the play-count wrapper — the only task allowed to touch `commands.ts`.
- **Where:** `src/api/commands.ts`, `src/stores/countdown.ts`
- **Depends on:** T5, T11
- **Reuses:** `StartCountdownParams` / `ArmCountdownParams`, the existing `invoke<T>` wrapper style
- **Done when:**
  - both param types gain `messageScale?: number` / `digitsScale?: number`, passed through to the invoke payload
  - `useCountdownStore.start` / `.arm` accept and forward them
  - `getSetPlayCount(id: string): Promise<number>` wraps `get_set_play_count`
  - no raw `invoke()` is introduced anywhere else
- **Tests:** unit — `stores/countdown.ts` is in the matrix: assert `arm`/`start` forward both scales. (`api/commands.ts` itself is "none" per the matrix — thin wrappers.)
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-09 (frontend half), P17-26 (wrapper half)
- **Commit:** `feat(api): countdown scale params and set play-count wrapper`

## T14 — `formatCommandError` helper

- **What:** One place that turns an `ErrorPayload` into a localized sentence.
- **Where:** `src/i18n/commandError.ts` (new)
- **Depends on:** T1
- **Reuses:** `normalizeError` (`api/commands.ts:32`), the `error.*` namespace
- **Done when:** `formatCommandError(err, t)` returns `t(["error." + code, "error.generic"], { ...params, code })`; a plain `Error`, a string and a raw `ErrorPayload` all produce a readable sentence; nothing returns `[object Object]`
- **Tests:** unit — (a) known code renders its message with params interpolated; (b) unknown code falls back to `error.generic` carrying the code; (c) a non-payload rejection still yields a string; (d) explicitly assert the output never equals `"[object Object]"`.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-16
- **Commit:** `feat(i18n): shared command-error formatter`

## T15 — `CountdownRenderer` honours the scales

- **What:** Multiply all three clamp terms by each element's scale.
- **Where:** `src/components/presentation/CountdownRenderer.tsx`
- **Depends on:** T11
- **Reuses:** the existing `containerType: size` wrapper and `POSITION_CLASS`
- **Done when:** a local `scaled(min, mid, max, pct)` helper builds `clamp(calc(...), calc(...), calc(...))`; message uses `0.75rem/3cqmin/2rem`, digits `2rem/30cqmin/18rem`; absent scales default to 100
- **Tests:** component — (a) at 100/100 the rendered `style.fontSize` of both elements equals the unscaled control (assert the *computed* value, not the string); (b) 150% message / 80% digits produce proportionally larger/smaller values; (c) an absent scale renders as 100%.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-07
- **Commit:** `feat(countdown): scale the message and digits independently`

## T16 — `itemLabel` takes the translator

- **What:** Localize the countdown and camera branches and thread `t` through the four call sites.
- **Where:** `src/components/presentation/itemMeta.tsx`, `OperatorPresentationLayout.tsx`, `SetItemList.tsx`, `OutputLaunchModal.tsx`, `StrophesGrid.tsx`
- **Depends on:** T1, T11, T12
- **Reuses:** the existing pure-function shape and its tests
- **Done when:**
  - signature is `itemLabel(item, songs, media, t, fallback = "—")`; the function stays pure (no hooks)
  - countdown branch returns `cfg?.name?.trim() || t("countdown.defaultName")` — **no duration, no time, no `"10min"`**
  - camera branch returns `Câmera — <host>` for rtsp/mjpeg, `Página web — <host>` for iframe, via i18n; the `Globe` icon becomes `Video` for this item type
  - all four call sites pass their existing `t`
- **Tests:** component — (a) named countdown returns the name; (b) unnamed returns the localized default and contains neither ":" nor "min"; (c) iframe vs rtsp camera labels differ; (d) existing `itemMeta` assertions updated, none deleted.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-02, P17-04, P17-28 (label half)
- **Commit:** `fix(labels): localize countdown and camera set-item names`

## T17 — `SetBuilder` item summaries

- **What:** Replace the countdown summary and the camera summary in the builder list.
- **Where:** `src/components/set/SetBuilder.tsx`
- **Depends on:** T1, T11, T12
- **Reuses:** `itemSummary`'s existing switch
- **Done when:**
  - the `countdown` case renders the name or the localized default; the `durLabel` expression and its `"10min"` literal are deleted
  - the `web_view` case renders the camera/web-page wording and shows the unsupported banner text for a legacy mode
  - the add button reads the new camera label
- **Tests:** component — (a) unconfigured countdown renders neither "10min" nor a duration; (b) named countdown renders its name; (c) a legacy-mode camera item renders the unsupported wording. Existing `SetBuilder.test.tsx` assertions updated, none deleted.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-03, P17-28, P17-32 (builder half)
- **Commit:** `fix(builder): name countdown and camera items correctly`

## T18 — Countdown modal: name field and size controls

- **What:** Add the name input and the two percentage sliders to the configuration modal.
- **Where:** `src/components/set/CountdownScheduleModal.tsx`
- **Depends on:** T1, T11, T13
- **Reuses:** the modal's existing state → `newConfig` → `updateSetItem` save path and its `message` trim-to-undefined idiom
- **Done when:**
  - a name input sits above Duration; whitespace-only saves as `undefined`
  - two sliders (50–300, step 5, default 100) with a visible percentage and a reset-to-100 control
  - `newConfig` carries `name`, `messageScale`, `digitsScale`; the `arm(...)` call passes both scales
- **Tests:** component — (a) typing a name and saving calls `updateSetItem` with it; (b) whitespace-only name saves `undefined`; (c) moving a slider and saving persists the value; (d) reset returns it to 100; (e) arming forwards both scales.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-05, P17-08
- **Commit:** `feat(countdown): name and size controls in the configuration modal`

## T19 — Takeover synthetic configs

- **What:** Make both synthetic takeover configs carry the mirrored appearance.
- **Where:** `src/components/presentation/LivePreview.tsx`, `src/windows/presentation/PresentationApp.tsx`
- **Depends on:** T11, T13
- **Reuses:** the two existing synthetic-config blocks (`LivePreview.tsx:84-89`, `PresentationApp.tsx:225-231`)
- **Done when:**
  - both blocks set `messageScale` / `digitsScale` from `CountdownState`
  - `LivePreview` uses `countdown.position ?? "center"` instead of the hardcoded `"center"` (RC-11)
  - `PresentationApp.tsx:199`'s `startCountdown` call forwards both scales from the item config
- **Tests:** component — (a) a takeover state with `position: "bottom-right"` renders the preview bottom-right, not centred; (b) a takeover with scales renders them; (c) the auto-start effect forwards the item's scales.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-09, P17-10
- **Commit:** `fix(preview): takeover preview honours position and scales`

## T20 — `BackupScreen`: real messages and a ledger note

- **What:** Replace all four `String(err)` sites and state that the ledger was cleared.
- **Where:** `src/components/backup/BackupScreen.tsx`, `src/components/backup/RestoreInProgressDialog.tsx`
- **Depends on:** T14
- **Reuses:** `formatCommandError`, the existing `ImportSummary` render
- **Done when:**
  - every `setError(String(err))` becomes `setError(formatCommandError(err, t))` (3 in `BackupScreen`, 1 in `RestoreInProgressDialog`)
  - a Replace-mode summary renders `backup.import.ledgerCleared`
  - no other error-handling behaviour changes
- **Tests:** component — (a) a rejected `restoreLibrary` with an `ErrorPayload` renders the localized message, and the assertion explicitly excludes `"[object Object]"`; (b) an unmapped code renders the generic sentence with the code; (c) a Replace summary shows the ledger note and a Merge summary does not.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-16, P17-18
- **Commit:** `fix(backup): show what actually failed instead of [object Object]`

## T21 — `SetPicker`

- **What:** The Home header control: switch, create, rename, delete.
- **Where:** `src/components/setbuilder/SetPicker.tsx` (new)
- **Depends on:** T1, T6, T13
- **Reuses:** `useSetsStore`, the `onSetChanged` subscription lifted from `SetList.tsx:19-24`, `ConfirmDialog`, `createSet`/`updateSet`/`deleteSet`, `getSetPlayCount`
- **Done when:**
  - renders the active set's name and a list of every set with item counts
  - selecting one calls `setActiveSet`; create makes the new set active; rename calls `updateSet`
  - delete opens `ConfirmDialog` naming the set and its play count (fetched via `getSetPlayCount`), and is disabled when only one set exists
  - a `disabled` prop suppresses every mutating control
- **Tests:** component — (a) lists sets with counts and marks the active one; (b) selecting calls `setActiveSet`; (c) create → `createSet` + becomes active; (d) rename → `updateSet`; (e) delete confirmation shows the play count and calls `deleteSet`; (f) delete disabled with a single set; (g) `disabled` hides/disables mutations.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-19, P17-25, P17-26
- **Commit:** `feat(sets): set picker for the Home header`

## T22 — Wire the picker into Home

- **What:** Render the picker and repoint every `fixedSetId` use.
- **Where:** `src/components/setbuilder/HomeSetBuilder.tsx`
- **Depends on:** T21
- **Reuses:** the component's existing `presState` read and its `fixedSetId` call sites
- **Done when:**
  - `SetPicker` renders in the header, `disabled` while presenting (same predicate the nav lock uses)
  - `activeSetId` replaces `fixedSetId` in `handleApresentar`, `ensurePresentation`, `handleAddSong`, the drop handler and the `SetBuilder` render
  - switching sets re-renders the builder with no reload
- **Tests:** component — (a) picker rendered; (b) switching sets repoints `SetBuilder`'s `setId`; (c) "Apresentar" loads the **active** set; (d) picker disabled while presenting.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-20, P17-23, P17-24
- **Commit:** `feat(sets): Home edits and presents the selected set`

## T23 — Retire the unreachable sets views

- **What:** Delete the dead `sets` / `set-builder` navigation surface.
- **Where:** `src/stores/library.ts`, `src/windows/operator/OperatorApp.tsx`, `src/components/set/SetBuilder.tsx`, `src/components/presentation/SlideController.tsx`, delete `src/components/set/SetList.tsx` + `SetList` tests
- **Depends on:** T22, **T17** (SetBuilder.tsx ordering)
- **Reuses:** —
- **Done when:**
  - `AppView` loses `"sets"` and `"set-builder"`; `editingSetId` and `openSetBuilder` are removed from the store
  - `OperatorApp` loses both view branches and the standalone `SetBuilder` render
  - `SetBuilder` loses its back button and the `hideBack` prop; `SlideController.tsx:87` targets `"home"`
  - `SetList.tsx` and its test file are deleted; no import of them remains
- **Tests:** component — existing `OperatorApp` / `SlideController` tests updated for the new target; `npx tsc --noEmit` proves no stale `setView("sets")` survives. Deleting `SetList.test.tsx` is an intentional removal, recorded here so the count drop is not silent.
- **Gate:** full
- **Requirements:** P17-27
- **Commit:** `refactor(sets): remove the unreachable sets views`

## T24 — Launch re-arm carries the full appearance (DD-1)

- **What:** Re-arm from the **active** set and pass position, background and both scales.
- **Where:** `src/runtime/scheduledCountdown.ts`, `src/windows/operator/OperatorApp.tsx`
- **Depends on:** T13, T23 (OperatorApp.tsx ordering)
- **Reuses:** `findUpcomingScheduledCountdown` and the existing launch effect
- **Done when:**
  - `UpcomingScheduledCountdown` carries `position`, `backgroundMediaId`, `messageScale`, `digitsScale`, populated from the item config
  - the launch effect resolves the **active** set instead of calling `getOrCreateDefaultSet()` directly, and forwards all four fields to `arm`
- **Tests:** unit + component — (a) `findUpcomingScheduledCountdown` returns the appearance fields; (b) the launch effect arms with them; (c) it uses the active set id.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-37
- **Commit:** `fix(countdown): launch re-arm keeps position, background and scales`

## T25 — Camera editor: three modes, scoped profiles

- **What:** Rebuild the mode picker and the conditional blocks.
- **Where:** `src/components/set/WebViewSetItemEditor.tsx`
- **Depends on:** T1, T12
- **Reuses:** `StreamProfileEditor`, `isUrlAllowed`, the existing crop and basic-auth blocks, `PROFILE_MODES`
- **Done when:**
  - the radio list offers exactly `iframe`, `mjpeg`, `rtsp`; the SRT and multicast blocks, their state, their defaults and the RTMP hint are gone
  - `StreamProfileEditor` renders only when `PROFILE_MODES.includes(mode)` — never for iframe
  - an item on a legacy mode renders the `unsupportedMode` banner and offers the three supported modes to switch to; saving it writes a supported config
  - `buildConfig` no longer emits `srtConfig` / `multicastConfig`
- **Tests:** component — (a) exactly three radios; (b) no profile section on iframe, present on rtsp and mjpeg; (c) a legacy-mode item shows the banner; (d) switching it to rtsp and saving persists a supported config with no legacy keys.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-29, P17-31, P17-32, P17-33, P17-35
- **Commit:** `feat(camera): three modes, profiles only where they work`

## T26 — `WebViewRenderer`: rtsp-only proxy, MJPEG profiles

- **What:** Collapse the proxy branch and route MJPEG through the profile resolver.
- **Where:** `src/components/presentation/WebViewRenderer.tsx`
- **Depends on:** T12
- **Reuses:** `resolveActiveSource`, `StreamProxyRenderer`, the existing load-timeout watchdog
- **Done when:**
  - `isProxyMode(mode)` is `mode === "rtsp"`; `buildStreamSource` has one branch
  - the MJPEG path resolves its URL via `resolveActiveSource(config)` instead of reading `config.url` directly
  - iframe behaviour is unchanged; a legacy-mode config renders the camera error surface, never an indefinite blank
- **Tests:** component — (a) rtsp renders the proxy; (b) mjpeg with two profiles renders the **active profile's** URL; (c) iframe ignores profiles entirely; (d) a legacy mode renders the error surface.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-31, P17-34
- **Commit:** `fix(camera): honour the selected profile on MJPEG`

## T27 — Profile switcher mode gate

- **What:** Hide the mid-presentation switcher on modes that do not use profiles.
- **Where:** `src/components/presentation/StreamProfileSwitcher.tsx`
- **Depends on:** T12
- **Reuses:** the existing `profiles.length < 2` guard
- **Done when:** the guard also requires `PROFILE_MODES.includes(cfg.mode)`; behaviour for rtsp/mjpeg with ≥2 profiles is unchanged
- **Tests:** component — (a) hidden for iframe even with two profiles; (b) still shown for rtsp with two; (c) still hidden with one.
- **Gate:** quick (`npx vitest run`)
- **Requirements:** P17-33
- **Commit:** `fix(camera): profile switcher only on profile-capable modes`

## T28 — Version bump to 1.4.0

- **What:** Run the bump script across all five version sources.
- **Where:** `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`
- **Depends on:** T1–T27
- **Reuses:** `scripts/bump-version.mjs`
- **Done when:** all five read `1.4.0`; no dependency pin changed; `scripts/version-files.test.mjs` green
- **Tests:** unit (the existing version-files test)
- **Gate:** full
- **Requirements:** P17-36
- **Commit:** `chore(release): bump version to 1.4.0`

## T29 — Full gate and release tag

- **What:** Run the complete gate, then push `v1.4.0`.
- **Where:** repo
- **Depends on:** T28
- **Done when:** `cargo test`, `npx vitest run`, `npx tsc --noEmit`, `cargo clippy -D warnings` all clean; counts are ≥ baseline plus the new tests; tag pushed and the draft release carries both signed bundles and a two-platform `latest.json`
- **Tests:** none (gate execution)
- **Gate:** build
- **Requirements:** P17-36

## T30 — Manual verification (operator, production hardware)

- **What:** The four checks from design § Verification Beyond Unit Tests.
- **Depends on:** T29
- **Done when:**
  - [ ] Replace restore of a real production `.tlz` onto a copy completes; media files present afterwards
  - [ ] Three sets: switch, restart, selection survived; delete a presented set and the dialog states its play count
  - [ ] Countdown at 50/100/300% on the real wall, plus a takeover armed at launch honouring position, background and scales
  - [ ] Production RTSP camera with two profiles switched mid-presentation; MJPEG profile switch takes effect; Página web item shows no profile section
- **Tests:** manual
- **Gate:** none (hardware)

---

## Task Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T1 | 2 locale files, one string set | ✅ cohesive |
| T2, T4 | 1 domain module each | ✅ |
| T3, T7 | 1 function / 1 flow in one file | ✅ |
| T5 | 1 command + 1 new command, same file | ✅ 2 related things, same file |
| T6, T11, T12, T13, T14 | 1 store / 1 type file / 1 helper | ✅ |
| T8, T9, T10 | 1 module each | ✅ |
| T15, T17, T18, T20, T21, T22, T25, T26, T27 | 1 component each | ✅ |
| T16 | 1 function + 4 mechanical call sites | ⚠️ acceptable — the call-site edits are one-line and compiler-enforced |
| T19 | 2 files, one concept (synthetic takeover config) | ⚠️ acceptable — splitting would leave the wall and preview inconsistent between tasks |
| T23 | 5 files + 1 deletion | ⚠️ acceptable — a partial removal does not compile; `AppView` narrowing forces all of it at once |
| T24 | 2 files, one flow | ✅ |
| T28, T29, T30 | release mechanics | ✅ |

No ❌ — nothing needs splitting.

---

## Diagram–Definition Cross-Check

| Task | `Depends on` (body) | Diagram shows | Status |
|------|---------------------|---------------|--------|
| T1–T6 | None | Phase 1, no arrows in | ✅ |
| T7 | T3 | `T3 ─→ T7` | ✅ |
| T8 | T2 | `T2 ─→ T8` | ✅ |
| T9 | T4 | `T4 ─→ T9` | ✅ |
| T10 | T4, T9 | `T4 ─→ T9 ─→ T10` | ✅ |
| T11 | T2 | `T2 ─→ T11` | ✅ |
| T12 | T4, T11 | `T11 ─→ T12`, T4 via Phase 1 | ✅ |
| T13 | T5, T11 | `T5, T11 ─→ T13` | ✅ |
| T14 | T1 | `T1 ─→ T14` | ✅ |
| T15 | T11 | `T11 ─→ T15` | ✅ |
| T16 | T1, T11, T12 | `T1,T11,T12 ─→ T16` | ✅ |
| T17 | T1, T11, T12 | `T1,T11,T12 ─→ T17` | ✅ |
| T18 | T1, T11, T13 | `T1,T11,T13 ─→ T18` | ✅ |
| T19 | T11, T13 | `T11,T13 ─→ T19` | ✅ |
| T20 | T14 | `T14 ─→ T20` | ✅ |
| T21 | T1, T6, T13 | `T1,T6,T13 ─→ T21` | ✅ |
| T22 | T21 | `T21 ─→ T22` | ✅ |
| T23 | T22, T17 | `T22 ─→ T23`, `T17 ↑ T23` | ✅ |
| T24 | T13, T23 | `T23 ─→ T24` | ✅ |
| T25 | T1, T12 | `T1,T12 ─→ T25` | ✅ |
| T26, T27 | T12 | `T12 ─→ T26`, `T12 ─→ T27` | ✅ |
| T28 | T1–T27 | `all ─→ T28` | ✅ |
| T29, T30 | T28 / T29 | `T28 ─→ T29 ─→ T30` | ✅ |

No task in a parallel batch depends on another task in the same batch.

---

## Test Co-location Validation

Cross-referenced against `.specs/codebase/TESTING.md`.

| Task | Layer touched | Matrix requires | Task says | Status |
|------|---------------|-----------------|-----------|--------|
| T1 | i18n locales (not in matrix) | — | unit (parity test) | ✅ |
| T2 | `domain/countdown.rs` | unit | unit | ✅ |
| T3 | `services/archive.rs` | unit | integration (sqlx, stronger) | ✅ |
| T4 | `domain/set.rs` | unit | unit | ✅ |
| T5 | `commands/set.rs` | none* | integration (sqlx) | ✅ exceeds |
| T6 | `stores/library.ts` | unit | unit | ✅ |
| T7 | `services/archive.rs` | unit | integration (sqlx) | ✅ exceeds |
| T8 | `commands/countdown.rs` | none* | unit | ✅ exceeds |
| T9 | `services/mediamtx.rs` | unit | unit | ✅ |
| T10 | `commands/stream.rs` | none | none | ✅ |
| T11 | `types/index.ts` (not in matrix) | — | none (`tsc`) | ✅ |
| T12 | `types/index.ts` + `utils/streamProfile.ts` | unit (utils) | unit | ✅ |
| T13 | `api/commands.ts` (none) + `stores/countdown.ts` (unit) | unit — highest wins | unit | ✅ |
| T14 | `src/i18n/commandError.ts` (utility) | unit | unit | ✅ |
| T15–T22, T25–T27 | `components/**` | component | component | ✅ |
| T23 | `stores` + `components` + `windows` | component — highest wins | component | ✅ |
| T24 | `runtime/*.ts` (utility) + `windows/**` | unit + component | unit + component | ✅ |
| T28 | scripts/config | unit (existing) | unit | ✅ |
| T29, T30 | gate / manual | none | none | ✅ |

No ❌ violations.

**\* Matrix drift, noted not worked around:** `TESTING.md` assigns `src-tauri/src/commands/*.rs` a test type of "none (tested via integration)", but `commands/set.rs` already carries 4 co-located sqlx tests, `commands/countdown.rs` 10, and `commands/presentation.rs` 25. This phase follows the code, not the stale row. Correcting `TESTING.md` is a docs follow-up, not a Phase 17 task.

---

## Splitting for an early 17C release

If the restore fix ships ahead of the rest: **T1 (backup/error strings only) → T3 → T7 → T14 → T20 → T5**, then bump to `1.3.1` and tag. That subset is self-contained — it touches no file the other groups need first — and closes RC-3, RC-4, RC-5 and RC-7.
