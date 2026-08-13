import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settings";

/** How often the settings screen re-reads the OS display list, in ms. */
export const MONITOR_POLL_MS = 4000;

/**
 * Live display detection for the monitor pickers.
 *
 * The monitor list used to be read once, when the operator window mounted, so a
 * TV connected (or woken — an HDMI-over-IP link that dropped disappears from the
 * OS display list) after launch never showed up in Settings, leaving the
 * operator unable to assign it to a screen. This block re-detects on mount, on
 * demand, and every {@link MONITOR_POLL_MS} while Settings is open. The store
 * keeps the previous array when nothing changed, so the poll is render-free.
 */
export const MonitorDetection: React.FC = () => {
  const { t } = useTranslation();
  const monitors = useSettingsStore((s) => s.monitors);
  const refreshMonitors = useSettingsStore((s) => s.refreshMonitors);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    refreshMonitors();
    const id = setInterval(() => {
      refreshMonitors();
    }, MONITOR_POLL_MS);
    return () => clearInterval(id);
  }, [refreshMonitors]);

  const onRefresh = useCallback(() => {
    setBusy(true);
    Promise.resolve(refreshMonitors()).finally(() => {
      if (mounted.current) setBusy(false);
    });
  }, [refreshMonitors]);

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-muted">
        {t("settings.windows.detected", { n: monitors.length })}
      </p>
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        className="text-xs px-2 py-1 rounded-lg border border-border hover:border-primary disabled:opacity-50"
      >
        {t("settings.windows.redetect")}
      </button>
    </div>
  );
};
