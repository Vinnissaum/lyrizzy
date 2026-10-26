import type { PresentationState } from "../types";

/**
 * Ids of the items of `setId` on the wall of any presenting output: each
 * output's current item, plus its frozen item while frozen. An idle output, or
 * one showing another set, contributes none. These cannot be removed live
 * (D-88) - the backend enforces the same rule.
 */
export function onScreenItemIds(
  states: readonly (PresentationState | null | undefined)[],
  setId: string | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!setId) return ids;
  for (const state of states) {
    if (!state || state.mode === "idle" || state.set?.id !== setId) continue;
    const items = state.set.items;
    const current = items[state.currentItemIndex];
    if (current) ids.add(current.id);
    if (state.mode === "frozen" && state.frozenAt) {
      const frozen = items[state.frozenAt[0]];
      if (frozen) ids.add(frozen.id);
    }
  }
  return ids;
}
