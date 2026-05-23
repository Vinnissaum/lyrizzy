import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

import { StrophesGrid } from "./StrophesGrid";

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

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const makeSongSlides = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    lines: [`Line ${i + 1}`],
    sectionLabel: `Verse ${i + 1}`,
    sectionId: `s${i + 1}`,
  }));

const makeSet = (itemType: string, extra: Record<string, unknown> = {}): ServiceSet => ({
  id: "set-1",
  name: "Culto",
  createdAt: 0,
  updatedAt: 0,
  items: [
    {
      id: "item-1",
      setId: "set-1",
      itemType: itemType as ServiceSet["items"][number]["itemType"],
      sortOrder: 0,
      ...extra,
    },
  ],
});

const makeState = (
  overrides: Partial<PresentationState> = {},
  set?: ServiceSet,
  slides?: PresentationState["allSlidesPerItem"],
): PresentationState => ({
  mode: "live",
  currentItemIndex: 0,
  currentSlideIndex: 0,
  itemSlideCounts: [slides?.[0]?.length ?? 0],
  set: set ?? makeSet("song", { songId: "song-1" }),
  allSlidesPerItem: slides ?? [makeSongSlides(6)],
  ...overrides,
});

describe("StrophesGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLibraryStore).mockReturnValue({
      songs: [
        {
          id: "song-1",
          title: "Awesome Song",
          artist: "",
          sections: [],
          language: "pt",
          scrimOpacity: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    } as ReturnType<typeof useLibraryStore>);
    vi.mocked(useMediaStore).mockReturnValue({
      media: [],
    } as ReturnType<typeof useMediaStore>);
  });

  // ── Test 1: Song with 6 slides renders 6 cards ───────────────────────────

  it("renders 6 cards for a song with 6 slides", () => {
    vi.mocked(usePresentationStore).mockReturnValue({
      state: makeState(),
    } as ReturnType<typeof usePresentationStore>);

    render(<StrophesGrid />);

    const grid = screen.getByTestId("strophes-grid");
    const buttons = grid.querySelectorAll("button");
    expect(buttons).toHaveLength(6);
  });

  // ── Test 2: Active slide has aria-current="true" ─────────────────────────

  it("sets aria-current on the active slide card", () => {
    vi.mocked(usePresentationStore).mockReturnValue({
      state: makeState({ currentSlideIndex: 2 }),
    } as ReturnType<typeof usePresentationStore>);

    render(<StrophesGrid />);

    const active = document.querySelectorAll('[aria-current="true"]');
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toContain("Line 3");
  });

  // ── Test 3: Clicking card N calls goToItem(currentItemIndex, N) ──────────

  it("calls goToItem with (currentItemIndex, slideIndex) when a card is clicked", () => {
    vi.mocked(usePresentationStore).mockReturnValue({
      state: makeState({ currentItemIndex: 0 }),
    } as ReturnType<typeof usePresentationStore>);

    render(<StrophesGrid />);

    const grid = screen.getByTestId("strophes-grid");
    const buttons = grid.querySelectorAll("button");
    fireEvent.click(buttons[3]);

    expect(goToItem).toHaveBeenCalledWith(0, 3);
  });

  // ── Test 4: Countdown item renders a single info card ───────────────────

  it("renders a single info card (not a grid) for countdown items", () => {
    const countdownSet = makeSet("countdown", {
      countdownConfig: {
        target: { kind: "duration", durationMs: 300000 },
        endBehavior: "holdZero",
      },
    });

    vi.mocked(usePresentationStore).mockReturnValue({
      state: makeState(
        {},
        countdownSet,
        [[{ lines: [], sectionLabel: "", sectionId: "" }]],
      ),
    } as ReturnType<typeof usePresentationStore>);

    render(<StrophesGrid />);

    expect(screen.queryByTestId("strophes-grid")).toBeNull();
    expect(screen.getByText("presentation.singleItem.hint")).toBeInTheDocument();
  });

  // ── Test 5: Empty slides array → empty-state text ───────────────────────

  it("shows empty-state text when slides array is empty", () => {
    vi.mocked(usePresentationStore).mockReturnValue({
      state: makeState({}, makeSet("song", { songId: "song-1" }), [[]]),
    } as ReturnType<typeof usePresentationStore>);

    render(<StrophesGrid />);

    expect(screen.queryByTestId("strophes-grid")).toBeNull();
    expect(screen.getByText("presentation.noSlides")).toBeInTheDocument();
  });

  // ── Test 6: SlideShow labels cards "Slide 1", "Slide 2", … ──────────────

  it("labels slideshow cards as 'Slide 1', 'Slide 2', etc.", () => {
    const slideshowSet = makeSet("slide_show", { mediaId: "pres-1" });
    const slideshowSlides = [
      { lines: [], sectionLabel: "", sectionId: "" },
      { lines: [], sectionLabel: "", sectionId: "" },
      { lines: [], sectionLabel: "", sectionId: "" },
    ];

    vi.mocked(usePresentationStore).mockReturnValue({
      state: makeState({}, slideshowSet, [slideshowSlides]),
    } as ReturnType<typeof usePresentationStore>);

    vi.mocked(useMediaStore).mockReturnValue({
      media: [
        {
          id: "pres-1",
          fileName: "pres.pptx",
          displayName: "My Slides",
          kind: "presentation",
          mimeType: "application/pdf",
          byteSize: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    } as ReturnType<typeof useMediaStore>);

    render(<StrophesGrid />);

    expect(screen.getByText("Slide 1")).toBeInTheDocument();
    expect(screen.getByText("Slide 2")).toBeInTheDocument();
    expect(screen.getByText("Slide 3")).toBeInTheDocument();
  });
});
