import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MediaSlideRenderer } from "./MediaSlideRenderer";
import { OutputContext } from "./outputContext";
import { installFakeVideo, loadMetadata, playTo, endVideo, failVideo } from "../../tests/fakeVideo";
import type { MediaItemOptions, OutputId, VideoAction, VideoReport } from "../../types";

// P23 S4: the wall's video set item reports its playback and obeys the
// operator (AD-094). The real renderer and the real event wrappers in
// src/api/commands.ts; Tauri's event bus is stubbed, and the <video> element
// is the jsdom model in src/tests/fakeVideo.ts.

type Handler = (e: { payload: unknown }) => void;
const handlers: Array<{ event: string; cb: Handler }> = [];

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(() => Promise.resolve()),
  listen: vi.fn((event: string, cb: Handler) => {
    const entry = { event, cb };
    handlers.push(entry);
    return Promise.resolve(() => {
      const i = handlers.indexOf(entry);
      if (i >= 0) handlers.splice(i, 1);
    });
  }),
}));

import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

let fake: ReturnType<typeof installFakeVideo>;

const reports = () =>
  vi.mocked(emit).mock.calls.filter(([e]) => e === "video_report").map(([, p]) => p as VideoReport);
const last = () => reports()[reports().length - 1];

function command(output: OutputId, itemId: string, action: VideoAction) {
  act(() => {
    for (const h of handlers.filter((h) => h.event === "video_command")) {
      h.cb({ payload: { output, itemId, action } });
    }
  });
}

const OPTIONS: MediaItemOptions = { loop: false, mute: false, autoAdvanceOnEnd: true };

function show({
  output = "one" as OutputId,
  itemId = "vid-1",
  options = OPTIONS,
  frozen = false,
  onEnded = vi.fn(),
} = {}) {
  const ui = (o: typeof options, f: boolean) => (
    <OutputContext.Provider value={output}>
      <MediaSlideRenderer
        assetUrl="asset://localhost/v.mp4"
        kind="video"
        itemId={itemId}
        options={o}
        frozen={f}
        onEnded={onEnded}
      />
    </OutputContext.Provider>
  );
  const view = render(ui(options, frozen));
  const video = view.container.querySelector("video") as HTMLVideoElement;
  return {
    ...view,
    video,
    onEnded,
    rerenderWith: (o: typeof options, f: boolean) => view.rerender(ui(o, f)),
  };
}

