import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  exitPresentation: vi.fn().mockResolvedValue(undefined),
  importPresentation: vi.fn().mockResolvedValue({ id: "media-1" }),
  setAnnouncementOverlay: vi.fn().mockResolvedValue(undefined),
  setMediaOverlay: vi.fn().mockResolvedValue(undefined),
  setWebviewOverlay: vi.fn().mockResolvedValue(undefined),
  addSetItem: vi.fn().mockResolvedValue(undefined),
  loadSetForPresentation: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getPresentationState: vi.fn().mockResolvedValue({ set: null }),
  OUTPUT2_LAST_SET_KEY: "output2.last_set_id",
}));

vi.mock("../../stores/sets", () => ({
  useSetsStore: vi.fn(),
}));

vi.mock("../../utils/outputDispatch", () => ({
  fanOutToMirror: vi.fn(),
  engageMirror: vi.fn().mockResolvedValue(undefined),
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

// Stub child components introduced in P7 so they don't need their own stores
vi.mock("./SetItemList", () => ({
  SetItemList: () => <div data-testid="set-item-list-stub" />,
}));

vi.mock("./StrophesGrid", () => ({
  StrophesGrid: () => <div data-testid="strophes-grid-stub" />,
}));

vi.mock("./LivePreview", () => ({
  LivePreview: () => <div data-testid="live-preview-stub" />,
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { useSettingsStore } from "../../stores/settings";
import { useSetsStore } from "../../stores/sets";
import {
  enterPresentation,
  getPresentationState,
  loadSetForPresentation,
} from "../../api/commands";
import { fanOutToMirror } from "../../utils/outputDispatch";
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

const AUDIO_DEFAULT = {
  micEnabled: false,
  micDelayMs: 0,
  cameraUnmuted: false,
  micDevice: null,
  outputDevice: null,
};

function mockSettingsSelector() {
  vi.mocked(useSettingsStore).mockImplementation((selector?: any) => {
    const s = {
      multiScreenEnabled: false,
      audio: { one: AUDIO_DEFAULT, two: AUDIO_DEFAULT },
      setOutputAudio: vi.fn(),
      cameraUrl: "",
      loadCameraUrl: vi.fn(),
    };
    return selector ? selector(s) : s;
  });
}

function setupDefaultMocks(stateOverrides?: Partial<PresentationState>) {
  const state = makePresentationState(stateOverrides);
  const storeShape = { state, focusedOutput: "one" as const };
  vi.mocked(usePresentationStore).mockImplementation((selector: any) =>
    selector ? selector(storeShape) : storeShape,
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
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useLibraryStore>);
  vi.mocked(useMediaStore).mockReturnValue({
    media: [],
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useMediaStore>);
  mockSetsSelector();
  mockSettingsSelector();
}

function mockSetsSelector(sets: { id: string; name: string }[] = []) {
  vi.mocked(useSetsStore).mockImplementation((selector?: any) => {
    const s = { sets, refresh: vi.fn() };
    return selector ? selector(s) : s;
  });
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

  it("renders all 3 pane components when state has a non-empty set", () => {
    setupDefaultMocks();
    render(<OperatorPresentationLayout />);

    expect(screen.getByTestId("set-item-list-stub")).toBeInTheDocument();
    expect(screen.getByTestId("strophes-grid-stub")).toBeInTheDocument();
    expect(screen.getByTestId("live-preview-stub")).toBeInTheDocument();
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
    vi.mocked(usePresentationStore).mockImplementation((selector: any) =>
      selector
        ? selector({ state: null, focusedOutput: "one" })
        : { state: null, focusedOutput: "one" },
    );
    vi.mocked(useLibraryStore).mockReturnValue({
      songs: [],
      fixedSetId: null,
      setView: vi.fn(),
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useLibraryStore>);
    vi.mocked(useMediaStore).mockReturnValue({
      media: [],
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useMediaStore>);
    mockSettingsSelector();

    render(<OperatorPresentationLayout />);

    expect(screen.getByText("presentation.empty")).toBeInTheDocument();
    expect(
      screen.queryByTestId("set-item-list-stub"),
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
      screen.queryByTestId("set-item-list-stub"),
    ).not.toBeInTheDocument();
  });

  it("presents the chosen set onto the focused output (Tela 2)", async () => {
    // Multi-screen on, Tela 2 focused, no set yet → the per-output picker shows.
    const storeShape = { state: null, focusedOutput: "two" as const };
    vi.mocked(usePresentationStore).mockImplementation((selector: any) =>
      selector ? selector(storeShape) : storeShape,
    );
    vi.mocked(useLibraryStore).mockReturnValue({
      songs: [],
      fixedSetId: null,
      setView: vi.fn(),
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useLibraryStore>);
    vi.mocked(useMediaStore).mockReturnValue({
      media: [],
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useMediaStore>);
    mockSetsSelector([
      { id: "set-1", name: "Culto" },
      { id: "set-2", name: "Ensaio" },
    ]);
    vi.mocked(useSettingsStore).mockImplementation((selector?: any) => {
      const s = {
        multiScreenEnabled: true,
        audio: { one: AUDIO_DEFAULT, two: AUDIO_DEFAULT },
        setOutputAudio: vi.fn(),
        cameraUrl: "",
        loadCameraUrl: vi.fn(),
      };
      return selector ? selector(s) : s;
    });

    render(<OperatorPresentationLayout />);

    fireEvent.click(screen.getByRole("button", { name: "Ensaio" }));

    await waitFor(() =>
      expect(loadSetForPresentation).toHaveBeenCalledWith("set-2", "two"),
    );
    expect(enterPresentation).toHaveBeenCalledWith("two");

    // Isolation (SEL-01/02): the focused output is targeted directly; the other
    // output is NOT loaded/presented except via mirror fan-out (which is a no-op
    // here because mirror is off — fanOutToMirror decides per the live flag).
    expect(loadSetForPresentation).not.toHaveBeenCalledWith("set-2", "one");
    expect(enterPresentation).not.toHaveBeenCalledWith("one");
    // The mirror hook is invoked for the focused output (it no-ops when off).
    expect(fanOutToMirror).toHaveBeenCalledWith("two", expect.any(Function));
  });

  it("defaults Tela 2 to Tela 1's set when Tela 2 has none", async () => {
    vi.mocked(getPresentationState).mockResolvedValue({
      set: { id: "set-1" },
    } as any);
    const storeShape = { state: null, focusedOutput: "two" as const };
    vi.mocked(usePresentationStore).mockImplementation((selector: any) =>
      selector ? selector(storeShape) : storeShape,
    );
    vi.mocked(useLibraryStore).mockReturnValue({
      songs: [],
      fixedSetId: null,
      setView: vi.fn(),
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useLibraryStore>);
    vi.mocked(useMediaStore).mockReturnValue({
      media: [],
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useMediaStore>);
    mockSetsSelector([{ id: "set-1", name: "Culto" }]);
    vi.mocked(useSettingsStore).mockImplementation((selector?: any) => {
      const s = {
        multiScreenEnabled: true,
        audio: { one: AUDIO_DEFAULT, two: AUDIO_DEFAULT },
        setOutputAudio: vi.fn(),
        cameraUrl: "",
        loadCameraUrl: vi.fn(),
      };
      return selector ? selector(s) : s;
    });

    render(<OperatorPresentationLayout />);

    // Tela 1's set is copied onto Tela 2 (operator view only — no Present yet).
    await waitFor(() =>
      expect(getPresentationState).toHaveBeenCalledWith("one"),
    );
    await waitFor(() =>
      expect(loadSetForPresentation).toHaveBeenCalledWith("set-1", "two"),
    );
    expect(enterPresentation).not.toHaveBeenCalled();
  });

  it("renders OverlayActionBar without Apresentar button", () => {
    setupDefaultMocks();
    render(<OperatorPresentationLayout />);

    // The Apresentar button must not be in the DOM when showApresentarButton=false
    expect(screen.queryByTestId("apresentar-button")).not.toBeInTheDocument();

    // But the overlay action bar itself is present (check one of its stable buttons)
    expect(
      screen.getByRole("button", { name: /home\.overlay\.image/ }),
    ).toBeInTheDocument();
  });
});
