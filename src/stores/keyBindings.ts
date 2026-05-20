import { create } from "zustand";
import { getKeyBindings, onKeyBindingsChanged } from "../api/commands";
import type { KeyBindings } from "../types";

interface KeyBindingsState {
  bindings: KeyBindings | null;
  load: () => Promise<void>;
  subscribe: () => Promise<() => void>;
}

export const useKeyBindingsStore = create<KeyBindingsState>((set) => ({
  bindings: null,

  load: async () => {
    try {
      const kb = await getKeyBindings();
      set({ bindings: kb });
    } catch (_) {}
  },

  subscribe: async () => {
    const unsub = await onKeyBindingsChanged((kb) => {
      set({ bindings: kb });
    });
    return unsub;
  },
}));
