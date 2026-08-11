import React from "react";
import { useTranslation } from "react-i18next";
import type { RtspTransport, StreamProfile, WebViewMode } from "../../types";

const INPUT_CLS =
  "w-full px-3 py-1.5 bg-surface-2 border border-border rounded text-sm focus:outline-none focus:border-primary";

interface Props {
  itemId: string;
  mode: WebViewMode;
  profiles: StreamProfile[];
  /** Legacy item's current URL, used to pre-fill the first profile instead of starting blank. */
  fallbackUrl: string;
  /** Legacy item's current RTSP transport, used to pre-fill the first profile in rtsp mode. */
  fallbackRtspTransport: RtspTransport;
  onChange: (profiles: StreamProfile[]) => void;
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Manages named stream profiles (label + URL + optional RTSP transport) inside
 * a camera set item. Profiles let the operator switch which stream this app
 * pulls (e.g. a lighter sub-stream) without touching what other consumers
 * (OBS, YouTube) pull directly from the camera.
 */
export const StreamProfileEditor: React.FC<Props> = ({
  itemId,
  mode,
  profiles,
  fallbackUrl,
  fallbackRtspTransport,
  onChange,
}) => {
  const { t } = useTranslation();

  const addProfile = () => {
    const next: StreamProfile =
      profiles.length === 0
        ? {
            id: makeId(),
            label: "",
            url: fallbackUrl,
            rtspTransport: mode === "rtsp" ? fallbackRtspTransport : undefined,
          }
        : { id: makeId(), label: "", url: "", rtspTransport: mode === "rtsp" ? "udp" : undefined };
    onChange([...profiles, next]);
  };

  const updateProfile = (id: string, patch: Partial<StreamProfile>) => {
    onChange(profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removeProfile = (id: string) => {
    onChange(profiles.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted block">{t("webview.editor.profiles.label")}</label>
        <button
          type="button"
          onClick={addProfile}
          className="text-xs text-primary hover:underline"
        >
          {t("webview.editor.profiles.add")}
        </button>
      </div>
      <p className="text-xs text-muted/70">{t("webview.editor.profiles.hint")}</p>

      {profiles.map((profile) => (
        <div key={profile.id} className="space-y-1.5 p-2 border border-border rounded">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
            <div>
              <label className="text-xs text-muted mb-1 block">
                {t("webview.editor.profiles.labelField")}
              </label>
              <input
                type="text"
                value={profile.label}
                onChange={(e) => updateProfile(profile.id, { label: e.target.value })}
                placeholder={t("webview.editor.profiles.labelPlaceholder")}
                className={INPUT_CLS}
              />
            </div>
            <button
              type="button"
              onClick={() => removeProfile(profile.id)}
              className="text-xs text-danger hover:underline mt-5"
            >
              {t("webview.editor.profiles.remove")}
            </button>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">
              {t("webview.editor.profiles.urlField")}
            </label>
            <input
              type="text"
              value={profile.url}
              onChange={(e) => updateProfile(profile.id, { url: e.target.value })}
              className={`${INPUT_CLS} font-mono`}
            />
          </div>

          {mode === "rtsp" && (
            <div>
              <label className="text-xs text-muted mb-1 block">
                {t("webview.editor.rtsp.transport")}
              </label>
              <div className="flex gap-4">
                {(["udp", "tcp", "automatic"] as RtspTransport[]).map((tp) => (
                  <label key={tp} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`stream-profile-transport-${itemId}-${profile.id}`}
                      checked={(profile.rtspTransport ?? "udp") === tp}
                      onChange={() => updateProfile(profile.id, { rtspTransport: tp })}
                      className="accent-primary"
                    />
                    <span className="text-sm">{t(`webview.editor.rtsp.transports.${tp}`)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
