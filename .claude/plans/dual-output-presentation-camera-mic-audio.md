# Plan & Design — Dual independent presentation outputs + camera RTSP with mic audio on the second TV

Status: **specifying** (not implemented) · Date: 2026-06-08 · Branch target: feature branch off `main`

## Goal (what the user needs)

Drive **two presentation screens at the same time**, each able to show **different
content** ("one with the items set and the other maybe another set"). One screen
shows the **RTSP camera** (already supported via MediaMTX→WebRTC) and must play
**audio captured from the computer's mic input**, all sent to a TV over **HDMI**.

### Locked decisions (from discussion 2026-06-08)

| # | Question | Decision |
|---|----------|----------|
| L-1 | How do the two screens relate? | **Two independent outputs** — each runs its own set and is navigated separately. Not a mirror, not a camera-only aux screen. |
| L-2 | Which audio plays on the camera screen? | **Mic** is the live source. It is **per-screen**, turned on by an explicit **switch button**, **default OFF**. Camera stream audio stays muted by default (matching the "audio comes from the sound desk" rationale), un-mutable via a separate toggle. |
| L-2b | Audio/video sync | A **configurable audio delay (ms)** per screen pushes the mic audio back to line up with the (latency-delayed) camera image. |
| L-3 | What does "combine mic + camera" mean? | **Play together live on the TV.** Camera video + mic audio out the same HDMI. **No** muxing, recording, or re-streaming. Browser-only. |
| L-4 | Physical setup | **3 displays**: operator (primary) + TV-1 + TV-2, each TV on its own HDMI. |

Target platform: **Windows / WebView2** (the `.exe`/`%APPDATA%` paths and bundled
`mediamtx.exe` confirm it; the dev box is WSL2 but is not the deployment target).

---

## Current behaviour (findings)

### Single source of truth, single output
- `AppState` holds exactly **one** live presentation: `presentation: Arc<RwLock<PresentationState>>`
  plus its parallel pre-computed slides `presentation_slides: Arc<RwLock<Vec<Vec<Slide>>>>`
  (`src-tauri/src/state.rs:16,20`). Everything downstream assumes one.
- `PresentationState` (`src-tauri/src/domain/presentation.rs:36-63`) carries `set`,
  `current_item_index`, `current_slide_index`, `mode`, `overlay`, slides, etc. — the
  full projection state for **one** screen.
- All mutations emit a single global event `state_changed` carrying the whole
  `PresentationState` (`src/api/commands.ts:529-530`: `onStateChanged` →
  `listen<PresentationState>("state_changed")`). Per CLAUDE.md, **both windows listen
  to ALL events**, so today both windows necessarily render the *same* state.

### One presentation window, auto-placed on the secondary monitor
- `enter_presentation(monitor_index: Option<usize>)` (`src-tauri/src/commands/window.rs:215-322`)
  builds a single `WebviewWindowBuilder::new(&app, "presentation", "presentation.html")`,
  guards against an empty set, and is idempotent on the fixed label `"presentation"`.
- Monitor pick is pure + tested: `resolve_target_index` → `pick_secondary_index` =
  "first monitor whose origin ≠ primary's" (`window.rs:80-105`), with a manual
  `monitor_index` override. `should_pin_on_top` only pins when there is exactly one
  monitor (`window.rs:191`).
- `exit_presentation` (`window.rs:337-402`) resets the one state to Idle and closes the
  one window; also tears down a countdown takeover. Operator-window destroy closes the
  presentation window (`should_close_presentation_on_destroy`, P10-06).
- `main.tsx:24-42` branches on `getCurrentWindow().label === "presentation"` to mount
  `PresentationApp`, else `OperatorApp`. The presentation window is forced dark.

