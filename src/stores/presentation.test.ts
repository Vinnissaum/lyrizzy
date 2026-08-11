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

describe("usePresentationStore — slide preservation across slim payloads", () => {
  const slides = [[{ lines: ["A"], sectionLabel: "Verse", sectionId: "s1" }]];
  const withSet = (
    setId: string,
    allSlidesPerItem?: PresentationState["allSlidesPerItem"],
  ): PresentationState => ({
    ...makeState(0, 0),
    set: { id: setId, name: "Culto", createdAt: 0, updatedAt: 0, items: [] },
    allSlidesPerItem,
  });

  let captured: (s: PresentationState) => void;
  beforeEach(async () => {
    vi.clearAllMocks();
    usePresentationStore.setState({ state: null, pendingSelection: null, isSubscribed: false });
    vi.mocked(onStateChanged).mockImplementation((cb) => {
      captured = cb;
      return Promise.resolve(() => {});
    });
    // Hydrate with a loaded set that carries the full slides.
    vi.mocked(getPresentationState).mockResolvedValue(withSet("set-1", slides));
    await usePresentationStore.getState().subscribe();
  });

  it("keeps the last-known slides when a same-set navigation patch omits them", () => {
    // Navigation event for the SAME set, slim (no slides).
    captured(withSet("set-1", []));
    expect(usePresentationStore.getState().state?.allSlidesPerItem).toBe(slides);
  });

  it("replaces slides when a payload actually carries them (set reload)", () => {
    const newSlides = [[{ lines: ["B"], sectionLabel: "Chorus", sectionId: "s2" }]];
    captured(withSet("set-2", newSlides));
    expect(usePresentationStore.getState().state?.allSlidesPerItem).toBe(newSlides);
  });

  it("does not leak stale slides onto a different set", () => {
    // A slim patch for a DIFFERENT set must not inherit the old slides.
    captured(withSet("set-2", []));
    expect(usePresentationStore.getState().state?.allSlidesPerItem).toEqual([]);
  });

  // ── P15-03 regression pins: non-empty incoming allSlidesPerItem, same set id ──
  //
  // These pin the exact branch P15-03's live-edit refresh depends on: when the
  // incoming payload for the SAME set carries a non-empty `allSlidesPerItem`,
  // reconcileSlides takes it verbatim — the previous copy is discarded, not
  // merged — so edits (adding/removing/reordering strophes) show up immediately.

  it("takes a longer incoming slide list verbatim (strophe added) for the same set", () => {
    const longerSlides = [
      [
        { lines: ["A"], sectionLabel: "Verse", sectionId: "s1" },
        { lines: ["A2"], sectionLabel: "Verse 2", sectionId: "s1b" },
      ],
    ];
    captured(withSet("set-1", longerSlides));
    expect(usePresentationStore.getState().state?.allSlidesPerItem).toBe(longerSlides);
  });

  it("takes a shorter incoming slide list verbatim (strophe removed) for the same set", () => {
    // Previous copy (hydrated in beforeEach) has 1 slide; incoming still has 1
    // but with different content, proving it's not merged/padded from the prior copy.
    const shorterSlides = [[{ lines: ["Only"], sectionLabel: "Chorus", sectionId: "s-only" }]];
    captured(withSet("set-1", shorterSlides));
    expect(usePresentationStore.getState().state?.allSlidesPerItem).toBe(shorterSlides);
    expect(usePresentationStore.getState().state?.allSlidesPerItem).not.toBe(slides);
  });

  it("takes a reordered incoming slide list verbatim for the same set", () => {
    const reorderedSlides = [
      [
        { lines: ["B"], sectionLabel: "Chorus", sectionId: "s2" },
        { lines: ["A"], sectionLabel: "Verse", sectionId: "s1" },
      ],
    ];
    captured(withSet("set-1", reorderedSlides));
    expect(usePresentationStore.getState().state?.allSlidesPerItem).toBe(reorderedSlides);
    expect(usePresentationStore.getState().state?.allSlidesPerItem?.[0][0].sectionId).toBe("s2");
  });
});
