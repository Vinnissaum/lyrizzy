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
  enterPresentation: vi.fn().mockResolvedValue(undefined),
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
import { enterPresentation, getSet } from "../../api/commands";
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
  });

  it("renders the Apresentar button", () => {
    vi.mocked(getSet).mockResolvedValue(baseSet);
    render(<HomeSetBuilder />);
    expect(screen.getByTestId("apresentar-button")).toBeInTheDocument();
  });

  it("shows toast and does NOT call enterPresentation when set is empty", async () => {
    vi.mocked(getSet).mockResolvedValue({ ...baseSet, items: [] });

    render(<HomeSetBuilder />);
    fireEvent.click(screen.getByTestId("apresentar-button"));

    await waitFor(() => {
      expect(screen.getByText("presentation.emptySet")).toBeInTheDocument();
    });
    expect(enterPresentation).not.toHaveBeenCalled();
  });

  it("calls enterPresentation when set has items", async () => {
    const setWithItems: ServiceSet = {
      ...baseSet,
      items: [{ id: "item-1", setId: "set-1", itemType: "song", sortOrder: 0 }],
    };
    vi.mocked(getSet).mockResolvedValue(setWithItems);

    render(<HomeSetBuilder />);
    fireEvent.click(screen.getByTestId("apresentar-button"));

    await waitFor(() => {
      expect(enterPresentation).toHaveBeenCalled();
    });
  });
});
