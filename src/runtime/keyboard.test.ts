import { describe, it, expect, vi, afterEach } from "vitest";
import { installKeyboardDispatcher, isPresentationActive } from "./keyboard";
import type { PresentationState } from "../types";

// Capture the forwarded-keydown callback so tests can simulate a key forwarded
// from the presentation window.
let forwardedCb: ((sig: string) => void) | null = null;
vi.mock("../api/commands", () => ({
  emitForwardKeydown: vi.fn().mockResolvedValue(undefined),
  onForwardKeydown: vi.fn((cb: (sig: string) => void) => {
    forwardedCb = cb;
    return Promise.resolve(() => {
      forwardedCb = null;
    });
  }),
}));

function fireKey(key: string, target: EventTarget = window): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}

describe("keyboard dispatcher — hardcoded ESC/F10", () => {
  let uninstall: (() => void) | null = null;

  afterEach(() => {
    uninstall?.();
    uninstall = null;
    vi.clearAllMocks();
  });

  it("ESC while presenting calls onEscape", () => {
    const onEscape = vi.fn();
    const onF10 = vi.fn();
    uninstall = installKeyboardDispatcher(
      () => null,
      {},
      { getIsPresenting: () => true, onEscape, onF10 }
    );

    fireKey("Escape");

    expect(onEscape).toHaveBeenCalledOnce();
    expect(onF10).not.toHaveBeenCalled();
  });

  it("ESC while not presenting does not call onEscape", () => {
    const onEscape = vi.fn();
    uninstall = installKeyboardDispatcher(
      () => null,
      {},
      { getIsPresenting: () => false, onEscape, onF10: vi.fn() }
    );

    fireKey("Escape");

    expect(onEscape).not.toHaveBeenCalled();
  });

  it("F10 while presenting calls onF10", () => {
    const onF10 = vi.fn();
    uninstall = installKeyboardDispatcher(
      () => null,
      {},
      { getIsPresenting: () => true, onEscape: vi.fn(), onF10 }
    );

    fireKey("F10");

    expect(onF10).toHaveBeenCalledOnce();
  });

  it("F10 while not presenting does not call onF10", () => {
    const onF10 = vi.fn();
    uninstall = installKeyboardDispatcher(
      () => null,
      {},
      { getIsPresenting: () => false, onEscape: vi.fn(), onF10 }
    );

    fireKey("F10");

    expect(onF10).not.toHaveBeenCalled();
  });

  it("ESC prevents event from reaching bindings when presenting", () => {
    const bindingAction = vi.fn();
    uninstall = installKeyboardDispatcher(
      () => ({ bindings: { advanceSlide: [{ key: "escape", ctrl: false, shift: false, alt: false }] } } as any),
      { advanceSlide: bindingAction },
      { getIsPresenting: () => true, onEscape: vi.fn(), onF10: vi.fn() }
    );

    fireKey("Escape");

    expect(bindingAction).not.toHaveBeenCalled();
  });

  it("forwarded ESC while presenting calls onEscape (single-owner exit)", () => {
    const onEscape = vi.fn();
    uninstall = installKeyboardDispatcher(
      () => null,
      {},
      { getIsPresenting: () => true, onEscape, onF10: vi.fn() }
    );

    // Simulate Esc forwarded from the presentation window.
    forwardedCb?.("escape");

    expect(onEscape).toHaveBeenCalledOnce();
  });

  it("forwarded ESC while not presenting does not call onEscape", () => {
    const onEscape = vi.fn();
    uninstall = installKeyboardDispatcher(
      () => null,
      {},
      { getIsPresenting: () => false, onEscape, onF10: vi.fn() }
    );

    forwardedCb?.("escape");

    expect(onEscape).not.toHaveBeenCalled();
  });

  it("forwarded ESC honored when an overlay is active (idle+overlay)", () => {
    // The operator gate is `isPresentationActive`; idle+overlay must honor Esc.
    const overlayIdle: PresentationState = {
      mode: "idle",
      currentItemIndex: 0,
      currentSlideIndex: 0,
      itemSlideCounts: [],
      overlay: { type: "media", mediaId: "m1" },
    };
    const onEscape = vi.fn();
    uninstall = installKeyboardDispatcher(
      () => null,
      {},
      {
        getIsPresenting: () => isPresentationActive(overlayIdle),
        onEscape,
        onF10: vi.fn(),
      }
    );

    forwardedCb?.("escape");

    expect(onEscape).toHaveBeenCalledOnce();
  });

  it("dispatcher without hardcoded config behaves as before", () => {
    const advanceSlide = vi.fn();
    uninstall = installKeyboardDispatcher(
      () => ({ bindings: { advanceSlide: [{ key: "arrowright", ctrl: false, shift: false, alt: false }] } } as any),
      { advanceSlide }
    );

    fireKey("ArrowRight");

    expect(advanceSlide).toHaveBeenCalledOnce();
  });
});

describe("isPresentationActive (P10-02)", () => {
  const base = {
    currentItemIndex: 0,
    currentSlideIndex: 0,
    itemSlideCounts: [] as number[],
  };

  it("is false when state is null/undefined", () => {
    expect(isPresentationActive(null)).toBe(false);
    expect(isPresentationActive(undefined)).toBe(false);
  });

  it("is true for live/blank/frozen modes", () => {
    for (const mode of ["live", "blank", "frozen"] as const) {
      expect(isPresentationActive({ ...base, mode } as PresentationState)).toBe(true);
    }
  });

  it("is false for idle with no overlay", () => {
    expect(isPresentationActive({ ...base, mode: "idle" } as PresentationState)).toBe(false);
  });

  it("is true for idle WITH an overlay", () => {
    expect(
      isPresentationActive({
        ...base,
        mode: "idle",
        overlay: { type: "media", mediaId: "m1" },
      } as PresentationState)
    ).toBe(true);
  });
});
