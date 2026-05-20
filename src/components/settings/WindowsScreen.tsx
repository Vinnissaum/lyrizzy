import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  getSetting,
  setSetting,
  listMonitors,
  openPresentationWindow,
  openStageWindow,
} from "../../api/commands";
import type { MonitorInfo } from "../../types";

async function getOperatorMonitorName(): Promise<string | null> {
  try {
    // currentMonitor() is available at runtime in Tauri v2 but may not be typed on Window
    const win = getCurrentWindow() as unknown as { currentMonitor(): Promise<{ name?: string } | null> };
    const m = await win.currentMonitor();
    return m?.name ?? null;
  } catch {
    return null;
  }
}

async function getSavedMonitorIdx(key: string): Promise<number | undefined> {
  try {
    const val = await getSetting(key);
    const idx = parseInt(val, 10);
    return isNaN(idx) ? undefined : idx;
  } catch {
    return undefined;
  }
}

interface WindowRowProps {
  title: string;
  monitors: MonitorInfo[];
  operatorMonitorName: string | null;
  selectedIdx: number | undefined;
  onSelect: (idx: number | undefined) => void;
  onOpen: () => void;
}

const WindowRow: React.FC<WindowRowProps> = ({
  title,
  monitors,
  operatorMonitorName,
  selectedIdx,
  onSelect,
  onOpen,
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
      <div className="flex gap-2">
        <select
          value={selectedIdx ?? ""}
          onChange={(e) =>
            onSelect(e.target.value === "" ? undefined : Number(e.target.value))
          }
          className="flex-1 bg-white border border-gray-300 dark:bg-gray-700 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="">{t("settings.windows.autoSelect")}</option>
          {monitors.map((m, i) => (
            <option key={i} value={i}>
              {m.name ?? `Monitor ${i + 1}`} ({m.width}×{m.height})
              {m.name === operatorMonitorName ? ` ${t("settings.windows.current")}` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={onOpen}
          className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          {t("settings.windows.open")}
        </button>
      </div>
    </div>
  );
};

export const WindowsScreen: React.FC = () => {
  const { t } = useTranslation();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [operatorMonitorName, setOperatorMonitorName] = useState<string | null>(null);
  const [presentationIdx, setPresentationIdx] = useState<number | undefined>(undefined);
  const [stageIdx, setStageIdx] = useState<number | undefined>(undefined);

  useEffect(() => {
    listMonitors().then(setMonitors).catch(() => {});
    getOperatorMonitorName().then(setOperatorMonitorName).catch(() => {});
    getSavedMonitorIdx("window.presentation.monitor").then(setPresentationIdx);
    getSavedMonitorIdx("window.stage.monitor").then(setStageIdx);
  }, []);

  const handleOpenPresentation = async () => {
    try {
      await setSetting(
        "window.presentation.monitor",
        presentationIdx !== undefined ? String(presentationIdx) : ""
      );
      await openPresentationWindow(presentationIdx);
    } catch (err) {
      console.error("Failed to open presentation window:", err);
    }
  };

  const handleOpenStage = async () => {
    try {
      await setSetting(
        "window.stage.monitor",
        stageIdx !== undefined ? String(stageIdx) : ""
      );
      await openStageWindow(stageIdx);
    } catch (err) {
      console.error("Failed to open stage window:", err);
    }
  };

  return (
    <div className="space-y-4">
      <WindowRow
        title={t("settings.windows.presentationWindow")}
        monitors={monitors}
        operatorMonitorName={operatorMonitorName}
        selectedIdx={presentationIdx}
        onSelect={setPresentationIdx}
        onOpen={handleOpenPresentation}
      />
      <WindowRow
        title={t("settings.windows.stageWindow")}
        monitors={monitors}
        operatorMonitorName={operatorMonitorName}
        selectedIdx={stageIdx}
        onSelect={setStageIdx}
        onOpen={handleOpenStage}
      />
    </div>
  );
};
