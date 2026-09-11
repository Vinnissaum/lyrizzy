import type { ServiceSet } from "../types";

/**
 * Which set should become active after the active one is deleted: the set
 * AFTER the deleted one in list order, or the one BEFORE it if the deleted
 * set was last. `null` when the deleted set was the only one, or when it is
 * not in the list at all. Pure for testability.
 */
export function nextActiveSetId(
  sets: ServiceSet[],
  deletedId: string,
): string | null {
  const index = sets.findIndex((s) => s.id === deletedId);
  if (index === -1) return null;
  if (sets.length === 1) return null;

  const next = sets[index + 1];
  if (next) return next.id;

  return sets[index - 1].id;
}
