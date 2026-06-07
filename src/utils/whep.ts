/**
 * Minimal WHEP (WebRTC-HTTP Egress Protocol) client.
 *
 * MediaMTX serves the proxied camera as WebRTC at `…/{path}/whep`. WHEP is a
 * single HTTP exchange: POST our SDP offer, receive the SDP answer. We negotiate
 * a receive-only video+audio connection and attach the resulting MediaStream to
 * a `<video>`. Used by the RTMP webview mode so an RTMP camera plays in WebView2,
 * which cannot decode RTMP natively.
 */

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
): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection();

  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  const stream = new MediaStream();
  pc.addEventListener("track", (ev) => {
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
