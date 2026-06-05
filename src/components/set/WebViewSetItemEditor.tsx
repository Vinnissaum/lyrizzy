import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { updateSetItem } from "../../api/commands";
import { isUrlAllowed } from "../../utils/urlAllowlist";
import { NotesField } from "../common/NotesField";
import type { SetItem, WebViewConfig, WebViewMode } from "../../types";

interface Props {
  item: SetItem;
}

export const WebViewSetItemEditor: React.FC<Props> = ({ item }) => {
  const { t } = useTranslation();
  const cfg = item.webviewConfig;
  const [mode, setMode] = useState<WebViewMode>(cfg?.mode ?? "iframe");
  const [url, setUrl] = useState(cfg?.url ?? "");
  const [authUser, setAuthUser] = useState(cfg?.basicAuthUser ?? "");
  const [authPass, setAuthPass] = useState(cfg?.basicAuthPass ?? "");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [httpWarning, setHttpWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMode(cfg?.mode ?? "iframe");
    setUrl(cfg?.url ?? "");
    setAuthUser(cfg?.basicAuthUser ?? "");
    setAuthPass(cfg?.basicAuthPass ?? "");
    setUrlError(null);
    setHttpWarning(false);
    setNotes(item.notes ?? "");
  }, [item.id]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      updateSetItem({ id: item.id, notes: value || undefined }).catch(console.error);
    }, 300);
  };

  const buildConfig = (): WebViewConfig | null => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError(t("webview.editor.errors.urlRequired"));
      return null;
    }
    const check = isUrlAllowed(trimmed);
    if (!check.ok) {
      setUrlError(check.reason ?? t("webview.editor.errors.urlInvalid"));
      return null;
    }
    setUrlError(null);
    return {
      mode,
      url: trimmed,
      // Credentials apply to both modes: iframe (Basic-Auth-gated pages) and
      // MJPEG (raw streams). Only persist a pair when both are filled.
      basicAuthUser: authUser && authPass ? authUser : undefined,
      basicAuthPass: authUser && authPass ? authPass : undefined,
    };
  };

  const handleSave = async () => {
    const config = buildConfig();
    if (!config) return;
    setSaving(true);
    try {
      await updateSetItem({ id: item.id, webviewConfig: config });
    } catch (err) {
      console.error("save webview failed:", err);
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
        <label className="text-xs text-muted mb-1 block">{t("webview.editor.mode")}</label>
        <div className="flex gap-4">
          {(["iframe", "mjpeg"] as WebViewMode[]).map((m) => (
            <label key={m} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`webview-mode-${item.id}`}
                value={m}
                checked={mode === m}
                onChange={() => handleModeChange(m)}
                className="accent-primary"
              />
              <span className="text-sm">
                {t(`webview.editor.modes.${m === "iframe" ? "iframe" : "mjpeg"}`)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* URL */}
      <div>
        <label className="text-xs text-muted mb-1 block">{t("webview.editor.url")}</label>
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
          className={`w-full px-3 py-1.5 bg-surface-2 border rounded text-sm font-mono focus:outline-none focus:border-primary ${
            urlError ? "border-danger" : "border-border"
          }`}
        />
        {urlError && (
          <p className="text-xs text-danger mt-1">{urlError}</p>
        )}
        {httpWarning && !urlError && (
          <p className="text-xs text-warning mt-1">
            {t("webview.editor.warnings.http")}
          </p>
        )}
      </div>

      {/* Basic auth — both modes (iframe: login-gated pages; MJPEG: streams) */}
      <div className="space-y-2">
        <label className="text-xs text-muted block">
          {t("webview.editor.auth")}
        </label>
        <input
          type="text"
          value={authUser}
          onChange={(e) => setAuthUser(e.target.value)}
          onBlur={handleSave}
          placeholder={t("webview.editor.user")}
          className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded text-sm focus:outline-none focus:border-primary"
        />
        <input
          type="password"
          value={authPass}
          onChange={(e) => setAuthPass(e.target.value)}
          onBlur={handleSave}
          placeholder={t("webview.editor.pass")}
          className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded text-sm focus:outline-none focus:border-primary"
        />
      </div>

      {saving && <p className="text-xs text-muted">{t("webview.editor.saving")}</p>}

      <div>
        <p className="text-xs text-muted mb-1">{t("builder.itemNotes.label")}</p>
        <NotesField value={notes} onChange={handleNotesChange} placeholder={t("builder.itemNotes.placeholder")} />
      </div>
    </div>
  );
};
