import { useEffect, useState } from "react";
import { getPresentationState, onStateChanged } from "../api/commands";
import type { OutputId, PresentationState } from "../types";

const OUTPUTS: OutputId[] = ["one", "two"];

/**
 * The live presentation state of every output, not only the focused one -
 * for rules that depend on what any screen shows (e.g. which set items are
 * on the wall). Hydrates once, then follows each output's `state_changed`.
 */
export function useOutputStates(): Record<OutputId, PresentationState | null> {
  const [states, setStates] = useState<Record<OutputId, PresentationState | null>>({
    one: null,
    two: null,
  });

  useEffect(() => {
    let active = true;
    const put = (output: OutputId, state: PresentationState) => {
      if (active) setStates((prev) => ({ ...prev, [output]: state }));
    };
    const unlistens = OUTPUTS.map((output) => {
      getPresentationState(output)
        .then((state) => put(output, state))
        .catch(() => {});
      return onStateChanged((state) => put(output, state), output);
    });
    return () => {
      active = false;
      for (const unlisten of unlistens) unlisten.then((u) => u());
    };
  }, []);

  return states;
}
