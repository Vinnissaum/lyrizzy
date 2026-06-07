import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { updateSetItem } from "../../api/commands";
import { isUrlAllowed } from "../../utils/urlAllowlist";
import { iframeCropStyle, withBasicAuth } from "../../utils/webview";
import { NotesField } from "../common/NotesField";
import type {
  MulticastConfig,
  RtspTransport,
  SetItem,
  SrtConfig,
  SrtMode,
  WebViewConfig,
  WebViewCrop,
  WebViewMode,
} from "../../types";

const DEFAULT_CROP: WebViewCrop = { zoom: 1, offsetX: 0, offsetY: 0 };
const DEFAULT_SRT: SrtConfig = { host: "", port: 9000, mode: "listener", encrypted: false };
const DEFAULT_MULTICAST: MulticastConfig = { ip: "", port: 1234 };

const INPUT_CLS =
  "w-full px-3 py-1.5 bg-surface-2 border border-border rounded text-sm focus:outline-none focus:border-primary";

function isIdentityCrop(c: WebViewCrop): boolean {
  return c.zoom === 1 && c.offsetX === 0 && c.offsetY === 0;
}

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
  const [crop, setCrop] = useState<WebViewCrop>(cfg?.crop ?? DEFAULT_CROP);
  const [srt, setSrt] = useState<SrtConfig>(cfg?.srtConfig ?? DEFAULT_SRT);
  const [multicast, setMulticast] = useState<MulticastConfig>(cfg?.multicastConfig ?? DEFAULT_MULTICAST);
  const [rtspTransport, setRtspTransport] = useState<RtspTransport>(cfg?.rtspTransport ?? "udp");
  const [configError, setConfigError] = useState<string | null>(null);
  const [httpWarning, setHttpWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMode(cfg?.mode ?? "iframe");
    setUrl(cfg?.url ?? "");
    setAuthUser(cfg?.basicAuthUser ?? "");
    setAuthPass(cfg?.basicAuthPass ?? "");
    setCrop(cfg?.crop ?? DEFAULT_CROP);
    setSrt(cfg?.srtConfig ?? DEFAULT_SRT);
    setMulticast(cfg?.multicastConfig ?? DEFAULT_MULTICAST);
    setRtspTransport(cfg?.rtspTransport ?? "udp");
    setConfigError(null);
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
    if (mode === "srt") {
      if (!srt.host.trim() || !srt.port) {
        setConfigError(t("webview.editor.errors.srtRequired"));
        return null;
      }
      setConfigError(null);
      return {
        mode,
        url: "",
        srtConfig: {
          ...srt,
          host: srt.host.trim(),
          streamId: srt.streamId?.trim() || undefined,
          passphrase: srt.encrypted ? srt.passphrase || undefined : undefined,
        },
      };
    }

    if (mode === "multicast") {
      if (!multicast.ip.trim() || !multicast.port) {
        setConfigError(t("webview.editor.errors.multicastRequired"));
        return null;
      }
      setConfigError(null);
      return { mode, url: "", multicastConfig: { ...multicast, ip: multicast.ip.trim() } };
    }

    // URL-based modes (iframe, mjpeg, rtmp).
    const trimmed = url.trim();
    if (!trimmed) {
      setConfigError(t("webview.editor.errors.urlRequired"));
      return null;
    }
    const check = isUrlAllowed(trimmed);
    if (!check.ok) {
      setConfigError(check.reason ?? t("webview.editor.errors.urlInvalid"));
      return null;
    }
    setConfigError(null);
    return {
      mode,
      url: trimmed,
      // Credentials apply to iframe (Basic-Auth-gated pages) and MJPEG (raw
      // streams). Only persist a pair when both are filled.
      basicAuthUser: authUser && authPass ? authUser : undefined,
      basicAuthPass: authUser && authPass ? authPass : undefined,
      // Crop is iframe-only and visual; skip it when it has no effect.
      crop: mode === "iframe" && !isIdentityCrop(crop) ? crop : undefined,
      // RTSP lower-transport (rtsp mode only).
      rtspTransport: mode === "rtsp" ? rtspTransport : undefined,
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
    setConfigError(null);
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
    setConfigError(null);
  };

  const updateCrop = (patch: Partial<WebViewCrop>) =>
    setCrop((prev) => ({ ...prev, ...patch }));

  const resetCrop = () => {
    setCrop(DEFAULT_CROP);
    void handleSave();
  };

  const updateSrt = (patch: Partial<SrtConfig>) => setSrt((prev) => ({ ...prev, ...patch }));
  const updateMulticast = (patch: Partial<MulticastConfig>) =>
    setMulticast((prev) => ({ ...prev, ...patch }));

  // Radio toggles persist with the explicit chosen value: a setState + onBlur
  // save would race the async state update and persist the previous value.
  const persist = (webviewConfig: WebViewConfig) => {
    updateSetItem({ id: item.id, webviewConfig }).catch((err) =>
      console.error("save webview failed:", err)
    );
  };

  const selectRtspTransport = (tp: RtspTransport) => {
    setRtspTransport(tp);
    const trimmed = url.trim();
    if (trimmed) persist({ mode: "rtsp", url: trimmed, rtspTransport: tp });
  };

  const selectSrtMode = (m: SrtMode) => {
    const next = { ...srt, mode: m };
    setSrt(next);
    if (next.host.trim() && next.port) {
      persist({
        mode: "srt",
        url: "",
        srtConfig: {
          ...next,
          host: next.host.trim(),
          streamId: next.streamId?.trim() || undefined,
          passphrase: next.encrypted ? next.passphrase || undefined : undefined,
        },
      });
    }
  };

  // Live preview only renders a real iframe when the URL is valid; otherwise the
  // box stays blank. Auth is injected the same way the renderer does it.
  const trimmedUrl = url.trim();
  const previewUrl =
    mode === "iframe" && trimmedUrl && isUrlAllowed(trimmedUrl).ok
      ? withBasicAuth(trimmedUrl, authUser || undefined, authPass || undefined)
      : null;

  const isUrlMode =
    mode === "iframe" || mode === "mjpeg" || mode === "rtmp" || mode === "rtsp";

  return (
    <div className="p-3 space-y-3">
      {/* Mode */}
      <div>
        <label className="text-xs text-muted mb-1 block">{t("webview.editor.mode")}</label>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {(["iframe", "mjpeg", "rtmp", "rtsp", "srt", "multicast"] as WebViewMode[]).map((m) => (
            <label key={m} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`webview-mode-${item.id}`}
                value={m}
                checked={mode === m}
                onChange={() => handleModeChange(m)}
                className="accent-primary"
              />
              <span className="text-sm">{t(`webview.editor.modes.${m}`)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* URL — iframe / mjpeg / rtmp */}
      {isUrlMode && (
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
                : mode === "rtmp"
                  ? "rtmp://192.168.100.138/live/stream0"
                  : mode === "rtsp"
                    ? "rtsp://192.168.15.50/1"
                    : "http://192.168.1.10/stream"
            }
            className={`w-full px-3 py-1.5 bg-surface-2 border rounded text-sm font-mono focus:outline-none focus:border-primary ${
              configError ? "border-danger" : "border-border"
            }`}
          />
          {configError && <p className="text-xs text-danger mt-1">{configError}</p>}
          {httpWarning && !configError && (
            <p className="text-xs text-warning mt-1">{t("webview.editor.warnings.http")}</p>
          )}
          {mode === "rtmp" && !configError && (
            <p className="text-xs text-muted mt-1">{t("webview.editor.rtmp.hint")}</p>
          )}

          {/* RTSP lower-transport — udp matches OBS's rtsp_transport=udp. */}
          {mode === "rtsp" && (
            <div className="mt-2">
              <label className="text-xs text-muted mb-1 block">
                {t("webview.editor.rtsp.transport")}
              </label>
              <div className="flex gap-4">
                {(["udp", "tcp", "automatic"] as RtspTransport[]).map((tp) => (
                  <label key={tp} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`rtsp-transport-${item.id}`}
                      checked={rtspTransport === tp}
                      onChange={() => selectRtspTransport(tp)}
                      className="accent-primary"
                    />
                    <span className="text-sm">{t(`webview.editor.rtsp.transports.${tp}`)}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted/70 mt-1">{t("webview.editor.rtsp.hint")}</p>
            </div>
          )}
        </div>
      )}

      {/* SRT form */}
      {mode === "srt" && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div>
              <label className="text-xs text-muted mb-1 block">{t("webview.editor.srt.host")}</label>
              <input
                type="text"
                value={srt.host}
                onChange={(e) => updateSrt({ host: e.target.value })}
                onBlur={handleSave}
                placeholder="192.168.100.138"
                className={INPUT_CLS}
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-muted mb-1 block">{t("webview.editor.srt.port")}</label>
              <input
                type="number"
                value={srt.port}
                onChange={(e) => updateSrt({ port: Number(e.target.value) })}
                onBlur={handleSave}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">{t("webview.editor.srt.mode")}</label>
            <div className="flex gap-4">
              {(["listener", "caller"] as SrtMode[]).map((sm) => (
                <label key={sm} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`srt-mode-${item.id}`}
                    checked={srt.mode === sm}
                    onChange={() => selectSrtMode(sm)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t(`webview.editor.srt.modes.${sm}`)}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted/70 mt-1">
              {t(`webview.editor.srt.modeHint.${srt.mode}`)}
            </p>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">{t("webview.editor.srt.streamId")}</label>
            <input
              type="text"
              value={srt.streamId ?? ""}
              onChange={(e) => updateSrt({ streamId: e.target.value })}
              onBlur={handleSave}
              placeholder={t("webview.editor.srt.optional")}
              className={INPUT_CLS}
            />
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={srt.encrypted}
              onChange={(e) => updateSrt({ encrypted: e.target.checked })}
              onBlur={handleSave}
              className="accent-primary"
            />
            <span className="text-sm">{t("webview.editor.srt.encrypted")}</span>
          </label>

          {srt.encrypted && (
            <div>
              <label className="text-xs text-muted mb-1 block">{t("webview.editor.srt.passphrase")}</label>
              <input
                type="password"
                value={srt.passphrase ?? ""}
                onChange={(e) => updateSrt({ passphrase: e.target.value })}
                onBlur={handleSave}
                className={INPUT_CLS}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted mb-1 block">{t("webview.editor.srt.latency")}</label>
              <input
                type="number"
                value={srt.latencyMs ?? ""}
                onChange={(e) =>
                  updateSrt({ latencyMs: e.target.value === "" ? undefined : Number(e.target.value) })
                }
                onBlur={handleSave}
                placeholder="120"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">{t("webview.editor.srt.overhead")}</label>
              <input
                type="number"
                value={srt.overheadBandwidth ?? ""}
                onChange={(e) =>
                  updateSrt({
                    overheadBandwidth: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                onBlur={handleSave}
                placeholder="25"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {configError && <p className="text-xs text-danger">{configError}</p>}
          <p className="text-xs text-muted/70">{t("webview.editor.srt.hint")}</p>
        </div>
      )}

      {/* Multicast form */}
      {mode === "multicast" && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div>
              <label className="text-xs text-muted mb-1 block">{t("webview.editor.multicast.ip")}</label>
              <input
                type="text"
                value={multicast.ip}
                onChange={(e) => updateMulticast({ ip: e.target.value })}
                onBlur={handleSave}
                placeholder="238.0.0.1"
                className={INPUT_CLS}
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-muted mb-1 block">{t("webview.editor.multicast.port")}</label>
              <input
                type="number"
                value={multicast.port}
                onChange={(e) => updateMulticast({ port: Number(e.target.value) })}
                onBlur={handleSave}
                className={INPUT_CLS}
              />
            </div>
          </div>
          {configError && <p className="text-xs text-danger">{configError}</p>}
          <p className="text-xs text-muted/70">{t("webview.editor.multicast.hint")}</p>
        </div>
      )}

      {/* Basic auth — iframe (login-gated pages) and MJPEG (streams) only. */}
      {(mode === "iframe" || mode === "mjpeg") && (
        <div className="space-y-2">
          <label className="text-xs text-muted block">{t("webview.editor.auth")}</label>
          <input
            type="text"
            value={authUser}
            onChange={(e) => setAuthUser(e.target.value)}
            onBlur={handleSave}
            placeholder={t("webview.editor.user")}
            className={INPUT_CLS}
          />
          <input
            type="password"
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
            onBlur={handleSave}
            placeholder={t("webview.editor.pass")}
            className={INPUT_CLS}
          />
        </div>
      )}

      {/* Crop — iframe only. Visual zoom/pan to frame a region (e.g. a camera
          page's <video>) full-screen. Tuned by eye via the live preview. */}
      {mode === "iframe" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted block">{t("webview.editor.crop.label")}</label>
            {!isIdentityCrop(crop) && (
              <button
                type="button"
                onClick={resetCrop}
                className="text-xs text-primary hover:underline"
              >
                {t("webview.editor.crop.reset")}
              </button>
            )}
          </div>
          <p className="text-xs text-muted/70">{t("webview.editor.crop.hint")}</p>

          {previewUrl ? (
            <div className="relative w-full aspect-video bg-black overflow-hidden rounded border border-border">
              <iframe
                key={previewUrl}
                src={previewUrl}
                // eslint-disable-next-line react/no-unknown-property
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                style={iframeCropStyle(crop)}
                title="WebView crop preview"
              />
            </div>
          ) : (
            <div className="w-full aspect-video bg-surface-2 rounded border border-border flex items-center justify-center">
              <span className="text-xs text-muted">{t("webview.editor.crop.noPreview")}</span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <CropSlider
              label={t("webview.editor.crop.zoom")}
              value={crop.zoom}
              min={1}
              max={5}
              step={0.05}
              display={`${crop.zoom.toFixed(2)}×`}
              onChange={(v) => updateCrop({ zoom: v })}
              onCommit={handleSave}
            />
            <CropSlider
              label={t("webview.editor.crop.offsetX")}
              value={crop.offsetX}
              min={-100}
              max={100}
              step={1}
              display={`${crop.offsetX}%`}
              onChange={(v) => updateCrop({ offsetX: v })}
              onCommit={handleSave}
            />
            <CropSlider
              label={t("webview.editor.crop.offsetY")}
              value={crop.offsetY}
              min={-100}
              max={100}
              step={1}
              display={`${crop.offsetY}%`}
              onChange={(v) => updateCrop({ offsetY: v })}
              onCommit={handleSave}
            />
          </div>
        </div>
      )}

      {saving && <p className="text-xs text-muted">{t("webview.editor.saving")}</p>}

      <div>
        <p className="text-xs text-muted mb-1">{t("builder.itemNotes.label")}</p>
        <NotesField value={notes} onChange={handleNotesChange} placeholder={t("builder.itemNotes.placeholder")} />
      </div>
    </div>
  );
};

interface CropSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
  onCommit: () => void;
}

/**
 * A labelled range input. `onChange` updates state live (so the preview tracks
 * the drag); `onCommit` fires on release/keyup to persist the value.
 */
const CropSlider: React.FC<CropSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  onCommit,
}) => (
  <div>
    <div className="flex items-center justify-between mb-0.5">
      <label className="text-xs text-muted">{label}</label>
      <span className="text-xs font-mono text-muted">{display}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onMouseUp={onCommit}
      onKeyUp={onCommit}
      className="w-full accent-primary"
    />
  </div>
);
