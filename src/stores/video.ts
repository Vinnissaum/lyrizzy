import { create } from "zustand";
import { emitVideoCommand, onVideoReport } from "../api/commands";
import { fanOutToMirror } from "../utils/outputDispatch";
import type { OutputId, VideoAction, VideoReport } from "../types";

interface VideoStore {
  /** The last report from each output's wall; `null` until one arrives. */
  reports: Record<OutputId, VideoReport | null>;
  /** Listen to every wall's reports (operator window). Returns the unlisten. */
  subscribe: () => Promise<() => void>;
  /**
   * Ask the wall of `output` to act on the video item it shows and, while
   * mirror (Simultânea) is on, the other wall too. Each wall obeys only if it
   * shows that item (AD-094).
   */
  send: (output: OutputId, itemId: string, action: VideoAction) => void;
}

/**
 * The operator's view of the video playing on each wall (P23). Playback lives
 * in the wall's `<video>` element; this store only keeps what the walls report
 * and relays the operator's commands. Run-only: nothing here is saved.
 */
export const useVideoStore = create<VideoStore>((set) => ({
  reports: { one: null, two: null },

  subscribe: async () => {
    const unlistenPromise = onVideoReport((report) => {
      set((s) => ({ reports: { ...s.reports, [report.output]: report } }));
    });
    return async () => {
      (await unlistenPromise)();
    };
  },

  send: (output, itemId, action) => {
    emitVideoCommand({ output, itemId, action }).catch(console.error);
    fanOutToMirror(output, (o) => emitVideoCommand({ output: o, itemId, action }));
  },
}));
