import type {
  CountdownEndBehavior,
  CountdownPosition,
  ScheduledStart,
  SetItem,
} from "../types";

export interface UpcomingScheduledCountdown {
  /** Index of the countdown item within the set. */
  itemIndex: number;
  scheduledStart: ScheduledStart;
  durationMs: number;
  message?: string;
  endBehavior: CountdownEndBehavior;
  /** "HH:MM" for display. */
  hhmm: string;
  /** Milliseconds from `nowMs` until the scheduled fire time (today). */
  remainingMs: number;
  /** On-screen anchor for the digits, from the item's countdown config (DD-1). */
  position?: CountdownPosition;
  /** Looped-video background id, from the item's countdown config (DD-1). */
  backgroundMediaId?: string;
  /** Scale factor (%) applied to the countdown message text (DD-1). */
  messageScale?: number;
  /** Scale factor (%) applied to the countdown digits (DD-1). */
  digitsScale?: number;
}

/**
 * Scan set items for a countdown scheduled for LATER TODAY (local time) and
 * return the earliest upcoming one, or `null`.
 *
 * Excluded: schedules whose HH:MM has already passed today (those would roll to
 * tomorrow — we don't surprise-prompt for them), countdowns without a positive
 * duration (can't be armed), and non-countdown / unscheduled items.
 */
export function findUpcomingScheduledCountdown(
  items: SetItem[],
  nowMs: number,
): UpcomingScheduledCountdown | null {
  let best: UpcomingScheduledCountdown | null = null;

  items.forEach((item, itemIndex) => {
    if (item.itemType !== "countdown") return;
    const cfg = item.countdownConfig;
    const sched = cfg?.scheduledStart;
    if (!cfg || !sched) return;

    const durationMs = cfg.target.kind === "duration" ? cfg.target.durationMs : 0;
    if (durationMs <= 0) return;

    const target = new Date(nowMs);
    target.setHours(sched.hour, sched.minute, 0, 0);
    const remainingMs = target.getTime() - nowMs;
    if (remainingMs <= 0) return; // already past today → would roll to tomorrow; skip

    if (!best || remainingMs < best.remainingMs) {
      best = {
        itemIndex,
        scheduledStart: sched,
        durationMs,
        message: cfg.message,
        endBehavior: cfg.endBehavior,
        hhmm: `${String(sched.hour).padStart(2, "0")}:${String(sched.minute).padStart(2, "0")}`,
        remainingMs,
        position: cfg.position,
        backgroundMediaId: cfg.backgroundMediaId,
        messageScale: cfg.messageScale,
        digitsScale: cfg.digitsScale,
      };
    }
  });

  return best;
}
