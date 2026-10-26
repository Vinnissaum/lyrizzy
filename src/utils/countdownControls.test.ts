import { describe, it, expect } from "vitest";
import { countdownControlState, countdownOnWall } from "./countdownControls";
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
