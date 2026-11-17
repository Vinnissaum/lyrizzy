import { create } from "zustand";
import { getOrCreateDefaultSet, getSet, getSetting, listSongs, setSetting } from "../api/commands";
import type { Song } from "../types";

/**
 * `list_songs` returns the first 200 songs by title unless given a limit;
 * SQLite reads a negative one as no limit. The presenter's titles must hold
 * every song a set can reference (src-tauri/tests/songs.rs).
 */
const WHOLE_LIBRARY = { limit: -1 } as const;

/** Settings key for the operator's last-active set selection. */
export const ACTIVE_SET_KEY = "ui.active_set_id";

export type AppView =
  | "home"
  | "library"
  | "editor"
  | "import-text"
  | "import-holyrics"
  | "media"
  | "backup"
  | "settings";

interface LibraryStore {
  /** The Biblioteca view's list: the songs matching `search`. */
  songs: Song[];
  /**
   * Every song in the library, whatever `search` holds. The presenter labels
   * set items from this one, so a library search never blanks a title.
   * `null` until it is first loaded.
   */
  allSongs: Song[] | null;
  isLoading: boolean;
  search: string;
  editingSongId: string | null;
  currentView: AppView;
  activeSetId: string | null;
  /** True while `editingSongId` was opened via `openLiveEditor` (editing over
   *  the presentation layout). `closeEditor` checks this to avoid navigating
   *  `currentView` away from the presentation layout on save/delete. */
  isLiveEdit: boolean;

  setSearch: (search: string) => void;
  refresh: () => Promise<void>;
  /** Loads `allSongs` only; `songs` and `search` stay as they are. */
  refreshAllSongs: () => Promise<void>;
  openEditor: (id?: string) => void;
  closeEditor: () => void;
  openLiveEditor: (id: string) => void;
  closeLiveEditor: () => void;
  setView: (view: AppView) => void;
  loadActiveSet: () => Promise<void>;
  setActiveSet: (id: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  songs: [],
  allSongs: null,
  isLoading: false,
  search: "",
  editingSongId: null,
  currentView: "home",
  activeSetId: null,
  isLiveEdit: false,

  setSearch: (search) => {
    set({ search });
  },

  refresh: async () => {
    set({ isLoading: true });
    try {
      const search = get().search || undefined;
      const songs = await listSongs({ search });
      // The Biblioteca's list is filtered by its search and capped at 200;
      // the presenter's is neither.
      const allSongs = await listSongs(WHOLE_LIBRARY);
      set({ songs, allSongs, isLoading: false });
    } catch (err) {
      console.error("Falha ao carregar músicas:", err);
      set({ isLoading: false });
    }
  },

  refreshAllSongs: async () => {
    try {
      set({ allSongs: await listSongs(WHOLE_LIBRARY) });
    } catch (err) {
      console.error("Falha ao carregar músicas:", err);
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

  setView: (view) => {
    set({ currentView: view });
  },

  loadActiveSet: async () => {
    let id: string | null = null;
    try {
      id = await getSetting(ACTIVE_SET_KEY);
    } catch {
      // Setting missing → fall through to the default set.
    }
    if (id) {
      try {
        await getSet(id);
      } catch {
        id = null;
      }
    }
    if (!id) {
      id = (await getOrCreateDefaultSet()).id;
    }
    set({ activeSetId: id });
  },

  setActiveSet: async (id: string) => {
    set({ activeSetId: id });
    try {
      await setSetting(ACTIVE_SET_KEY, id);
    } catch (err) {
      console.error("Falha ao salvar conjunto ativo:", err);
    }
  },
}));

