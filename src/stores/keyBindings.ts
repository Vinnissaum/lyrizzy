import { create } from "zustand";
import { getKeyBindings, onKeyBindingsChanged, setKeyBindings } from "../api/commands";
import type { KeyBindings } from "../types";

interface KeyBindingsState {
  bindings: KeyBindings | null;
  load: () => Promise<void>;
  subscribe: () => Promise<() => void>;
}

function isCanonicalExit(kb: KeyBindings): boolean {
  const binding = kb.bindings["exitPresentation"];
  return (
    Array.isArray(binding) &&
    binding.length === 1 &&
    binding[0].key === "Escape" &&
    !binding[0].ctrl &&
    !binding[0].shift &&
    !binding[0].alt
  );
}

export const useKeyBindingsStore = create<KeyBindingsState>((set) => ({
  bindings: null,

  load: async () => {
    try {
      const kb = await getKeyBindings();
      if (!isCanonicalExit(kb)) {
        kb.bindings["exitPresentation"] = [
          { key: "Escape", ctrl: false, shift: false, alt: false },
        ];
        await setKeyBindings(kb);
      }
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
