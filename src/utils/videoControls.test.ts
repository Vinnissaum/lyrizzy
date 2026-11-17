import { describe, it, expect } from "vitest";
import {
  SKIP_MS,
  clampPosition,
  formatVideoTime,
  skipTarget,
  videoControlState,
  videoOnWall,
  videoTimes,
} from "./videoControls";
import type { CountdownState, PresentationState, VideoReport } from "../types";

const report = (over: Partial<VideoReport> = {}): VideoReport => ({
  output: "one",
  itemId: "vid-1",
  status: "playing",
  positionMs: 65_000,
  durationMs: 200_000,
  muted: false,
  ...over,
});

describe("video times (P23)", () => {
  it("formats elapsed, total, remaining and fraction", () => {
    expect(videoTimes(65_000, 200_000)).toEqual({
      elapsed: "01:05",
      total: "03:20",
      remaining: "−02:15",
      fraction: 0.325,
    });
    expect(videoTimes(0, 200_000)).toEqual({ elapsed: "00:00", total: "03:20", remaining: "−03:20", fraction: 0 });
    expect(videoTimes(200_000, 200_000)).toEqual({ elapsed: "03:20", total: "03:20", remaining: "−00:00", fraction: 1 });
    // Past the end, or before the start, the clock stays inside the video.
    expect(videoTimes(250_000, 200_000).remaining).toBe("−00:00");
    expect(videoTimes(-3_000, 200_000).elapsed).toBe("00:00");
    // Part seconds: elapsed and remaining still add up to the total.
    expect(videoTimes(65_900, 200_000)).toMatchObject({ elapsed: "01:05", remaining: "−02:15" });
    expect(videoTimes(65_000, 200_500)).toMatchObject({ total: "03:20", remaining: "−02:15" });
    // From an hour up.
    expect(videoTimes(3_725_000, 7_200_000)).toMatchObject({ elapsed: "1:02:05", total: "2:00:00", remaining: "−57:55" });
    expect(formatVideoTime(59_999)).toBe("00:59");
  });

  it("an unknown duration shows dashes", () => {
    expect(videoTimes(65_000, null)).toEqual({ elapsed: "01:05", total: "--:--", remaining: "--:--", fraction: 0 });
  });

  it("a skip is clamped to the video", () => {
    expect(SKIP_MS).toBe(10_000);
    expect(skipTarget(4_000, -10_000, 200_000)).toBe(0);
    expect(skipTarget(195_000, 10_000, 200_000)).toBe(200_000);
    expect(skipTarget(60_000, 10_000, 200_000)).toBe(70_000);
    expect(skipTarget(60_000, -10_000, 200_000)).toBe(50_000);
    // With no duration known, only the start bounds it.
    expect(skipTarget(60_000, 10_000, null)).toBe(70_000);
    expect(skipTarget(5_000, -10_000, null)).toBe(0);
    expect(clampPosition(-5, 1_000)).toBe(0);
    expect(clampPosition(1_500, 1_000)).toBe(1_000);
  });
});

describe("when the strip shows (P23)", () => {
  const idle: CountdownState = {
    mode: "idle",
    durationMs: 0,
    remainingMs: 0,
    endBehavior: "holdZero",
    messageScale: 100,
    digitsScale: 100,
  };
  const presenting = (over: Partial<PresentationState> = {}): PresentationState => ({
    mode: "live",
    currentItemIndex: 1,
    currentSlideIndex: 0,
    itemSlideCounts: [1, 1],
    set: {
      id: "set-1",
      name: "Culto",
      createdAt: 0,
      updatedAt: 0,
      items: [
        { id: "song-1", setId: "set-1", itemType: "song", songId: "s", sortOrder: 0 },
        { id: "vid-1", setId: "set-1", itemType: "media", mediaId: "m", mediaKind: "video", sortOrder: 1 },
      ],
    },
    ...over,
  });

  it("the strip shows only while the wall plays a video", () => {
    expect(videoOnWall(report(), presenting(), idle)).toBe(true);
    expect(videoOnWall(report(), presenting({ mode: "frozen" }), idle)).toBe(true);
    // The wall said no video is on it, or said nothing yet.
    expect(videoOnWall(report({ itemId: null }), presenting(), idle)).toBe(false);
    expect(videoOnWall(null, presenting(), idle)).toBe(false);
    expect(videoOnWall(undefined, presenting(), idle)).toBe(false);
    // Not presenting, blacked out, covered by an overlay or a takeover.
    expect(videoOnWall(report(), null, idle)).toBe(false);
    expect(videoOnWall(report(), presenting({ mode: "idle" }), idle)).toBe(false);
    expect(videoOnWall(report(), presenting({ mode: "blank" }), idle)).toBe(false);
    expect(videoOnWall(report(), presenting({ overlay: { type: "announcement", text: "Aviso" } }), idle)).toBe(false);
    expect(videoOnWall(report(), presenting({ overlay: { type: "media", mediaId: "img" } }), idle)).toBe(false);
    expect(videoOnWall(report(), presenting(), { ...idle, mode: "running", takeover: true })).toBe(false);
    expect(videoOnWall(report(), presenting(), { ...idle, mode: "paused", takeover: true })).toBe(false);
    // A takeover flag left on an idle countdown covers nothing.
    expect(videoOnWall(report(), presenting(), { ...idle, mode: "idle", takeover: true })).toBe(true);
    // The operator moved on, and the wall's last report is for the old item.
    expect(videoOnWall(report(), presenting({ currentItemIndex: 0 }), idle)).toBe(false);
  });

  it("which controls are usable", () => {
    const all = { pauseResume: true, restart: true, skip: true, seek: true, mute: true };
    expect(videoControlState(report(), false)).toEqual(all);
    expect(videoControlState(report({ status: "paused" }), false)).toEqual(all);
    expect(videoControlState(report({ status: "loading", durationMs: null }), false)).toEqual({
      ...all,
      skip: false,
      seek: false,
    });
    expect(videoControlState(report({ status: "ended" }), false)).toEqual({ ...all, pauseResume: false });
    expect(videoControlState(report(), true)).toEqual({
      pauseResume: false,
      restart: false,
      skip: false,
      seek: false,
      mute: true,
    });
    const none = { pauseResume: false, restart: false, skip: false, seek: false, mute: false };
    expect(videoControlState(report({ status: "failed" }), false)).toEqual(none);
    expect(videoControlState(report({ status: "failed" }), true)).toEqual(none);
  });
});
