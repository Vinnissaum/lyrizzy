import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperatorPresentationLayout } from "./OperatorPresentationLayout";

// ── Module mocks ──────────────────────────────────────────────────────────────

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
  clearOverlay: vi.fn().mockResolvedValue(undefined),
  enterPresentation: vi.fn().mockResolvedValue(undefined),
  importPresentation: vi.fn().mockResolvedValue({ id: "media-1" }),
  setAnnouncementOverlay: vi.fn().mockResolvedValue(undefined),
  setMediaOverlay: vi.fn().mockResolvedValue(undefined),
  setWebviewOverlay: vi.fn().mockResolvedValue(undefined),
  addSetItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { useSettingsStore } from "../../stores/settings";
import type { PresentationState, ServiceSet } from "../../types";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const mockSet: ServiceSet = {
  id: "set-1",
  name: "Culto",
  createdAt: 0,
  updatedAt: 0,
  items: [
    {
      id: "item-1",
      setId: "set-1",
      itemType: "song",
      songId: "song-1",
      sortOrder: 0,
    },
    {
      id: "item-2",
      setId: "set-1",
      itemType: "countdown",
      sortOrder: 1,
      countdownConfig: {
        target: { kind: "duration", durationMs: 600000 },
        endBehavior: "holdZero",
      },
    },
  ],
};

const makePresentationState = (
  overrides: Partial<PresentationState> = {},
): PresentationState => ({
  mode: "live",
  currentItemIndex: 0,
  currentSlideIndex: 0,
  itemSlideCounts: [2, 1],
  allSlidesPerItem: [
    [{ lines: ["Santo"], sectionLabel: "Verse", sectionId: "s1" }],
    [{ lines: [], sectionLabel: "", sectionId: "" }],
  ],
  set: mockSet,
  ...overrides,
});

function setupDefaultMocks(stateOverrides?: Partial<PresentationState>) {
  vi.mocked(usePresentationStore).mockReturnValue(
    makePresentationState(stateOverrides) as unknown as ReturnType<
      typeof usePresentationStore
    >,
  );
  vi.mocked(useLibraryStore).mockReturnValue({
    songs: [
      {
        id: "song-1",
        title: "Santo",
        artist: "",
        sections: [],
        language: "pt",
        scrimOpacity: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    ],
    fixedSetId: "set-1",
    setView: vi.fn(),
  } as unknown as ReturnType<typeof useLibraryStore>);
  vi.mocked(useMediaStore).mockReturnValue({
    media: [],
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useMediaStore>);
  vi.mocked(useSettingsStore).mockReturnValue({
    cameraUrl: "",
    loadCameraUrl: vi.fn(),
  } as unknown as ReturnType<typeof useSettingsStore>);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("OperatorPresentationLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the root data-testid", () => {
    setupDefaultMocks();
    render(<OperatorPresentationLayout />);
    expect(
      screen.getByTestId("operator-presentation-layout"),
    ).toBeInTheDocument();
  });

  it("renders all 3 pane stubs when state has a non-empty set", () => {
    setupDefaultMocks();
    render(<OperatorPresentationLayout />);

    expect(screen.getByTestId("set-pane-stub")).toBeInTheDocument();
    expect(screen.getByTestId("strophes-pane-stub")).toBeInTheDocument();
    expect(screen.getByTestId("live-pane-stub")).toBeInTheDocument();
  });

  it("renders pane header i18n keys", () => {
    setupDefaultMocks();
    render(<OperatorPresentationLayout />);

    expect(screen.getByText("presentation.pane.set")).toBeInTheDocument();
    expect(
      screen.getByText(/presentation\.pane\.strophes/),
    ).toBeInTheDocument();
    expect(screen.getByText("presentation.pane.live")).toBeInTheDocument();
  });

  it("renders empty-state placeholder when state has no set", () => {
    vi.mocked(usePresentationStore).mockReturnValue(
      null as unknown as ReturnType<typeof usePresentationStore>,
    );
    vi.mocked(useLibraryStore).mockReturnValue({
      songs: [],
      fixedSetId: null,
      setView: vi.fn(),
    } as unknown as ReturnType<typeof useLibraryStore>);
    vi.mocked(useMediaStore).mockReturnValue({
      media: [],
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useMediaStore>);
    vi.mocked(useSettingsStore).mockReturnValue({
      cameraUrl: "",
      loadCameraUrl: vi.fn(),
    } as unknown as ReturnType<typeof useSettingsStore>);

    render(<OperatorPresentationLayout />);

    expect(screen.getByText("presentation.empty")).toBeInTheDocument();
    expect(
      screen.queryByTestId("set-pane-stub"),
    ).not.toBeInTheDocument();
  });

  it("renders empty-state placeholder when set has no items", () => {
    const emptySet: ServiceSet = {
      id: "set-empty",
      name: "Empty",
      createdAt: 0,
      updatedAt: 0,
      items: [],
    };
    setupDefaultMocks({ set: emptySet });

    render(<OperatorPresentationLayout />);

    expect(screen.getByText("presentation.empty")).toBeInTheDocument();
    expect(
      screen.queryByTestId("set-pane-stub"),
    ).not.toBeInTheDocument();
  });

  it("renders OverlayActionBar without Apresentar button", () => {
    setupDefaultMocks();
    render(<OperatorPresentationLayout />);

    // The Apresentar button must not be in the DOM when showApresentarButton=false
    expect(screen.queryByTestId("apresentar-button")).not.toBeInTheDocument();

    // But the overlay action bar itself is present (check one of its stable buttons)
    expect(
      screen.getByRole("button", { name: /home\.overlay\.oferta/ }),
    ).toBeInTheDocument();
  });
});
