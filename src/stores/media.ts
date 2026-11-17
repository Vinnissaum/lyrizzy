import { create } from "zustand";
import { listMedia, onMediaLibraryChanged } from "../api/commands";
import type { Media, MediaKind } from "../types";

/** No kind, no search, no cap: SQLite reads a negative limit as "no limit". */
const WHOLE_LIBRARY = { limit: -1 } as const;

interface MediaStore {
  media: Media[];
  /**
   * The whole library, for what labels or shows set items: the presenter and
   * the wall (P24). Never narrowed by the Mídia view's filter or search, never
   * capped at the 200 newest. `null` until loaded.
   */
  allMedia: Media[] | null;
  isLoading: boolean;
  filter: MediaKind | undefined;
  search: string;
  refresh: () => Promise<void>;
  /** Loads `allMedia` only; `media`, `filter` and `search` stay as they are. */
  refreshAllMedia: () => Promise<void>;
  setFilter: (kind: MediaKind | undefined) => void;
  setSearch: (search: string) => void;
  subscribe: () => Promise<() => void>;
  /** Loads `allMedia` and reloads it on `media_library_changed`. Returns the unlisten. */
  subscribeAllMedia: () => Promise<() => void>;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useMediaStore = create<MediaStore>((set, get) => ({
  media: [],
  allMedia: null,
  isLoading: false,
  filter: undefined,
  search: "",

  refresh: async () => {
    set({ isLoading: true });
    try {
      const { filter, search } = get();
      const media = await listMedia({
        kind: filter,
        search: search || undefined,
      });
      set({ media, isLoading: false });
    } catch (err) {
      console.error("Falha ao carregar mídia:", err);
      set({ isLoading: false });
    }
  },

  refreshAllMedia: async () => {
    try {
      set({ allMedia: await listMedia(WHOLE_LIBRARY) });
    } catch (err) {
      console.error("Falha ao carregar mídia:", err);
    }
  },

  setFilter: (kind) => {
    set({ filter: kind });
    get().refresh();
  },

  setSearch: (search) => {
    set({ search });
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      get().refresh();
    }, 150);
  },

  subscribe: async () => {
    get().refresh();
    const unlistenPromise = onMediaLibraryChanged(() => {
      get().refresh();
    });
    return async () => {
      (await unlistenPromise)();
    };
  },

  subscribeAllMedia: async () => {
    get().refreshAllMedia();
    const unlistenPromise = onMediaLibraryChanged(() => {
      get().refreshAllMedia();
    });
    return async () => {
      (await unlistenPromise)();
    };
  },
}));
