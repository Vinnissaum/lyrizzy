import React from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "../../stores/theme";

export const ThemeToggle: React.FC = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-300 dark:text-gray-300">
        {t("settings.theme.label")}
      </span>
      <div className="flex rounded-lg overflow-hidden border border-gray-600 text-sm">
        <button
          onClick={() => setTheme("light")}
          className={`px-3 py-1.5 transition-colors ${
            theme === "light"
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {t("settings.theme.light")}
        </button>
        <button
          onClick={() => setTheme("dark")}
          className={`px-3 py-1.5 transition-colors ${
            theme === "dark"
              ? "bg-emerald-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {t("settings.theme.dark")}
        </button>
      </div>
    </div>
  );
};
