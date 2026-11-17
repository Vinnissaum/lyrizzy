import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { SongBackground } from "./SongBackground";
import { TransitionStage } from "./TransitionStage";
import { installFakeVideo } from "../../tests/fakeVideo";
import type { BackgroundInfo } from "../../types";

// P23 (AC 25): a song's or a countdown's video background stops the moment
// its item starts leaving the wall, not when the fade ends.

const background: BackgroundInfo = {
  mediaKind: "video",
  assetUrl: "http://asset.localhost/media/bg.mp4",
  scrimOpacity: 35,
  restartOnSectionBoundary: false,
};

describe("SongBackground leaving the wall (P23)", () => {
  let fake: ReturnType<typeof installFakeVideo>;
  beforeEach(() => {
    vi.useFakeTimers();
    fake = installFakeVideo();
  });
  afterEach(() => {
    fake.restore();
    vi.useRealTimers();
  });

  it("a background video leaving the wall is paused at once", () => {
    const { container, rerender } = render(
      <TransitionStage contentKey="song-1-2" durationMs={200}>
        <SongBackground background={background} />
      </TransitionStage>
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.paused).toBe(false);

    rerender(
      <TransitionStage contentKey="blank-0" durationMs={200}>
        <div>Tela preta</div>
      </TransitionStage>
    );
    expect(container.querySelector("video")).toBe(video);
    expect(video.paused).toBe(true);

    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(container.querySelector("video")).toBeNull();
  });

  it("the next strophe of the same song keeps its background playing", () => {
    const { container, rerender } = render(
      <TransitionStage contentKey="song-1-2" groupKey="song-1" durationMs={200}>
        <SongBackground background={background} />
      </TransitionStage>
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    video.currentTime = 12;

    // The next strophe is the same item: the background is not remounted.
    rerender(
      <TransitionStage contentKey="song-1-3" groupKey="song-1" durationMs={200}>
        <SongBackground background={background} />
      </TransitionStage>
    );
    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(Array.from(container.querySelectorAll("video"))).toEqual([video]);
    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(12);
  });
});
