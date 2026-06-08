# Spike C0 — WebView2 audio feasibility (mic capture + delay + HDMI output routing)

**Parent plan**: `dual-output-presentation-camera-mic-audio.md` (Slice C is gated by this).
**Date**: 2026-06-08 · **Method**: docs/source analysis (knowledge chain). Hardware proof on the
real Windows 3-display rig is still **pending** — see "Residual checks".
**Verdict**: ✅ **GO** — every required API exists in WebView2; the only real engineering item
is a microphone **permission handler** on the Rust side to avoid WebView2's default prompt and
the "blocked forever" trap.

---

## Question

Can a Tauri (WebView2, Windows) presentation window:
- (a) capture the PC mic via `getUserMedia`, including the permission flow;
- (b) `enumerateDevices` with **labels** (needed to name the mic + the HDMI output);
- (c) route audio to a **specific HDMI output device** via `AudioContext.setSinkId` / `{ sinkId }`;
- (d) apply a **live, adjustable delay** to the mic (`DelayNode`) for lip-sync?

## Findings

### (a) Mic capture + permission — WORKS, but the prompt must be handled
- WebView2 is evergreen Chromium and `getUserMedia` is supported. Tauri serves app content from a
  secure context (`http://tauri.localhost` / custom protocol), which satisfies the
  secure-context requirement for `getUserMedia`.
- **Default behaviour:** with the WebView2 permission state left at `Default`, calling
  `getUserMedia({audio})` makes **WebView2 show its own "Allow microphone?" prompt** — it is *not*
  silently denied ([WebView2Feedback #2406]). So mic works out-of-the-box with a one-time prompt.
- **The trap:** if the user clicks **Block**, there is no built-in way to re-prompt, and once a
  permission is set to Deny the `PermissionRequested` event stops firing for it
  ([tauri #5042], [WebView2Feedback #2672]). For an unattended church-PC kiosk this is
  unacceptable — a stray "Block" would permanently kill the mic.
- **Fix (the one real work item):** register a WebView2 `PermissionRequested` handler and
  explicitly set `State = Allow` for the `Microphone` permission kind. Setting Allow/Deny
  explicitly also **suppresses the WebView2 prompt entirely** ([WebView2Feedback #2406]) — so the
  presentation window just gets the mic, no dialog. In Tauri this is reached through
  `WebviewWindow::with_webview(|w| { #[cfg(windows)] /* w.controller().CoreWebView2() */ ... })`
  and the `webview2-com` + `windows` crates to add the event handler. (Exact binding names to be
  confirmed at implementation — the *approach* is standard; this spike does not assert the precise
  method signatures.)

### (b) enumerateDevices labels — WORKS, gated on the grant
- `navigator.mediaDevices.enumerateDevices()` returns audio **input and output** devices; device
  **labels are only populated after a `getUserMedia` grant**. Since we capture the mic anyway, the
  grant unlocks labels for both the mic picker *and* the HDMI-output picker. Intentional synergy.

### (c) Output routing to the HDMI device — WORKS (Chrome 110+)
- `AudioContext.setSinkId()` / `new AudioContext({ sinkId })` ships in **Chromium ≥ 110**
  ([Chrome for Developers blog], [MDN]). WebView2 evergreen on any 2023+ runtime is far past 110,
  so this is available. `HTMLMediaElement.setSinkId` (for the camera `<video>` when un-muted) has
  been stable even longer.
- Mechanism: `enumerateDevices` → pick the HDMI/TV `audiooutput` `deviceId` → pass to the
  AudioContext sink. Without this, audio always goes to the **system default** device regardless of
  which monitor the window sits on — confirming this API is exactly what makes "sound out the other
  TV" possible.

### (d) Live mic delay — WORKS (universal)
- Web Audio `DelayNode` is universally supported. Chain:
  `getUserMedia → MediaStreamAudioSourceNode → DelayNode(delayTime = ms/1000) → AudioContext({sinkId})`.
  `delayNode.delayTime.value` is live-adjustable (default max 1 s; construct with a larger
  `maxDelayTime` if we ever want >1 s offset). This realises the per-screen delay slider.

## Verdict & impact on the plan

**GO.** No blocker. Concrete consequences folded back into the plan:
1. **New backend work item** (Slice C, Rust): a Windows `PermissionRequested` handler that
   auto-Allows `Microphone` for the presentation window(s), via `with_webview`. This both removes
   the prompt and prevents the permanent-block trap. *(Add `webview2-com`/`windows` dev path; gate
   behind `#[cfg(windows)]`.)*
2. The mic chain is **Web Audio** (`DelayNode` + `AudioContext.setSinkId`), not an `<audio>`
   element — already reflected in `useMicAudio` (plan §4).
3. Build target/runtime: ensure the deployed **WebView2 Runtime ≥ 110** (effectively guaranteed in
   2026; add a defensive `typeof AudioContext.prototype.setSinkId` capability check + user-facing
   fallback message rather than a crash).

## Residual checks (must confirm on the real rig — cheap, do at Slice C start)
- [ ] With the `PermissionRequested`→Allow handler in place, `getUserMedia({audio})` returns a track
      with **no dialog** in the packaged app.
- [ ] `enumerateDevices` lists the **HDMI/TV** as a distinct `audiooutput` with a usable label.
- [ ] `AudioContext({ sinkId: <hdmi> })` actually makes sound exit the **TV speakers** while the
      operator's default device stays silent.
- [ ] Un-muted camera `<video>.setSinkId(<hdmi>)` behaves the same.
- [ ] Autoplay: un-muted audio starts without a gesture in the *presentation* window, or needs a
      one-tap "Ativar áudio" (R-2). Determine which.
- [ ] Delay slider audibly shifts lip-sync; find a sane default (camera latency is typically
      ~0.3–2 s over WebRTC-from-RTSP).

## Sources
- [Change the destination output device in Web Audio — Chrome for Developers](https://developer.chrome.com/blog/audiocontext-setsinkid)
- [AudioContext.setSinkId() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId)
- [WebView2Feedback #2406 — Default state shows the prompt; Allow/Deny suppresses it](https://github.com/MicrosoftEdge/WebView2Feedback/issues/2406)
- [WebView2Feedback #2672 — after Deny, PermissionRequested no longer fires](https://github.com/MicrosoftEdge/WebView2Feedback/issues/2672)
- [tauri #5042 — re-granting mic/camera after block doesn't work](https://github.com/tauri-apps/tauri/issues/5042)
