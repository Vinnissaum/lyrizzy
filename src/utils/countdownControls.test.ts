import { describe, it, expect } from "vitest";
import { countdownControlState, countdownOnWall, restartTargetPassed } from "./countdownControls";
import type { CountdownMode, CountdownState, SetItem } from "../types";

function countdown(mode: CountdownMode, remainingMs: number, takeover = false): CountdownState {
  return {
    mode,
    durationMs: 600_000,
    remainingMs,
    endBehavior: "holdZero",
    messageScale: 100,
    digitsScale: 100,
    takeover,
  };
}

const songItem: SetItem = {
  id: "item-1",
  setId: "set-1",
  itemType: "song",
  songId: "song-1",
  sortOrder: 0,
};

const countdownItem: SetItem = {
  id: "item-2",
  setId: "set-1",
  itemType: "countdown",
  sortOrder: 1,
  countdownConfig: { target: { kind: "duration", durationMs: 600_000 }, endBehavior: "holdZero" },
};

describe("countdownControls", () => {
  it("countdown on the wall: a countdown item, or a takeover running or paused over a song", () => {
    expect(countdownOnWall(countdownItem, countdown("running", 270_000))).toBe(true);
    expect(countdownOnWall(countdownItem, countdown("idle", 0))).toBe(true);
    expect(countdownOnWall(songItem, countdown("running", 270_000))).toBe(false);
    expect(countdownOnWall(songItem, countdown("idle", 0))).toBe(false);
    expect(countdownOnWall(songItem, countdown("running", 270_000, true))).toBe(true);
    expect(countdownOnWall(songItem, countdown("paused", 270_000, true))).toBe(true);
    expect(countdownOnWall(songItem, countdown("finished", 0, true))).toBe(false);
    expect(countdownOnWall(undefined, countdown("running", 270_000))).toBe(false);
  });

  it("minus disabled at or below a minute", () => {
    expect(countdownControlState(countdown("running", 60_000)).minus).toBe(false);
    expect(countdownControlState(countdown("running", 60_001)).minus).toBe(true);
    expect(countdownControlState(countdown("running", 40_000)).minus).toBe(false);
    expect(countdownControlState(countdown("paused", 60_000)).minus).toBe(false);
    expect(countdownControlState(countdown("paused", 270_000)).minus).toBe(true);
    expect(countdownControlState(countdown("finished", 0)).minus).toBe(false);
  });

  it("idle and scheduled disable every control", () => {
    for (const mode of ["idle", "scheduled"] as const) {
      expect(countdownControlState(countdown(mode, 270_000))).toEqual({
        plus: false,
        minus: false,
        pause: false,
        resume: false,
        restart: false,
      });
    }
  });

  it("restart disabled once a clock time has passed; a duration countdown is unaffected", () => {
    const until1900: SetItem = {
      ...countdownItem,
      id: "cd-19",
      countdownConfig: { target: { kind: "fixedTime", hour: 19, minute: 0 }, endBehavior: "holdZero" },
    };
    const items = [songItem, countdownItem, until1900];
    const at = (h: number, m: number) => new Date(2026, 9, 26, h, m, 0, 0);
    const fromItem = (id: string): CountdownState => ({
      ...countdown("running", 180_000),
      sourceItemId: id,
    });

    expect(restartTargetPassed(fromItem("cd-19"), items, at(19, 2))).toBe(true);
    expect(restartTargetPassed(fromItem("cd-19"), items, at(19, 0))).toBe(true);
    expect(restartTargetPassed(fromItem("cd-19"), items, at(18, 59))).toBe(false);
    // A duration countdown, or one with no source item (a fired schedule).
    expect(restartTargetPassed(fromItem("item-2"), items, at(23, 59))).toBe(false);
    expect(restartTargetPassed(countdown("running", 180_000), items, at(23, 59))).toBe(false);

    expect(countdownControlState(fromItem("cd-19"), true).restart).toBe(false);
    expect(countdownControlState(fromItem("cd-19"), false).restart).toBe(true);
  });

  it("running, paused and finished enable what applies", () => {
    expect(countdownControlState(countdown("running", 270_000))).toEqual({
      plus: true,
      minus: true,
      pause: true,
      resume: false,
      restart: true,
    });
    expect(countdownControlState(countdown("paused", 270_000))).toEqual({
      plus: true,
      minus: true,
      pause: false,
      resume: true,
      restart: true,
    });
    expect(countdownControlState(countdown("finished", 0))).toEqual({
      plus: true,
      minus: false,
      pause: false,
      resume: false,
      restart: true,
    });
  });
});
