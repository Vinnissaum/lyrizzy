import { create } from "zustand";
import { listSongs } from "../api/commands";
import type { Song } from "../types";

export type AppView =
  | "library"
  | "editor"
  | "import-text"
  | "import-holyrics"
  | "sets"
  | "set-builder"
  | "set-player"
  | "countdown"
  | "media";

interface LibraryStore {
  songs: Song[];
  isLoading: boolean;
  search: string;
  editingSongId: string | null;
  editingSetId: string | null;
  currentView: AppView;

  setSearch: (search: string) => void;
  refresh: () => Promise<void>;
  openEditor: (id?: string) => void;
  closeEditor: () => void;
  openSetBuilder: (id?: string) => void;
  setView: (view: AppView) => void;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  songs: [],
  isLoading: false,
  search: "",
  editingSongId: null,
  editingSetId: null,
  currentView: "library",

  setSearch: (search) => {
    set({ search });
  },

  refresh: async () => {
    set({ isLoading: true });
    try {
      const songs = await listSongs({ search: get().search || undefined });
      set({ songs, isLoading: false });
    } catch (err) {
      console.error("Falha ao carregar músicas:", err);
      set({ isLoading: false });
    }
  },

  openEditor: (id?: string) => {
    set({ editingSongId: id ?? null, currentView: "editor" });
  },

  closeEditor: () => {
    set({ editingSongId: null, currentView: "library" });
  },

  openSetBuilder: (id?: string) => {
    set({ editingSetId: id ?? null, currentView: "set-builder" });
  },

  setView: (view) => {
    set({ currentView: view });
  },
}));

