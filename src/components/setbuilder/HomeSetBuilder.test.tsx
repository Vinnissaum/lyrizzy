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

vi.mock("../../api/commands", () => ({
  listSongs: vi.fn().mockResolvedValue([]),
  onSongsChanged: vi.fn().mockResolvedValue(() => {}),
  getSet: vi.fn(),
  loadSetForPresentation: vi.fn().mockResolvedValue({}),
  addSetItem: vi.fn(),
  clearOverlay: vi.fn(),
  importPresentation: vi.fn(),
  setAnnouncementOverlay: vi.fn(),
  setMediaOverlay: vi.fn(),
  setWebviewOverlay: vi.fn(),
}));

vi.mock("../set/SetBuilder", () => ({
  SetBuilder: () => <div data-testid="set-builder" />,
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
import { getSet, loadSetForPresentation } from "../../api/commands";
import type { ServiceSet } from "../../types";

const baseLibraryStore = {
  fixedSetId: "set-1",
  setView: vi.fn(),
  cameraUrl: undefined,
};

const baseSet: ServiceSet = {
  id: "set-1",
  name: "Culto",
  createdAt: 0,
  updatedAt: 0,
  items: [],
};

describe("HomeSetBuilder — Apresentar button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLibraryStore).mockReturnValue(baseLibraryStore as ReturnType<typeof useLibraryStore>);
    vi.mocked(useMediaStore).mockReturnValue({ media: [], refresh: vi.fn() } as ReturnType<typeof useMediaStore>);
    vi.mocked(usePresentationStore).mockReturnValue({ state: null } as ReturnType<typeof usePresentationStore>);
    vi.mocked(useSettingsStore).mockReturnValue({ cameraUrl: undefined, loadCameraUrl: vi.fn() } as ReturnType<typeof useSettingsStore>);
    // Reset command mocks to their default resolved implementations
    mockRequestPresentation.mockReset().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(loadSetForPresentation).mockResolvedValue(undefined as any);
  });

  it("renders the Apresentar button", () => {
    vi.mocked(getSet).mockResolvedValue(baseSet);
    render(<HomeSetBuilder />);
    expect(screen.getByTestId("apresentar-button")).toBeInTheDocument();
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

  it("calls requestPresentation(setId) via the launch hook when set has items", async () => {
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
});
