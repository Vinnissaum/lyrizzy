import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../../stores/library", () => ({
  useLibraryStore: vi.fn(),
}));

vi.mock("../../stores/media", () => ({
  useMediaStore: vi.fn(),
}));

vi.mock("../../stores/presentation", () => ({
  usePresentationStore: vi.fn(),
}));

vi.mock("../../api/commands", () => ({
  getSet: vi.fn(),
  listSongs: vi.fn().mockResolvedValue([]),
  onSetChanged: vi.fn().mockResolvedValue(() => {}),
  addSetItem: vi.fn(),
  duplicateSetItem: vi.fn(),
  removeSetItem: vi.fn(),
  reorderSetItems: vi.fn(),
  updateSet: vi.fn(),
  importPresentation: vi.fn(),
  loadSetForPresentation: vi.fn().mockResolvedValue(undefined),
  enterPresentation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../api/assets", () => ({
  mediaUrl: (f: string) => `http://asset.localhost/media/${f}`,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

vi.mock("./CountdownSetItemEditor", () => ({ CountdownSetItemEditor: () => null }));
vi.mock("./WebViewSetItemEditor", () => ({ WebViewSetItemEditor: () => null }));
vi.mock("./MediaSetItemEditor", () => ({ MediaSetItemEditor: () => null }));
vi.mock("./BlankItemNotesEditor", () => ({ BlankItemNotesEditor: () => null }));
vi.mock("./SlideshowSetItemEditor", () => ({ SlideshowSetItemEditor: () => null }));

import { SetBuilder } from "./SetBuilder";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { usePresentationStore } from "../../stores/presentation";
import { getSet } from "../../api/commands";
import type { ServiceSet } from "../../types";

const baseSet: ServiceSet = {
  id: "set-1",
  name: "Culto",
  createdAt: 0,
  updatedAt: 0,
  items: [{ id: "item-1", setId: "set-1", itemType: "song", sortOrder: 0 }],
};

describe("SetBuilder — hidePresentButton prop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLibraryStore).mockReturnValue({ setView: vi.fn() } as ReturnType<typeof useLibraryStore>);
    vi.mocked(useMediaStore).mockReturnValue({ media: [], refresh: vi.fn() } as ReturnType<typeof useMediaStore>);
    vi.mocked(usePresentationStore).mockReturnValue({ getState: vi.fn() } as unknown as ReturnType<typeof usePresentationStore>);
    vi.mocked(getSet).mockResolvedValue(baseSet);
  });

  it("renders the Apresentar button when hidePresentButton is not set", async () => {
    render(<SetBuilder setId="set-1" />);
    await waitFor(() =>
      expect(screen.getByText("builder.present")).toBeInTheDocument()
    );
  });

  it("does NOT render the Apresentar button when hidePresentButton is true", async () => {
    render(<SetBuilder setId="set-1" hidePresentButton />);
    await waitFor(() =>
      expect(screen.getByText("Culto")).toBeInTheDocument()
    );
    expect(screen.queryByText("builder.present")).toBeNull();
  });
});
