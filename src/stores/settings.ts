import { create } from "zustand";

interface SettingsStore {
  transitionMs: number;
  reduceMotion: boolean;
  locale: string;
  setLocale: (locale: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  transitionMs: 200,
  reduceMotion: false,
  locale: "pt-BR",
  setLocale: (locale) => set({ locale }),
}));
