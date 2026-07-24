import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { startStreamProxy } from "../../api/commands";
import { connectWhep, setReceiverPlayoutLatency } from "../../utils/whep";
import type { StreamSource } from "../../types";

interface Props {
  source: StreamSource;
  /**
   * Mute the camera's own audio track. Default true — a church camera's audio
   * normally comes from the sound desk, and muting also satisfies autoplay
   * policy. Set false to hear the stream's embedded audio.
   */
  muted?: boolean;
  /**
   * Audio output device id (e.g. the TV's HDMI endpoint) to route the camera's
   * audio to via `HTMLMediaElement.setSinkId`. Only applies when not muted.
   */
  sinkId?: string;
  /**
   * Target playout-buffer depth (ms) for the WebRTC receivers. 0 (default) asks
   * the browser for the shallowest buffer — closest to real time. Applied live,
   * so changing it re-tunes the running stream without reconnecting.
   */
  jitterBufferTargetMs?: number;
}

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1500;

/**
 * Plays a camera stream (RTMP, SRT, or UDP/multicast) by asking the Rust
 * MediaMTX proxy to bridge it to WebRTC, then attaching the WHEP stream to a
 * `<video>`. None of those transports play in WebView2 directly, so this is the
 * only way to show such a camera.
 *
 * On first connect the proxy may still be spinning up MediaMTX / dialling the
 * camera, so we retry the WHEP handshake a few times before giving up. The video
 * is muted (a church camera's audio comes from the sound desk, not the stream)
 * which also satisfies autoplay policy.
 */
export const StreamProxyRenderer: React.FC<Props> = ({
  source,
  muted = true,
  sinkId,
  jitterBufferTargetMs = 0,
}) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  // Keep the latest target in a ref so the connect effect (which must NOT depend
  // on it — changing latency shouldn't reconnect) reads the current value.
  const jitterTargetRef = useRef(jitterBufferTargetMs);
  jitterTargetRef.current = jitterBufferTargetMs;
  const [error, setError] = useState<string | null>(null);
  // Re-run the effect whenever the source meaningfully changes.
  const sourceKey = JSON.stringify(source);

  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();
    let pc: RTCPeerConnection | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      setError(null);
      let whepUrl: string;
      try {
        const info = await startStreamProxy(source);
        whepUrl = info.whepUrl;
      } catch (err) {
        // The Tauri command rejects with an ErrorPayload { code, params }.
        const code = (err as { code?: string })?.code;
        if (!cancelled) {
          setError(
            code === "stream.mediamtx_not_found"
              ? t("webview.stream.errors.mediamtxNotFound")
              : t("webview.stream.errors.proxyFailed")
          );
        }
        console.error("start_stream_proxy failed:", err);
        return;
      }

      const attempt = async (n: number): Promise<void> => {
        if (cancelled || !videoRef.current) return;
        try {
          pc = await connectWhep(videoRef.current, whepUrl, abort.signal, {
            jitterBufferTargetMs: jitterTargetRef.current,
          });
          pcRef.current = pc;
          if (!cancelled) setError(null);
        } catch (err) {
          if (cancelled) return;
          if (n < MAX_ATTEMPTS) {
            retryTimer = setTimeout(() => void attempt(n + 1), RETRY_DELAY_MS);
          } else {
            setError(t("webview.stream.errors.connectFailed"));
            console.error("WHEP connect failed:", err);
          }
        }
      };
      void attempt(1);
    };

    void run();

    return () => {
      cancelled = true;
      abort.abort();
      if (retryTimer) clearTimeout(retryTimer);
      pc?.close();
      pcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, t]);

  // Re-tune the playout buffer live when the target changes, without tearing
  // down the WHEP session. No-op until a connection exists.
  useEffect(() => {
    if (pcRef.current) setReceiverPlayoutLatency(pcRef.current, jitterBufferTargetMs);
  }, [jitterBufferTargetMs]);

  // Route the camera's audio to a specific output device (e.g. the TV's HDMI)
  // when un-muted. setSinkId is Chromium/WebView2; guarded for absence.
  useEffect(() => {
    const video = videoRef.current as
      | (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> })
      | null;
    if (!video || muted || !sinkId || typeof video.setSinkId !== "function") return;
    video.setSinkId(sinkId).catch((err) =>
      console.error("camera setSinkId failed:", err),
    );
  }, [sinkId, muted]);

  return (
    <div className="h-screen bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        muted={muted}
        playsInline
        className="max-w-full max-h-full w-full h-full object-contain"
      />
      {error && (
        <p className="absolute bottom-4 right-4 text-xs text-gray-500">{error}</p>
      )}
    </div>
  );
};
