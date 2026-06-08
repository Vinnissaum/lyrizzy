# Tasks — Dual independent presentation outputs + camera RTSP with mic audio on the 2nd TV

**Spec/design**: `dual-output-presentation-camera-mic-audio.md`
**Spike**: `dual-output-spike-c0-webview2-audio.md` (C0 done — verdict GO)
**Status**: In progress. 4 slices, 23 tasks. Backend `output` dimension defaults to
`One` so each step stays green during migration (plan R-7).

**Progress** (branch `feat/dual-output`)
- ✅ **A1** `OutputId` domain type — `domain/output.rs` (+`other()`), tests. (2026-06-08, commit 4d90a1e)
- ✅ **A2** `AppState` → `outputs: HashMap<OutputId, OutputState>` (presentation+slides+countdown+task per output; `stream_proxy` global); all 55 access sites migrated. (4d90a1e)
- ✅ **A3** `output` param through presentation nav/load commands. (3f1c7ff)
- ✅ **A4** `output` param through overlay commands. (3f1c7ff)
- ✅ **A5** `output` param through countdown commands (per-output ticker/takeover; helpers already Arc-parameterised). (3f1c7ff)
- ✅ **A6** per-output `enter/exit_presentation` (window label `presentation`/`presentation-2`, both load `presentation.html`), `resolve_output_monitor` exclusion, operator-destroy closes all presentation* windows, lifecycle payload carries `output`. (03c02e3)
- ✅ **A7** tagged `{output,state}` events end-to-end + frontend output routing (`onStateChanged`/`onCountdownTick` filter by output; `subscribe(output)`; `PresentationApp` `output` prop; `main.tsx` label→OutputId). (91692be)
- ✅ **A8** no new commands to register; full gate green; docs updated. (this commit)

**SLICE A COMPLETE.** Gate: **235 Rust lib + integration tests, clippy `-D warnings`, tsc, 339 vitest — all green.** The backend has a full output dimension and the frontend routes by output; the app still drives output One identically.

**SLICE B — operator dual-output control, gated behind a config toggle (per user request).** Done 2026-06-08 (commits 969f395, f0e914b):
- ✅ **B0** `multiScreenEnabled` setting (`output.multi_screen_enabled`, default false) + Settings toggle + i18n. Single-screen UI unchanged when off.
- ✅ **B1** output-aware presentation store (`output`/`focusedOutput`, mutations target focused output) + per-output command wrappers (nav/overlay/enter/exit/load, per-output monitor key + exit dedup).
- ✅ **B2** `OutputSwitcher` (Tela 1/2 tabs, render-gated on the setting) + `OperatorApp` focus-keyed re-subscription so the panes follow the selected screen. +3 tests.
- ✅ **B3** keyboard/Esc act on the focused output (live-read to dodge stale closure).
- ✅ **B5** per-output set picker (operator empty-state) → `loadSetForPresentation(setId, output)` + `enterPresentation(output)`.
- ⏳ **B4 (partial)** TV-2 `last_set_id` persistence not yet wired (picker is per-session).
- ⏳ **B6** per-output countdown *arming*: countdown store mutations (start/arm) still target output One — needs `output` on the countdown command wrappers + store. Display already follows the focused output.
- ⏳ status-strip for the unfocused output: deferred.

Gate after Slice B: **tsc, 342 vitest (+3) green; Rust unchanged (235).** **Needs a real two-monitor `npm run tauri dev` validation pass** (cannot be verified headless).

**SLICE B COMPLETE** (B0–B6) incl. per-output countdown arming + TV-2 last-set memory. Commits 969f395, f0e914b, + B4/B6 commit.

