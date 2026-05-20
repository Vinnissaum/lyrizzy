import { create } from "zustand";
import { getSetting, setSetting } from "../api/commands";

interface SettingsStore {
  transitionMs: number;
  reduceMotion: boolean;
  locale: string;
  notesPanelCollapsed: boolean;
  setLocale: (locale: string) => void;
  setNotesPanelCollapsed: (collapsed: boolean) => void;
  loadNotesPanelCollapsed: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  transitionMs: 200,
  reduceMotion: false,
  locale: "pt-BR",
  notesPanelCollapsed: false,
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
}));
