import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();
import { PresentationNavigator } from "./PresentationNavigator";

vi.mock("../../stores/presentation", () => ({
  usePresentationStore: vi.fn(),
}));

vi.mock("../../stores/library", () => ({
  useLibraryStore: vi.fn(),
}));

vi.mock("../../stores/media", () => ({
  useMediaStore: vi.fn(),
}));

vi.mock("../../api/commands", () => ({
  goToItem: vi.fn().mockResolvedValue({}),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { goToItem } from "../../api/commands";
import type { PresentationState, ServiceSet } from "../../types";

const songSlides = [
  { lines: ["Santo, Santo, Santo"], sectionLabel: "Verse 1", sectionId: "s1" },
  { lines: ["É o Senhor"], sectionLabel: "Chorus", sectionId: "s2" },
];

const mockSet: ServiceSet = {
  id: "set-1",
  name: "Culto",
  createdAt: 0,
  updatedAt: 0,
  items: [
    { id: "item-1", setId: "set-1", itemType: "song", songId: "song-1", sortOrder: 0 },
    { id: "item-2", setId: "set-1", itemType: "countdown", sortOrder: 1,
      countdownConfig: { target: { kind: "duration", durationMs: 600000 }, endBehavior: "holdZero" } },
  ],
};

const makePresentationState = (overrides: Partial<PresentationState> = {}): PresentationState => ({
  mode: "live",
  currentItemIndex: 0,
  currentSlideIndex: 0,
  itemSlideCounts: [2, 1],
  allSlidesPerItem: [
    songSlides,
    [{ lines: [], sectionLabel: "", sectionId: "" }],
  ],
  set: mockSet,
  ...overrides,
});

describe("PresentationNavigator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLibraryStore).mockReturnValue({ songs: [{ id: "song-1", title: "Santo", artist: "", sections: [], language: "pt", scrimOpacity: 0, createdAt: 0, updatedAt: 0 }] } as ReturnType<typeof useLibraryStore>);
    vi.mocked(useMediaStore).mockReturnValue({ media: [] } as ReturnType<typeof useMediaStore>);
  });

  it("renders cards for all slides in a 2-item set (Song + Countdown)", () => {
    vi.mocked(usePresentationStore).mockReturnValue({
      state: makePresentationState(),
    } as ReturnType<typeof usePresentationStore>);

    render(<PresentationNavigator />);

    expect(screen.getByText("Santo, Santo, Santo")).toBeInTheDocument();
    expect(screen.getByText("É o Senhor")).toBeInTheDocument();
  });

  it("marks the current slide with aria-current", () => {
    vi.mocked(usePresentationStore).mockReturnValue({
      state: makePresentationState({ currentItemIndex: 0, currentSlideIndex: 1 }),
    } as ReturnType<typeof usePresentationStore>);

    render(<PresentationNavigator />);

    const cards = document.querySelectorAll('[aria-current="true"]');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain("É o Senhor");
  });

  it("calls goToItem with correct indices on card click", async () => {
    vi.mocked(usePresentationStore).mockReturnValue({
      state: makePresentationState(),
    } as ReturnType<typeof usePresentationStore>);

    render(<PresentationNavigator />);

    const secondSlide = screen.getByText("É o Senhor").closest('[role="button"]')!;
    fireEvent.click(secondSlide);

    expect(goToItem).toHaveBeenCalledWith(0, 1);
  });

  it("renders a SlideShow item with one card per slide", () => {
    const slideshowSet: ServiceSet = {
      id: "set-2",
      name: "Culto",
      createdAt: 0,
      updatedAt: 0,
      items: [
        { id: "item-1", setId: "set-2", itemType: "slide_show", mediaId: "pres-1", sortOrder: 0 },
      ],
    };

    vi.mocked(usePresentationStore).mockReturnValue({
      state: {
        mode: "live",
        currentItemIndex: 0,
        currentSlideIndex: 0,
        itemSlideCounts: [3],
        allSlidesPerItem: [
          [
            { lines: [], sectionLabel: "", sectionId: "" },
            { lines: [], sectionLabel: "", sectionId: "" },
            { lines: [], sectionLabel: "", sectionId: "" },
          ],
        ],
        set: slideshowSet,
      },
    } as ReturnType<typeof usePresentationStore>);

    vi.mocked(useMediaStore).mockReturnValue({
      media: [{ id: "pres-1", fileName: "pres.pptx", displayName: "My Slides", kind: "presentation", mimeType: "application/pdf", byteSize: 0, createdAt: 0, updatedAt: 0 }],
    } as ReturnType<typeof useMediaStore>);

    render(<PresentationNavigator />);

    expect(screen.getByText("Slide 1/3")).toBeInTheDocument();
    expect(screen.getByText("Slide 2/3")).toBeInTheDocument();
    expect(screen.getByText("Slide 3/3")).toBeInTheDocument();
  });

  it("shows no-set message when state is null", () => {
    vi.mocked(usePresentationStore).mockReturnValue({
      state: null,
    } as ReturnType<typeof usePresentationStore>);

    render(<PresentationNavigator />);
    expect(screen.getByText("presentation.noSetLoaded")).toBeInTheDocument();
  });
});
