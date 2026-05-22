import React from "react";
import { useTranslation } from "react-i18next";
import { LanguagePicker } from "./LanguagePicker";
import { KeyBindingsScreen } from "./KeyBindingsScreen";
import { ThemeToggle } from "./ThemeToggle";
import { CCLIReportScreen } from "../reports/CCLIReportScreen";
import { UpdateCheckButton } from "../system/UpdateCheckButton";
import { useSettingsStore } from "../../stores/settings";

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { cameraUrl, setCameraUrl } = useSettingsStore();

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <h2 className="text-lg font-semibold">{t("settings.title")}</h2>

        <div className="bg-surface-2 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
            {t("settings.general")}
          </h3>
          <LanguagePicker />
          <ThemeToggle />
        </div>

        <div className="bg-surface-2 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
            {t("settings.windows.title")}
          </h3>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t("settings.windows.cameraUrl")}
            </p>
            <input
              type="url"
              value={cameraUrl}
              onChange={(e) => setCameraUrl(e.target.value)}
              placeholder="http://192.168.1.x/cam"
              className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="bg-surface-2 rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
            {t("keyBindings.title")}
          </h3>
          <KeyBindingsScreen />
        </div>

        <div className="bg-surface-2 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
            {t("reports.ccli.title")}
          </h3>
          <CCLIReportScreen />
        </div>

        <div className="bg-surface-2 rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider">
            {t("settings.about")}
          </h3>
          <UpdateCheckButton />
        </div>
      </div>
    </div>
  );
};