describe("MediaSlideRenderer on the wall (P23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake = installFakeVideo();
  });
  afterEach(() => {
    vi.useRealTimers();
    fake.restore();
  });

  it("unmounting reports that no video is on the wall", () => {
    const { video, unmount } = show({ output: "two" });
    act(() => loadMetadata(video, 200_000));
    expect(last()).toMatchObject({ output: "two", itemId: "vid-1", status: "playing" });

    unmount();

    expect(last()).toEqual({
      output: "two",
      itemId: null,
      status: "loading",
      positionMs: 0,
      durationMs: null,
      muted: false,
    });
  });

  it("reports playback at least every 500 ms and on every change", () => {
    vi.useFakeTimers();
    const { video } = show();
    expect(last()).toMatchObject({ itemId: "vid-1", status: "loading", durationMs: null });

    act(() => loadMetadata(video, 200_000));
    expect(last()).toEqual({
      output: "one",
      itemId: "vid-1",
      status: "playing",
      positionMs: 0,
      durationMs: 200_000,
      muted: false,
    });

    // While playing, the position goes out on its own, twice a second at least.
    for (const ms of [1_000, 2_000, 3_000]) {
      playTo(video, ms);
      const before = reports().length;
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(reports().length).toBeGreaterThan(before);
      expect(last().positionMs).toBe(ms);
    }

    // Every change goes out at once, with no timer.
    const now = () => reports().length;
    let n = now();
    act(() => video.pause());
    expect(now()).toBeGreaterThan(n);
    expect(last()).toMatchObject({ status: "paused", positionMs: 3_000 });

    n = now();
    act(() => {
      video.play();
    });
    expect(now()).toBeGreaterThan(n);
    expect(last().status).toBe("playing");

    n = now();
    act(() => {
      video.currentTime = 30;
    });
    expect(now()).toBeGreaterThan(n);
    expect(last().positionMs).toBe(30_000);

    n = now();
    act(() => {
      video.muted = true;
    });
    expect(now()).toBeGreaterThan(n);
    expect(last().muted).toBe(true);

    n = now();
    act(() => endVideo(video));
    expect(now()).toBeGreaterThan(n);
    expect(last()).toMatchObject({ status: "ended", positionMs: 200_000 });
  });

  it("pause and resume drive the element and keep its position", () => {
    const { video } = show();
    act(() => loadMetadata(video, 200_000));
    playTo(video, 65_000);

    command("one", "vid-1", { kind: "pause" });
    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(65);
    expect(last()).toMatchObject({ status: "paused", positionMs: 65_000 });

    command("one", "vid-1", { kind: "resume" });
    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(65);
    expect(last()).toMatchObject({ status: "playing", positionMs: 65_000 });
  });

  it("restart plays from zero from every state", () => {
    const { video } = show();
    act(() => loadMetadata(video, 200_000));

    // Playing.
    playTo(video, 65_000);
    command("one", "vid-1", { kind: "restart" });
    expect(video.currentTime).toBe(0);
    expect(video.paused).toBe(false);

    // Paused by the operator.
    playTo(video, 40_000);
    command("one", "vid-1", { kind: "pause" });
    command("one", "vid-1", { kind: "restart" });
    expect(video.currentTime).toBe(0);
    expect(video.paused).toBe(false);

    // Ended.
    act(() => endVideo(video));
    expect(last().status).toBe("ended");
    command("one", "vid-1", { kind: "restart" });
    expect(video.currentTime).toBe(0);
    expect(video.paused).toBe(false);
    expect(video.ended).toBe(false);
    expect(last()).toMatchObject({ status: "playing", positionMs: 0 });
  });

  it("skip and seek set the clamped position", () => {
    const { video } = show();
    act(() => loadMetadata(video, 200_000));

    playTo(video, 4_000);
    command("one", "vid-1", { kind: "skip", deltaMs: -10_000 });
    expect(video.currentTime).toBe(0);

    playTo(video, 195_000);
    command("one", "vid-1", { kind: "skip", deltaMs: 10_000 });
    expect(video.currentTime).toBe(200);

    playTo(video, 60_000);
    command("one", "vid-1", { kind: "skip", deltaMs: 10_000 });
    expect(video.currentTime).toBe(70);
    expect(last().positionMs).toBe(70_000);

    command("one", "vid-1", { kind: "seek", positionMs: 50_000 });
    expect(video.currentTime).toBe(50);
    command("one", "vid-1", { kind: "seek", positionMs: -5 });
    expect(video.currentTime).toBe(0);
    command("one", "vid-1", { kind: "seek", positionMs: 999_999 });
    expect(video.currentTime).toBe(200);
  });

  it("mute is for this run and a new landing uses the saved option", () => {
    const first = show({ options: { ...OPTIONS, mute: false } });
    act(() => loadMetadata(first.video, 200_000));
    expect(first.video.muted).toBe(false);

    command("one", "vid-1", { kind: "mute", muted: true });
    expect(first.video.muted).toBe(true);
    expect(last().muted).toBe(true);
    // A re-render with the same saved option keeps the operator's choice.
    first.rerenderWith({ ...OPTIONS, mute: false }, false);
    expect(first.video.muted).toBe(true);

    command("one", "vid-1", { kind: "mute", muted: false });
    expect(first.video.muted).toBe(false);
    command("one", "vid-1", { kind: "mute", muted: true });
    // Nothing is saved: no command reaches the backend.
    expect(vi.mocked(invoke)).not.toHaveBeenCalled();
    first.unmount();

    // A new landing starts from the item's saved option, either way.
    const again = show({ options: { ...OPTIONS, mute: false } });
    expect(again.video.muted).toBe(false);
    again.unmount();
    const savedMuted = show({ options: { ...OPTIONS, mute: true } });
    expect(savedMuted.video.muted).toBe(true);
  });

  it("playback commands are ignored while frozen", () => {
    const view = show({ frozen: true });
    const { video } = view;
    act(() => loadMetadata(video, 200_000));
    playTo(video, 30_000);
    expect(video.paused).toBe(true);

    command("one", "vid-1", { kind: "resume" });
    command("one", "vid-1", { kind: "restart" });
    command("one", "vid-1", { kind: "seek", positionMs: 90_000 });
    command("one", "vid-1", { kind: "skip", deltaMs: 10_000 });
    expect(video.paused).toBe(true);
    expect(video.currentTime).toBe(30);

    // Mute still applies while frozen.
    command("one", "vid-1", { kind: "mute", muted: true });
    expect(video.muted).toBe(true);

    // Unfrozen, it plays on from where it held.
    view.rerenderWith(OPTIONS, false);
    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(30);
  });

  it("a video that cannot play reports failed", () => {
    const { video } = show();
    act(() => failVideo(video));

    expect(last()).toMatchObject({ itemId: "vid-1", status: "failed" });
    // Nothing to drive any more.
    command("one", "vid-1", { kind: "seek", positionMs: 10_000 });
    expect(video.currentTime).toBe(0);
    expect(last().status).toBe("failed");
  });

  it("an ended video reports ended and still auto-advances", () => {
    const advancing = show();
    act(() => loadMetadata(advancing.video, 200_000));
    act(() => endVideo(advancing.video));
    expect(last()).toMatchObject({ status: "ended", positionMs: 200_000 });
    expect(advancing.onEnded).toHaveBeenCalledTimes(1);
    advancing.unmount();

    const holding = show({ options: { ...OPTIONS, autoAdvanceOnEnd: false } });
    act(() => loadMetadata(holding.video, 200_000));
    act(() => endVideo(holding.video));
    expect(last().status).toBe("ended");
    expect(holding.onEnded).not.toHaveBeenCalled();
  });

  it("ignores commands for another output or another item", () => {
    const { video } = show({ output: "one", itemId: "vid-1" });
    act(() => loadMetadata(video, 200_000));

    command("two", "vid-1", { kind: "pause" });
    expect(video.paused).toBe(false);
    command("one", "vid-9", { kind: "pause" });
    expect(video.paused).toBe(false);
    command("two", "vid-9", { kind: "mute", muted: true });
    expect(video.muted).toBe(false);

    command("one", "vid-1", { kind: "pause" });
    expect(video.paused).toBe(true);
  });

  it("an image, or a video that is no set item, reports nothing", () => {
    const image = render(<MediaSlideRenderer assetUrl="asset://localhost/a.png" kind="image" itemId="img-1" />);
    image.unmount();
    const overlay = render(<MediaSlideRenderer assetUrl="asset://localhost/v.mp4" kind="video" />);
    act(() => loadMetadata(overlay.container.querySelector("video")!, 10_000));
    overlay.unmount();

    expect(reports()).toEqual([]);
    expect(handlers.filter((h) => h.event === "video_command")).toEqual([]);
  });
});
