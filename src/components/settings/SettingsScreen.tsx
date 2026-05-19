import React from "react";
import { useTranslation } from "react-i18next";
import { LanguagePicker } from "./LanguagePicker";

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <h2 className="text-lg font-semibold text-white">{t("settings.title")}</h2>

        <div className="bg-gray-800 rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {t("settings.general")}
          </h3>
          <LanguagePicker />
        </div>
      </div>
    </div>
  );
};
