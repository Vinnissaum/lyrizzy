import React, { useEffect, useState } from "react";
import { updateSetItem } from "../../api/commands";
import { isUrlAllowed } from "../../utils/urlAllowlist";
import type { SetItem, WebViewConfig, WebViewMode } from "../../types";

interface Props {
  item: SetItem;
}

export const WebViewSetItemEditor: React.FC<Props> = ({ item }) => {
  const cfg = item.webviewConfig;
  const [mode, setMode] = useState<WebViewMode>(cfg?.mode ?? "iframe");
  const [url, setUrl] = useState(cfg?.url ?? "");
  const [authUser, setAuthUser] = useState(cfg?.basicAuthUser ?? "");
  const [authPass, setAuthPass] = useState(cfg?.basicAuthPass ?? "");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [httpWarning, setHttpWarning] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode(cfg?.mode ?? "iframe");
    setUrl(cfg?.url ?? "");
    setAuthUser(cfg?.basicAuthUser ?? "");
    setAuthPass(cfg?.basicAuthPass ?? "");
    setUrlError(null);
    setHttpWarning(false);
  }, [item.id]);

  const buildConfig = (): WebViewConfig | null => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError("URL obrigatória");
      return null;
    }
    const check = isUrlAllowed(trimmed);
    if (!check.ok) {
      setUrlError(check.reason ?? "URL inválida");
      return null;
    }
    setUrlError(null);
    return {
      mode,
      url: trimmed,
      basicAuthUser: mode === "mjpeg" && authUser ? authUser : undefined,
      basicAuthPass: mode === "mjpeg" && authPass ? authPass : undefined,
    };
  };

  const handleSave = async () => {
    const config = buildConfig();
    if (!config) return;
    setSaving(true);
    try {
      await updateSetItem({ id: item.id, webViewConfig: config });
    } catch (err) {
      console.error("Falha ao salvar WebView:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setUrlError(null);
    try {
      const parsed = new URL(value);
      setHttpWarning(mode === "iframe" && parsed.protocol === "http:");
    } catch {
      setHttpWarning(false);
    }
  };

  const handleModeChange = (newMode: WebViewMode) => {
    setMode(newMode);
    setHttpWarning(false);
  };

  return (
    <div className="p-3 space-y-3">
      {/* Mode */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Modo</label>
        <div className="flex gap-4">
          {(["iframe", "mjpeg"] as WebViewMode[]).map((m) => (
            <label key={m} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`webview-mode-${item.id}`}
                value={m}
                checked={mode === m}
                onChange={() => handleModeChange(m)}
                className="accent-blue-500"
              />
              <span className="text-sm text-gray-300">
                {m === "iframe" ? "Iframe (URL)" : "MJPEG (câmera)"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* URL */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">URL</label>
        <input
          type="text"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          onBlur={handleSave}
          placeholder={
            mode === "iframe"
              ? "https://exemplo.com"
              : "http://192.168.1.10/stream"
          }
          className={`w-full px-3 py-1.5 bg-gray-700 border rounded text-sm text-white font-mono focus:outline-none focus:border-blue-500 ${
            urlError ? "border-red-500" : "border-gray-600"
          }`}
        />
        {urlError && (
          <p className="text-xs text-red-400 mt-1">{urlError}</p>
        )}
        {httpWarning && !urlError && (
          <p className="text-xs text-yellow-400 mt-1">
            Conexões http podem ser bloqueadas pelo navegador.
          </p>
        )}
      </div>

      {/* Basic auth — MJPEG only */}
      {mode === "mjpeg" && (
        <div className="space-y-2">
          <label className="text-xs text-gray-400 block">
            Autenticação básica (opcional)
          </label>
          <input
            type="text"
            value={authUser}
            onChange={(e) => setAuthUser(e.target.value)}
            onBlur={handleSave}
            placeholder="Usuário"
            className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <input
            type="password"
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
            onBlur={handleSave}
            placeholder="Senha"
            className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {saving && <p className="text-xs text-gray-500">Salvando…</p>}
    </div>
  );
};
