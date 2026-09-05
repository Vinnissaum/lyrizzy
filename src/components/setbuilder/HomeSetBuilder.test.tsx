import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../stores/library", () => ({
  useLibraryStore: vi.fn(),
}));

vi.mock("../../stores/media", () => ({
  useMediaStore: vi.fn(),
}));

vi.mock("../../stores/presentation", () => ({
  usePresentationStore: vi.fn(),
}));

vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock("../../stores/sets", () => ({
  useSetsStore: vi.fn(),
}));

vi.mock("../../api/commands", () => ({
  listSongs: vi.fn().mockResolvedValue([]),
  onSongsChanged: vi.fn().mockResolvedValue(() => {}),
  onSetChanged: vi.fn().mockResolvedValue(() => {}),
  getSet: vi.fn(),
  loadSetForPresentation: vi.fn().mockResolvedValue({}),
  addSetItem: vi.fn(),
  clearOverlay: vi.fn(),
  importPresentation: vi.fn(),
  setAnnouncementOverlay: vi.fn(),
  setMediaOverlay: vi.fn(),
  setWebviewOverlay: vi.fn(),
  createSet: vi.fn(),
  updateSet: vi.fn(),
  deleteSet: vi.fn(),
  getSetPlayCount: vi.fn(),
}));

vi.mock("../set/SetBuilder", () => ({
  SetBuilder: ({ setId }: { setId: string }) => (
    <div data-testid="set-builder" data-set-id={setId} />
  ),
}));

