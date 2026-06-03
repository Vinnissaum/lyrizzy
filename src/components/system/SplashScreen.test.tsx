import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { SplashScreen } from "./SplashScreen";

// matchMedia is not implemented in jsdom — default to "no reduced motion".
function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduced && q.includes("reduce"),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("SplashScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders the wordmark and animates by default", () => {
    render(<SplashScreen onDone={vi.fn()} />);
    const wordmark = screen.getByText("Lyrizzy");
    expect(wordmark).toBeInTheDocument();
    expect(wordmark.className).toContain("splash-wordmark-in");
  });

  it("calls onDone after the hold + fade", () => {
    const onDone = vi.fn();
    render(<SplashScreen onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1400 + 350 + 10);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("skips ahead on a keypress", () => {
    const onDone = vi.fn();
    render(<SplashScreen onDone={onDone} />);
    act(() => {
      fireEvent.keyDown(window, { key: "a" });
      vi.advanceTimersByTime(350 + 10);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("omits the animation when reduced motion is preferred", () => {
    mockMatchMedia(true);
    const onDone = vi.fn();
    render(<SplashScreen onDone={onDone} />);
    expect(screen.getByText("Lyrizzy").className).not.toContain("splash-wordmark-in");
    act(() => {
      vi.advanceTimersByTime(600 + 350 + 10);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
