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
 * Update the set of outputs that currently have a presentation window open,
 * from a `presentation_lifecycle` phase. Used by the operator to stay in the
 * presentation layout while ANY screen presents. Pure for testability.
 */
export function reducePresentingOutputs(
  prev: ReadonlySet<OutputId>,
  phase: "entered" | "exited",
  output: OutputId,
): Set<OutputId> {
  const next = new Set(prev);
  if (phase === "entered") next.add(output);
  else next.delete(output);
  return next;
}

/**
 * Launch a presentation on `output` starting at a chosen set item, in the order
 * that both opens the window AND propagates set state to an already-open one:
 *
 *   1. `loadSetForPresentation` — re-computes slides, sets the output Live, and
 *      re-emits the FULL set to every window (so a screen-2 window that was
 *      already open updates to the new set).
 *   2. `enterPresentation` — opens the window (or focuses an existing one).
 *   3. `goToItem` — navigates to the chosen start item and emits it.
 *
 * Mirror (Simultânea): the same set + start item is fanned out to the other
 * screen, best-effort. Used by the Screen 2 launch modal.
 */
export async function launchOutputAt(
  setId: string,
  itemIndex: number,
  output: OutputId,
): Promise<void> {
  await loadSetForPresentation(setId, output);
  await enterPresentation(output);
  await goToItem(itemIndex, 0, output);
  fanOutToMirror(output, (o) =>
    loadSetForPresentation(setId, o)
      .then(() => enterPresentation(o))
      .then(() => goToItem(itemIndex, 0, o)),
  );
}

/**
 * Engage mirror mode: make EVERY screen show exactly what the master is showing,
 * and **present on all of them**. The master is `master`'s current set + position
 * (defaults to Tela 1); if it has no set loaded, falls back to any other output
 * that does. Copies that content onto every other output, then opens/focuses the
 * presentation window on all outputs. No-op only when no output has a set at all.
 */
export async function engageMirror(master: OutputId = "one"): Promise<void> {
  let srcOutput = master;
  let src = await getPresentationState(master);
  if (!src?.set) {
    for (const o of ALL_OUTPUTS) {
      if (o === master) continue;
      const s = await getPresentationState(o);
      if (s?.set) {
        src = s;
        srcOutput = o;
        break;
      }
    }
  }
  if (!src?.set) return; // nothing loaded anywhere → nothing to mirror

  // Copy the master's set + position onto every other output.
  for (const o of ALL_OUTPUTS) {
    if (o === srcOutput) continue;
    await loadSetForPresentation(src.set.id, o);
    await goToItem(src.currentItemIndex ?? 0, src.currentSlideIndex ?? 0, o);
  }

  // Present on ALL screens (idempotent: focuses an already-open window).
  for (const o of ALL_OUTPUTS) {
    await enterPresentation(o).catch(() => {});
  }
}