const mockRequestPresentation = vi.fn().mockResolvedValue(undefined);
vi.mock("../presentation/PresentationLaunchProvider", () => ({
  useRequestPresentation: () => mockRequestPresentation,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import { HomeSetBuilder } from "./HomeSetBuilder";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { usePresentationStore } from "../../stores/presentation";
import { useSettingsStore } from "../../stores/settings";
import { useSetsStore } from "../../stores/sets";
import { getSet, loadSetForPresentation } from "../../api/commands";
import type { ServiceSet } from "../../types";

const setActiveSet = vi.fn().mockResolvedValue(undefined);

const baseLibraryStore = {
  activeSetId: "set-1",
  setActiveSet,
  setView: vi.fn(),
  cameraUrl: undefined,
};

const makeSet = (id: string, name: string): ServiceSet => ({
  id,
  name,
  createdAt: 0,
  updatedAt: 0,
  items: [],
});

const baseSet: ServiceSet = makeSet("set-1", "Culto");

describe("HomeSetBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLibraryStore).mockReturnValue(baseLibraryStore as ReturnType<typeof useLibraryStore>);
    vi.mocked(useMediaStore).mockReturnValue({ media: [], refresh: vi.fn() } as ReturnType<typeof useMediaStore>);
    vi.mocked(usePresentationStore).mockReturnValue({ state: null } as ReturnType<typeof usePresentationStore>);
    vi.mocked(useSettingsStore).mockReturnValue({ cameraUrl: undefined, loadCameraUrl: vi.fn() } as ReturnType<typeof useSettingsStore>);
    vi.mocked(useSetsStore).mockReturnValue({
      sets: [makeSet("set-1", "Culto Manhã"), makeSet("set-2", "Culto Noite")],
      isLoading: false,
      refresh: vi.fn().mockResolvedValue(undefined),
    } as ReturnType<typeof useSetsStore>);
    // Reset command mocks to their default resolved implementations
    mockRequestPresentation.mockReset().mockResolvedValue(undefined);
    setActiveSet.mockReset().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(loadSetForPresentation).mockResolvedValue(undefined as any);
  });

  it("renders the Apresentar button", () => {
    vi.mocked(getSet).mockResolvedValue(baseSet);
    render(<HomeSetBuilder />);
    expect(screen.getByTestId("apresentar-button")).toBeInTheDocument();
  });

  it("renders the SetPicker", () => {
    vi.mocked(getSet).mockResolvedValue(baseSet);
    render(<HomeSetBuilder />);
    expect(screen.getByTestId("set-picker-active-name")).toBeInTheDocument();
  });

  it("switching sets repoints SetBuilder's setId with no reload", () => {
    vi.mocked(getSet).mockResolvedValue(baseSet);
    const { rerender } = render(<HomeSetBuilder />);

    expect(screen.getByTestId("set-builder")).toHaveAttribute("data-set-id", "set-1");

    fireEvent.click(screen.getByRole("button", { name: /Culto Noite/ }));
    expect(setActiveSet).toHaveBeenCalledWith("set-2");

    // Simulate the store re-rendering the component with the new active set,
    // without the component ever unmounting (no reload).
    vi.mocked(useLibraryStore).mockReturnValue({
      ...baseLibraryStore,
      activeSetId: "set-2",
    } as ReturnType<typeof useLibraryStore>);
    rerender(<HomeSetBuilder />);

    expect(screen.getByTestId("set-builder")).toHaveAttribute("data-set-id", "set-2");
  });

  it("shows toast and does NOT call requestPresentation when set is empty", async () => {
    vi.mocked(getSet).mockResolvedValue({ ...baseSet, items: [] });

    render(<HomeSetBuilder />);
    fireEvent.click(screen.getByTestId("apresentar-button"));

    await waitFor(() => {
      expect(screen.getByText("error.presentation.empty_set")).toBeInTheDocument();
    });
    expect(mockRequestPresentation).not.toHaveBeenCalled();
  });

  it("shows no_monitors toast when requestPresentation rejects with presentation.no_monitors", async () => {
    const setWithItems: ServiceSet = {
      ...baseSet,
      items: [{ id: "item-1", setId: "set-1", itemType: "song", sortOrder: 0 }],
    };
    vi.mocked(getSet).mockResolvedValue(setWithItems);
    mockRequestPresentation.mockRejectedValue({ code: "presentation.no_monitors" });

    render(<HomeSetBuilder />);
    fireEvent.click(screen.getByTestId("apresentar-button"));

    await waitFor(() => {
      expect(screen.getByText("error.presentation.no_monitors")).toBeInTheDocument();
    });
  });

  it("does NOT call requestPresentation when loadSetForPresentation rejects", async () => {
    const setWithItems: ServiceSet = {
      ...baseSet,
      items: [{ id: "item-1", setId: "set-1", itemType: "song", sortOrder: 0 }],
    };
    vi.mocked(getSet).mockResolvedValue(setWithItems);
    vi.mocked(loadSetForPresentation).mockRejectedValue({ code: "some.error" });

    render(<HomeSetBuilder />);
    fireEvent.click(screen.getByTestId("apresentar-button"));

    await waitFor(() => {
      expect(screen.getByText("error.some.error")).toBeInTheDocument();
    });
    expect(mockRequestPresentation).not.toHaveBeenCalled();
  });

  it("calls requestPresentation with the active set id when set has items", async () => {
    const setWithItems: ServiceSet = {
      ...baseSet,
      items: [{ id: "item-1", setId: "set-1", itemType: "song", sortOrder: 0 }],
    };
    vi.mocked(getSet).mockResolvedValue(setWithItems);

    render(<HomeSetBuilder />);
    fireEvent.click(screen.getByTestId("apresentar-button"));

    await waitFor(() => {
      expect(mockRequestPresentation).toHaveBeenCalledWith("set-1");
    });
  });

  it("Apresentar loads the active set, even after switching", async () => {
    vi.mocked(useLibraryStore).mockReturnValue({
      ...baseLibraryStore,
      activeSetId: "set-2",
    } as ReturnType<typeof useLibraryStore>);
    const setTwoWithItems: ServiceSet = {
      ...makeSet("set-2", "Culto Noite"),
      items: [{ id: "item-1", setId: "set-2", itemType: "song", sortOrder: 0 }],
    };
    vi.mocked(getSet).mockResolvedValue(setTwoWithItems);

    render(<HomeSetBuilder />);
    fireEvent.click(screen.getByTestId("apresentar-button"));

    await waitFor(() => {
      expect(getSet).toHaveBeenCalledWith("set-2");
      expect(loadSetForPresentation).toHaveBeenCalledWith("set-2");
      expect(mockRequestPresentation).toHaveBeenCalledWith("set-2");
    });
  });

  it("disables the SetPicker while presenting", () => {
    vi.mocked(getSet).mockResolvedValue(baseSet);
    vi.mocked(usePresentationStore).mockReturnValue({
      state: { mode: "live" },
    } as ReturnType<typeof usePresentationStore>);

    render(<HomeSetBuilder />);

    expect(screen.queryByText("sets.picker.create")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Culto Noite/ }));
    expect(setActiveSet).not.toHaveBeenCalled();
  });
});
