import { describe, it, expect } from "vitest";
import { findUpcomingScheduledCountdown } from "./scheduledCountdown";
import type { SetItem } from "../types";

// 2026-06-04 08:00:00 local
const NOW = new Date(2026, 5, 4, 8, 0, 0, 0).getTime();

function countdownItem(
  id: string,
  opts: { hour: number; minute: number; durationMs?: number; fixedTime?: boolean } | null,
): SetItem {
  const base = {
    id,
    setId: "set-1",
    itemType: "countdown",
    sortOrder: 0,
  } as unknown as SetItem;
  if (!opts) {
    base.countdownConfig = {
      target: { kind: "duration", durationMs: 600000 },
      endBehavior: "holdZero",
    } as never;
    return base;
  }
  base.countdownConfig = {
    target: opts.fixedTime
      ? { kind: "fixedTime", hour: 9, minute: 0 }
      : { kind: "duration", durationMs: opts.durationMs ?? 600000 },
    message: "Começa em…",
    endBehavior: "holdZero",
    scheduledStart: { hour: opts.hour, minute: opts.minute },
  } as never;
  return base;
}

const song = { id: "s1", setId: "set-1", itemType: "song", sortOrder: 0 } as unknown as SetItem;

describe("findUpcomingScheduledCountdown", () => {
  it("finds a countdown scheduled for later today", () => {
    const hit = findUpcomingScheduledCountdown([song, countdownItem("c1", { hour: 19, minute: 30 })], NOW);
    expect(hit).not.toBeNull();
    expect(hit!.hhmm).toBe("19:30");
    expect(hit!.itemIndex).toBe(1);
    expect(hit!.durationMs).toBe(600000);
    expect(hit!.remainingMs).toBe((11 * 3600 + 30 * 60) * 1000);
  });

  it("excludes a schedule already past today (would roll to tomorrow)", () => {
    const hit = findUpcomingScheduledCountdown([countdownItem("c1", { hour: 7, minute: 0 })], NOW);
    expect(hit).toBeNull();
  });

  it("picks the earliest upcoming schedule among several", () => {
    const hit = findUpcomingScheduledCountdown(
      [
        countdownItem("late", { hour: 21, minute: 0 }),
        countdownItem("early", { hour: 9, minute: 15 }),
        countdownItem("mid", { hour: 19, minute: 0 }),
      ],
      NOW,
    );
    expect(hit!.hhmm).toBe("09:15");
  });

  it("ignores items that are not scheduled countdowns", () => {
    expect(findUpcomingScheduledCountdown([song], NOW)).toBeNull();
    expect(findUpcomingScheduledCountdown([countdownItem("c", null)], NOW)).toBeNull();
  });

  it("ignores a scheduled countdown without a positive duration", () => {
    const hit = findUpcomingScheduledCountdown(
      [countdownItem("c1", { hour: 19, minute: 0, fixedTime: true })],
      NOW,
    );
    expect(hit).toBeNull();
  });
});