### Camera path already exists — audio is in the pipe but muted
- `services/mediamtx.rs` runs MediaMTX as a managed sidecar (`kill_on_drop`) that
  ingests RTSP/RTMP/SRT/multicast and re-serves it as **WebRTC (WHEP)** on
  `127.0.0.1:8889/cam/whep` (`WEBRTC_PORT`, `PATH_NAME`, `whep_url()`). RTSP carries an
  optional `rtspTransport` (`Source::Rtsp`). `sourceOnDemand: yes` so it only dials the
  camera while a reader is attached.
- `commands/stream.rs` exposes `start_stream_proxy(source)` / `stop_stream_proxy` /
  `check_mediamtx`. The running child + its config live in `AppState.stream_proxy`
  (`state.rs:31,36`); an identical config reuses the live process. **Only one camera
  stream is proxied at a time** (single `cam` path).
- `utils/whep.ts` negotiates `recvonly` for **video AND audio** (`whep.ts:40-41`), so the
  camera's own audio is already available in the `MediaStream`.
- `StreamProxyRenderer.tsx` plays the WHEP stream in a `<video … muted>` and hardcodes
  the mute, with the comment *"a church camera's audio comes from the sound desk, not the
  stream"* (`StreamProxyRenderer.tsx:25,89-95`). It is rendered as a **WebView set item**
  (camera modes were kept; only the overlay quick-action was removed on 2026-06-08, see
  `remove-overlay-quickactions-fix-operator-song-titles.md`).
- **No mic capture, no audio-output-device selection anywhere today** —
  `grep getUserMedia|enumerateDevices|setSinkId` = 0 hits.

### What this means
A genuinely independent second output requires adding an **output dimension** to: the
state, the slides, every navigation/overlay command, the `state_changed` event, the
window label/launch, the operator UI, and keyboard routing. Camera-audio is a one-line
unmute; the **mic + HDMI-audio-routing** is net-new browser code (`getUserMedia` +
`setSinkId`).

---

## Design

### 1. Output model — generalize "one presentation" to N, implement two

Introduce an `OutputId` (start with two: `One`, `Two`; designed so a third is not
precluded). `One` maps to today's behaviour for backwards compatibility.

**Backend (`src-tauri`):**
- New `domain::output::OutputId` enum (`#[serde(rename_all="camelCase")]` → `"one"`/`"two"`).
- `AppState`: replace the two single fields with a keyed collection:
  ```rust
  pub outputs: HashMap<OutputId, OutputState>,   // OutputState { presentation: RwLock<PresentationState>, slides: RwLock<Vec<Vec<Slide>>> }
  ```
  Keep a thin `state.output(id)` accessor. (Alternative considered: keep
  `presentation` as-is + add `presentation_2`; rejected — duplicates every command. The
  map localizes the change to the accessor.)
- Every command that reads/writes the live presentation gains `output: Option<OutputId>`
  **defaulting to `One`** so existing front-end calls and tests keep working while we
  migrate call sites: `next_slide`, `prev_slide`, `goto_slide`, `set_blank`, `freeze`,
  the overlay commands (`overlay.rs`), `load_set_for_presentation`, `enter_presentation`,
  `exit_presentation`, plus the mid-presentation `append_item_to_live_presentation`.
- Event shape: `state_changed` payload becomes `{ output: OutputId, state: PresentationState }`.
  (Internal contract change — acceptable; both windows already receive all events.) The
  emit-after-drop-lock invariant is unchanged.

**Frontend (`src`):**
- `onStateChanged(output, cb)` filters the tagged payload (`commands.ts:529`).
- The presentation Zustand store becomes keyed by output, or each presentation window
  instantiates a store bound to its own `OutputId`. The operator holds **both** outputs'
  states.
- `main.tsx`: treat any label starting with `presentation` as a presentation window;
  derive `OutputId` from the label suffix (`presentation` → One, `presentation-2` → Two)
  and pass it to `PresentationApp` so it subscribes to and renders only its output.

### 2. Two windows, two monitors

- Labels: output One keeps `"presentation"` (no churn in `main.tsx`/P10-06 logic);
  output Two = `"presentation-2"` → loads a second `presentation-2.html` entry (mirrors
  the existing `presentation.html` Vite input).
