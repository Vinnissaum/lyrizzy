import { create } from "zustand";
import { getSetting, setSetting } from "../api/commands";
import type { FontSize } from "../types";

export const PRESENTATION_FONT_SIZE_KEY = "presentation.font_size";

const FONT_SIZE_VALUES: FontSize[] = ["sm", "md", "lg", "xl"];
const DEFAULT_FONT_SIZE: FontSize = "lg";

function parseFontSize(value: string | null | undefined): FontSize {
  return FONT_SIZE_VALUES.includes(value as FontSize)
    ? (value as FontSize)
    : DEFAULT_FONT_SIZE;
}

interface SettingsStore {
  transitionMs: number;
  reduceMotion: boolean;
  locale: string;
  notesPanelCollapsed: boolean;
  cameraUrl: string;
  presentationFontSize: FontSize;
  setLocale: (locale: string) => void;
  setNotesPanelCollapsed: (collapsed: boolean) => void;
  loadNotesPanelCollapsed: () => Promise<void>;
  setCameraUrl: (url: string) => void;
  loadCameraUrl: () => Promise<void>;
  setPresentationFontSize: (size: FontSize) => void;
  loadPresentationFontSize: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  transitionMs: 200,
  reduceMotion: false,
  locale: "pt-BR",
  notesPanelCollapsed: false,
  cameraUrl: "",
  presentationFontSize: DEFAULT_FONT_SIZE,
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
  setPresentationFontSize: (size) => {
    set({ presentationFontSize: size });
    setSetting(PRESENTATION_FONT_SIZE_KEY, size).catch(() => {});
  },
  loadPresentationFontSize: async () => {
    try {
      const val = await getSetting(PRESENTATION_FONT_SIZE_KEY);
      set({ presentationFontSize: parseFontSize(val) });
    } catch {
      // setting not found — use default
    }
  },
}));
