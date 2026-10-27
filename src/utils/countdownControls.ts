import type { CountdownState, SetItem } from "../types";

/** `−1 min` needs more than this left, so it can never reach 00:00 (D-89). */
export const MINUTE_MS = 60_000;

/**
 * Whether the countdown is what the congregation sees on this output: its
 * current item is a countdown, or a takeover (a fired schedule) is running or
 * paused over whatever the item is. The live controls show only then.
 */
export function countdownOnWall(
  currentItem: SetItem | undefined,
  countdown: CountdownState,
): boolean {
  if (currentItem?.itemType === "countdown") return true;
  return (
    !!countdown.takeover &&
    (countdown.mode === "running" || countdown.mode === "paused")
  );
}

export interface CountdownControlState {
  /** `+1 min` and `+5 min`. */
  plus: boolean;
  minus: boolean;
  pause: boolean;
  resume: boolean;
  restart: boolean;
}

/** Which live controls are usable for a countdown. Mirrors the backend rules. */
export function countdownControlState(
  countdown: CountdownState,
  restartTargetPassed = false,
): CountdownControlState {
  const { mode, remainingMs } = countdown;
  const counting = mode === "running" || mode === "paused";
  const active = counting || mode === "finished";
  return {
    plus: active,
    minus: counting && remainingMs > MINUTE_MS,
    pause: mode === "running",
    resume: mode === "paused",
    restart: active && !restartTargetPassed,
  };
}

/**
 * Whether a restart has nowhere to go: the countdown's source item counts to a
 * clock time (HH:MM) that has already passed today. The backend refuses that
 * restart rather than rolling to tomorrow (AC 28).
 */
export function restartTargetPassed(
  countdown: CountdownState,
  items: readonly SetItem[],
  now: Date,
): boolean {
  const source = items.find((i) => i.id === countdown.sourceItemId);
  const target = source?.countdownConfig?.target;
  if (target?.kind !== "fixedTime") return false;
  const at = new Date(now);
  at.setHours(target.hour, target.minute, 0, 0);
  return at.getTime() <= now.getTime();
}