- `enter_presentation(output, monitor_index)`: per-output empty-set guard + idempotency on
  that output's label. Monitor pick: extend `resolve_target_index` to **exclude the
  monitor already used by the other active output** so two auto-launched outputs don't
  both grab the same TV; manual per-output `monitor_index` override remains the safety net
  (and is the recommended default for a fixed 3-screen install — see Risk R-3).
- `should_pin_on_top` stays count-based; with 3 monitors neither output pins.
- `exit_presentation(output)` closes only that output's window. Operator-destroy closes
  **all** presentation windows (generalize `should_close_presentation_on_destroy`'s caller
  to loop over `presentation*` labels).

### 3. Operator control of two outputs

Extend `OperatorPresentationLayout` (the Holyrics-style 3-pane, D-30) with an
**active-output switcher** — tabs `Tela 1 / Tela 2` above the SET|STROPHES|LIVE panes.
The 3-pane drives the **focused** output; a compact **status strip** shows the *other*
output at a glance (set name + current item + mode + tiny live thumbnail) so the operator
always knows what TV-2 is doing while driving TV-1.

- Keyboard shortcuts act on the **focused** output only (route through the active
  `OutputId`); presentation-window key-forwarding tags its own output.
- Each output has its own "Apresentar Tela N" control + monitor picker + set selector.
  Output One keeps the default "Culto Dominical" set (D-21); Output Two starts with no set
  until one is chosen (it can pick any set, including the same one).
- LIVE preview pane reflects the focused output (reuse the shared `SlideStage`, D-36).

### 4. Camera audio + mic on the camera screen ("play together live")

This is an **output-level audio companion**, toggled on per screen with an explicit
switch (**default OFF**, L-2):

- **Mic capture + delay (L-2/L-2b):** new `useMicAudio({ deviceId, sinkId, delayMs, enabled })`
  hook. Because the mic must be **delayed** to match the late camera image, it cannot be a
  plain `<audio>` element — it routes through the **Web Audio API**:
  `getUserMedia({ audio: { deviceId } })` → `MediaStreamAudioSourceNode` → **`DelayNode`**
  (`delayTime = delayMs/1000`, live-adjustable) → `AudioContext` destination. The
  `AudioContext`'s output is pinned to the TV's HDMI endpoint via
  `new AudioContext({ sinkId })` / `audioContext.setSinkId(sinkId)`. No muxing — mic and
  camera video simply play together into the same window, with the mic offset for sync.
- **Camera audio (L-2):** `StreamProxyRenderer` gains a `muted` prop (default `true`). A
  per-output "Áudio da câmera" toggle flips it. The WHEP audio track is already
  negotiated, so this is purely the `<video muted>` flag. (When un-muted, the camera's own
  audio is *not* delay-corrected — it is already in sync with its own video; only the mic
  carries the delay.)
- **HDMI routing (the crux of "on the other TV"):** the mic's `AudioContext` and the
  camera `<video>` (if un-muted, via `HTMLMediaElement.setSinkId`) both target the **TV's
  HDMI audio endpoint** — not the operator's default speakers. Without this, audio plays
  on the system-default device regardless of which monitor the window sits on.
- Device discovery: `navigator.mediaDevices.enumerateDevices()` populates an input-device
  (mic) picker and an output-device (HDMI/TV) picker. Device **labels** are only exposed
  after a `getUserMedia` grant — which we do anyway — so the synergy is intentional.

### 5. Settings & persistence

New key/value settings rows (no migration — matches D-39 pattern):
`output1.monitor_index`, `output2.monitor_index`, `output2.last_set_id` (remember TV-2's
last set, L-1), `output.<id>.audio.mic_device_id`, `output.<id>.audio.output_device_id`,
`output.<id>.audio.camera_unmuted`, `output.<id>.audio.mic_enabled` (**default false**),
`output.<id>.audio.mic_delay_ms` (**default 0**). Store devices by **label + groupId** with
id fallback so they survive replug/id churn (Risk R-4). The mic switch's **on/off state is
remembered per screen** (persisted to `output.<id>.audio.mic_enabled`), defaulting to off
only on first use.

