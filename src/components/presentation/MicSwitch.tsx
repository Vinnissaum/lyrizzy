import React from "react";
import { useTranslation } from "react-i18next";
import { usePresentationStore } from "../../stores/presentation";
import { useSettingsStore } from "../../stores/settings";

/**
 * Compact mic on/off + delay control for the focused output, shown only in
 * multi-screen mode. Writes the per-output audio settings (persisted), which the
 * camera window's `useMicAudio` reacts to. Default off, remembered per screen.
 */
export const MicSwitch: React.FC = () => {
  const { t } = useTranslation();
  const multiScreenEnabled = useSettingsStore((s) => s.multiScreenEnabled);
  const audio = useSettingsStore((s) => s.audio);
  const setOutputAudio = useSettingsStore((s) => s.setOutputAudio);
  const focusedOutput = usePresentationStore((s) => s.focusedOutput);

  if (!multiScreenEnabled) return null;
  const mic = audio[focusedOutput];

  return (
    <div
      data-testid="mic-switch"
      className="flex items-center gap-2 px-2 py-1 border-b border-border"
    >
      <button
        type="button"
        aria-pressed={mic.micEnabled}
        onClick={() => setOutputAudio(focusedOutput, { micEnabled: !mic.micEnabled })}
        className={`px-2 py-1 text-xs rounded-lg transition-colors ${
          mic.micEnabled
            ? "bg-primary text-fg-on-primary font-medium"
            : "bg-surface-2 text-muted hover:bg-border"
        }`}
      >
        {t("presentation.output.mic")}
      </button>
      <label className="flex items-center gap-1 text-xs text-muted">
        {t("presentation.output.delay")}
        <input
          type="number"
          min={0}
          max={5000}
          step={50}
          value={mic.micDelayMs}
          onChange={(e) =>
            setOutputAudio(focusedOutput, { micDelayMs: Number(e.target.value) || 0 })
          }
          className="w-16 px-1 py-0.5 bg-surface-2 border border-border rounded"
        />
      </label>
    </div>
  );
};
