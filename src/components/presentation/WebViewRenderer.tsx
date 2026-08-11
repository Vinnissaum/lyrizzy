import React, { useEffect, useRef, useState } from "react";
import { isUrlAllowed } from "../../utils/urlAllowlist";
import { iframeCropStyle, withBasicAuth } from "../../utils/webview";
import { StreamProxyRenderer } from "./StreamProxyRenderer";
import { useOutputId } from "./outputContext";
import { useSettingsStore } from "../../stores/settings";
import { resolveActiveSource } from "../../utils/streamProfile";
import type { StreamSource, WebViewConfig } from "../../types";

interface Props {
  config: WebViewConfig;
}

/** Modes bridged to WebRTC by the Rust MediaMTX proxy. */
function isProxyMode(mode: WebViewConfig["mode"]): boolean {
  return mode === "rtmp" || mode === "rtsp" || mode === "srt" || mode === "multicast";
}

/** Build the proxy source payload from config, or null if it's incomplete. */
function buildStreamSource(config: WebViewConfig): StreamSource | null {
  switch (config.mode) {
    case "rtmp": {
      const { url } = resolveActiveSource(config);
      return url.trim() ? { kind: "rtmp", url: url.trim() } : null;
    }
    case "rtsp": {
      const { url, transport } = resolveActiveSource(config);
      return url.trim()
        ? { kind: "rtsp", url: url.trim(), transport: transport ?? "udp" }
        : null;
    }
    case "srt":
      return config.srtConfig?.host.trim()
        ? { kind: "srt", config: config.srtConfig }
        : null;
    case "multicast":
      return config.multicastConfig?.ip.trim()
        ? { kind: "multicast", config: config.multicastConfig }
        : null;
    default:
      return null;
  }
}

export const WebViewRenderer: React.FC<Props> = ({ config }) => {
  const { mode, url, basicAuthUser, basicAuthPass, crop } = config;
  const output = useOutputId();
  const cameraAudio = useSettingsStore((s) => s.audio[output]);
  const cameraJitterBufferMs = useSettingsStore((s) => s.cameraJitterBufferMs);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);

    // Proxy modes (rtmp/srt/multicast) don't use `url` and own their own
    // load/error lifecycle in StreamProxyRenderer, so skip URL validation and
    // the load-timeout watchdog that never resolves for a <video>.
    if (isProxyMode(mode)) {
      setError(null);
      return;
    }

    const check = isUrlAllowed(url);
    if (!check.ok) {
      setError(check.reason ?? "URL não permitida");
      return;
    }
    if (!url.trim()) {
      setError("URL não configurada");
      return;
    }
    setError(null);

    timerRef.current = setTimeout(() => {
      if (!loadedRef.current) {
        setError("Não foi possível carregar o conteúdo");
      }
    }, 10_000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [url, mode]);

  const handleLoad = () => {
    loadedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setError(null);
  };

  const handleError = () => {
    loadedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setError("Não foi possível carregar o conteúdo");
  };

  if (error) {
    return (
      <div className="h-screen bg-black relative select-none">
        <p className="absolute bottom-4 right-4 text-xs text-gray-500">{error}</p>
      </div>
    );
  }

  if (mode === "iframe") {
    // Inject credentials so a Basic-Auth-gated page authenticates on the first
    // navigation instead of popping a dialog (or rendering blank when the auth
    // prompt is suppressed inside the sandbox).
    const iframeUrl = withBasicAuth(url, basicAuthUser, basicAuthPass);
    return (
      // overflow-hidden clips whatever the crop transform pushes off-screen.
      <div className="h-screen bg-black overflow-hidden">
        <iframe
          key={iframeUrl}
          src={iframeUrl}
          // Login-gated pages (e.g. IP cameras) need more than scripts: a JS
          // login dialog uses window.prompt/alert/confirm (allow-modals), a
          // form login needs to POST (allow-forms), and some panels open the
          // live view in a popup (allow-popups). Without these the sandbox
          // silently suppresses the dialog and the page looks broken.
          // eslint-disable-next-line react/no-unknown-property
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          style={iframeCropStyle(crop)}
          onLoad={handleLoad}
          onError={handleError}
          title="WebView"
        />
      </div>
    );
  }

  if (isProxyMode(mode)) {
    // RTMP/SRT/multicast can't play in WebView2; StreamProxyRenderer bridges
    // them via the MediaMTX WebRTC proxy and manages its own lifecycle.
    const source = buildStreamSource(config);
    if (!source) {
      return (
        <div className="h-screen bg-black relative select-none">
          <p className="absolute bottom-4 right-4 text-xs text-gray-500">
            URL não configurada
          </p>
        </div>
      );
    }
    return (
      <StreamProxyRenderer
        source={source}
        muted={!cameraAudio.cameraUnmuted}
        sinkId={cameraAudio.outputDevice?.deviceId}
        jitterBufferTargetMs={cameraJitterBufferMs}
      />
    );
  }

  // MJPEG mode — inject basic-auth credentials into the URL if provided.
  const mjpegUrl = withBasicAuth(url, basicAuthUser, basicAuthPass);

  return (
    <div className="h-screen bg-black flex items-center justify-center">
      <img
        key={mjpegUrl}
        src={mjpegUrl}
        alt=""
        className="max-w-full max-h-full object-contain"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};
