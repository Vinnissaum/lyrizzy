# Trinity Lyrics v2 — State

**Last updated:** 2026-09-04
**Current phase:** Phase 17 SPECIFIED (2026-09-04) — `.specs/features/phase17-sets-countdown-camera-restore/` (36 reqs P17-01..P17-36, target tag `v1.4.0`) across six groups: 17A countdown naming (RC-1), 17B per-item countdown message/digit sizing (RC-2, plus RC-11 live-preview position), 17C Replace-restore integrity (RC-3 `song_plays` FK blocks `wipe_db`, RC-4 `[object Object]` errors, RC-5 media wiped before the failing wipe), 17D set switching on Home over the unreachable `SetList` (RC-6, RC-7), 17E camera rename + mode reduction to RTSP/MJPEG/web page and profile scoping (RC-8..RC-10), 17F `v1.4.0` release. User decisions D-75..D-78. **DESIGNED 2026-09-04** — `design.md`: transactional ledger-aware `wipe_db` with validate-then-destroy ordering, flat scale mirroring per the Phase 14 precedent, legacy camera modes kept as parse-only discriminants, `SetList` retired in favour of a Home `SetPicker`. Design surfaced DD-1/RC-12 (launch-time re-arm drops position+background) → P17-37, 37 reqs total. **TASKS READY 2026-09-04** — `tasks.md`, 30 tasks T1–T30 in 6 batches, 37/37 requirements mapped, all three pre-approval checks green. All four gates measured green on this tree before execution: 663 Vitest passing + 1 skipped (81 files; ROADMAP's 641 is the v1.3.0 figure), 349 Rust passing + 1 ignored, `cargo clippy --all-targets -D warnings` clean, `tsc --noEmit` clean. `cargo test` runs fine on WSL/Linux — the Phase 16 note about needing the MSVC toolchain applies to `tauri build`, not to the test gate. **17C SLICE IMPLEMENTED 2026-09-04** on branch `phase17c-restore-integrity` (6 commits): T1 backup strings, T3 ledger-first transactional `wipe_db`, T7 read-then-wipe-then-delete ordering, T5 ledger-aware `delete_set` + `get_set_play_count`, T14 `formatCommandError`, T20 five error sites + ledger notice. Gate green: 669 Vitest (+6), 356 Rust (+7), `tsc` clean, clippy clean. RC-3 reproduced before the fix as SQLite error 787. Not yet released — awaiting the `1.3.1` decision. Groups 17A/17B/17D/17E (T2, T4, T6, T8–T13, T15–T19, T21–T27) not started.
**Previous phase:** Phase 16 IMPLEMENTED (2026-08-30) — `.specs/features/phase16-multiscreen-focus-import-ux/` (28 reqs P16-01..P16-28, 28/28 done), released as `v1.3.0`: always-on-top presentation windows on multi-monitor setups, "Tela preta" set-item naming, Simultânea toggle regrouped with the screen tabs, single-song Holyrics import, informed multi-screen stop. Gate: 641 Vitest, 349 Rust (1 ignored), `tsc --noEmit` clean, `cargo clippy -D warnings` clean.
**Previous phase:** Phase 15 IMPLEMENTED (2026-08-11) — `.specs/features/phase15-freetext-lyrics-ux-fixes/` (22 reqs P15-01..P15-22, 22/22 done, target tag `v1.2.0`) across six groups: 15A live-edit strophes-grid refresh (RC-1), 15B monitor names propagating without restart (RC-2) + names on the audio/mic blocks (RC-4), 15C Aviso font-size label (RC-3), 15D triquetra+noteheads icon (D-71), 15E free-text lyrics editor with derived sections (D-68..D-70), 15F release tag. All 18 tasks (T1–T18) executed via parallel/sequential sub-agents in dependency batches (see Phase 15 Completion Summary below). Gate green: 599 Vitest (76 files), 335 Rust (1 ignored), `tsc --noEmit` clean, `cargo clippy -D warnings` clean. Version bumped to `1.2.0`.
**Previous phase:** Phase 14 IMPLEMENTED (2026-08-11) — `.specs/features/phase14-multiscreen-liveedit-camera/` (32 reqs P14-01..P14-32, 32/32 done) across four groups: 14A multi-screen launch modal + three-value launch policy + per-monitor naming (D-53, D-54); 14B live lyrics editing with section-anchored slide regeneration (D-55); 14C per-camera stream profiles replacing the rejected "camera resolution" request (D-56, D-57); 14D icon rebrand (D-64). All 22 tasks (T1–T20, T22, wrap-up T21) executed via parallel/sequential sub-agents in dependency batches (see Phase 14 Completion Summary below). Gate green: 546 Vitest (73 files), 327 Rust, `tsc --noEmit` clean, `cargo clippy -D warnings` clean.
**Previous phase:** Phase 13 IMPLEMENTED (2026-07-23) — `.specs/features/phase13-auto-update-release/` (29 reqs P13-01..P13-29): honest `check_for_updates` (discriminated `UpdateCheckResult`, no more false "up to date"), tag-push → GitHub Actions → signed draft release pipeline, real About-panel button + `UpdateDialog` download progress, docs rewritten for Tauri v2 signing. T1–T16 done; gate green (tsc clean, 459 Vitest [excl. 3 pre-existing/unrelated `version-files.test.mjs` failures from an in-progress manual verification], 307 Rust tests). Phase 3 independently verified — see `.specs/features/phase13-auto-update-release/validation.md`. P13-09 and the full P13-24 install+restart leg remain on the manual checklist in `tasks.md`.
**Previous phase:** Phase 11 IMPLEMENTED (2026-06-02) — `.specs/features/phase11-operator-polish/` (5 reqs P11-01..P11-05): announcement-over-blackout (announcement only), optimistic operator selection feedback, strophe-card 16:9 cropping. T1–T6 done via parallel sub-agents; gate green (tsc clean, 268 Vitest, Rust tests pass). See `SUMMARY.md`.

---

## Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| D-1 | Single `index.html` + `presentation.html` both load `src/main.tsx`; branch on `getCurrentWindow().label` | Simpler Vite config; no duplicated React setup | 2026-05-18 |
| D-2 | `Arc<RwLock<i32>>` for Phase 0 counter demo; migrate to `Arc<RwLock<PresentationState>>` in Phase 1 | Proves IPC pattern without premature complexity | 2026-05-18 |
| D-3 | asset:// protocol validates paths by checking canonical path starts with media_dir | Prevents path traversal; keeps handler simple | 2026-05-18 |
| D-4 | DB stored at `%APPDATA%\TrinityLyrics\database.db`; media at `%APPDATA%\TrinityLyrics\media\` | Standard Windows app data location | 2026-05-18 |
| D-5 | `sqlx::migrate!()` macro at Tauri setup — compile-time embed of migrations folder | Automatic, versioned, forward-only; no manual migration runner needed | 2026-05-18 |
| D-6 | Phase 2 video thumbnails: spawn ffmpeg/ffprobe (no bundling); placeholder fallback if not on PATH | Keeps installer < 15 MB; ffmpeg as optional runtime dep degrades gracefully | 2026-05-19 |
| D-7 | Phase 2 countdown ticker: drift-free wall-clock-target algorithm (compute `remaining = target - now()` each tick, not decrement) | Current Phase 1-D impl decrements by 1000 ms — drifts on OS sleep jitter. Wall-clock target meets spec ±100 ms/60 min | 2026-05-19 |
| D-8 | Phase 2 backup format: `.tlz` extension (ZIP internally) with media files bundled | Custom extension enables Windows file-association double-click restore; ZIP stays inspectable | 2026-05-19 |
| D-9 | Phase 2 backend error refactor: **one-shot first task** — migrate every Phase 1 command to `ErrorPayload { code, params }` before any other Phase 2 feature work. Reversed from initial incremental proposal on user confirmation. | Avoids dual error shapes accreting; clean codebase from day 1; estimated ~1 week of focused work | 2026-05-19 |
| D-10 | Phase 2 WebView sandbox: `allow-scripts allow-same-origin` on iframes | Required for most IP camera UIs and livestream embeds; trades surface area for compatibility | 2026-05-19 |
| D-13 | Tauri 2 CSP is **global-only** (verified by spike against `schema.tauri.app/config/2` 2026-05-19). Phase 2 uses a relaxed single global CSP; per-window scoping deferred to a future Tauri release. Runtime URL allowlist + iframe sandbox compensate. | Spike showed `WindowConfig` has no `security` field; original design assumed per-window support that does not exist | 2026-05-19 |
| D-11 | Phase 2 set-item type extension forces compiler-checked exhaustive `match`es everywhere (no `_` arms) | Compile-time guarantee that every dispatch site is reviewed when new variants added | 2026-05-19 |
| D-12 | Phase 2 per-song scrim opacity stored as `songs.scrim_opacity` TINYINT column (not JSON in `slide_config`) | Queryable + indexable; default 35%; per-song override in editor | 2026-05-19 |
| D-14 | Phase 3 ships 6 of 8 originally-roadmapped items; PPTX (bundled-LibreOffice strategy) and Sentry opt-in deferred to Phase 4 | PPTX adds ~150 MB to installer — deserves its own phase + signing review; Sentry's privacy-disclosure flow bundles naturally with the PPTX phase. Keeps Phase 3 focused on operator UX + ops infra. | 2026-05-20 |
| D-15 | ~~Phase 3 introduces a third WebviewWindow labeled `"stage"`~~ **Superseded by D-27** | — | 2026-05-20 |
| D-16 | Phase 3 CCLI play-counting is per-service-idempotent: insert one `song_plays` row per `(song_id, set_id, played_on DATE)` triggered when the set is started; duplicates within the same day are silently skipped | Matches what CCLI actually reports ("usage per service"); avoids double-counting if operator restarts the same set mid-service | 2026-05-20 |
| D-17 | Phase 3 auto-update uses Tauri updater plugin pointing at GitHub Releases `latest.json` manifest; public signing key embedded in app, private key stays out of repo via `.gitignore` | Free distribution channel, native Tauri support, no extra infra to maintain | 2026-05-20 |
| D-18 | Phase 3 dark/light theme scope is **operator window only** (presentation + stage stay content-driven) | Presentation backgrounds are author-controlled (song media); theme would either fight the content or be invisible. Operator chrome is the only ambiguous surface. | 2026-05-20 |
| D-19 | Phase 3 keyboard bindings move to a `key_bindings` JSON row in the existing `settings` key/value table (not a new table) | Reuses Phase 1/2 storage; single source of truth for bindings; trivial to back up/restore via existing settings export | 2026-05-20 |
| D-20 | Phase 4 presentation window auto-detects non-primary monitor and opens fullscreen; no manual monitor picker. `app.primary_monitor()` identifies primary; first non-primary gets fullscreen. Single-monitor fallback: 1280×720 windowed. | User confirmed 100% automatic behavior; WindowsScreen presentation row removed from settings. | 2026-05-20 |
| D-21 | Phase 4 uses a single fixed "Culto Dominical" set — no SetList; `get_or_create_default_set` command auto-creates on first run | Sunday workflow always uses one set; multi-set navigation is pure friction | 2026-05-20 |
| D-22 | Phase 4 overlay system: `PresentationState` gains `overlay: Option<OverlayState>` (Announcement/QuickMedia/QuickWebView variants). Overlay commands: `set_announcement_overlay`, `set_media_overlay`, `set_webview_overlay`, `clear_overlay`. Esc in presentation clears overlay before exiting idle. | Overlays must not modify the set — they're transient interruptions (offering image, camera, announcement) | 2026-05-20 |
| D-23 | Phase 4 design tokens: CSS custom properties in index.css (`--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-muted`, `--color-primary #19A4DD`, `--color-primary-hover #1494C5`). Tailwind v4 theme extends these. | Neutral gray dark mode (not blue-shifted Tailwind grays); consistent secondary color replaces scattered emerald-600/blue-600 | 2026-05-20 |
| D-24 | Phase 4 PPTX/PDF deferred to Phase 5; placeholder button shows "Em breve" tooltip | PDF via WebView2 iframe was considered but deferred to avoid scope creep in this phase | 2026-05-20 |
| D-25 | Phase 5 LibreOffice bundled silently (larger installer); path resolution order: bundled `soffice/program/soffice.exe` → `SOFFICE_PATH` env → PATH | User chose silent bundle ("always works") over PATH-only or optional install | 2026-05-21 |
| D-26 | Phase 5 Sentry crash reporting skipped entirely (not just deferred) | Out of scope per user decision 2026-05-21 | 2026-05-21 |
| D-27 | Phase 6 removes the Stage window (D-15 superseded): 3-window design (operator + presentation + stage) reverted to 2-window. Stage display replaced by `PresentationNavigator` embedded in the operator window. | Stage window added latency + complexity without clear gain for current workflow; in-operator navigator is always-visible and eliminates focus-switching | 2026-05-22 |
| D-28 | `open_presentation_window` replaced by `enter_presentation` / `exit_presentation` command pair. `enter_presentation` is idempotent (focus-only if window exists), guards against empty set, emits `presentation_lifecycle {phase: "entered"}`. `exit_presentation` resets state, clears overlay, emits `presentation_lifecycle {phase: "exited"}`. | Lifecycle events let operator window react to presentation state without polling; idempotency makes retry safe; empty-set guard gives user feedback before the window opens | 2026-05-22 |
| D-29 | Phase 7 single-monitor `Apresentar` uses `.always_on_top(true)` + `.fullscreen(true)`; multi-monitor branch (D-20) stays without `always_on_top` to avoid stealing focus from operator on primary. Phantom monitors (size 0×0) filtered at enumeration. | User confirmed PowerPoint-style single-screen behavior; previous P6-04 single-monitor fullscreen alone was invisible on user's machine (z-order issue) | 2026-05-22 |
| D-30 | Phase 7 replaces the linear `PresentationNavigator` with a Holyrics-style 3-pane `OperatorPresentationLayout`: LEFT = SET items list (~240px), CENTER = STROPHES wrapping grid (flex-1), RIGHT = LIVE preview (~320px). Clicking a non-active set item is REPLACE semantics (`goto_slide(itemIdx, 0)`), not overlay. Overlay system (Oferta/Câmera/Aviso/PDF from P4H) stays for transient layering. | User cited Holyrics as the reference; the long-vertical list grouping all items together was hard to scan. 3-pane mirrors Holyrics/OpenLP/ProPresenter ergonomics. Replace semantics for set-item clicks matches conventional slide software. | 2026-05-22 |
| D-31 | Phase 7 LIVE preview pane renders the projection state in-app (reuses the same renderer components used in the presentation window), NOT a screen capture (no DXGI / desktop duplication). Strategy choice (direct composition vs. CSS `transform: scale()`) deferred to design.md. | Screen-capture in WebView2 adds complexity with no correctness benefit — we already own the `PresentationState` that drives the projection, so re-rendering is always accurate | 2026-05-22 |
| D-32 | Monitor filter: `width > 0 && height > 0` applied at enumeration time; `presentation.no_monitors` error returned if all monitors are filtered out. | Phantom monitors with 0×0 size appeared on user's machine and were selected by the auto-pick logic, resulting in a silent invisible window | 2026-05-23 |
| D-33 | Single-monitor path uses `always_on_top(true)` + `fullscreen(true)` (PowerPoint browse-mode parity). Multi-monitor branch (D-20) keeps `always_on_top` off to avoid stealing focus from operator on primary. | Previous P6-04 single-monitor fullscreen alone was invisible on user's machine (z-order issue); always-on-top resolves it | 2026-05-23 |
| D-34 | LivePreview hybrid strategy: full render for text/image/countdown items; placeholder cards for video/iframe items (avoids double-mounting media in the same WebView). | Double-mounting `<video>` or `<iframe>` elements inside the preview pane caused audio bleed and janky seek; placeholder cards convey enough context without media side-effects | 2026-05-23 |
| D-35 | `OverlayDialogs` stay inline in `OperatorPresentationLayout`; only the toolbar action row is extracted as `<OverlayActionBar />` for reuse between `HomeSetBuilder` and the presentation layout. | Full dialog extraction would have required prop-drilling all overlay commands; toolbar-row extraction alone gives P4H HomeSetBuilder reuse without complexity overhead | 2026-05-23 |
| D-36 | Phase 9 unifies projection + all previews behind one shared `SlideStage` (fixed 1280×720 virtual stage, `transform: scale(min(cw/1280,ch/720))`, letterbox) + `SlideContent` switch. Promotes existing `SlideChip` logic; `PresentationApp`, `LivePreview`, `StrophesGrid`, song-editor preview all route through it. | Three divergent renderers (projection / `LivePreview.SongSlidePreview` / `SlideChip`) caused previews to ignore position/margin/size. Single source guarantees preview == projection up to scale. | 2026-05-30 |
| D-37 | Phase 9 language-picker bug root cause: `main.tsx` changes `i18next` from DB `app.locale` but never syncs `useSettingsStore.locale` (frozen at `pt-BR` default) which `LanguagePicker` binds to. Fix = add `loadLocale()` to settings store, call at operator+presentation boot. | Keeps store as single source of truth (consistent with `onLocaleChanged`); rejected binding picker to `i18n.language`. | 2026-05-30 |
| D-38 | Phase 9 blackout-after-song: append a sentinel `Slide{ section_label:"__blackout__", lines:[] }` after each Song item's slides in `load_set_for_presentation`, gated by `presentation.blackout_after_song` setting (default ON). Frontend renders the sentinel as solid black. | No `Slide`/enum change, index-based navigation untouched, serde-safe; user chose per-song placement + settings toggle. | 2026-05-30 |
| D-39 | Phase 9 adds settings `announcement.margin` (default `lg`) + `presentation.blackout_after_song` (default `true`) as key/value rows — no migration. Warning overlay re-rendered through `SlideContent` to fill the whole stage (fixes gray edges) honoring announcement position + new margin. Title-slide author size dropped to `stepSize(fontSize,-1)`. Nav tabs `disabled` (not hidden) while presenting. Set items gain dnd-kit drag reorder (keep arrows) via existing `reorder_set_items`. | Batch of UX fixes riding on the shared renderer; settings are key/value so zero schema risk. | 2026-05-30 |
| D-40 | Phase 10 render-order precedence in `PresentationApp.tsx`: `blank` → `overlay` → `idle` (countdown/waiting) → `live/frozen`. Overlay now reachable from idle (root cause of the "Aguardando" freeze). Fix is render-only — overlays stay mode-independent transient layers (D-22 preserved); backend `overlay.rs` does NOT flip `mode` (would corrupt set position on clear). | Idle branch returned before overlay, so an overlay set while idle never rendered → frozen projector. Render layer is the correct place to fix precedence. | 2026-06-02 |
| D-41 | Phase 10 `isPresentationActive(state)` = `state != null && (mode ∈ {live,blank,frozen} \|\| overlay != null)` replaces the `getIsPresenting` mode-gate for Esc handling in `runtime/keyboard.ts` + `OperatorApp.tsx`. Predicate co-located in `keyboard.ts` (no shared selectors module exists yet — candidate to move if one is introduced). Operator Esc + the rebindable `exitPresentation` action unified behind one handler ("clear overlay if present, else `exitPresentation()` command") — fixes the prior split where the rebindable action only did `setMode("idle")` and left the window open. | Idle was excluded from `getIsPresenting`, so Esc was dead in idle/overlay states. | 2026-06-02 |
| D-42 | Phase 10 presentation-window Esc always `preventDefault()` + `forwardKeydown(e)` AND arms a ~400ms local fallback `getCurrentWindow().close()` (try/catch swallow, single-arm gate so double-Esc closes once, timer cleared on cleanup). Guarantees escape even when the operator window is gone or the round-trip stalls. `getCurrentWindow` was NOT previously imported in `PresentationApp.tsx` (spec assumption was wrong — it's used in `main.tsx`); added the import. | The clean operator round-trip can't be relied on when the operator window itself is the thing that vanished (issue #3). | 2026-06-02 |
| D-43 | Phase 10 author-credit normalizer (idempotent) replicated in Rust (`commands/presentation.rs` `credit_line`/`is_balanced_wrapped`) and TS (`src/components/presentation/credit.ts` `creditLine`/`isBalancedWrapped`) with mirrored unit tests. "Already wrapped" = trimmed string starts `(` ends `)` AND the first `(` closes only at the very end (depth-scan). Strips-then-rewraps when ON (no `((...))`); strips when OFF; `()`/empty → omit line. `John (PD)` and `(A) and (B)` are NOT wrapped. Backend is source of truth for the projected slide; frontend helper drives editor preview only — kept identical to prevent drift. | Naïve `format!("({a})")` produced `((John Newton))` and never stripped when the flag was off. | 2026-06-02 |
| D-45 | Phase 11 announcement-over-blackout is **announcement-scoped** and **render-only**: new presentation precedence `announcement-overlay → blank → other-overlay → idle → live/frozen` (partially reverses D-40's "blank beats everything"). Oferta/Câmera overlays still lose to blackout. Backend `overlay.rs` still does NOT flip `mode`, so clearing the announcement restores blackout automatically. | User wants Aviso to overlap a blacked-out projector without manual toggling; chose announcement-only scope. D-40 invariant (overlays mode-independent) preserved. | 2026-06-02 |
| D-46 | Phase 11 operator selection feedback is **optimistic**: strophe/set-item click updates a local highlight immediately, reconciles to backend `state_changed` (backend stays source of truth). Pair with memoized `SlideCard` so the full strophe grid does not re-render per state change. | Operator-side highlight lagged the backend round-trip; projection itself was fine. | 2026-06-02 |
| D-44 | Phase 10 observability + lifecycle in `lib.rs`: `std::panic::set_hook` (logs payload + `file:line:col` via `tracing::error!`, chains the default hook) installed before the builder, and an `.on_window_event` handler logging `CloseRequested`/`Destroyed`/`Focused(false)` with window label. On **operator** `Destroyed`, close the presentation window (via `get_webview_window("presentation")`, ignore-if-gone) to prevent an orphaned always-on-top fullscreen window; presentation-alone close does nothing to the operator. Decision extracted as pure testable `should_close_presentation_on_destroy(label) -> bool` in `commands/window.rs`. Tauri's `CloseRequested` exposes no user-vs-programmatic origin — `Focused(false)` logging provides the focus context to disambiguate the spontaneous-close hypotheses on next field repro. | No `on_window_event`/panic hook existed; issue #3 (operator vanishes on app-switch) can't be root-caused without instrumentation. Panic hook distinguishes whole-process crash from a single-window close. | 2026-06-02 |
| D-47 | Dual independent presentation outputs (feature branch `feat/dual-output`, Slice A done 2026-06-08): `AppState.outputs: HashMap<OutputId, OutputState>` (presentation+slides+countdown+task per output; `stream_proxy` stays global — one camera at a time). Commands take `output: Option<OutputId>` defaulting to `One` (Tauri missing-arg→None) so the migration stayed green. `state_changed`/`countdown_tick` flipped to tagged `{output, state}`; frontend filters by output. Both windows load the SAME `presentation.html` — the window label (`presentation`/`presentation-2`) is the discriminator (no 2nd HTML/Vite entry). Per-output countdown via passing each output's Arcs to the existing ticker helpers. | Spec `.claude/plans/dual-output-presentation-camera-mic-audio.md`. User wants two TVs each running their own set + the camera/mic on TV-2; the single global PresentationState/state_changed/countdown had to gain an output dimension. | 2026-06-08 |
| D-48 | Phase 13 release platforms: **Windows (NSIS setup.exe) + Linux (AppImage)**. macOS excluded. AppImage is the only Linux bundle the Tauri updater can self-update; `.deb`/`.rpm` still ship as release assets but are not update targets. | User decision 2026-07-22. Production target is a native Windows church PC (`docs/installation.md`); macOS would need a $99/yr Developer ID or every download hits Gatekeeper quarantine. | 2026-07-22 |
| D-49 | Phase 13 release trigger: **push a `v*` git tag**. A `verify-version` CI job hard-fails before any build if `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and the tag disagree. `scripts/bump-version.mjs` writes all of them. | User decision 2026-07-22. Version currently lives in 4+ files at `0.1.0` with nothing enforcing agreement; a silent drift would ship a build the updater refuses. | 2026-07-22 |
| D-50 | Phase 13 stores the Tauri private signing key in **GitHub Actions secrets** (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`), **reversing the `docs/release.md` § Security Notes prohibition**. Mitigation: the workflow has no `pull_request` trigger, so GitHub never exposes the secret to fork PRs. `docs/release.md` is rewritten to match. | User decision 2026-07-22, made with the prohibition in view. Local-only signing keeps the release a manual multi-step chore, which is the thing this phase exists to remove. | 2026-07-22 |
| D-51 | Phase 13 publishes releases as **drafts** (`releaseDraft: true`); the maintainer clicks Publish after smoke-testing. `https://github.com/Vinnissaum/triade/releases/latest/download/latest.json` returns **404 while the release is a draft** — that 404 is the intended safety gate, and P13-11 requires it surface as `update.check_failed`, never as `upToDate`. | User decision 2026-07-22. A broken auto-published build would reach the church machine before it could be caught, and rolling back an auto-update is painful. | 2026-07-22 |
| D-52 | Phase 13 Linux runner is **`ubuntu-24.04`**, not the `ubuntu-22.04` used in most tauri-action examples. | `ubuntu-22.04` begins deprecation 2026-09-17 with brownout job failures ([actions/runner-images#14254](https://github.com/actions/runner-images/issues/14254)) — pinning it breaks the workflow within two months of writing. Trade-off accepted: the AppImage links against glibc 2.39 and will not run on older distros. | 2026-07-22 |
| D-53 | Phase 14 multi-screen launch: pressing **Apresentar** with multi-screen enabled prompts "mirror all screens?" — yes = mirror on + every output loaded with the same set at item 0 slide 0; no = main output only, no window for output Two. Governed by a new three-value launch policy setting (`ask` default / `mirror_all` / `main_only`) so the prompt can be retired once the church settles into a routine. | User decision 2026-08-11. `output.multi_screen_enabled` and `output.mirror_enabled` already existed but were never surfaced at launch time, so Screen 2 required a separate `OutputSwitcher` → `OutputLaunchModal` flow every single service. | 2026-08-11 |
| D-54 | Phase 14 screen naming attaches to the **physical monitor**; outputs display the name of whichever monitor they are currently assigned to. Fallback chain: operator name → OS-reported name → generated "Monitor N — W×H". | User chose "name monitors, outputs inherit" over naming the output slots. Index-based naming is unusable because monitor enumeration order is OS-dependent (CLAUDE.md gotcha, D-32). Stable identity key deferred to design as DQ-1. | 2026-08-11 |
| D-55 | Phase 14 live lyrics editing is **full edit, persisted to the song**: the operator opens the real editor mid-presentation, saves to the DB, and only that item's slides are regenerated and re-projected — no full `load_set_for_presentation`. Position is anchored by `section_id`, clamping to the nearest valid slide when the section vanishes or the slide count shrinks. Blank/frozen mode survives the regeneration; the projector must never blank as a side effect. | User chose full edit over current-slide-only and transient-override. Slides are computed once into `presentation_slides`, so today a correction forces a set reload that resets position and blacks the projector mid-service. | 2026-08-11 |
| D-56 | Phase 14 **rejects** the originally-requested "set the resolution on camera webview" as ineffective, and ships operator-defined per-camera **stream profiles** instead (two or more named URL/transport pairs, switchable mid-presentation). | Packet loss and the monotonically *growing* latency both occur on the camera→PC leg before Lyrizzy sees the stream — confirmed by identical degradation in the camera's own HTTP viewer. Growing delay is a sustained throughput deficit, not random loss. MediaMTX remuxes and does not transcode, so a resolution control would need FFmpeg, which D-6 deliberately leaves unbundled; downscaling on the receiving PC costs CPU and changes nothing on the wire. Pulling the camera's lighter sub-stream is the only implementable fix, and leaves OBS/YouTube's 4K main stream untouched. See spec Root-Cause Analysis F-1..F-8. | 2026-08-11 |
| D-58 | Phase 14 live-edit regeneration is triggered **inside `update_song`** (via a `pub(crate)` helper `refresh_song_in_outputs` in `commands/presentation.rs`), not by a frontend-invoked command. Slide position is re-anchored by a pure `(section_id, ordinal)` pair — `anchor_of` / `resolve_anchor` — with the fallback chain exact → last-slide-of-section → clamp `old_index` → 0. `mode`/`frozen_at`/`overlay` are left untouched so blank/frozen survive for free. | Keeps Rust the single source of truth and makes every edit path (library screen *and* the live modal) consistent — the frontend cannot forget to refresh. `section_id` alone is ambiguous because a section splits across multiple slides (`slide_splitter.rs:34,42,53`) and `RepeatMode::Duplicate` repeats whole runs, so the ordinal is required. Pure helpers mirror the D-43 testability pattern. | 2026-08-11 |
| D-59 | Phase 14 camera stream profiles are **additive `#[serde(default)]` fields on `WebViewConfig`** (`profiles: Vec<StreamProfile>`, `active_profile_id: Option<String>`) — no SQL migration, and switching needs **no new Rust command**. `mode` stays item-level; profiles vary only URL + transport. Empty `profiles` = today's behaviour, resolved from the existing `url`/`rtsp_transport`. | `set_items.webview_config` is a `TEXT` JSON column (`003_media_phase2.sql:39`), so existing rows deserialize unchanged at zero risk. `start_stream_proxy` already kills/respawns on a changed config (`stream.rs:124-134`), and validates before killing — so an invalid profile URL leaves the running stream alive. | 2026-08-11 |
| D-60 | Phase 14 launch policy is applied in **one hook** (`useRequestPresentation` + `PresentationLaunchProvider`), with the four bare `enterPresentation()` call sites (`HomeSetBuilder.tsx:85,95`, `OperatorApp.tsx:155`, `SetBuilder.tsx:381`) refactored to route through it. Mirror-all launches explicitly at item 0 slide 0 rather than reusing `engageMirror`. Monitor names key on OS name with a `{w}x{h}@{x},{y}` geometry fallback, stored as one JSON `settings` row. | Applying the policy at each call site would guarantee drift. `engageMirror` copies the master's *current* position, but P14-02 requires the first item. Monitor index is unusable as an identity key because enumeration order is OS-dependent (CLAUDE.md gotcha, D-32). | 2026-08-11 |
| D-64 | Phase 14D app icon: the Lyrizzy **L whose vertical stroke doubles as a music-note stem**, notehead fused at the corner — keeping the existing purple-on-dark-rounded-square palette. Authored as ONE committed `src-tauri/icons/icon.svg`; every raster asset is generated by `npx tauri icon`. Rejected: note+cross, open hymnal, chapel arch. | User chose brand continuity over a full rebrand; the L silhouette stays legible at 32×32 where a book or arch collapses, and no denominational symbol is introduced. Probe confirmed the Tauri CLI accepts SVG, emits the complete asset set, preserves transparency (so the background must be drawn in the source) and does not write `public/icons/` (synced by hand). | 2026-08-11 |
| D-68 | Phase 15 (GA-1) removes sections from the **UI only**. The editor becomes one free-text lyrics box; on save the app derives one `song_sections` row per blank-line-separated block (empty label, type `verse`, `repeat_count` 1). The table, the FTS body triggers, `Slide.section_id` anchoring, per-section background resolution and both import wizards are left untouched. | User chose derived sections over dropping `song_sections` for a `songs.lyrics` column. The full removal would need a destructive migration, break `.tlz` restore of pre-1.2.0 backups, rewrite the FTS triggers and rework the Phase 14 anchor basis — across ~38 files — for an outcome the operator cannot tell apart from the UI-only change. | 2026-08-11 |
| D-69 | Phase 15 uses **no bracket-label syntax** (`[Refrão]`) inside the free-text box; blocks are split on blank lines only and derived sections carry an empty label, so operator-side strophe badges fall back to their ordinal. The plain-text import wizard keeps its existing bracket handling. | The box is edited *live* during a service, so exact round-trip (reopen reproduces what was typed) outweighs label richness. A consumed-and-re-emitted `[Label]` line cannot round-trip exactly. Rejected alternatives: reuse `parse_plain_text` as-is (strips the bracket line); strip-and-re-emit on load (extra machinery, still lossy on edge cases). | 2026-08-11 |
| D-70 | Phase 15 (GA-3) retires repeat count from the **UI and from everything newly written** — per-section control and the global "Repetições" setting removed, new sections always `repeat_count = 1` — but keeps the column, the `RepeatMode` enum and backend honouring of legacy values under the default `Duplicate` mode. | Consistent with D-68's leave-the-schema-alone stance. A hard removal breaks `.tlz` restore of older backups and touches 17 files with zero operator-visible gain. Flagged as a stated assumption under P15-18 so the user can escalate it into scope. | 2026-08-11 |
| D-71 | Phase 15 (GA-4) app icon: a **triquetra (Trinity knot) whose three lobes terminate in filled noteheads**, keeping the purple-on-dark-rounded-square palette. Retires the D-64 L-as-music-note mark. Same authoring pipeline: one committed `src-tauri/icons/icon.svg`, rasters via `npx tauri icon`, `public/icons/` synced by hand. | User rejected the D-64 rebrand and asked for a Trinity symbol fused with something referring to Lyrizzy. Triquetra chosen over the Shield-of-the-Trinity triangle, the knot-holding-the-L, and the trefoil: most recognisable as Trinity, survives 32×32, introduces no denomination-specific imagery. Palette continuity retained deliberately. | 2026-08-11 |
| D-72 | Phase 15 (DD-1) re-bases the live-edit slide anchor on **slide content** (`SlideAnchor { key, ordinal }`, key = trimmed lines joined by `\n`) instead of `section_id`. Fallback chain unchanged: exact `(key, ordinal)` → last slide with `key` → clamped `old_index` → 0. Section id generation, `archive.rs` and the schema are untouched. | F-1: `db_update_song` regenerates every section UUID on save (`commands/song.rs:353-361`), so the D-58/D-65 `section_id` anchor never matches and always degrades to index clamping. The spec's first fix — deterministic `{song_id}-s{N}` ids — was analysed at design time and **rejected as actively wrong**: inserting a strophe shifts every later id down one, so the exact-match branch would resolve to the *wrong* strophe rather than failing safe. Content matching holds the right strophe on insert/delete and degrades to today's clamp only when the current slide's own text changed — where clamping is already correct because the slide count is unchanged. Strictly better in every case, never worse. | 2026-08-11 |
| D-73 | Phase 15 (DD-2) builds the live-edit emit payload in a pure `with_full_slides(&PresentationState, &[Vec<Slide>]) -> PresentationState` in `domain/presentation.rs`; the stored state keeps `all_slides_per_item` empty and only the emitted copy carries the slides. | The two-line inline alternative lands in `commands/*.rs`, which TESTING.md's matrix leaves untested, and `refresh_song_in_outputs` takes an `AppHandle` so it is also unreachable from `src-tauri/tests/` (L-7, D-66). A pure helper turns "stored state stays slim" (P15-02) into an assertion instead of a comment. Same reasoning as D-65. | 2026-08-11 |
| D-57 | Phase 14 does **not** change the RTSP transport default from `udp` to `tcp`, despite TCP retransmission being the standard remedy for loss on marginal cabling. It stays a documented field action. | The picker already exists and is operator-selectable (`WebViewSetItemEditor.tsx:269`); flipping the default would change behaviour under installs that work today, for a fix the operator can apply in one click. | 2026-08-11 |
| D-65 | Phase 14 (R-1) `SlideAnchor`/`anchor_of`/`resolve_anchor` live in `domain/slide.rs`, not `commands/presentation.rs` as `design.md` originally said. | They're pure functions over `Slide`, which is defined in `domain/slide.rs`. TESTING.md's coverage matrix requires unit tests for `domain/*.rs` and none for `commands/*.rs` — placing them in `domain` makes the required tests matrix-compliant instead of an exception. | 2026-08-11 |
| D-66 | Phase 14 (R-2) `refresh_song_in_outputs` was split into `regenerate_song_slides` (pool-only, no `AppHandle`/`AppState`) + `refresh_song_in_outputs` (lock/anchor/emit shell), not the single helper `design.md` proposed. `regenerate_song_slides` is `pub(crate)`, which Rust's crate-visibility rules make **invisible to the separate `tests/` integration crate** even though it takes no `AppHandle` — so T8's integration tests exercise a faithful mirror of the production logic built from public API, following the same precedent `build_slide_groups` already set for `compute_item_slides`. | `src-tauri/tests/presentation.rs` deliberately avoids `AppHandle`/`AppState`. A helper taking `AppHandle` couldn't be tested there at all; splitting puts the interesting logic (item matching, slide recomputation, multi-occurrence handling) under test. The `pub(crate)`-is-still-invisible-to-`tests/` wrinkle wasn't caught at planning time — worth remembering for the next `pub(crate)`-for-testability design. | 2026-08-11 |
| D-67 | Phase 14 (R-3) added task T6: `update_set_item` now loops `OutputId::ALL` (via extracted pure helper `patch_item_in_set`) instead of hard-coding `OutputId::One` when patching the live snapshot and emitting `state_changed`. | `commands/set.rs` hard-coded output One; per D-47 the camera normally runs on Tela 2, so a profile switch (P14-26) would persist to the DB and never reach the window actually showing the camera. | 2026-08-11 |
| D-74 | Phase 15 batch execution needed one unplanned consolidated-fix commit (`7552032`) between the T4-T11 monitor-store batch and T14: `SettingsScreen.test.tsx` and `OperatorPresentationLayout.test.tsx` each hand-roll their own `useSettingsStore` mock via `mockReturnValue(...)`/a fixed object, which ignores the selector argument. Once T7/T8/T9 switched their components to `useSettingsStore((s) => s.monitors)`-style selector reads, those two unrelated test files started receiving the *whole mocked store* as `monitors`, crashing on `.map is not a function`. No task in `tasks.md` owned those files, since neither is in any task's file list. | No sub-agent's own scoped gate (`vitest run <its files>`) could catch this — each one dutifully ran the full suite afterward, correctly diagnosed the failure as pre-existing/not-theirs, and reported it upward without fixing it (this was the *correct* call under their "touch only listed files" constraint). The fix required someone with cross-task visibility. Same shape as Phase 14's L-9 lesson (concurrent tasks racing shared consumers), but this time the shared consumer was a *test mock*, not a shared source file — worth widening L-9's guidance to include "any test file that hand-mocks a store any two file-disjoint tasks both touch the shape of." | 2026-08-11 |
| D-75 | Phase 17: the countdown set item gets an **operator-editable name** (`CountdownConfig.name`), defaulting to the localized "Cronômetro", instead of a fixed label or one derived from the message. | The report was "it has a fixed name of Counter 10 min". Dropping the duration alone still leaves every countdown identically named in a set that can hold several; a name field costs one optional JSON key on a blob column (no migration) and makes the set readable at a glance. The `"10min"` literal in `SetBuilder.tsx:453` was a fabricated default, not a real duration. | 2026-09-04 |
| D-76 | Phase 17: countdown message/digit sizing is **per item**, stored on `CountdownConfig` as two percentages defaulting to 100, applied by multiplying all three terms of each `clamp()`. | The operator asked to keep the current proportion as the baseline and gain control, which a percentage over today's constants expresses exactly — 100% is byte-identical to `v1.3.0`. Per item (not global) because different countdowns in one service want different emphasis. Multiplying every clamp term preserves the container-query behaviour that keeps the operator's small live preview proportional. Scales must be mirrored into `CountdownState` like `position`/`background_media_id`, since the takeover path renders from a synthetic config. | 2026-09-04 |
| D-77 | Phase 17: set switching ships as a **picker in the Home header only**; the unreachable `sets` / `set-builder` views and `SetList.tsx` are removed rather than revived. | Sets have had full backend CRUD and a written `SetList` since Phase 1, reachable by no navigation control — two ways to manage sets would be one more than the operator asked for. The picker also forces `delete_set` to be fixed: `song_plays.set_id` is a RESTRICT FK, so deleting any presented set fails today (same root cause as the restore defect). | 2026-09-04 |
| D-78 | Phase 17: the camera item keeps only **RTSP, MJPEG and web page (iframe)**; RTMP, SRT and multicast are removed outright, and stream profiles are scoped to RTSP/MJPEG. | RTMP mode maps to `Source::Pull`, i.e. MediaMTX dialling an RTMP *server*, while cameras push RTMP and the generated config disables every server but WebRTC — so the mode cannot work with a camera as built. SRT is contribution/encoder gear and multicast MPEG-TS is IPTV distribution; RTSP is what ONVIF mandates and MJPEG is the older-camera fallback. Profiles were rendered for all six modes but honoured only in `rtmp`/`rtsp` (`WebViewRenderer.tsx:20-41`), so the iframe profile UI the operator wants gone never did anything. User-facing labels change to "Câmera"; `web_view`/`webviewConfig` identifiers stay. | 2026-09-04 |

---

## Blockers

| # | Blocker | Status | Notes |
|---|---------|--------|-------|
| B-1 | OQ-1: Holyrics export format unknown | Resolved 2026-05-18 | User supplied sample export. Format: top-level array of song objects; each song has `title`, `artist`, `lyrics.paragraphs[]` where each paragraph is `{number, description, text}`. `description` holds section labels (empty in samples — importer must auto-label or leave blank). `full_text` duplicates joined paragraphs (use paragraphs as source of truth). `order`/`arrangements`/`bpm`/`key`/`streaming` mostly empty stubs (drop for MVP). Holyrics `id` is a JS timestamp — generate our own PKs. |

---

## Open Questions

| # | Question | Status |
|---|----------|--------|
| OQ-1 | Holyrics exact JSON structure? | Resolved 2026-05-18 — see B-1 row |
| OQ-2 | Video thumbnail library: video-rs vs ffmpeg spawn vs placeholder | Deferred to Phase 2 |
| OQ-3 | Multi-window entry: single index.html vs separate HTML | Decided: single (D-1) |
| OQ-4 | Font rendering on projectors with older Windows | Needs hardware test in Phase 1 |
| OQ-5 | `.specs/features/phase13-auto-update-release/` is cited by both ROADMAP and this file as the source of truth for 29 requirements (P13-01..P13-29), but the directory was never committed and is absent from disk — `git log --all` shows no history for it. The requirement table survives only in the ROADMAP row. | Open 2026-08-11 — decide whether to reconstruct the spec/tasks/validation docs or accept the ROADMAP row as the record |

---

## Deferred Ideas

- ~~Per-section background overrides~~ → now P3-06/P3-07 in Phase 3 spec
- ~~Keyboard shortcut customization~~ → now P3-08/P3-09/P3-10 in Phase 3 spec
- Optional VLC fallback for MKV/AVI (Phase 2+ — still deferred)
- ~~PPTX rendering via bundled LibreOffice sidecar~~ → shipped in Phase 5
- Opt-in Sentry crash reporting (deferred from Phase 3 → Phase 5, skipped — out of scope per user decision 2026-05-21)
- Per-slide notes (Phase 4 candidate — per-section deemed sufficient for Phase 3)
- Auto-update beta channel (Phase 4 candidate — stable-only in v2)
- Include `song_plays` (and `tags`/`song_tags`) in the backup archive — a Replace restore currently drops the CCLI ledger silently (Phase 17 follow-up, 2026-09-04)
- Restore from an unzipped backup folder, not only a `.tlz` (Phase 17 out-of-scope, 2026-09-04)
- **Guard the Replace restore against a data-less archive** — `read_zip_entry_str` maps a missing zip entry to `"[]"` by design (selective artifacts have no `sets.json`), so a structurally-valid `.tlz` whose `data/*.json` entries are absent wipes the library and restores nothing. Found while implementing Phase 17 T7, 2026-09-04; out of that spec's scope.
- Key-binding scheme presets / "Holyrics-like" / "ProPresenter-like" bundles (Phase 4 candidate, P3 ships individual bindings only)

---

## Lessons Learned

- **L-1:** Tauri 2 requires `use tauri::Emitter` in scope to call `app.emit()`, and `use tauri::Manager` for `app_handle.manage()`. Always import both in command files that emit events.
- **L-2:** `sqlx::migrate!()` macro path is relative to `CARGO_MANIFEST_DIR` (the `src-tauri/` folder), so `"./migrations"` not `"../migrations"`.
- **L-3:** Vitest requires `jsdom` as a separate dev dependency — not bundled with vitest itself.
- **L-4:** When testing canonical path containment, use two independent temp dirs. A file in the *parent* of `media/` could accidentally start_with `media/` if using the same `TempDir`.
- **L-5:** `http` crate must be added explicitly to `Cargo.toml` for the protocol handler; it is not re-exported from `tauri` in a usable way for custom handlers.
- **L-6:** Tauri 2 built-in `asset://` protocol requires `protocol-asset` feature. To use a custom media directory without that feature, register your own `asset` scheme via `register_uri_scheme_protocol`.
- **L-7:** `pub(crate)` is not enough to make a function callable from `src-tauri/tests/*.rs` — Cargo integration tests compile as a **separate crate**, so `pub(crate)` items in the library crate are invisible there regardless of whether the function needs `AppHandle`. The existing workaround (mirror the logic against public API inside the test file, as `build_slide_groups` already did for `compute_item_slides`) is the established pattern — plan for it up front instead of discovering it mid-task (see D-66).
- **L-8:** Background sub-agents given a long-running command (`cargo test` on a multi-crate workspace, 1-3 min) tended to background/poll it via a Monitor tool and stop their turn "waiting for a notification" that never reliably arrived, instead of just running it synchronously and reading the result. Explicitly instructing "run this in Bash and wait for it to return in the same call, do not background or poll" in the task prompt fixed it for later batches. Worth baking into the sub-agent prompt template for any task with a slow gate check.
- **L-9:** Running many sub-agents concurrently against one shared (non-worktree) working tree works well when tasks are genuinely file-disjoint, but locale JSON files (`en-US.json`/`pt-BR.json`) and a few shared components (`OperatorPresentationLayout.tsx`, `SettingsScreen.tsx`) are touched by many tasks — those must be serialized (one task at a time) even when their *other* files are disjoint, or edits race. A full `npx tsc --noEmit` run is worth doing once at the end regardless of individual task gates — several nullable-type mismatches (`string | null` vs `string`) only surfaced when independently-written concurrent tasks' mocks/callers were checked together; no single task's own gate (`vitest run`) caught them.

- **L-10:** `mermaid-studio`'s `scripts/validate.mjs` cannot parse a **multi-line** `%%{init: ...}%%` directive — it reports the contradictory "Unknown diagram type. First content line: `flowchart TD`. Expected one of: flowchart, …". Collapsing the init directive to a single line passes. Its "`style`/`subgraph`/`end` is a reserved keyword" warnings are false positives on flowcharts (state-diagram rules applied globally) and can be ignored. Note there is no render engine installed in this environment — `render.mjs` needs `scripts/setup.sh` first, which is not worth running just to emit inline mermaid for a markdown doc.

## Phase 15 Completion Summary (2026-08-11)

All 22 P15-01..P15-22 requirements delivered across 18 tasks (T1–T18), executed via parallel/sequential sub-agents in batches (`/tlc-spec-driven implement phase15 on batch with subagents`):

| Area | Tasks | Delivered |
|---|---|---|
| 15A live-edit strophes refresh | T1, T2 | `with_full_slides` pure emit-payload builder (D-73) wired into `refresh_song_in_outputs`; stored `PresentationState` stays slim, only the emitted copy carries slides; `reconcileSlides`/`StrophesGrid` regression pins (no frontend code change needed) |
| 15B slide anchoring by content | T3 | `SlideAnchor{key,ordinal}` rebased from `section_id` to slide-content key (D-72/DD-1) — holds the right strophe across insert/delete above the current position, falls back to clamped index only when the current slide's own text changed |
| 15C monitor names, everywhere and immediately | T4–T11 | `useSettingsStore` monitor-setup slice (`monitors`/`monitorNames`/`outputMonitorIndex`, `loadMonitorSetup`/`setMonitorName`/`applyMonitorSetting`); `outputScreenName` shared resolver; operator-boot load + `setting_changed` invalidation; `MonitorNameSettings`/`MonitorPicker`/`OutputSwitcher`/`PresentationLaunchProvider`/`MicAudioSettings` all read from the store instead of their own mount-time caches — fixes the RC-2 restart-required bug at its root (the launch-provider boot-once cache) |
| 15D settings labels | T12 | Aviso tab gets its own `settings.announcement.fontSize` label; Projeção keeps `settings.windows.fontSize`; the global "Repetições" control removed from the UI (state/backend honouring of legacy values kept per D-70/DD-8) |
| 15E free-text lyrics editor | T13–T15 | `lyricsToBlocks`/`blocksToSectionPayloads`/`sectionsToLyrics` pure functions with an exact round-trip contract, deliberately independent of `parse_plain_text` (D-69); `SongEditor` rewritten to one lyrics textarea, `SectionCard.tsx` deleted, all drag/paste/section-control machinery removed; `OperatorNotesPanel` repointed from per-section to song-level notes |
| 15F icon | T16 | `src-tauri/icons/icon.svg` — triquetra (Trinity knot) with filled noteheads at the three lobe tips, replacing the Phase 14D L-as-music-note mark, same purple-on-dark-rounded-square palette; full asset set regenerated via `npx tauri icon`; `public/icons/` synced by hand |
| Wrap-up | T17, T18 | Version bumped to `1.2.0` across all five sources via `scripts/bump-version.mjs`; full gate re-verified; spec traceability → all 22 Implemented; ROADMAP Phase 15 row; this summary; D-74 recorded; TESTING.md gained a `src/utils/*.ts → unit` matrix row (R-3) |

**Consolidated fix required mid-batch:** one commit (`7552032`) between the T4–T11 batch and T14 to repair `SettingsScreen.test.tsx`/`OperatorPresentationLayout.test.tsx`'s hand-rolled `useSettingsStore` mocks, which broke once T7–T9 switched their components to selector-based store reads. See D-74. Also fixed in that pass: a pre-existing `SetItemType` typo (`"announcement"`, not a valid variant) in `OperatorNotesPanel.test.tsx`, surfaced by the final `tsc --noEmit` sweep.

**Test results at completion:** 599 Vitest tests (76 files; baseline 546 + 53 new), 335 Rust tests (baseline 327 + 8 new, 1 ignored, 0 deletions). `tsc --noEmit` clean. `cargo clippy -D warnings` clean. `src/i18n/locales.test.ts` green throughout. `node scripts/check-version.mjs v1.2.0` — all five sources agree.

**Open verification note (manual, hardware/release required — carried from tasks.md § Manual Verification):**
1. Live-edit end to end: insert a strophe mid-song while presenting, save — projector holds position, LIVE preview and strophes grid both refresh, no black frame; repeat with blackout and with freeze engaged
2. Navigate to strophe 4, insert a new strophe 2, save — projector still shows what was strophe 4 (content-anchor proof)
3. Edit a song loaded in both outputs (mirror on) — both refresh
4. Rename a monitor in Settings — check settings list, Projeção picker, output switcher, Apresentar launch modal, and audio blocks all show the new name with no restart
5. Unplug/replug a monitor while Settings is open — stored name reappears for its identity
6. Build and install — taskbar, Start menu, window chrome and both browser tabs show the triquetra mark, legible at the smallest size
7. Push the `v1.2.0` tag — `verify-version` CI passes and a signed draft release is produced (per D-51, `latest.json` 404s while the release is a draft — that's the intended gate)

---

## Phase 14 Completion Summary (2026-08-11)

All 32 P14-01..P14-32 requirements delivered across 22 tasks (T1–T20, T22 + wrap-up T21), executed via parallel/sequential sub-agents in 6 dependency-respecting batches (see `.claude/skills/tlc-spec-driven` `/tlc-spec-driven implement phase14 on batch with subagents`):

| Area | Tasks | Delivered |
|---|---|---|
| 14C camera stream profiles | T1–T6 | `StreamProfile` additive on `WebViewConfig` (Rust+TS); `resolveActiveSource` fallback resolver; `WebViewRenderer` follows the active profile; `StreamProfileEditor` in the camera item editor; `StreamProfileSwitcher` mid-presentation control with optimistic revert-on-failure; `update_set_item` now patches every output (D-67) |
| 14B live lyrics editing | T7–T11 | `SlideAnchor`/`anchor_of`/`resolve_anchor` pure position anchoring (D-65); `regenerate_song_slides` pool-only core + `refresh_song_in_outputs` lock/emit shell wired into `update_song` (D-66); `LiveSongEditModal` mounts unmodified `SongEditor` without disturbing `currentView`; live-edit entry point (Song items only) + exit cleanup in the operator layout |
| 14A multi-screen launch & naming | T12–T20 | `LaunchPolicy` setting (ask/mirror_all/main_only); `resolveLaunchPlan`/`startPresentationPlan`; `MultiScreenLaunchModal`; `PresentationLaunchProvider`/`useRequestPresentation` wired into all four Apresentar call sites; `LaunchPolicySetting` control; `monitorIdentity`/`resolveMonitorName` stable per-monitor naming; `MonitorNameSettings` editor; names surfaced in `MonitorPicker`/`OutputSwitcher`/`MultiScreenLaunchModal` |
| 14D icon rebrand | T22 | `src-tauri/icons/icon.svg` — L-as-music-note mark on the existing purple/dark-rounded-square palette; full asset set regenerated via `npx tauri icon`; `public/icons/` synced by hand |
| Wrap-up | T21 | Full gate re-verified after fixing 3 tsc errors surfaced by concurrent-task interaction (nullable-type mismatches, not caught by any individual task's own `vitest run` gate); spec traceability → Implemented; ROADMAP Phase 14 row; this summary; D-65..D-67 recorded |

**Test results at completion:** 546 Vitest tests (73 files; baseline 480 + 66 new), 327 Rust tests (baseline 307 + 20 new — note: baseline in tasks.md said "≥310"/"≥315" per-task minimums assuming 307 start; actual lib-only baseline was 278 at some intermediate points per one sub-agent's observation, converging to 280 lib + 47 integration = 327 total at completion, all green, 0 deletions). `tsc --noEmit` clean. `cargo clippy -D warnings` clean. `src/i18n/locales.test.ts` green throughout.

**Open verification note (manual, hardware required — carried from tasks.md § Manual Verification):**
1. Launch policy across all three values, from all four Apresentar call sites
2. Monitor names surviving restart, unplug/replug, and enumeration reorder
3. Live edit mid-song: no black frame, position held, with blackout and frozen modes engaged
4. Profile switch mid-presentation while OBS pulls the 4K main stream concurrently — confirm OBS is unaffected and latency stops growing
5. Profile switch while the camera is on **Tela 2** (D-67), confirming the switch reaches the second screen

**Field actions before shipping** (spec § Root-Cause Analysis — configuration, not code): switch the camera item's RTSP transport `udp` → `tcp`; enable a 1080p/720p sub-stream on the camera; verify negotiated NIC link speed at both ends.

---

## Phase 11 Completion Summary (2026-06-02)

All 5 P11-01..P11-05 requirements delivered (T1–T6 via parallel sub-agents; frontend-only, no Rust/schema/IPC change):

| Area | Tasks | Delivered |
|---|---|---|
| Announcement over blackout — projection | T1 (P11-01) | `PresentationApp.tsx` precedence → announcement-overlay → blank → other-overlay → idle → live/frozen (D-45); +3 tests |
| Announcement over blackout — LIVE preview | T2 (P11-02) | `LivePreview.tsx` announcement card before BLACKOUT card; media/webView stay below blank; +2 tests |
| Optimistic selection — store | T3 (P11-03 core) | `usePresentationStore` `pendingSelection` + `selectSlide`; `onStateChanged` clears pending (D-46); new `presentation.test.ts` +4 tests |
| Optimistic + memo + 16:9 crop | T4 (P11-03/04/05) | `StrophesGrid` `effectiveSlideIdx`; `React.memo`(`SlideCard`)+`useMemo`+`useCallback`; `aspect-video` on outer button + grid `items-start`; +3 tests |
| Optimistic selection — set items | T5 (P11-03) | `SetItemList` active from `pendingSelection?.itemIndex ?? currentItemIndex`; click → `selectSlide`; +2 tests |
| Wrap-up | T6 | ROADMAP Phase 11 row, STATE current-phase + this summary, spec traceability → Verified, `SUMMARY.md` |

**Test results at completion:** Rust tests green (unchanged), `tsc --noEmit` clean, **268 Vitest tests** (39 files) — all passing (baseline 254; +14 new, no pre-existing test removed).

**Open verification note:** P11-05 "zero empty space" and P11-03 "perceptually instant highlight" are covered by structural proxies in tests (`items-start`, `aspect-video`, `aria-current` from `pendingSelection`); recommend a manual two-monitor pass (F10→Aviso-over-black→clear→F10; rapid strophe/item clicking; tight 16:9 cards).

---

## Phase 10 Completion Summary (2026-06-02)

All 6 P10-01..P10-06 requirements delivered (T1–T7 via parallel sub-agents, 4 file-independent chains):

| Area | Tasks | Delivered |
|---|---|---|
| Smart parens — backend | T1 (P10-03) | `credit_line`/`is_balanced_wrapped` in `commands/presentation.rs`; `build_title_slide` uses `author.and_then(|a| credit_line(a, in_parens))`; +10 unit cases (4 flag×wrap combos, `()`, `John (PD)`, `(A) and (B)`) |
| Smart parens — frontend | T2 (P10-04) | new `src/components/presentation/credit.ts` (`creditLine`/`isBalancedWrapped`), consumed in `SongPreviewPane.tsx`; `credit.test.ts` 10 cases 1:1 with Rust |
| Overlay over idle | T3 (P10-01) | `PresentationApp.tsx` render-branch reorder → blank → overlay → idle → live/frozen (D-40); +2 test cases (overlay-over-idle, blank-beats-overlay) |
| Esc always escapes | T4 (P10-02) | `isPresentationActive` predicate in `keyboard.ts` (D-41); presentation-window Esc always forwards + ~400ms local self-close fallback (D-42); operator Esc + rebindable exit unified; fake-timer Vitest cases |
| Observability | T5 (P10-05) | panic hook + `on_window_event` logging in `lib.rs` (D-44) |
| Lifecycle hardening | T6 (P10-06) | operator `Destroyed` → close presentation window; `should_close_presentation_on_destroy(label)` pure helper + 3 unit tests in `commands/window.rs` |
| Wrap-up | T7 | ROADMAP Phase 10 row, STATE D-40..D-44, this summary; full gate green |

**Test results at completion:** Rust tests green, `cargo clippy -D warnings` clean, `tsc --noEmit` clean, 254 Vitest tests (38 files) — all passing.

**Open verification note (carried from tasks.md):** P10-05/06 instrument and contain issue #3 (spontaneous operator close) but do not yet prove its root cause — needs a field repro. The new `on_window_event` + panic-hook logging is designed to disambiguate the leading hypotheses (WebView2/GPU process crash on focus loss, async-command panic, OS/WM always-on-top focus interaction) on the next field occurrence. Regardless of cause, the P10-02 local Esc fallback + P10-06 orphan prevention ensure the user is never left stuck.

---

## Phase 8 Completion Summary (2026-05-23)

All 8 P8-01..P8-08 requirements delivered:

| Area | Tasks | Delivered |
|---|---|---|
| State sync | P8-01, P8-02 | `StrophesGrid`/`SetItemList` click handlers read store via `getState()` at click time; `emit_state` tracing added |
| Countdown fallback | P8-03 | No-config countdown set item renders `t("presentation.countdown.noConfig")` instead of silent black |
| ESC freeze | P8-04 | `exit_presentation` idempotent; `state_changed` emitted before `w.close()`; frontend `exitInflight` dedup |
| ESC label | P8-05 | `Keycap` maps Escape→ESC, arrows→glyphs, Space→"Space"; `exitPresentation` normalised to `[{Escape}]` on boot |
| URL scheme | P8-06 | `protocol::asset::url_for()` helper; `mediaUrl()` frontend helper; all `asset://localhost/...` literals swept |
| Background presets | P8-07 | Migration 007 (8 new columns); `BackgroundPreset`/`FontFamily`/`FontSize`/`Typography` domain types; preset-mode resolver branch; `SongEditor` 3-tab BackgroundEditor (None/Preset/Media at song level; Inherit/Preset/Media at section level); `SongBackground`/`SongSlide`/`LivePreview` honour preset + typography |
| Apresentar buttons | P8-08 | `SetBuilder.hidePresentButton` prop; `HomeSetBuilder` suppresses bottom button; standalone set-builder bottom button unified with home handler; `set-player` dead view removed |

**Test results at completion:** 148 Vitest tests green. `tsc --noEmit` clean. `cargo test` green. `cargo clippy -D warnings` clean. `Grep "asset://localhost"` = 0 code matches. `Grep "ESCAPE/SPACE"` = 0 matches.

---

## Phase 7 Completion Summary (2026-05-23)

All 8 P7-01..P7-08 requirements delivered:

| Area | Tasks | Delivered |
|---|---|---|
| Monitor fix | P7-01 | `width > 0 && height > 0` filter at enumeration; toast on `enter_presentation` error (D-32) |
| Single-monitor fullscreen | P7-02 | `always_on_top(true)` + `fullscreen(true)` on single-monitor path (D-33); multi-monitor unchanged |
| Dark-theme sweep | P7-03 | Zero hardcoded color hits in operator components; `check-theme-tokens.ps1` deny-list updated |
| 3-pane shell | P7-04 | `OperatorPresentationLayout` — LEFT SET pane (~240 px) + CENTER STROPHES flex-1 + RIGHT LIVE preview (~320 px) |
| Strophes grid | P7-05 | `StrophesGrid` — wrapping thumbnail grid replaces vertical slide list |
| LIVE preview | P7-06 | `LivePreview` hybrid strategy: full render for text/image/countdown; placeholder cards for video/iframe (D-34) |
| SET pane | P7-07 | `SetItemList` — click-to-replace (`goto_slide(itemIdx, 0)`) inter-item navigation |
| OverlayActionBar | P7-08 | `<OverlayActionBar />` extracted; dialogs stay inline (D-35); reused in `HomeSetBuilder` |
| Cleanup | T10 | `PresentationNavigator` component + test deleted; `VideoDims` type alias added to fix clippy type_complexity |

**Test results at completion:** 141 Rust unit tests, 124 Vitest tests — all passing. `tsc --noEmit` clean. `cargo clippy -D warnings` clean. `check-theme-tokens.ps1` exits 0.

---

## Phase 6 Completion Summary (2026-05-22)

All 9 P6-01..P6-09 requirements delivered:

| Area | Tasks | Delivered |
|---|---|---|
| Stage removal | T1 | Stage window subsystem deleted; 3-window → 2-window architecture |
| Button cleanup | T2 | Redundant "Open Presentation Window" toolbar button removed |
| Presentation mode | T3, T4 | `enter_presentation`/`exit_presentation` backend + "Apresentar" button + OperatorApp routing + lifecycle subscription |
| Navigator | T5 | `PresentationNavigator` — scrollable per-slide list, click-to-jump, auto-scroll, current highlight |
| Keyboard | T6 | ESC exits presentation, F10 toggles blackout (hardcoded, both windows), read-only rows in KeyBindingsScreen |
| Token sweep | T7 | `--color-fg` + `--color-fg-on-primary` tokens; NotesField + textbox sweep |
| Surface sweep | T8, T9 | Full operator surfaces → semantic tokens; `check-theme-tokens.ps1` deny-list extended; dark contrast fixed |
| Countdown | T10, T11 | `CountdownTarget` enum (`Duration` \| `FixedTime`); backward-compat serde; `CountdownSetItemEditor` mode toggle + `<input type="time">` |

**Test results at completion:** 175 Rust unit tests, 104 Vitest tests — all passing. `tsc --noEmit` clean. `check-theme-tokens.ps1` exits 0.

---

## Phase 4 Completion Summary (2026-05-21)

All 12 P4H-01..P4H-07e requirements delivered:

| Area | Tasks | Delivered |
|---|---|---|
| Theme tokens | T1–T7 | CSS custom props in `index.css` (`--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-muted`, `--color-primary #19A4DD`); full semantic token sweep across all tabs/components |
| Auto-monitor | T8, T12 | `open_presentation_window` auto-picks first non-primary monitor + fullscreen; manual picker removed from operator UI |
| Single-set home | T9, T13 | `get_or_create_default_set` command; `HomeSetBuilder` replaces Conjuntos as starting view |
| Overlay backend | T10 | `OverlayState` (Announcement/QuickMedia/QuickWebView) in `PresentationState`; 4 commands: `set_announcement_overlay`, `set_media_overlay`, `set_webview_overlay`, `clear_overlay` |
| Remove section label | T11 | Strophe label removed from `PresentationApp` `SongSlide` |
| Overlay renderers | T14–T16 | `AnnouncementRenderer`, `QuickMediaRenderer`, `QuickWebViewRenderer` |
| Overlay wiring | T17 | `PresentationApp` overlay branch (after blank guard, before set content); Esc clears overlay first |
| Home shortcuts | T18–T20 | "Limpar" with confirmation; drag-from-library song sidebar; Oferta/Câmera/Aviso/PDF overlay buttons |

**Test results at completion:** 124 Rust unit tests, 86 Vitest tests — all passing. `tsc --noEmit` clean.

---

## Phase 5 Completion Summary (2026-05-21)

All 8 P5-01..P5-08 requirements delivered:

| Area | Tasks | Delivered |
|---|---|---|
| Data model | T1 | `Presentation` MediaKind, `slide_count` column, migration 006 |
| Domain | T2 | `SlideShow` SetItemType, `Slide::pseudo_slideshow(index)` |
| Backend service | T3 | `libreoffice.rs`: soffice path resolution (bundled → env → PATH), headless PNG conversion, canonical rename to `slide_NNN.png` |
| Backend command | T4 | `import_presentation` command, `check_libreoffice`, `conversion_progress` event |
| Runtime | T5 | `load_set_for_presentation` generates N pseudo-slides for SlideShow items |
| Presentation | T6 | `SlideshowRenderer` (asset URL with padded index), `SlideshowSetItemEditor` (thumbnail + slide count), SetBuilder "+ Apresentação" button, HomeSetBuilder PDF button wired |
| Tests | T7 | 10 new Vitest tests (SlideshowRenderer ×3, LibreOfficeBanner ×4, SlideshowSetItemEditor ×3) |

**Test results at completion:** 124 Rust unit tests, 96 Vitest tests — all passing. `tsc --noEmit` clean.

**Decision:** Sentry crash reporting (originally bundled with Phase 5) skipped entirely per user decision.

---

## Phase 3 Completion Summary (2026-05-20)

All 18 P3-01..P3-18 requirements delivered:

| Phase | Tasks | Delivered |
|---|---|---|
| 3A — Stage window | T4-T7 | `open_stage_window`, `StageApp`, `StageRenderer` (current+next+notes+clock), `WindowsScreen` |
| 3B — Notes | T8-T12 | Per-section notes (SectionCard), per-set-item notes, OperatorNotesPanel, StageNotesPanel |
| 3C — Section BG | T13-T16 | Background resolver service, SectionCard picker, restart-on-boundary semantics, delete check |
| 3D — Shortcuts | T17-T20 | `key_bindings` domain+commands, TS dispatcher, KeyBindingsScreen, window forwarding |
| 3E — CCLI | T21-T24 | Song editor Direitos panel, `play_counter` service, CSV export command, CCLIReportScreen |
| 3F — Theme | T25-T27 | Tailwind dark variant, theme store + bootstrap, ThemeToggle, light-mode regression sweep |
| 3G — Auto-update | T28-T30 | `tauri-plugin-updater`, check/apply commands (24h debounce), UpdateBanner+Dialog |
| 3H — Cross-cutting | T31-T32 | i18n extraction sweep, STATE/ROADMAP update |

**Test results at completion:** 109 Rust unit tests, 74 Vitest tests — all passing. `tsc --noEmit` clean.

**Field period:** 8 weeks from 2026-05-20 → 2026-07-15. No non-critical merges during field period.

---

## Phase 0 Completion Summary

All 5 Phase 0 goals delivered:
1. Two-window IPC demo: `increment_counter` command + `state_changed` event working
2. sqlx + SQLite: pool connected, `sqlx::migrate!()` running `001_initial.sql` at startup
3. asset:// protocol: registered in lib.rs + tauri.conf.json CSP; path traversal protected
4. MP4 via asset://: `<video src="asset://media/test.mp4">` in PresentationApp
5. Tests green: 9 Rust tests + 3 Vitest tests passing

---

## Preferences

- (none recorded yet)
