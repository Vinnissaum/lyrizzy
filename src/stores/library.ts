import { create } from "zustand";
import { listSongs } from "../api/commands";
import type { Song } from "../types";

type View = "library" | "editor" | "import-text" | "import-holyrics";

interface LibraryStore {
  songs: Song[];
  isLoading: boolean;
  search: string;
  editingSongId: string | null;
  currentView: View;

  setSearch: (search: string) => void;
  refresh: () => Promise<void>;
  openEditor: (id?: string) => void;
  closeEditor: () => void;
  setView: (view: View) => void;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  songs: [],
  isLoading: false,
  search: "",
  editingSongId: null,
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

  setView: (view) => {
    set({ currentView: view });
  },
}));

