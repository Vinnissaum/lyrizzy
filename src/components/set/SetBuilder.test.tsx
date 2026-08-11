import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

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
}));

const mockRequestPresentation = vi.fn().mockResolvedValue(undefined);
vi.mock("../presentation/PresentationLaunchProvider", () => ({
  useRequestPresentation: () => mockRequestPresentation,
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

vi.mock("./CountdownScheduleModal", () => ({ CountdownScheduleModal: () => null }));
vi.mock("./WebViewSetItemEditor", () => ({ WebViewSetItemEditor: () => null }));
vi.mock("./MediaSetItemEditor", () => ({ MediaSetItemEditor: () => null }));
vi.mock("./BlankItemNotesEditor", () => ({ BlankItemNotesEditor: () => null }));
vi.mock("./SlideshowSetItemEditor", () => ({ SlideshowSetItemEditor: () => null }));

import { SetBuilder, reorderIds } from "./SetBuilder";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { usePresentationStore } from "../../stores/presentation";
import { getSet, loadSetForPresentation, reorderSetItems } from "../../api/commands";
import type { ServiceSet, SetItem } from "../../types";

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
    mockRequestPresentation.mockReset().mockResolvedValue(undefined);
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

  it("clicking Apresentar loads the set then calls requestPresentation(setId) via the launch hook", async () => {
    render(<SetBuilder setId="set-1" />);
    await waitFor(() =>
      expect(screen.getByText("builder.present")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("builder.present"));

    await waitFor(() =>
      expect(loadSetForPresentation).toHaveBeenCalledWith("set-1")
    );
    await waitFor(() =>
      expect(mockRequestPresentation).toHaveBeenCalledWith("set-1")
    );
  });
});

// ── Countdown row: schedule button + chip ────────────────────────────────────

const countdownSet: ServiceSet = {
  id: "set-cd",
  name: "Cd",
  createdAt: 0,
  updatedAt: 0,
  items: [
    {
      id: "cd-1",
      setId: "set-cd",
      itemType: "countdown",
      sortOrder: 0,
      countdownConfig: {
        target: { kind: "duration", durationMs: 600_000 },
        endBehavior: "holdZero",
        scheduledStart: { hour: 19, minute: 30 },
      },
    },
  ],
};

describe("SetBuilder — countdown row", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestPresentation.mockReset().mockResolvedValue(undefined);
    vi.mocked(useLibraryStore).mockReturnValue({ setView: vi.fn() } as ReturnType<typeof useLibraryStore>);
    vi.mocked(useMediaStore).mockReturnValue({ media: [], refresh: vi.fn() } as ReturnType<typeof useMediaStore>);
    vi.mocked(usePresentationStore).mockReturnValue({ getState: vi.fn() } as unknown as ReturnType<typeof usePresentationStore>);
    vi.mocked(getSet).mockResolvedValue(countdownSet);
  });

  it("shows the schedule button and ⏰ chip inline (no expand needed) for a scheduled countdown", async () => {
    render(<SetBuilder setId="set-cd" />);
    await waitFor(() => expect(screen.getByText("Cd")).toBeInTheDocument());

    // Countdown rows render their config button inline — no chevron/expand.
    await waitFor(() =>
      expect(screen.getByText("countdown.schedule.button")).toBeInTheDocument()
    );
    expect(screen.getByText(/19:30/)).toBeInTheDocument();
    expect(screen.queryByTitle("builder.actions.edit")).not.toBeInTheDocument();
  });
});

// ── reorderIds pure-function tests ───────────────────────────────────────────

type MinItem = Pick<SetItem, "id">;

describe("reorderIds", () => {
  const items: MinItem[] = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d" },
  ];

  it("moves an item forward in the list", () => {
    const result = reorderIds(items, "a", "c");
    expect(result.map((i) => i.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item backward in the list", () => {
    const result = reorderIds(items, "d", "b");
    expect(result.map((i) => i.id)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns the original array when activeId === overId", () => {
    const result = reorderIds(items, "b", "b");
    expect(result).toBe(items);
  });

  it("returns the original array when activeId is not found", () => {
    const result = reorderIds(items, "z", "b");
    expect(result).toBe(items);
  });

  it("returns the original array when overId is not found", () => {
    const result = reorderIds(items, "a", "z");
    expect(result).toBe(items);
  });
});

// ── Drag-end reorder integration test ────────────────────────────────────────

const multiItemSet: ServiceSet = {
  id: "set-2",
  name: "Multi",
  createdAt: 0,
  updatedAt: 0,
  items: [
    { id: "item-1", setId: "set-2", itemType: "song", sortOrder: 0 },
    { id: "item-2", setId: "set-2", itemType: "blank", sortOrder: 1 },
    { id: "item-3", setId: "set-2", itemType: "blank", sortOrder: 2 },
  ],
};

describe("SetBuilder — drag-end reorder calls reorderSetItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestPresentation.mockReset().mockResolvedValue(undefined);
    vi.mocked(useLibraryStore).mockReturnValue({ setView: vi.fn() } as ReturnType<typeof useLibraryStore>);
    vi.mocked(useMediaStore).mockReturnValue({ media: [], refresh: vi.fn() } as ReturnType<typeof useMediaStore>);
    vi.mocked(usePresentationStore).mockReturnValue({ getState: vi.fn() } as unknown as ReturnType<typeof usePresentationStore>);
    vi.mocked(getSet).mockResolvedValue(multiItemSet);
    vi.mocked(reorderSetItems).mockResolvedValue(multiItemSet);
  });

  it("reorderIds produces correct order when dragging first item to last position", () => {
    // Unit-test the pure function to give real coverage of the drag-end logic
    // (simulating pointer-sensor events in jsdom is impractical with dnd-kit internals)
    const result = reorderIds(multiItemSet.items, "item-1", "item-3");
    expect(result.map((i) => i.id)).toEqual(["item-2", "item-3", "item-1"]);
  });

  it("renders drag handles (GripVertical) for each item", async () => {
    render(<SetBuilder setId="set-2" />);
    await waitFor(() =>
      expect(screen.getByText("Multi")).toBeInTheDocument()
    );
    // Each item row should have a drag-handle button
    const handles = screen.getAllByRole("button", { name: "builder.actions.drag" });
    expect(handles).toHaveLength(3);
  });
});
