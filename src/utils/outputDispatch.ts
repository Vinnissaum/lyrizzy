import type { OutputId } from "../types";
import { useSettingsStore } from "../stores/settings";
import {
  enterPresentation,
  getPresentationState,
  goToItem,
  loadSetForPresentation,
} from "../api/commands";

const ALL_OUTPUTS: OutputId[] = ["one", "two"];

/**
 * Which outputs an operator action should target: BOTH screens while mirror
 * (Simultânea) mode is on, otherwise only the focused one. Pure for testability.
 */
export function targetsForFocused(focused: OutputId, mirror: boolean): OutputId[] {
  return mirror ? [...ALL_OUTPUTS] : [focused];
}

/**
 * The *extra* mirror targets besides the focused output — empty when not
 * mirroring. The caller drives the focused output itself (keeping its returned
 * state for the operator preview); these extras are fanned out separately. Pure.
 */
export function mirrorTargets(focused: OutputId, mirror: boolean): OutputId[] {
  return targetsForFocused(focused, mirror).filter((o) => o !== focused);
}

/**
 * Fire `call` on every mirror target besides `focused`, best-effort. Reads the
 * live `mirrorEnabled` flag so call sites don't each re-read settings. The
 * focused output is the caller's responsibility; mirror targets are
 * fire-and-forget — their own windows reconcile via `state_changed`.
 */
export function fanOutToMirror(
  focused: OutputId,
  call: (o: OutputId) => Promise<unknown>,
): void {
  const mirror = useSettingsStore.getState().mirrorEnabled;
  for (const o of mirrorTargets(focused, mirror)) {
    call(o).catch(() => {});
  }
}

/**
 * Engage mirror mode: make Screen 2 (Tela 2) show exactly what Screen 1 — the
 * master — currently shows. Copies output One's set + current position onto
 * output Two and opens its window. No-op when One has no set loaded.
 */
export async function engageMirror(): Promise<void> {
  const master = await getPresentationState("one");
  if (!master?.set) return;
  await loadSetForPresentation(master.set.id, "two");
  await goToItem(
    master.currentItemIndex ?? 0,
    master.currentSlideIndex ?? 0,
    "two",
  );
  await enterPresentation("two");
}
