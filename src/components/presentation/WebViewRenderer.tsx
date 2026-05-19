import React, { useEffect, useRef, useState } from "react";
import { isUrlAllowed } from "../../utils/urlAllowlist";
import type { WebViewConfig } from "../../types";

interface Props {
  config: WebViewConfig;
}

export const WebViewRenderer: React.FC<Props> = ({ config }) => {
  const { mode, url, basicAuthUser, basicAuthPass } = config;
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
    return (
      <div className="h-screen bg-black">
        <iframe
          key={url}
          src={url}
          // eslint-disable-next-line react/no-unknown-property
          sandbox="allow-scripts allow-same-origin"
          className="w-full h-full border-0"
          onLoad={handleLoad}
          onError={handleError}
          title="WebView"
        />
      </div>
    );
  }

  // MJPEG mode — inject basic-auth credentials into the URL if provided.
  let mjpegUrl = url;
  if (basicAuthUser && basicAuthPass) {
    try {
      const parsed = new URL(url);
      parsed.username = basicAuthUser;
      parsed.password = basicAuthPass;
      mjpegUrl = parsed.toString();
    } catch {
      // keep original url
    }
  }

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
