import React, { useEffect, useRef, useState } from "react";
import { isUrlAllowed } from "../../utils/urlAllowlist";
import { iframeCropStyle, withBasicAuth } from "../../utils/webview";
import { RtmpRenderer } from "./RtmpRenderer";
import type { WebViewConfig } from "../../types";

interface Props {
  config: WebViewConfig;
}

export const WebViewRenderer: React.FC<Props> = ({ config }) => {
  const { mode, url, basicAuthUser, basicAuthPass, crop } = config;
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);

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

    // RTMP mode owns its own load/error lifecycle (RtmpRenderer), so skip the
    // iframe/img load-timeout watchdog that never resolves for a <video>.
    if (mode === "rtmp") return;

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

  if (mode === "rtmp") {
    // RTMP can't play in WebView2; RtmpRenderer bridges it via the MediaMTX
    // WebRTC proxy and manages its own connection lifecycle.
    return <RtmpRenderer url={url} />;
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
