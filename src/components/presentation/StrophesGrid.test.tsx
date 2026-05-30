import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// jsdom does not implement ResizeObserver — provide a minimal stub so SlideStage
// can mount without throwing (mirrors the approach in SlideStage.test.tsx).
class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ResizeObserver = ResizeObserverStub;
  }
});

afterAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ResizeObserver;
});

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../stores/presentation", () => ({
  usePresentationStore: vi.fn(),
}));

vi.mock("../../stores/library", () => ({
  useLibraryStore: vi.fn(),
}));

vi.mock("../../stores/media", () => ({
  useMediaStore: vi.fn(),
}));

vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
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

// SongBackground uses asset:// URLs — stub it.
vi.mock("./SongBackground", () => ({
  SongBackground: () => <div data-testid="song-background-stub" />,
}));

// SlideshowRenderer may fetch slide images — stub it.
vi.mock("./SlideshowRenderer", () => ({
  SlideshowRenderer: ({
    mediaId,
    slideIndex,
  }: {
    mediaId: string;
    slideIndex: number;
  }) => (
    <div
      data-testid="slideshow-renderer-stub"
      data-media-id={mediaId}
      data-slide-index={slideIndex}
    />
  ),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { StrophesGrid } from "./StrophesGrid";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { useSettingsStore } from "../../stores/settings";
import { goToItem } from "../../api/commands";
import type { PresentationState, ServiceSet } from "../../types";

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const defaultAppearance = {
  presentationFontFamily: "sans" as const,
  presentationFontSize: "lg" as const,
  presentationPreset: "preto-branco" as const,
  presentationPosition: "center" as const,
  presentationMargin: "lg" as const,
};

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

    // Mock settings store: selector-based access
    vi.mocked(useSettingsStore).mockImplementation((selector: unknown) => {
      if (typeof selector === "function") {
        return (selector as (s: typeof defaultAppearance) => unknown)(defaultAppearance);
      }
      return defaultAppearance;
    });

    // Provide a default getState so tests that don't override it don't crash on click
    Object.assign(vi.mocked(usePresentationStore), {
      getState: vi.fn().mockReturnValue({ state: makeState() }),
    });
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
    // Slide index 2 → "Line 3" in the thumbnail content
    expect(active[0].textContent).toContain("Line 3");
  });

  // ── Test 3: Clicking card N calls goToItem(currentItemIndex, N) ──────────

  it("calls goToItem with (currentItemIndex, slideIndex) when a card is clicked", () => {
    const liveState = makeState({ currentItemIndex: 0 });
    vi.mocked(usePresentationStore).mockReturnValue({
      state: liveState,
    } as ReturnType<typeof usePresentationStore>);
    Object.assign(vi.mocked(usePresentationStore), {
      getState: vi.fn().mockReturnValue({ state: liveState }),
    });

    render(<StrophesGrid />);

    const grid = screen.getByTestId("strophes-grid");
    const buttons = grid.querySelectorAll("button");
    fireEvent.click(buttons[3]);

    expect(goToItem).toHaveBeenCalledWith(0, 3);
  });

  // ── Test 3b: Closure-staleness — getState() is read at click time ────────

  it("uses getState() currentItemIndex at click time, not the render-time closure", () => {
    // Render with currentItemIndex=0
    vi.mocked(usePresentationStore).mockReturnValue({
      state: makeState({ currentItemIndex: 0 }),
    } as ReturnType<typeof usePresentationStore>);
    // Store updates to currentItemIndex=2 before the click fires
    const liveState = makeState({ currentItemIndex: 2 });
    Object.assign(vi.mocked(usePresentationStore), {
      getState: vi.fn().mockReturnValue({ state: liveState }),
    });

    render(<StrophesGrid />);

    const grid = screen.getByTestId("strophes-grid");
    const buttons = grid.querySelectorAll("button");
    fireEvent.click(buttons[3]);

    // Must use the live index (2), not the stale render-time index (0)
    expect(goToItem).toHaveBeenCalledWith(2, 3);
    expect(goToItem).not.toHaveBeenCalledWith(0, 3);
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

  // ── Test 7: __blackout__ slide shows the blackout label ─────────────────

  it("shows the blackout label for slides with __blackout__ sectionLabel", () => {
    const slidesWithBlackout = [
      { lines: ["Amazing Grace"], sectionLabel: "Verse 1", sectionId: "s1" },
      { lines: [], sectionLabel: "__blackout__", sectionId: "s-blackout" },
    ];

    vi.mocked(usePresentationStore).mockReturnValue({
      state: makeState({}, makeSet("song", { songId: "song-1" }), [slidesWithBlackout]),
    } as ReturnType<typeof usePresentationStore>);

    render(<StrophesGrid />);

    // The badge for the blackout slide shows the i18n key (mocked as key passthrough)
    expect(screen.getByText("presentation.blackoutSlide")).toBeInTheDocument();
    // The normal slide badge still shows the section label
    expect(screen.getByText("Verse 1")).toBeInTheDocument();
  });
});
