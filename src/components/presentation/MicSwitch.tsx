import React from "react";
import { useTranslation } from "react-i18next";
import { usePresentationStore } from "../../stores/presentation";
import { useSettingsStore } from "../../stores/settings";

/**
 * Compact live mic control for the focused output. Shown ONLY when multi-screen
 * is on AND the mic is activated for this screen in the global config
 * (Settings → Áudio) — activation + device selection live there, so this strip
 * is just the live delay (lip-sync) tuner and an "active" indicator. Writes the
 * per-output `micDelayMs`, which the camera window's `useMicAudio` reacts to.
 */
export const MicSwitch: React.FC = () => {
  const { t } = useTranslation();
  const multiScreenEnabled = useSettingsStore((s) => s.multiScreenEnabled);
  const audio = useSettingsStore((s) => s.audio);
  const setOutputAudio = useSettingsStore((s) => s.setOutputAudio);
  const focusedOutput = usePresentationStore((s) => s.focusedOutput);

  const mic = audio[focusedOutput];
  // Only surface the live controls once the mic is activated in the config.
  if (!multiScreenEnabled || !mic.micEnabled) return null;

  return (
    <div
      data-testid="mic-switch"
      className="flex items-center gap-2 px-2 py-1 border-b border-border"
    >
      <span className="px-2 py-1 text-xs rounded-lg bg-primary text-fg-on-primary font-medium">
        {t("presentation.output.micActive")}
      </span>
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
