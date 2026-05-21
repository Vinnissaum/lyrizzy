import { create } from "zustand";
import { getSetting, setSetting } from "../api/commands";

interface SettingsStore {
  transitionMs: number;
  reduceMotion: boolean;
  locale: string;
  notesPanelCollapsed: boolean;
  cameraUrl: string;
  setLocale: (locale: string) => void;
  setNotesPanelCollapsed: (collapsed: boolean) => void;
  loadNotesPanelCollapsed: () => Promise<void>;
  setCameraUrl: (url: string) => void;
  loadCameraUrl: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  transitionMs: 200,
  reduceMotion: false,
  locale: "pt-BR",
  notesPanelCollapsed: false,
  cameraUrl: "",
  setLocale: (locale) => set({ locale }),
  setNotesPanelCollapsed: (collapsed) => {
    set({ notesPanelCollapsed: collapsed });
    setSetting("ui.notes_panel_collapsed", String(collapsed)).catch(() => {});
  },
  loadNotesPanelCollapsed: async () => {
    try {
      const val = await getSetting("ui.notes_panel_collapsed");
      set({ notesPanelCollapsed: val === "true" });
    } catch {
      // setting not found — use default false
    }
  },
  setCameraUrl: (url) => {
    set({ cameraUrl: url });
    setSetting("camera.url", url).catch(() => {});
  },
  loadCameraUrl: async () => {
    try {
      const url = await getSetting("camera.url");
      set({ cameraUrl: url });
    } catch {
      // setting not found — use default ""
    }
  },
}));
