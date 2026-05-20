import { create } from "zustand";
import { setSetting } from "../api/commands";

export type Theme = "light" | "dark";

const STORAGE_KEY = "trinity.theme";

function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  load: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem(STORAGE_KEY) as Theme) ?? "light",

  setTheme: (theme: Theme) => {
    set({ theme });
    applyTheme(theme);
    setSetting("theme", theme).catch(() => {});
  },

  load: async () => {
    // DB value takes precedence over localStorage on first load.
    try {
      const { getSetting } = await import("../api/commands");
      const dbTheme = await getSetting("theme");
      if (dbTheme === "dark" || dbTheme === "light") {
        set({ theme: dbTheme as Theme });
        applyTheme(dbTheme as Theme);
      }
    } catch {
      // DB not ready or setting missing — keep localStorage value.
    }
  },
}));
