import { describe, it, expect, vi, afterEach } from "vitest";
import { installKeyboardDispatcher } from "./keyboard";

vi.mock("../api/commands", () => ({
  emitForwardKeydown: vi.fn().mockResolvedValue(undefined),
  onForwardKeydown: vi.fn().mockResolvedValue(vi.fn()),
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
