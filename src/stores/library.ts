import { create } from "zustand";
import { getOrCreateDefaultSet, listSongs } from "../api/commands";
import type { Song } from "../types";

export type AppView =
  | "home"
  | "library"
  | "editor"
  | "import-text"
  | "import-holyrics"
  | "sets"
  | "set-builder"
  | "media"
  | "backup"
  | "settings";

interface LibraryStore {
  songs: Song[];
  isLoading: boolean;
  search: string;
  editingSongId: string | null;
  editingSetId: string | null;
  currentView: AppView;
  fixedSetId: string | null;
  /** True while `editingSongId` was opened via `openLiveEditor` (editing over
   *  the presentation layout). `closeEditor` checks this to avoid navigating
   *  `currentView` away from the presentation layout on save/delete. */
  isLiveEdit: boolean;

  setSearch: (search: string) => void;
  refresh: () => Promise<void>;
  openEditor: (id?: string) => void;
  closeEditor: () => void;
  openLiveEditor: (id: string) => void;
  closeLiveEditor: () => void;
  openSetBuilder: (id?: string) => void;
  setView: (view: AppView) => void;
  loadFixedSet: () => Promise<void>;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  songs: [],
  isLoading: false,
  search: "",
  editingSongId: null,
  editingSetId: null,
  currentView: "home",
  fixedSetId: null,
  isLiveEdit: false,

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
    set({ editingSongId: id ?? null, currentView: "editor", isLiveEdit: false });
  },

  closeEditor: () => {
    // Editing over the presentation layout (see openLiveEditor): leave
    // currentView untouched so the operator stays on the presentation layout.
    if (get().isLiveEdit) {
      set({ editingSongId: null, isLiveEdit: false });
      return;
    }
    set({ editingSongId: null, currentView: "library" });
  },

  openLiveEditor: (id: string) => {
    set({ editingSongId: id, isLiveEdit: true });
  },

  closeLiveEditor: () => {
    set({ editingSongId: null, isLiveEdit: false });
  },

  openSetBuilder: (id?: string) => {
    set({ editingSetId: id ?? null, currentView: "set-builder" });
  },

  setView: (view) => {
    set({ currentView: view });
  },

  loadFixedSet: async () => {
    try {
      const defaultSet = await getOrCreateDefaultSet();
      set({ fixedSetId: defaultSet.id });
    } catch (err) {
      console.error("Falha ao carregar conjunto fixo:", err);
    }
  },
}));

