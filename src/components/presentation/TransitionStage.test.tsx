import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TransitionStage } from "./TransitionStage";
import { MediaSlideRenderer } from "./MediaSlideRenderer";
import { installFakeVideo } from "../../tests/fakeVideo";

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(() => Promise.resolve()),
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe("TransitionStage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the initial content", () => {
    render(
      <TransitionStage contentKey="a" durationMs={200}>
        <div>slide A</div>
      </TransitionStage>
    );
    expect(screen.getByText("slide A")).toBeInTheDocument();
  });

  // Regression: with transitions enabled, the front layer's opacity never
  // animates so `transitionend` never fires there. Completion must be driven by
  // the timeout fallback — otherwise the queue jams and we get stuck on the
  // second slide. jsdom does not dispatch transitionend, so this exercises the
  // timeout path exactly as it runs when the front layer never animates.
  it("does not get stuck after the second advance (rapid changes flush)", () => {
    const { rerender } = render(
      <TransitionStage contentKey="a" durationMs={200}>
        <div>slide A</div>
      </TransitionStage>
    );

    // First advance: begins a transition (timer armed).
    rerender(
      <TransitionStage contentKey="b" durationMs={200}>
        <div>slide B</div>
      </TransitionStage>
    );
    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(screen.getByText("slide B")).toBeInTheDocument();

    // Second advance: must NOT be dropped (the original bug froze here).
    rerender(
      <TransitionStage contentKey="c" durationMs={200}>
        <div>slide C</div>
      </TransitionStage>
    );
    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(screen.getByText("slide C")).toBeInTheDocument();

    // Third advance keeps working.
    rerender(
      <TransitionStage contentKey="d" durationMs={200}>
        <div>slide D</div>
      </TransitionStage>
    );
    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(screen.getByText("slide D")).toBeInTheDocument();
  });

  it("coalesces rapid intermediate changes to the latest content", () => {
    const { rerender } = render(
      <TransitionStage contentKey="a" durationMs={200}>
        <div>slide A</div>
      </TransitionStage>
    );

    // Start a transition, then queue two more before it completes.
    rerender(
      <TransitionStage contentKey="b" durationMs={200}>
        <div>slide B</div>
      </TransitionStage>
    );
    rerender(
      <TransitionStage contentKey="c" durationMs={200}>
        <div>slide C</div>
      </TransitionStage>
    );
    rerender(
      <TransitionStage contentKey="d" durationMs={200}>
        <div>slide D</div>
      </TransitionStage>
    );

    // Flush the in-flight transition; the queue collapses to the latest (D).
    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(screen.getByText("slide D")).toBeInTheDocument();
    expect(screen.queryByText("slide C")).not.toBeInTheDocument();

    // Drain any follow-up transition started by flushing the queue.
    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(screen.getByText("slide D")).toBeInTheDocument();
  });

  it("cuts instantly when duration is 0", () => {
    const { rerender } = render(
      <TransitionStage contentKey="a" durationMs={0}>
        <div>slide A</div>
      </TransitionStage>
    );
    rerender(
      <TransitionStage contentKey="b" durationMs={0}>
        <div>slide B</div>
      </TransitionStage>
    );
    expect(screen.getByText("slide B")).toBeInTheDocument();
  });

  // ── P23: what left the wall does not keep running behind it ───────────────

  it("the outgoing layer is unmounted when its fade ends", () => {
    const { rerender } = render(
      <TransitionStage contentKey="video" durationMs={200}>
        <div>item A</div>
      </TransitionStage>
    );
    rerender(
      <TransitionStage contentKey="blank" durationMs={200}>
        <div>item B</div>
      </TransitionStage>
    );
    const incoming = screen.getByText("item B");

    // During the fade A is still there, underneath and fading.
    const outgoing = screen.getByText("item A");
    expect(outgoing.closest("[data-layer]")).toHaveAttribute("data-layer", "back");
    expect((outgoing.closest("[data-layer]") as HTMLElement).style.opacity).toBe("0");
    expect(incoming.closest("[data-layer]")).toHaveAttribute("data-layer", "front");

    act(() => {
      vi.advanceTimersByTime(230);
    });
    expect(screen.queryByText("item A")).not.toBeInTheDocument();
    // B was never remounted to change layer: it is the same element.
    expect(screen.getByText("item B")).toBe(incoming);
    // Nothing else is left in either layer.
    const layers = Array.from(document.querySelectorAll("[data-layer]"));
    expect(layers.map((l) => l.textContent).join("")).toBe("item B");
  });

  it("an instant cut unmounts the outgoing layer at once", () => {
    const { rerender } = render(
      <TransitionStage contentKey="video" durationMs={0}>
        <div>item A</div>
      </TransitionStage>
    );
    rerender(
      <TransitionStage contentKey="blank" durationMs={0}>
        <div>item B</div>
      </TransitionStage>
    );
    expect(screen.queryByText("item A")).not.toBeInTheDocument();
    expect(screen.getByText("item B")).toBeInTheDocument();

    // `instant` cuts the same way, whatever the duration.
    rerender(
      <TransitionStage contentKey="song" durationMs={200} instant>
        <div>item C</div>
      </TransitionStage>
    );
    expect(screen.queryByText("item B")).not.toBeInTheDocument();
  });

  it("an outgoing video is paused in the update that replaces it", () => {
    const fake = installFakeVideo();
    try {
      const video = (
        <MediaSlideRenderer
          assetUrl="asset://localhost/loop.mp4"
          kind="video"
          itemId="vid-1"
          options={{ loop: true, mute: false, autoAdvanceOnEnd: false }}
        />
      );
      const { rerender, container } = render(
        <TransitionStage contentKey="vid-1-0" durationMs={200}>
          {video}
        </TransitionStage>
      );
      const el = container.querySelector("video") as HTMLVideoElement;
      expect(el.paused).toBe(false);

      rerender(
        <TransitionStage contentKey="blank-0" durationMs={200}>
          <div>Tela preta</div>
        </TransitionStage>
      );

      // Still mounted while it fades, but already silent - no timer has run.
      expect(container.querySelector("video")).toBe(el);
      expect(el.paused).toBe(true);
      expect(fake.pause).toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(230);
      });
      expect(container.querySelector("video")).toBeNull();
    } finally {
      fake.restore();
    }
  });
});
