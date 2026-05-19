import { create } from "zustand";
import {
  getPresentationState,
  goToItem,
  nextSlide,
  onStateChanged,
  prevSlide,
  setPresentationMode,
} from "../api/commands";
import type { PresentationMode, PresentationState } from "../types";

interface PresentationStore {
  state: PresentationState | null;
  isSubscribed: boolean;
  subscribe: () => Promise<() => void>;
  syncState: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  jumpToItem: (itemIndex: number) => Promise<void>;
  setMode: (mode: PresentationMode) => Promise<void>;
}

export const usePresentationStore = create<PresentationStore>((set, get) => ({
  state: null,
  isSubscribed: false,

  subscribe: async () => {
    if (get().isSubscribed) return () => {};
    set({ isSubscribed: true });

    // Hydrate immediately
    try {
      const current = await getPresentationState();
      set({ state: current });
    } catch (_) {}

    const unlistenPromise = onStateChanged((newState) => {
      set({ state: newState });
    });

    return async () => {
      set({ isSubscribed: false });
      (await unlistenPromise)();
    };
  },

  syncState: async () => {
    try {
      const current = await getPresentationState();
      set({ state: current });
    } catch (err) {
      console.error("Falha ao sincronizar estado de apresentação:", err);
    }
  },

  next: async () => {
    try {
      const newState = await nextSlide();
      set({ state: newState });
    } catch (err) {
      console.error("Falha ao avançar slide:", err);
    }
  },

  prev: async () => {
    try {
      const newState = await prevSlide();
      set({ state: newState });
    } catch (err) {
      console.error("Falha ao voltar slide:", err);
    }
  },

  jumpToItem: async (itemIndex: number) => {
    try {
      const newState = await goToItem(itemIndex);
      set({ state: newState });
    } catch (err) {
      console.error("Falha ao ir para item:", err);
    }
  },

  setMode: async (mode: PresentationMode) => {
    try {
      const newState = await setPresentationMode(mode);
      set({ state: newState });
    } catch (err) {
      console.error("Falha ao alterar modo:", err);
    }
  },
}));
