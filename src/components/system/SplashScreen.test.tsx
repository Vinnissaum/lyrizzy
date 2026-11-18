import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { SplashScreen, HOLD_MS, FADE_MS, REDUCED_HOLD_MS } from "./SplashScreen";

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

  it("renders the wordmark and the inscribed window, animated by default", () => {
    render(<SplashScreen onDone={vi.fn()} />);
    expect(screen.getByText("Lyrizzy")).toBeInTheDocument();
    const window = screen.getByTestId("splash-window");
    for (const word of ["PATER", "FILIUS", "DEUS"]) {
      expect(window.textContent).toContain(word);
    }
    expect(window.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByTestId("splash-screen").className).toContain("splash-animate");
  });

  it("calls onDone after the hold + fade", () => {
    const onDone = vi.fn();
    render(<SplashScreen onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS + FADE_MS - 10);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("skips ahead on a keypress", () => {
    const onDone = vi.fn();
    render(<SplashScreen onDone={onDone} />);
    act(() => {
      fireEvent.keyDown(window, { key: "a" });
      vi.advanceTimersByTime(FADE_MS + 10);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("shows the window still, for a shorter hold, when reduced motion is preferred", () => {
    mockMatchMedia(true);
    const onDone = vi.fn();
    render(<SplashScreen onDone={onDone} />);
    expect(screen.getByTestId("splash-screen").className).not.toContain("splash-animate");
    expect(screen.getByTestId("splash-window").textContent).toContain("DEUS");
    act(() => {
      vi.advanceTimersByTime(REDUCED_HOLD_MS + FADE_MS + 10);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
