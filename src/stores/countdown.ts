import { create } from "zustand";
import {
  getCountdownState,
  onCountdownTick,
  pauseCountdown,
  resetCountdown,
  setCountdownDuration,
  startCountdown,
  type StartCountdownParams,
} from "../api/commands";
import type { CountdownState } from "../types";

interface CountdownStore {
  state: CountdownState;
  isSubscribed: boolean;
  subscribe: () => Promise<() => void>;
  setDuration: (durationMs: number) => Promise<void>;
  start: (params?: StartCountdownParams) => Promise<void>;
  pause: () => Promise<void>;
  reset: () => Promise<void>;
}

const DEFAULT_STATE: CountdownState = {
  mode: "idle",
  durationMs: 0,
  remainingMs: 0,
  endBehavior: "holdZero",
};

export const useCountdownStore = create<CountdownStore>((set) => ({
  state: DEFAULT_STATE,
  isSubscribed: false,

  subscribe: async () => {
    // Per-mount listener registration with a real unlisten cleanup — see the
    // matching note in stores/presentation.ts for why the `isSubscribed` guard
    // was removed (it strands the listener under React 18 StrictMode).
    set({ isSubscribed: true });

    try {
      const current = await getCountdownState();
      set({ state: current });
    } catch (_) {}

    const unlistenPromise = onCountdownTick((newState) => {
      set({ state: newState });
    });

    return async () => {
      (await unlistenPromise)();
    };
  },

  setDuration: async (durationMs) => {
    try {
      const newState = await setCountdownDuration(durationMs);
      set({ state: newState });
    } catch (err) {
      console.error("Falha ao definir duração:", err);
    }
  },

  start: async (params?) => {
    try {
      const newState = await startCountdown(params);
      set({ state: newState });
    } catch (err) {
      console.error("Falha ao iniciar cronômetro:", err);
    }
  },

  pause: async () => {
    try {
      const newState = await pauseCountdown();
      set({ state: newState });
    } catch (err) {
      console.error("Falha ao pausar cronômetro:", err);
    }
  },

  reset: async () => {
    try {
      const newState = await resetCountdown();
      set({ state: newState });
    } catch (err) {
      console.error("Falha ao resetar cronômetro:", err);
    }
  },
}));
