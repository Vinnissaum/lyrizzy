import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TransitionStage } from "./TransitionStage";

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
});
