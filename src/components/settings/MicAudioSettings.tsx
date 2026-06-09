import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settings";
import {
  enumerateAudioDevices,
  supportsAudioOutputSelection,
  toSavedDevice,
  type AudioDevices,
} from "../../utils/audioDevices";
import type { OutputId } from "../../types";

const OUTPUTS: OutputId[] = ["one", "two"];

/**
 * Per-output camera/mic audio settings: enable the mic on a screen, pick its
 * input + the output (TV's HDMI) device, set the sync delay, and un-mute the
 * camera's own audio. Device labels need a one-time mic grant (the Grant button).
 */
export const MicAudioSettings: React.FC = () => {
  const { t } = useTranslation();
  const audio = useSettingsStore((s) => s.audio);
  const setOutputAudio = useSettingsStore((s) => s.setOutputAudio);
  const [devices, setDevices] = useState<AudioDevices>({ inputs: [], outputs: [] });
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setDevices(await enumerateAudioDevices());
    } catch {
      setError(t("settings.audio.enumerateFailed"));
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Device labels are only exposed after a getUserMedia grant.
  const grantAndRefresh = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((tr) => tr.stop());
    } catch {
      setError(t("settings.audio.permissionDenied"));
    }
    await refresh();
  };

  const outputSupported = supportsAudioOutputSelection();

  return (
    <div className="space-y-4" data-testid="mic-audio-settings">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{t("settings.audio.description")}</p>
        <button
          type="button"
          onClick={grantAndRefresh}
          className="px-3 py-1 text-xs rounded-lg bg-surface-2 hover:bg-border whitespace-nowrap"
        >
          {t("settings.audio.grant")}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!outputSupported && (
        <p className="text-xs text-amber-400">{t("settings.audio.noOutputSelection")}</p>
      )}

      {OUTPUTS.map((o, i) => {
        const a = audio[o];
        return (
          <div key={o} className="rounded-lg border border-border p-3 space-y-2">
            <h4 className="text-sm font-medium">
              {t("presentation.output.tela", { n: i + 1 })}
            </h4>

            <label className="flex items-center justify-between text-sm">
              <span>{t("settings.audio.micEnabled")}</span>
              <input
                type="checkbox"
                checked={a.micEnabled}
                onChange={(e) => setOutputAudio(o, { micEnabled: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between text-sm">
              <span>{t("settings.audio.cameraUnmuted")}</span>
              <input
                type="checkbox"
                checked={a.cameraUnmuted}
                onChange={(e) => setOutputAudio(o, { cameraUnmuted: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between gap-2 text-sm">
              <span>{t("settings.audio.micDelay")}</span>
              <input
                type="number"
                min={0}
                max={5000}
                step={50}
                value={a.micDelayMs}
                onChange={(e) =>
                  setOutputAudio(o, { micDelayMs: Number(e.target.value) || 0 })
                }
                className="w-24 px-2 py-1 bg-surface-2 border border-border rounded text-sm"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>{t("settings.audio.micDevice")}</span>
              <select
                value={a.micDevice?.deviceId ?? ""}
                onChange={(e) => {
                  const d = devices.inputs.find((x) => x.deviceId === e.target.value);
                  setOutputAudio(o, { micDevice: d ? toSavedDevice(d) : null });
                }}
                className="px-2 py-1 bg-surface-2 border border-border rounded text-sm"
              >
                <option value="">{t("settings.audio.defaultDevice")}</option>
                {devices.inputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || d.deviceId}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>{t("settings.audio.outputDevice")}</span>
              <select
                value={a.outputDevice?.deviceId ?? ""}
                onChange={(e) => {
                  const d = devices.outputs.find((x) => x.deviceId === e.target.value);
                  setOutputAudio(o, { outputDevice: d ? toSavedDevice(d) : null });
                }}
                className="px-2 py-1 bg-surface-2 border border-border rounded text-sm"
              >
                <option value="">{t("settings.audio.defaultDevice")}</option>
                {devices.outputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || d.deviceId}
                  </option>
                ))}
              </select>
            </label>
          </div>
        );
      })}
    </div>
  );
};
