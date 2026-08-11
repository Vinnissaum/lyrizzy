import React from "react";
import { useTranslation } from "react-i18next";
import { monitorIdentity, resolveMonitorName } from "../../utils/monitorNames";
import { useSettingsStore } from "../../stores/settings";

/**
 * Editable per-monitor name list. Every detected monitor gets a row with its
 * resolution and a text field for an operator-chosen name, persisted by
 * identity (not array index) via the settings store.
 */
export const MonitorNameSettings: React.FC = () => {
  const { t } = useTranslation();
  const monitors = useSettingsStore((s) => s.monitors);
  const names = useSettingsStore((s) => s.monitorNames);
  const setMonitorName = useSettingsStore((s) => s.setMonitorName);

  const onChange = (identity: string, value: string) => {
    setMonitorName(identity, value).catch(() => {});
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("settings.monitorNames.title")}</p>
      <div className="space-y-2">
        {monitors.map((m, i) => {
          const identity = monitorIdentity(m);
          return (
            <div key={identity} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={names[identity] ?? ""}
                  placeholder={resolveMonitorName(m, i, names)}
                  onChange={(e) => onChange(identity, e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <span className="text-xs text-muted whitespace-nowrap">
                {m.width}×{m.height}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">{t("settings.monitorNames.help")}</p>
    </div>
  );
};
