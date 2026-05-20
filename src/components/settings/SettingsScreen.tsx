import React from "react";
import { useTranslation } from "react-i18next";
import { LanguagePicker } from "./LanguagePicker";
import { WindowsScreen } from "./WindowsScreen";
import { KeyBindingsScreen } from "./KeyBindingsScreen";
import { ThemeToggle } from "./ThemeToggle";
import { CCLIReportScreen } from "../reports/CCLIReportScreen";
import { UpdateCheckButton } from "../system/UpdateCheckButton";

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("settings.title")}</h2>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t("settings.general")}
          </h3>
          <LanguagePicker />
          <ThemeToggle />
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t("settings.windows.title")}
          </h3>
          <WindowsScreen />
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t("keyBindings.title")}
          </h3>
          <KeyBindingsScreen />
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t("reports.ccli.title")}
          </h3>
          <CCLIReportScreen />
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t("settings.about")}
          </h3>
          <UpdateCheckButton />
        </div>
      </div>
    </div>
  );
};
