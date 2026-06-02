import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/commands", () => ({
  getPresentationState: vi.fn(),
  goToItem: vi.fn(),
  nextSlide: vi.fn(),
  prevSlide: vi.fn(),
  setPresentationMode: vi.fn(),
  onStateChanged: vi.fn(),
}));

import {
  getPresentationState,
  goToItem,
  onStateChanged,
} from "../api/commands";
import { usePresentationStore } from "./presentation";
import type { PresentationState } from "../types";

const makeState = (
  currentItemIndex: number,
  currentSlideIndex: number
): PresentationState => ({
  currentItemIndex,
  currentSlideIndex,
  mode: "live",
  itemSlideCounts: [],
});

describe("usePresentationStore — optimistic selectSlide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePresentationStore.setState({
      state: null,
      pendingSelection: null,
      isSubscribed: false,
    });
  });

  it("(a) sets pendingSelection synchronously, before goToItem resolves", () => {
    // Never-resolving promise so we can inspect the synchronous side effect.
    vi.mocked(goToItem).mockReturnValue(new Promise(() => {}));

    void usePresentationStore.getState().selectSlide(2, 5);

    expect(usePresentationStore.getState().pendingSelection).toEqual({
      itemIndex: 2,
      slideIndex: 5,
    });
  });

  it("(b) on resolve sets authoritative state and clears pendingSelection", async () => {
    const authoritative = makeState(2, 5);
    vi.mocked(goToItem).mockResolvedValue(authoritative);

    await usePresentationStore.getState().selectSlide(2, 5);

    expect(usePresentationStore.getState().state).toEqual(authoritative);
    expect(usePresentationStore.getState().pendingSelection).toBeNull();
  });

  it("(c) on reject clears pendingSelection and does not throw", async () => {
    vi.mocked(goToItem).mockRejectedValue(new Error("boom"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      usePresentationStore.getState().selectSlide(1, 0)
    ).resolves.toBeUndefined();

    expect(usePresentationStore.getState().pendingSelection).toBeNull();
    errSpy.mockRestore();
  });

  it("(d) a state_changed event clears a standing pendingSelection", async () => {
    let captured: ((s: PresentationState) => void) | undefined;
    vi.mocked(onStateChanged).mockImplementation((cb) => {
      captured = cb;
      return Promise.resolve(() => {});
    });
    vi.mocked(getPresentationState).mockResolvedValue(makeState(0, 0));

    await usePresentationStore.getState().subscribe();

    // Stand up an optimistic selection.
    usePresentationStore.setState({
      pendingSelection: { itemIndex: 3, slideIndex: 1 },
    });

    const authoritative = makeState(4, 2);
    captured?.(authoritative);

    expect(usePresentationStore.getState().pendingSelection).toBeNull();
    expect(usePresentationStore.getState().state).toEqual(authoritative);
  });
});
