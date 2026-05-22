import React from "react";
import { useTranslation } from "react-i18next";
import { setSetting } from "../../api/commands";
import { useSettingsStore } from "../../stores/settings";

const LOCALE_OPTIONS = [
  { value: "pt-BR", labelKey: "settings.languageOptions.ptBR" },
  { value: "en-US", labelKey: "settings.languageOptions.enUS" },
] as const;

export const LanguagePicker: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { locale, setLocale } = useSettingsStore();

  const handleChange = async (newLocale: string) => {
    setLocale(newLocale);
    await i18n.changeLanguage(newLocale);
    setSetting("app.locale", newLocale).catch(console.error);
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{t("settings.language")}</span>
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-primary"
      >
        {LOCALE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
};