**SLICE C — in progress (primitives done).** Commit (Slice C primitives):
- ✅ **C5** `StreamProxyRenderer` `muted` prop (default true) + `sinkId` (camera audio → output device via `HTMLMediaElement.setSinkId`). +existing tests.
- ✅ **C3** `utils/audioDevices.ts` — enumerate inputs/outputs, replug-safe `resolveDeviceId` (id → label+groupId), `supportsAudioOutputSelection`. +7 tests.
- ✅ **C4** `hooks/useMicAudio.ts` — getUserMedia → `DelayNode` → `AudioContext.setSinkId`, live delay, full teardown. +4 tests.
- ⏳ **C2** Windows `PermissionRequested`→Allow(Microphone) handler (Rust, `with_webview` + `webview2-com`) — **needs the real WebView2 native API + a Windows build to verify; not written yet (won't fabricate the binding blind).**
- ⏳ **C6/C7** operator `MicSwitch` (on/off + delay) + camera-audio toggle + mounting `useMicAudio` in the camera output window — buildable but **non-functional until C2 + rig**, and entangled with the audio-device settings (D1/D2).
- ⏳ **C1** rig verification (mic actually exits TV-2 HDMI; autoplay gesture; sane delay default) — **your Windows 3-display hardware only.**

Gate after Slice C primitives: **tsc, 353 vitest (+11) green; Rust 235 + clippy unchanged.**

**Genuine handoff point:** the remaining Slice C work needs (1) the native mic-permission handler verified on a Windows build, and (2) real-hardware confirmation of the audio path. Slices A+B also still want a two-monitor `tauri dev` validation pass.

**A6 simplification:** both windows load the same `presentation.html` (label differentiates them), so no `presentation-2.html`/Vite/tauri.conf changes are needed — A6 was pure Rust.

**Sequencing refinement (decided during A2):** the **tagged `state_changed`/`countdown_tick` payload** is deferred from A3/A5 to land **together with the frontend (A7)**. Reason: flipping the event shape before the frontend can filter it would break the *running* app between commits (Rust tests would pass, but the presentation window would mis-parse events). Until Slice B, only output One is ever driven, so A3–A6 keep emitting the existing bare payloads. A7 introduces the tagged shape + frontend filters in lockstep.

**Gate commands** (no `TESTING.md`; from CLAUDE.md conventions):
- Rust: `cargo test --manifest-path src-tauri/Cargo.toml` + `cargo clippy --all-targets -- -D warnings`
- Frontend: `npx vitest run` (co-located `*.test.tsx`/`*.test.ts`)
- `npx tsc --noEmit`
- i18n parity enforced by the existing key-completeness test (part of `vitest run`)

**All tasks**: standard file/edit tools; no MCP/skills unless a task says otherwise.

**Requirement tags**: `R-OUT` output model · `R-WIN` windows/monitors · `R-CD` per-output
countdown · `R-OP` operator control · `R-CAM` camera audio · `R-MIC` mic+delay+routing ·
`R-SET` settings/persistence.

---

## Slice sequencing

```
Spike C0 ✅ (done) ─────────────────────────────────────────────┐
                                                                 │ (informs C)
SLICE A (backend foundation + per-output countdown)  ── gates ─▶ SLICE B (operator control)
        │                                                              │
        └────────────────────────────── both gate ───────────────────┴─▶ SLICE C (audio, +C0 rig check)
                                                                                    │
                                                                                    ▼
                                                                              SLICE D (settings/i18n/polish)
```

Ship/verify each slice before the next. A is green = app still works single-output. B green =
two TVs run different sets + independent countdowns. C green = mic on the camera TV. D = persistence + polish.

---

# SLICE A — Dual-output backend foundation + per-output countdown

### A1: `OutputId` domain type [P]
**What**: New `OutputId` enum (`One`, `Two`) with serde `rename_all="camelCase"` → `"one"`/`"two"`;
`from_window_label(&str) -> Option<OutputId>` (`presentation`→One, `presentation-2`→Two) and
`window_label()` inverse; `all()` iterator.
**Where**: `src-tauri/src/domain/output.rs` (new); `domain/mod.rs` (export).
**Depends on**: none. **Reuses**: serde conventions; [[serde-enum-rename-all-fields]] (unit-variant rename is fine here).
**Req**: R-OUT.
**Done when**: serde round-trips both variants; label↔id helpers covered by unit tests.

### A2: `AppState` → keyed outputs + per-output countdown + tagged event payload
**What**: Replace single `presentation`/`presentation_slides` with `outputs: HashMap<OutputId, OutputState>`
(`OutputState { presentation: RwLock<PresentationState>, slides: RwLock<Vec<Vec<Slide>>> }`) and a
`output(id)` accessor. Replace single `countdown`/`countdown_task` with
`countdown: HashMap<OutputId, Arc<RwLock<CountdownState>>>` + `countdown_tasks: HashMap<…, Arc<Mutex<Option<AbortHandle>>>>`.
Keep `stream_proxy` as-is. Add `StateChangedPayload { output: OutputId, state: PresentationState }`
+ `CountdownTickPayload { output: OutputId, state: CountdownState }`. `Default` builds both outputs.
**Where**: `src-tauri/src/state.rs`; small new `domain/events.rs` (or in `output.rs`) for the payload structs.
**Depends on**: A1. **Reuses**: existing `PresentationState`/`CountdownState`.
**Req**: R-OUT, R-CD.
**Done when**: compiles with accessors; `db_pool_unset`/`countdown_starts_idle` tests adapted to the map; new test: both outputs present and independent by default.

### A3: Thread `output` through presentation nav + load commands
**What**: Add `output: Option<OutputId>` (default `One`) to `next_slide`, `prev_slide`, `goto_slide`,
`set_blank`, `freeze`, `load_set_for_presentation`, `append_item_to_live_presentation`. Read/write via
`state.output(id)`; emit the tagged `state_changed` (`StateChangedPayload`). Preserve drop-lock-before-emit.
**Where**: `src-tauri/src/commands/presentation.rs`; `lib.rs` (signatures unchanged in handler list).
**Depends on**: A2. **Reuses**: existing nav logic, `compute_item_slides`/`load_slide_gen_settings`, `append_item_to_live_presentation` (from the 2026-06-08 work).
**Req**: R-OUT.
**Done when**: existing nav tests pass against output One; new test: navigating One leaves Two untouched. `state_changed` payload carries `output`.

### A4: Thread `output` through overlay commands
**What**: Add `output` (default One) to `set_announcement_overlay`, `set_media_overlay`,
`set_webview_overlay`, `clear_overlay`; operate on `state.output(id)`; emit tagged `state_changed`.
**Where**: `src-tauri/src/commands/overlay.rs`.
**Depends on**: A2 (payload type from A2; can run [P] with A3 — disjoint files).
**Reuses**: existing overlay logic (D-22/D-40/D-45 precedence unchanged).
**Req**: R-OUT.
**Done when**: overlay set on Two does not appear on One; existing overlay tests pass on One.

### A5: Per-output countdown (state + commands + ticker + takeover)
**What**: Thread `output` (default One) through `commands/countdown.rs` (arm/fire/reset/schedule);
each ticker task captures its `OutputId` and emits the tagged `countdown_tick`; takeover engages only on
the owning output; `exit_presentation(output)` (A6) tears down only that output's ticker/takeover.
Thread the countdown-v2 auto-present/launch logic with `output`
(`scheduled-countdown-launch-warning-autopresent.md`).
**Where**: `src-tauri/src/commands/countdown.rs`; touches `state.rs` maps from A2.
**Depends on**: A2. **Reuses**: existing ticker/arm/fire (correct per [[countdown-arming-model]]).
**Req**: R-CD.
**Done when**: unit test — TV-1 ticker running/takeover does **not** mutate Two's `CountdownState`; aborting One leaves Two ticking.

### A6: Window layer — second window, per-output enter/exit, multi-monitor exclusion
**What**: `enter_presentation(output, monitor_index)` / `exit_presentation(output)`; build label
`presentation`/`presentation-2`; per-output empty-set guard + idempotency on that label. Extend
`resolve_target_index` to **exclude a monitor already used by the other active output**. Generalize the
operator-destroy teardown to close **all** `presentation*` windows (P10-06). Add `presentation-2.html`
Vite input + `tauri.conf.json`; confirm CSP allows mic/`mediastream:`.
**Where**: `src-tauri/src/commands/window.rs`; `vite.config.ts`; `presentation-2.html` (mirror `presentation.html`); `tauri.conf.json`.
**Depends on**: A2, A1. **Reuses**: `apply_monitor`, `logical_placement`, `pick_secondary_index`, `should_pin_on_top`, Linux `fullscreen_on_monitor` path.
**Req**: R-WIN.
**Done when**: pure tests — exclusion picks a *different* monitor for the 2nd output; teardown helper returns true for `operator` and closes both presentation labels; per-output empty-set guard.

### A7: Frontend IPC + entry plumbing (operator still single-output)
**What**: `commands.ts`: add `output` params to nav/overlay/countdown/enter/exit wrappers (default One);
`onStateChanged(output, cb)` + `onCountdownTick(output, cb)` filter the tagged payloads.
`main.tsx`: treat any `presentation*` label as a presentation window, derive `OutputId`, pass to
`PresentationApp`. `PresentationApp` subscribes to **its** output. Presentation store keyed by output.
Operator keeps driving One (no UI change yet).
**Where**: `src/api/commands.ts`, `src/main.tsx`, `src/windows/presentation/PresentationApp.tsx`, `src/stores/presentation.ts`.
**Depends on**: A3, A4, A5, A6. **Reuses**: existing listeners; D-36 `SlideStage`.
**Req**: R-OUT.
**Done when**: `onStateChanged` ignores the other output's events (Vitest); existing presentation tests pass; `tsc` clean.

### A8: Slice A gate + STATE/ROADMAP note
**What**: Register any new commands in `lib.rs` invoke_handler; run full gate; record decisions
(OutputId model, tagged events, per-output countdown) in STATE.
**Depends on**: A1–A7. **Req**: R-OUT/R-CD/R-WIN.
**Done when**: all gate commands green; app runs single-output exactly as before (manual smoke on One).

---

# SLICE B — Operator dual-output control
*(depends: Slice A green)*

### B1: i18n — operator dual-output strings [P]
**What**: `Tela 1`/`Tela 2`, switcher, status-strip labels, "Apresentar Tela N", per-output monitor picker.
**Where**: `src/i18n/locales/*.json`. **Depends on**: none. **Req**: R-OP.
**Done when**: key-parity test green.

### B2: Operator holds both outputs (store/selectors)
**What**: Operator presentation store tracks both outputs' states; `focusedOutput` state + selectors
(focused state for the 3-pane, other state for the status strip).
**Where**: `src/stores/presentation.ts`. **Depends on**: A7. **Req**: R-OP.
**Done when**: store unit tests — focus switch flips which output the selectors return; both stay in sync with their own `state_changed`.

### B3: Output switcher tabs + status strip
**What**: `Tela 1 / Tela 2` tabs above SET|STROPHES|LIVE; 3-pane drives the focused output; compact
status strip shows the *other* output (set name + current item + mode + small `SlideStage` thumbnail).
**Where**: `src/components/presentation/OperatorPresentationLayout.tsx` (+ small `OutputSwitcher.tsx`, `OutputStatusStrip.tsx`).
**Depends on**: B2, B1. **Reuses**: D-30 layout, D-36 `SlideStage`, D-46 memoized cards.
**Req**: R-OP.
**Done when**: switching tabs re-targets the panes; status strip renders the other output; Vitest for switch + strip.

### B4: Keyboard routing to the focused output
**What**: Route Space/arrows/B/F/Esc/1–9 + rebindable actions to the focused `OutputId`; presentation-window
key-forward tags its own output.
**Where**: `src/runtime/keyboard.ts`, `OperatorApp.tsx`, `PresentationApp.tsx` (forward tag).
**Depends on**: B2. **Reuses**: `isPresentationActive` (D-41), forward_keydown (P10-02/D-42).
**Req**: R-OP.
**Done when**: fake-timer Vitest — a key acts on the focused output only; Esc precedence preserved.

### B5: Per-output set selector + monitor picker + present controls; TV-2 remembers last set
**What**: Each output: choose its set (any set; One keeps default "Culto Dominical" D-21), pick its monitor,
"Apresentar Tela N" / exit. Persist + restore `output2.last_set_id`.
**Where**: `OperatorPresentationLayout.tsx`/home controls; `src/api/commands.ts` (per-output load+enter); `src/stores/settings.ts` (last-set).
**Depends on**: B2, A6. **Reuses**: `get_or_create_default_set`, `load_set_for_presentation(output,…)`.
**Req**: R-OP, R-SET.
**Done when**: TV-2 reopens with its last set; launching two outputs targets two monitors; Vitest for selector + last-set restore.

### B6: Per-output countdown wiring (operator)
**What**: Countdown store keyed by `OutputId`; `CountdownSetItemEditor` auto-arm effect runs per output;
floating widget/badge reflect the owning output.
**Where**: `src/stores/countdown.ts`, `CountdownSetItemEditor`, countdown widget components.
**Depends on**: A5, B2. **Reuses**: countdown-v2 widget/modal ([[countdown-arming-model]]).
**Req**: R-CD.
**Done when**: a countdown item armed on Two engages only Two's projector; One unaffected; Vitest.

---

# SLICE C — Camera audio + mic + HDMI routing
*(depends: Slice A+B green; do C1 rig checks first — Spike C0)*

### C1: Rig confirmation of Spike C0 residual checks (manual, BEFORE building)
**What**: On the real Windows 3-display rig, confirm the spike's open checks: no-dialog mic with the
permission handler (C2), HDMI device enumerated with label, `AudioContext({sinkId})` actually exits TV
speakers, un-muted camera `setSinkId`, autoplay-gesture need (R-2), sane delay default.
**Depends on**: C2 prototype available. **Req**: R-MIC. **Done when**: checklist in the spike doc ticked or deviations noted.

### C2: Windows mic permission handler (auto-Allow)
**What**: On presentation windows, register a WebView2 `PermissionRequested`→`Allow` handler for the
`Microphone` kind via `WebviewWindow::with_webview`, `#[cfg(windows)]`, using `webview2-com`/`windows`.
Removes the default prompt and the irreversible-Block trap (Spike C0, [tauri #5042]).
**Where**: `src-tauri/src/commands/window.rs` (or a `setup` hook); `Cargo.toml` (webview2-com/windows if not already pulled by tauri).
**Depends on**: A6. **Req**: R-MIC.
**Done when**: packaged app gets the mic with no dialog (verified in C1); non-Windows builds compile (cfg-gated).

### C3: Audio-device utilities [P]
**What**: `enumerateAudioDevices()` (inputs + outputs), match-by-`{label, groupId}` with `deviceId`
fallback (R-4), and a capability check (`typeof AudioContext.prototype.setSinkId === "function"`).
**Where**: `src/utils/audioDevices.ts` (new). **Depends on**: none (mockable). **Req**: R-MIC.
**Done when**: Vitest with mocked `enumerateDevices` — filtering, label-match fallback, capability false-path.

### C4: `useMicAudio` hook
**What**: `useMicAudio({ deviceId, sinkId, delayMs, enabled })`:
`getUserMedia({audio:{deviceId}})` → `MediaStreamAudioSourceNode` → `DelayNode(delayMs/1000)` →
`AudioContext({ sinkId })`; live-update `delayTime`; full teardown on disable/unmount; surface
permission-denied. No-op when `enabled` is false.
**Where**: `src/hooks/useMicAudio.ts` (new). **Depends on**: C3. **Req**: R-MIC.
**Done when**: Vitest with mocked `getUserMedia`/`AudioContext`/`DelayNode`/`setSinkId` — attach, sink set,
delay applied to `delayTime`, cleanup releases tracks/context, denied path, disabled = no capture.

### C5: `StreamProxyRenderer` — `muted` prop + output sink
**What**: Replace the hardcoded `muted` with a `muted` prop (default true); when un-muted, apply
`HTMLMediaElement.setSinkId(sinkId)` to the `<video>`.
**Where**: `src/components/presentation/StreamProxyRenderer.tsx`. **Depends on**: C3.
**Reuses**: existing WHEP path (audio track already negotiated, `whep.ts:40`). **Req**: R-CAM.
**Done when**: Vitest — `muted` prop honored; `setSinkId` called with the device when un-muted; default unchanged (muted).

### C6: `MicSwitch` control + mount mic companion on the output
**What**: Per-screen `MicSwitch` (on/off switch, default off; delay-ms input) on the operator's per-output
controls; mount `useMicAudio` in `PresentationApp` for that output, driven by the switch + settings.
Add the "Ativar áudio" one-tap affordance **iff** C1 shows autoplay needs a gesture (R-2).
**Where**: `src/components/presentation/MicSwitch.tsx` (new); `PresentationApp.tsx`; operator controls.
**Depends on**: C4, B3/B5. **Req**: R-MIC.
**Done when**: toggling the switch starts/stops mic on that screen; delay edits take effect live; Vitest for switch wiring.

### C7: Camera-audio toggle wiring
**What**: Per-output "Áudio da câmera" toggle → `StreamProxyRenderer.muted`; default muted.
**Where**: operator output controls; `PresentationApp.tsx`; settings (`camera_unmuted`).
**Depends on**: C5, B5. **Req**: R-CAM.
**Done when**: toggle un-mutes camera audio on that screen only; Vitest.

---

# SLICE D — Settings persistence + i18n + polish
*(depends: Slice C green)*

### D1: Settings UI — per-output devices/monitor/audio
**What**: SettingsScreen section per output: monitor picker, mic-input device, audio-output (HDMI) device,
camera-unmute, mic delay default, mic enabled. Populate via `enumerateAudioDevices` (labels after grant).
**Where**: `src/components/settings/SettingsScreen.tsx`, `src/stores/settings.ts`. **Depends on**: C3, C6, C7. **Req**: R-SET.
**Done when**: pickers list real devices; selections drive the hooks; Vitest with mocked enumerate.

### D2: Persistence (key/value rows, no migration)
**What**: Load/save `output1.monitor_index`, `output2.monitor_index`, `output2.last_set_id`,
`output.<id>.audio.{mic_device_id,output_device_id,camera_unmuted,mic_enabled,mic_delay_ms}`. Store devices
by label+groupId (R-4). **Mic on/off remembered per screen** (per the decision); delay + devices remembered.
**Where**: `src/stores/settings.ts`; settings commands (existing key/value `settings` table — D-39 pattern, no migration).
**Depends on**: D1. **Req**: R-SET.
**Done when**: restart restores monitor/devices/delay/mic-state/last-set; Vitest for load/save round-trip.

### D3: Polish + i18n parity + STATE/ROADMAP
**What**: Status-strip thumbnails refinement; device-replug graceful fallback to default (R-4);
capability-missing user message (setSinkId absent); final pt-BR/en-US parity; STATE decisions + ROADMAP row;
update the plan/spec status to implemented.
**Where**: components above; `src/i18n/locales/*`; `.specs/project/STATE.md`, `ROADMAP.md`.
**Depends on**: D2. **Req**: all.
**Done when**: full gate green; manual two-TV + camera + mic pass on the rig; docs updated.

---

## Traceability

| Req | Tasks |
|-----|-------|
| R-OUT | A1, A2, A3, A4, A7, A8 |
| R-WIN | A6, A8 |
| R-CD | A2, A5, B6 |
| R-OP | B1, B2, B3, B4, B5 |
| R-CAM | C5, C7 |
| R-MIC | C1, C2, C3, C4, C6 |
| R-SET | B5, D1, D2, D3 |

## Parallelizable
- Slice A: **A1** then **A3 ∥ A4** (disjoint command files, both after A2); A5 ∥ A3/A4.
- Slice B: **B1** anytime; B3/B4/B5/B6 after B2.
- Slice C: **C3** anytime; C2 after A6; C5 ∥ C4 after C3.
- Cross-slice: B and the non-Windows parts of C share no files but C depends on B3/B5 for its controls.
