import { create } from "zustand";

interface SettingsStore {
  transitionMs: number;
  reduceMotion: boolean;
}

// Defaults sourced from migration 004 seed values.
// Full DB wiring will be implemented in T29 (i18n/settings command phase).
export const useSettingsStore = create<SettingsStore>(() => ({
  transitionMs: 200,
  reduceMotion: false,
}));
