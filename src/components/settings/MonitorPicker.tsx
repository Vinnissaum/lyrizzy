import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PRESENTATION_MONITOR_KEY,
  getSetting,
  listMonitors,
  setSetting,
} from "../../api/commands";
import type { MonitorInfo } from "../../types";

/**
 * Lets the operator choose which monitor the presentation opens on. The choice
 * is persisted in settings (`presentation.monitor_index`); `enterPresentation`
 * reads it automatically, so every "enter presentation" path honours it. This
 * is the reliable fallback on Wayland, where auto-placement may land wrong.
 */
export const MonitorPicker: React.FC = () => {
  const { t } = useTranslation();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [value, setValue] = useState<string>("auto");

  useEffect(() => {
    listMonitors()
      .then(setMonitors)
      .catch(() => setMonitors([]));
    getSetting(PRESENTATION_MONITOR_KEY)
      .then((v) => setValue(v && v !== "auto" ? v : "auto"))
      .catch(() => setValue("auto"));
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setValue(v);
    setSetting(PRESENTATION_MONITOR_KEY, v).catch(() => {});
  };

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{t("settings.windows.monitorLabel")}</p>
      <select
        value={value}
        onChange={onChange}
        className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
      >
        <option value="auto">{t("settings.windows.autoSelect")}</option>
        {monitors.map((m, i) => (
          <option key={i} value={String(i)}>
            {(m.name ?? t("settings.windows.monitorOption", { index: i + 1 })) +
              ` — ${m.width}×${m.height}`}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted">{t("settings.windows.monitorHelp")}</p>
    </div>
  );
};
