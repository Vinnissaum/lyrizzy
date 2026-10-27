import { create } from "zustand";
import {
  adjustCountdown,
  armCountdown,
  getCountdownState,
  onCountdownTick,
  pauseCountdown,
  resetCountdown,
  restartCountdown,
  resumeCountdown,
  setCountdownDuration,
  startCountdown,
  type ArmCountdownParams,
  type StartCountdownParams,
} from "../api/commands";
import type { CountdownState, OutputId } from "../types";
import { fanOutToMirror } from "../utils/outputDispatch";

interface CountdownStore {
  state: CountdownState;
  /** The output this store instance drives (set on subscribe). */
  output: OutputId;
  /** Which set item is currently armed (frontend-only; null when none). */
  armedItem: { setId: string; itemIndex: number } | null;
  isSubscribed: boolean;
  subscribe: (output?: OutputId) => Promise<() => void>;
  setDuration: (durationMs: number) => Promise<void>;
  start: (params?: StartCountdownParams) => Promise<void>;
  arm: (params: ArmCountdownParams) => Promise<void>;
  /**
   * `mirror: true` (the live `Pausar` control) also pauses the other screen
   * while Simultânea is on. Without it - the `countdownPause` key, whose
   * resume path is not mirrored - only this store's output pauses.
   */
  pause: (options?: { mirror?: boolean }) => Promise<void>;
  reset: () => Promise<void>;
  /**
   * Live controls (P21). Each acts on this store's output and, while mirror
   * (Simultânea) is on, on the other screen too. Unlike the actions above they
   * reject with the command's error so the control can show it.
   */
  adjust: (deltaMs: number) => Promise<void>;
  resume: () => Promise<void>;
  restart: () => Promise<void>;
}

const DEFAULT_STATE: CountdownState = {
  mode: "idle",
  durationMs: 0,
  remainingMs: 0,
  endBehavior: "holdZero",
  messageScale: 100,
  digitsScale: 100,
};

export const useCountdownStore = create<CountdownStore>((set, get) => ({
  state: DEFAULT_STATE,
  output: "one",
  armedItem: null,
  isSubscribed: false,

  subscribe: async (output: OutputId = "one") => {
    set({ output });
    // Per-mount listener registration with a real unlisten cleanup — see the
    // matching note in stores/presentation.ts for why the `isSubscribed` guard
    // was removed (it strands the listener under React 18 StrictMode).
    set({ isSubscribed: true });

    try {
      const current = await getCountdownState(output);
      set({ state: current });
    } catch (_) {}

    const unlistenPromise = onCountdownTick((newState) => {
      set({ state: newState });
    }, output);

    return async () => {
      (await unlistenPromise)();
    };
  },

  setDuration: async (durationMs) => {
    try {
      const newState = await setCountdownDuration(durationMs, get().output);
      set({ state: newState });
    } catch (err) {
      console.error("Falha ao definir duração:", err);
    }
  },

  start: async (params?) => {
    try {
      const newState = await startCountdown(params, get().output);
      set({ state: newState });
    } catch (err) {
      console.error("Falha ao iniciar cronômetro:", err);
    }
  },

  arm: async (params) => {
    try {
      const newState = await armCountdown(params, get().output);
      const armedItem =
        typeof params.setId === "string" && typeof params.itemIndex === "number"
          ? { setId: params.setId, itemIndex: params.itemIndex }
          : null;
      set({ state: newState, armedItem });
    } catch (err) {
      console.error("Falha ao agendar cronômetro:", err);
    }
  },

  pause: async (options) => {
    const output = get().output;
    try {
      const newState = await pauseCountdown(output);
      set({ state: newState });
    } catch (err) {
      console.error("Falha ao pausar cronômetro:", err);
    }
    if (options?.mirror) fanOutToMirror(output, (o) => pauseCountdown(o));
  },

  adjust: async (deltaMs) => {
    const output = get().output;
    const newState = await adjustCountdown(deltaMs, output);
    set({ state: newState });
    fanOutToMirror(output, (o) => adjustCountdown(deltaMs, o));
  },

  resume: async () => {
    const output = get().output;
    const newState = await resumeCountdown(output);
    set({ state: newState });
    fanOutToMirror(output, (o) => resumeCountdown(o));
  },

  restart: async () => {
    const output = get().output;
    const newState = await restartCountdown(output);
    set({ state: newState });
    fanOutToMirror(output, (o) => restartCountdown(o));
  },

  reset: async () => {
    try {
      const newState = await resetCountdown(get().output);
      set({ state: newState, armedItem: null });
    } catch (err) {
      console.error("Falha ao resetar cronômetro:", err);
    }
  },
}));
