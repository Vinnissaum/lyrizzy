import { create } from "zustand";
import { listSets } from "../api/commands";
import type { ServiceSet } from "../types";

interface SetsStore {
  sets: ServiceSet[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export const useSetsStore = create<SetsStore>((set) => ({
  sets: [],
  isLoading: false,

  refresh: async () => {
    set({ isLoading: true });
    try {
      const sets = await listSets();
      set({ sets, isLoading: false });
    } catch (err) {
      console.error("Falha ao carregar conjuntos:", err);
      set({ isLoading: false });
    }
  },
}));
