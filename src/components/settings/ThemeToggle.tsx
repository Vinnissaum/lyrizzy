import React from "react";
import { useTranslation } from "react-i18next";
import { Toggle } from "../common/Toggle";
import { useThemeStore } from "../../stores/theme";

export const ThemeToggle: React.FC = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useThemeStore();

  return (
    <Toggle
      label={t("settings.theme.label")}
      value={theme}
      onChange={setTheme}
      options={[
        { value: "light", label: t("settings.theme.light") },
        { value: "dark", label: t("settings.theme.dark") },
      ]}
    />
  );
};