### 6. Per-output countdown (two independent timers)

TV-1 keeps its countdown exactly as today; TV-2 gets its own, driven by a countdown item in
TV-2's set — fully independent ("two separated things"). The single global countdown becomes
keyed by output:
- `AppState`: `countdown: HashMap<OutputId, Arc<RwLock<CountdownState>>>` +
  `countdown_tasks: HashMap<OutputId, Arc<Mutex<Option<AbortHandle>>>>` (one ticker per
  output, started/aborted independently).
- `commands/countdown.rs`: every command gains `output: Option<OutputId>` (default One);
  the ticker task captures its own `OutputId` and emits an `output`-tagged `countdown_tick`.
- The countdown **takeover** overlay (countdown-v2,
  `scheduled-countdown-launch-warning-autopresent.md`) engages on the **owning output**
  only — TV-1's takeover never seizes TV-2 and vice-versa. `exit_presentation(output)` tears
  down only that output's takeover/ticker (today it tears down the single global one).
- Frontend `onCountdownTick(output, cb)` filters by output; the countdown store keys by
  output; the `CountdownSetItemEditor` auto-arm effect runs per output.

---

## Files touched (anticipated)

| File | Change |
|------|--------|
| `src-tauri/src/domain/output.rs` (new) | `OutputId` enum + serde + tests |
| `src-tauri/src/state.rs` | `outputs: HashMap<OutputId, OutputState>` + accessor; per-output `countdown`/`countdown_tasks` maps; keep `stream_proxy` |
| `src-tauri/src/commands/window.rs` | `enter_presentation(output, monitor_index)`, `exit_presentation(output)`, multi-monitor exclusion, generalize operator-destroy teardown |
| `src-tauri/src/commands/presentation.rs` | thread `output` through nav + `load_set_for_presentation` + `append_item_to_live_presentation`; emit tagged `state_changed` |
| `src-tauri/src/commands/overlay.rs` | thread `output` through overlay set/clear |
| `src-tauri/src/commands/countdown.rs` | per-output `CountdownState`/ticker; `output` param; `output`-tagged `countdown_tick`; per-output takeover + auto-present |
| `src/stores/countdown.ts` + `CountdownSetItemEditor` | key by `OutputId`; `onCountdownTick(output, cb)` filter; per-output auto-arm |
| `src-tauri/src/commands/stream.rs` / `services/mediamtx.rs` | unchanged for v1 (one camera, one proxy); note if both outputs ever need a camera (Risk R-5) |
| `src-tauri/src/lib.rs` | register new commands; state init builds both outputs |
| `src-tauri/src/commands/window.rs` (or setup) | **Windows `PermissionRequested`→Allow(Microphone)** handler via `with_webview` on presentation windows (Spike C0); `#[cfg(windows)]`, `webview2-com`/`windows` crates |
| `src-tauri/tauri.conf.json` + `vite.config.ts` | add `presentation-2.html` entry; confirm CSP allows `mediastream:`/mic |
| `src/main.tsx` | label-prefix branch → derive `OutputId` |
| `src/windows/presentation/PresentationApp.tsx` | accept `OutputId`; subscribe to own output; mount camera/mic audio companion |
| `src/components/presentation/StreamProxyRenderer.tsx` | `muted` prop + `setSinkId` on the `<video>` |
| `src/hooks/useMicAudio.ts` (new) | getUserMedia → MediaStreamSource → `DelayNode(delayMs)` → `AudioContext({ sinkId })`; switch (default off) + live delay control |
| `src/components/presentation/MicSwitch.tsx` (new) | per-screen on/off switch + delay (ms) input, surfaced on the operator output controls |
| `src/components/presentation/OperatorPresentationLayout.tsx` | output switcher tabs + status strip; route keys/commands by focused output |
| `src/stores/presentation.ts` | key by `OutputId` (both outputs in operator) |
| `src/api/commands.ts` | `output` params; `onStateChanged(output, cb)` filter; enter/exit per output |
| `src/components/settings/SettingsScreen.tsx` + `src/stores/settings.ts` | per-output monitor + mic/output-device + camera-unmute pickers; `enumerateDevices` |
| `src/utils/audioDevices.ts` (new) | enumerate + match-by-label/groupId helpers |
| `src/runtime/keyboard.ts` | route actions to focused `OutputId` |
| i18n `en-US` / `pt-BR` | `Tela 1/2`, audio/device-picker, camera-audio strings |

