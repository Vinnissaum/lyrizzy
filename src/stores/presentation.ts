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

export const usePresentationStore = create<PresentationStore>((set) => ({
  state: null,
  isSubscribed: false,

  subscribe: async () => {
    // Each mount registers its own `state_changed` listener and returns a
    // cleanup that unlistens exactly that listener. We deliberately do NOT gate
    // on an `isSubscribed` flag: under React 18 StrictMode the mount→unmount→
    // remount cycle interleaves so that a flag-guarded remount returns a no-op
    // while the first cleanup unlistens the only live listener — leaving the
    // presentation window with no listener (slides emitted but never reflected
    // on screen). Registering per-mount yields register L1 → unlisten L1 →
    // register L2, so exactly one listener stays live.
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
      const newState = await goToItem(itemIndex, 0);
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
