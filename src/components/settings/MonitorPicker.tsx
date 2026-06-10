import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PRESENTATION_MONITOR_KEY,
  getSetting,
  listMonitors,
  setSetting,
} from "../../api/commands";
import type { MonitorInfo } from "../../types";

interface MonitorPickerProps {
  /** Which persisted setting key this picker reads/writes. Defaults to output One. */
  settingKey?: string;
  /** Optional label override (e.g. "Monitor da Tela 2"). Defaults to the generic label. */
  label?: string;
}

/**
 * Lets the operator choose which monitor a presentation output opens on. The
 * choice is persisted under `settingKey` (default `presentation.monitor_index`
 * for output One; `output2.monitor_index` for Tela 2); `enterPresentation` reads
 * the matching key automatically, so every "enter presentation" path honours it.
 * This is the reliable fallback on Wayland, where auto-placement may land wrong.
 */
export const MonitorPicker: React.FC<MonitorPickerProps> = ({
  settingKey = PRESENTATION_MONITOR_KEY,
  label,
}) => {
  const { t } = useTranslation();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [value, setValue] = useState<string>("auto");

  useEffect(() => {
    listMonitors()
      .then(setMonitors)
      .catch(() => setMonitors([]));
    getSetting(settingKey)
      .then((v) => setValue(v && v !== "auto" ? v : "auto"))
      .catch(() => setValue("auto"));
  }, [settingKey]);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setValue(v);
    setSetting(settingKey, v).catch(() => {});
  };

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label ?? t("settings.windows.monitorLabel")}</p>
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
