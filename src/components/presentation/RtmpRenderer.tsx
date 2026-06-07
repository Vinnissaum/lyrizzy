import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { startRtmpProxy } from "../../api/commands";
import { connectWhep } from "../../utils/whep";

interface Props {
  url: string;
}

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1500;

/**
 * Plays an RTMP(S) camera by asking the Rust MediaMTX proxy to bridge it to
 * WebRTC, then attaching the WHEP stream to a `<video>`. RTMP can't play in
 * WebView2 directly, so this is the only way to show such a camera.
 *
 * On first connect the proxy may still be spinning up MediaMTX / dialling the
 * camera, so we retry the WHEP handshake a few times before giving up. The video
 * is muted (a church camera's audio comes from the sound desk, not the stream)
 * which also satisfies autoplay policy.
 */
export const RtmpRenderer: React.FC<Props> = ({ url }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();
    let pc: RTCPeerConnection | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      setError(null);
      let whepUrl: string;
      try {
        const info = await startRtmpProxy(url);
        whepUrl = info.whepUrl;
      } catch (err) {
        if (!cancelled) setError(t("webview.rtmp.errors.proxyFailed"));
        console.error("start_rtmp_proxy failed:", err);
        return;
      }

      const attempt = async (n: number): Promise<void> => {
        if (cancelled || !videoRef.current) return;
        try {
          pc = await connectWhep(videoRef.current, whepUrl, abort.signal);
          if (!cancelled) setError(null);
        } catch (err) {
          if (cancelled) return;
          if (n < MAX_ATTEMPTS) {
            retryTimer = setTimeout(() => void attempt(n + 1), RETRY_DELAY_MS);
          } else {
            setError(t("webview.rtmp.errors.connectFailed"));
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
    };
  }, [url, t]);

  return (
    <div className="h-screen bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="max-w-full max-h-full w-full h-full object-contain"
      />
      {error && (
        <p className="absolute bottom-4 right-4 text-xs text-gray-500">{error}</p>
      )}
    </div>
  );
};
