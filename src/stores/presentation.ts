import { create } from "zustand";
import {
  getPresentationState,
  goToItem,
  nextSlide,
  onStateChanged,
  prevSlide,
  setPresentationMode,
} from "../api/commands";
import type { OutputId, PresentationMode, PresentationState } from "../types";
import { fanOutToMirror } from "../utils/outputDispatch";

/**
 * Reconcile an incoming state payload with the slides we already hold.
 *
 * To keep the IPC round-trip small, the backend ships `allSlidesPerItem` (every
 * slide body of every item) ONLY on set (re)load and on hydration. Navigation
 * and overlay events arrive with it empty. The slide bodies never change between
 * loads, so when an incoming patch omits them we keep the last-known set — as
 * long as we're still on the same set. A different/cleared set takes the
 * incoming value verbatim, so stale slides can never leak across loads.
 */
function reconcileSlides(
  prev: PresentationState | null,
  next: PresentationState,
): PresentationState {
  if (next.allSlidesPerItem && next.allSlidesPerItem.length > 0) return next;
  const sameSet = !!prev?.set?.id && prev.set.id === next.set?.id;
  if (sameSet && prev?.allSlidesPerItem?.length) {
    return { ...next, allSlidesPerItem: prev.allSlidesPerItem };
  }
  return next;
}

interface PresentationStore {
  state: PresentationState | null;
  /** The output this store instance is actively subscribed to / drives. */
  output: OutputId;
  /** Operator's selected output (multi-screen mode). Drives the 3-pane focus. */
  focusedOutput: OutputId;
  setFocusedOutput: (output: OutputId) => void;
  /**
   * Optimistic selection target. Set synchronously by `selectSlide` so the UI
   * can highlight instantly, then cleared on the next authoritative update
   * (goToItem resolve/reject OR any `state_changed` event). Kept SEPARATE from
   * `state` so the LIVE preview/projection always read the truthful projector
   * state, never the optimistic guess.
   */
  pendingSelection: { itemIndex: number; slideIndex: number } | null;
  isSubscribed: boolean;
  subscribe: (output?: OutputId) => Promise<() => void>;
  syncState: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  jumpToItem: (itemIndex: number) => Promise<void>;
  selectSlide: (itemIndex: number, slideIndex: number) => Promise<void>;
  setMode: (mode: PresentationMode) => Promise<void>;
}

export const usePresentationStore = create<PresentationStore>((set, get) => ({
  state: null,
  output: "one",
  focusedOutput: "one",
  setFocusedOutput: (focusedOutput) => set({ focusedOutput }),
  pendingSelection: null,
  isSubscribed: false,

  subscribe: async (output: OutputId = "one") => {
    // Each mount registers its own `state_changed` listener and returns a
    // cleanup that unlistens exactly that listener. We deliberately do NOT gate
    // on an `isSubscribed` flag: under React 18 StrictMode the mount→unmount→
    // remount cycle interleaves so that a flag-guarded remount returns a no-op
    // while the first cleanup unlistens the only live listener — leaving the
    // presentation window with no listener (slides emitted but never reflected
    // on screen). Registering per-mount yields register L1 → unlisten L1 →
    // register L2, so exactly one listener stays live.
    set({ isSubscribed: true, output });

    // Hydrate immediately
    try {
      const current = await getPresentationState(output);
      set((s) => ({ state: reconcileSlides(s.state, current) }));
    } catch (_) {}

    const unlistenPromise = onStateChanged((newState) => {
      // Any authoritative update (including nav from the other window) clears
      // a standing optimistic selection.
      set((s) => ({ state: reconcileSlides(s.state, newState), pendingSelection: null }));
    }, output);

    return async () => {
      (await unlistenPromise)();
    };
  },

  syncState: async () => {
    try {
      const current = await getPresentationState(get().output);
      set((s) => ({ state: reconcileSlides(s.state, current) }));
    } catch (err) {
      console.error("Falha ao sincronizar estado de apresentação:", err);
    }
  },

  next: async () => {
    const output = get().output;
    try {
      const newState = await nextSlide(output);
      set((s) => ({ state: reconcileSlides(s.state, newState) }));
    } catch (err) {
      console.error("Falha ao avançar slide:", err);
    }
    // Mirror (Simultânea): drive the other output identically.
    fanOutToMirror(output, (o) => nextSlide(o));
  },

  prev: async () => {
    const output = get().output;
    try {
      const newState = await prevSlide(output);
      set((s) => ({ state: reconcileSlides(s.state, newState) }));
    } catch (err) {
      console.error("Falha ao voltar slide:", err);
    }
    fanOutToMirror(output, (o) => prevSlide(o));
  },

  jumpToItem: async (itemIndex: number) => {
    const output = get().output;
    try {
      const newState = await goToItem(itemIndex, 0, output);
      set((s) => ({ state: reconcileSlides(s.state, newState) }));
    } catch (err) {
      console.error("Falha ao ir para item:", err);
    }
    fanOutToMirror(output, (o) => goToItem(itemIndex, 0, o));
  },

  selectSlide: async (itemIndex: number, slideIndex: number) => {
    const output = get().output;
    // Optimistic: highlight the target immediately, before the round-trip.
    set({ pendingSelection: { itemIndex, slideIndex } });
    try {
      const newState = await goToItem(itemIndex, slideIndex, output);
      set((s) => ({ state: reconcileSlides(s.state, newState), pendingSelection: null }));
    } catch (err) {
      set({ pendingSelection: null });
      console.error("Falha ao selecionar slide:", err);
    }
    fanOutToMirror(output, (o) => goToItem(itemIndex, slideIndex, o));
  },

  setMode: async (mode: PresentationMode) => {
    const output = get().output;
    try {
      const newState = await setPresentationMode(mode, output);
      set((s) => ({ state: reconcileSlides(s.state, newState) }));
    } catch (err) {
      console.error("Falha ao alterar modo:", err);
    }
    fanOutToMirror(output, (o) => setPresentationMode(mode, o));
  },
}));
