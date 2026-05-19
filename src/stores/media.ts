import { create } from "zustand";
import { listMedia, onMediaLibraryChanged } from "../api/commands";
import type { Media, MediaKind } from "../types";

interface MediaStore {
  media: Media[];
  isLoading: boolean;
  filter: MediaKind | undefined;
  search: string;
  refresh: () => Promise<void>;
  setFilter: (kind: MediaKind | undefined) => void;
  setSearch: (search: string) => void;
  subscribe: () => Promise<() => void>;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useMediaStore = create<MediaStore>((set, get) => ({
  media: [],
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
}));
