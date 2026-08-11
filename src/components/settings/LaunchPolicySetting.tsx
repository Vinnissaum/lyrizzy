import React from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore, type LaunchPolicy } from "../../stores/settings";

const LAUNCH_POLICY_OPTIONS: LaunchPolicy[] = ["ask", "mirror_all", "main_only"];

/**
 * Radio group choosing how the second output launches when multi-screen is
 * enabled. Inert (disabled, with an explanatory note) while multi-screen is off.
 */
export const LaunchPolicySetting: React.FC = () => {
  const { t } = useTranslation();
  const multiScreenEnabled = useSettingsStore((s) => s.multiScreenEnabled);
  const launchPolicy = useSettingsStore((s) => s.launchPolicy);
  const setLaunchPolicy = useSettingsStore((s) => s.setLaunchPolicy);

  const optionLabel = (v: LaunchPolicy) =>
    t(
      `settings.launchPolicy.${
        v === "ask" ? "ask" : v === "mirror_all" ? "mirrorAll" : "mainOnly"
      }`,
    );

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{t("settings.launchPolicy.title")}</p>
      <div role="radiogroup" aria-label={t("settings.launchPolicy.title")} className="space-y-1">
        {LAUNCH_POLICY_OPTIONS.map((opt) => (
          <label
            key={opt}
            className={`flex items-center gap-2 text-sm ${
              multiScreenEnabled ? "" : "text-muted"
            }`}
          >
            <input
              type="radio"
              name="launch-policy"
              value={opt}
              checked={launchPolicy === opt}
              disabled={!multiScreenEnabled}
              onChange={() => setLaunchPolicy(opt)}
            />
            {optionLabel(opt)}
          </label>
        ))}
      </div>
      {!multiScreenEnabled && (
        <p className="text-xs text-muted">{t("settings.launchPolicy.disabledHint")}</p>
      )}
    </div>
  );
};
