import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { useKeyBindingsStore } from "./keyBindings";
import type { KeyBindings } from "../types";

import type { Shortcut } from "../types";

const s = (key: string): Shortcut[] => [
  { key, ctrl: false, shift: false, alt: false },
];

const makeKeyBindings = (exitBinding: KeyBindings["bindings"]["exitPresentation"]): KeyBindings => ({
  bindings: {
    exitPresentation: exitBinding,
    advanceSlide: s("ArrowRight"),
    previousSlide: s("ArrowLeft"),
    blank: s("b"),
    freeze: s("f"),
    jumpToItem1: s("1"),
    jumpToItem2: s("2"),
    jumpToItem3: s("3"),
    jumpToItem4: s("4"),
    jumpToItem5: s("5"),
    jumpToItem6: s("6"),
    jumpToItem7: s("7"),
    jumpToItem8: s("8"),
    jumpToItem9: s("9"),
    countdownPause: s("p"),
    openPresentationWindow: s("F10"),
    focusSearch: s("f"),
  },
});

const CANONICAL_EXIT = [{ key: "Escape", ctrl: false, shift: false, alt: false }];

describe("useKeyBindingsStore normaliser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useKeyBindingsStore.setState({ bindings: null });
  });

  it("does NOT call setKeyBindings when exitPresentation is already canonical", async () => {
    const kb = makeKeyBindings(CANONICAL_EXIT);
    vi.mocked(invoke).mockResolvedValueOnce(kb); // getKeyBindings
    await useKeyBindingsStore.getState().load();
    // invoke called once (getKeyBindings), not a second time (setKeyBindings)
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(useKeyBindingsStore.getState().bindings?.bindings.exitPresentation).toEqual(CANONICAL_EXIT);
  });

  it("resets to canonical and calls setKeyBindings when binding is non-canonical (extra key)", async () => {
    const nonCanonical = [
      { key: "Escape", ctrl: false, shift: false, alt: false },
      { key: " ", ctrl: false, shift: false, alt: false },
    ];
    const kb = makeKeyBindings(nonCanonical);
    vi.mocked(invoke).mockResolvedValueOnce(kb); // getKeyBindings
    vi.mocked(invoke).mockResolvedValueOnce(kb); // setKeyBindings
    await useKeyBindingsStore.getState().load();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(useKeyBindingsStore.getState().bindings?.bindings.exitPresentation).toEqual(CANONICAL_EXIT);
  });

  it("resets when exitPresentation uses a non-Escape key", async () => {
    const nonCanonical = [{ key: " ", ctrl: false, shift: false, alt: false }];
    const kb = makeKeyBindings(nonCanonical);
    vi.mocked(invoke).mockResolvedValueOnce(kb);
    vi.mocked(invoke).mockResolvedValueOnce(kb);
    await useKeyBindingsStore.getState().load();
    expect(useKeyBindingsStore.getState().bindings?.bindings.exitPresentation).toEqual(CANONICAL_EXIT);
  });

  it("resets when exitPresentation has modifier flags", async () => {
    const nonCanonical = [{ key: "Escape", ctrl: true, shift: false, alt: false }];
    const kb = makeKeyBindings(nonCanonical);
    vi.mocked(invoke).mockResolvedValueOnce(kb);
    vi.mocked(invoke).mockResolvedValueOnce(kb);
    await useKeyBindingsStore.getState().load();
    expect(useKeyBindingsStore.getState().bindings?.bindings.exitPresentation).toEqual(CANONICAL_EXIT);
  });
});