---

## Tests

- **Rust (pure, the project's strength):** `OutputId` serde round-trip; per-output
  empty-set guard; multi-monitor exclusion (extend the `resolve_target_index` table tests
  with an "other output already on monitor X" case); tagged `state_changed` payload shape;
  generalized operator-destroy teardown over `presentation*` labels; **per-output countdown
  independence** (TV-1 ticker running/takeover does not touch TV-2's `CountdownState`, and
  `exit_presentation(output)` only tears down that output's ticker/takeover).
- **Vitest (current baseline 339):** `onStateChanged` filters by output; output switcher
  focuses/routes; `StreamProxyRenderer` honours `muted` prop; `useMicAudio` with mocked
  `getUserMedia`/`AudioContext`/`DelayNode`/`setSinkId`/`enumerateDevices` (attach, sink,
  cleanup, permission-denied, **delay applied to `DelayNode.delayTime`**, switch default
  off); device-picker match-by-label fallback; keyboard routes to focused output.
- **Manual on Windows hardware (mandatory — see Risks):** 3-display install; camera on TV-2
  with mic audible **from TV-2's speakers**, **delay dialled until lips match**; independent
  navigation of two sets; replug a TV; autoplay-gesture behaviour for un-muted audio in a
  second window.

---

## Risks / notes

- **R-1 — `getUserMedia` / `enumerateDevices` / `AudioContext.setSinkId` / `DelayNode` in
  WebView2.** These are Chromium APIs; WebView2 generally tracks Chromium, but
  **mic-permission prompting and policy differ** and must be verified — WebView2 may need a
  `PermissionRequested` handler (Rust side) or an explicit allow; both element-level
  `HTMLMediaElement.setSinkId` *and* **`AudioContext` output-device selection** (the
  `{ sinkId }` constructor option / `AudioContext.prototype.setSinkId`, a more recent
  Chromium addition) require a secure context + device label (hence the `getUserMedia`
  grant first). The mic-delay path leans on `AudioContext.setSinkId` specifically, so its
  WebView2 support is part of this unknown. **Verify against Microsoft WebView2 docs
  (Context7/web) and on real hardware before committing to the approach.** This is the
  single biggest feasibility unknown and gates Slice C.
- **R-2 — Autoplay gesture for un-muted audio.** Chromium blocks un-muted autoplay until a
  user gesture. The operator's "Apresentar" click happens in the *operator* window; the
  gesture may not carry to the separate presentation window. Likely need a one-tap "Ativar
  áudio" affordance on the camera output (or launch audio from a presentation-window click).
- **R-3 — Two TVs, OS-dependent monitor ordering** (existing CLAUDE.md gotcha, now ×2).
  Auto-pick can't reliably tell TV-1 from TV-2. The **per-output manual monitor picker is
  the recommended default** for the fixed install; auto-pick is best-effort.
- **R-4 — HDMI audio device identity.** The TV's HDMI audio endpoint only exists while
  connected (and not in "display-only" mode) and its `deviceId` can change on replug →
  persist by label/groupId with graceful fallback to system default.
- **R-5 — One camera proxy.** `AppState.stream_proxy` + the single MediaMTX `cam` path
  proxy **one** stream. v1 assumes only one output shows a camera at a time. Two
  simultaneous cameras = a second path/proxy (future).
- **R-6 — Countdown is global today, now made per-output (in scope).** `CountdownState`,
  the `countdown_task` ticker handle, and the `countdown_tick` event are single
  (`state.rs:23-26`). Per the decision, each output needs its own independent countdown
  (TV-1 as today; TV-2 driven by a countdown item in TV-2's set). This becomes a keyed
  `countdown: HashMap<OutputId, RwLock<CountdownState>>` + per-output ticker handles + an
  `output`-tagged `countdown_tick`, and the takeover overlay engages on the **owning
  output** only. The recent countdown-v2 takeover/auto-present logic
  (`scheduled-countdown-launch-warning-autopresent.md`) must be threaded with `output` too.
  This widens Slice A; see slices.
- **R-7 — Blast radius.** The `output` parameter touches every nav/overlay command and
  every `onStateChanged` consumer. The `Option<OutputId>` default-`One` strategy keeps each
  migration step green, but the diff is wide — hence the slicing below.

---

## Suggested commit slices

Sized so each is independently shippable + testable; **Slice C is gated by Spike C0.**

- **Spike C0 — WebView2 audio feasibility.** ✅ **DONE (analysis) — verdict GO.** See
  `dual-output-spike-c0-webview2-audio.md`. All four APIs exist in WebView2;
  `AudioContext.setSinkId` is Chromium ≥110 (fine on evergreen WebView2). **One new work
  item surfaced:** a Windows `PermissionRequested`→Allow handler for `Microphone` (removes
  the default prompt *and* the irreversible-"Block" trap, [tauri #5042]) — folded into Slice
  C below. Residual hardware checks (sound actually exits the TV's HDMI; autoplay gesture;
  delay default) remain to confirm on the rig at Slice C start.
- **Slice A — Dual-output backend foundation.** `OutputId`, `AppState.outputs`, thread
  `output` (default `One`) through nav/overlay/load commands, tagged `state_changed`,
  `presentation-2.html` + per-output `enter/exit_presentation` with multi-monitor
  exclusion, **plus per-output countdown** (keyed `CountdownState`/tickers, `output`-tagged
  `countdown_tick`, per-output takeover — §6/R-6). Operator unchanged (still drives output
  One). Gate: Rust tests + existing Vitest green.
- **Slice B — Operator dual-output control.** Output switcher tabs + status strip,
  per-output stores, keyboard routing, per-output set selector + monitor picker, per-output
  countdown wiring (auto-arm). Now both TVs run different sets — and independent countdowns
  — navigated separately. (Camera/mic still as-is.)
- **Slice C — Camera audio + mic + HDMI routing** *(gated by C0)*. `StreamProxyRenderer`
  `muted` prop, `useMicAudio` hook (`DelayNode` + `AudioContext` sink), per-screen mic
  switch + delay control, device pickers, permission handling. Mic default off (state
  remembered per screen); separate camera-audio toggle.
- **Slice D — Settings persistence + i18n + polish.** Persist per-output monitor/device/
  delay/mic-state/last-set settings, full pt-BR/en-US strings, status-strip thumbnails,
  edge polish.

---

## Resolved (from discussion)

- **Output 2's set:** ✅ **remember the last set it used** (`output2.last_set_id`).
- **Mic:** ✅ **per-screen switch button**, default OFF on first use but its **on/off state
  is remembered per screen** thereafter; **configurable audio delay (ms)** to sync mic to
  the camera image (L-2 / L-2b). Implemented via Web Audio `DelayNode` + `AudioContext({ sinkId })`.
- **Countdown:** ✅ **per-output, two independent timers.** TV-1 keeps its own countdown as
  today; TV-2 shows a countdown only when one is added to TV-2's set. The global
  `CountdownState`/ticker becomes per-output (see Design §6, R-6).
- **Audio feasibility:** ✅ **spike first** — deep-analyze WebView2 mic-permission +
  `AudioContext.setSinkId`/`DelayNode` support (and prove it on the real rig) before
  building Slice C.
```
