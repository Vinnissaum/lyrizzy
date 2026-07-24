/**
 * Minimal WHEP (WebRTC-HTTP Egress Protocol) client.
 *
 * MediaMTX serves the proxied camera as WebRTC at `…/{path}/whep`. WHEP is a
 * single HTTP exchange: POST our SDP offer, receive the SDP answer. We negotiate
 * a receive-only video+audio connection and attach the resulting MediaStream to
 * a `<video>`. Used by the RTMP webview mode so an RTMP camera plays in WebView2,
 * which cannot decode RTMP natively.
 */

export interface WhepOptions {
  /**
   * Target playout-buffer depth in milliseconds, applied to every RTP receiver
   * (video *and* audio) so A/V stay in sync.
   *
   * Chromium holds arriving frames in a jitter buffer before display; that buffer
   * is the dominant source of end-to-end delay. Lower = closer to real time but
   * more sensitive to network jitter (stutter / freezes if the camera→MediaMTX
   * path is uneven). `0` asks the browser for the shallowest buffer it can manage.
   * A wired LAN camera tolerates 0; a flaky Wi-Fi source may need 50–150ms.
   *
   * Default `0` (minimum latency).
   */
  jitterBufferTargetMs?: number;
}

/**
 * Ask the browser's WebRTC stack for the shallowest playout buffer it can manage,
 * trading jitter-resilience for latency. Both properties are Chromium-specific and
 * missing from the DOM lib types, so we set them defensively:
 *  - `jitterBufferTarget` (milliseconds) is the standard-track control (Chromium 111+).
 *  - `playoutDelayHint` (seconds) is the older hint, still honoured; setting both
 *    minimises latency regardless of which the running WebView2 build supports.
 */
function tuneReceiverLatency(receiver: RTCRtpReceiver, targetMs: number): void {
  const r = receiver as RTCRtpReceiver & {
    jitterBufferTarget?: number | null;
    playoutDelayHint?: number | null;
  };
  try {
    r.jitterBufferTarget = targetMs;
    r.playoutDelayHint = targetMs / 1000;
  } catch {
    // Read-only or unsupported on this WebView2 build — ignore.
  }
}

/**
 * Re-apply a playout-buffer target to every receiver of a live connection.
 *
 * `jitterBufferTarget` is writable on an active receiver, so the operator can
 * tighten or loosen camera latency mid-service without tearing down the WHEP
 * session. Safe to call before any track has arrived (no receivers yet).
 */
export function setReceiverPlayoutLatency(
  pc: RTCPeerConnection,
  targetMs: number,
): void {
  for (const receiver of pc.getReceivers()) {
    tuneReceiverLatency(receiver, targetMs);
  }
}

/** Resolve once ICE gathering finishes (so the offer carries all candidates). */
function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
    // Safety net: don't hang forever if the event is missed.
    setTimeout(resolve, 2000);
  });
}

/**
 * Connect to a WHEP endpoint and play the stream in `video`.
 *
 * Returns the peer connection so the caller can `.close()` it on teardown.
 * Throws on HTTP/negotiation failure (caller handles retry / error UI).
 */
export async function connectWhep(
  video: HTMLVideoElement,
  whepUrl: string,
  signal?: AbortSignal,
  opts: WhepOptions = {},
): Promise<RTCPeerConnection> {
  const { jitterBufferTargetMs = 0 } = opts;
  const pc = new RTCPeerConnection();

  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  const stream = new MediaStream();
  pc.addEventListener("track", (ev) => {
    // Minimise the receiver's jitter buffer so the picture is as close to live
    // as the network allows — the church wants real-time, in-room presentation.
    tuneReceiverLatency(ev.receiver, jitterBufferTargetMs);
    stream.addTrack(ev.track);
    if (video.srcObject !== stream) video.srcObject = stream;
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc);

  try {
    const res = await fetch(whepUrl, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: pc.localDescription?.sdp ?? offer.sdp ?? "",
      signal,
    });
    if (!res.ok) {
      throw new Error(`WHEP ${res.status}`);
    }
    const answer = await res.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
  } catch (err) {
    pc.close();
    throw err;
  }

  return pc;
}
