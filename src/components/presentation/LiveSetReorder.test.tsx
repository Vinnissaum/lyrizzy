import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import type { DragEndEvent } from "@dnd-kit/core";
import { OperatorPresentationLayout } from "./OperatorPresentationLayout";
import { SetItemList } from "./SetItemList";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useCountdownStore } from "../../stores/countdown";
import type { PresentationState, ServiceSet, SetItem, Song } from "../../types";

// P23 S3: reordering the live set. The real layout, set list and stores; the
// backend (invoke) is stubbed. jsdom has no layout, so dnd-kit cannot run a
// pointer or keyboard drag here: the drop is delivered straight to the list's
// drop handler, and the gestures themselves are walked in a real browser (C17).

let drop: ((event: DragEndEvent) => void) | undefined;

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({
      children,
      onDragEnd,
    }: {
      children: React.ReactNode;
      onDragEnd: (event: DragEndEvent) => void;
    }) => {
      drop = onDragEnd;
      return <>{children}</>;
    },
  };
});
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));
vi.mock("./StrophesGrid", () => ({
  StrophesGrid: () => <div data-testid="strophes-grid-stub" />,
}));
vi.mock("./LivePreview", () => ({
  LivePreview: () => <div data-testid="live-preview-stub" />,
}));
vi.mock("./OutputSwitcher", () => ({
  OutputSwitcher: () => null,
}));
vi.mock("./MicSwitch", () => ({
  MicSwitch: () => null,
}));
vi.mock("./StreamProfileSwitcher", () => ({
  StreamProfileSwitcher: () => null,
}));

import { invoke } from "@tauri-apps/api/core";

const song = (id: string, title: string): Song =>
  ({ id, title, artist: "", language: "pt", scrimOpacity: 35, createdAt: 0, updatedAt: 0, sections: [] }) as Song;

const songItem = (id: string, sortOrder: number): SetItem => ({
  id,
  setId: "set-1",
  itemType: "song",
  songId: `song-${id}`,
  sortOrder,
});

const countdownItem = (id: string, sortOrder: number): SetItem => ({
  id,
  setId: "set-1",
  itemType: "countdown",
  sortOrder,
  countdownConfig: {
    target: { kind: "duration", durationMs: 600_000 },
    name: "Regressivo",
    endBehavior: "holdZero",
    scheduledStart: { hour: 19, minute: 0 },
  },
});

function setOf(items: SetItem[]): ServiceSet {
  return { id: "set-1", name: "Culto", createdAt: 0, updatedAt: 0, items };
}

/** Live on the second item. */
function liveOn(items: SetItem[]): PresentationState {
  return {
    mode: "live",
    currentItemIndex: 1,
    currentSlideIndex: 0,
    itemSlideCounts: items.map(() => 2),
    set: setOf(items),
  };
}

let reorderResult: "ok" | "refuse";

function backend(state: PresentationState) {
  vi.mocked(invoke).mockImplementation((cmd: string, args?: any) => {
    switch (cmd) {
      case "list_songs":
        return Promise.resolve(["A", "B", "C", "D"].map((n) => song(`song-${n}`, n)));
      case "get_presentation_state":
        return Promise.resolve(args?.output === "two" ? { ...state, set: null, mode: "idle" } : state);
      case "reorder_set_items":
        return reorderResult === "ok"
          ? Promise.resolve(state.set)
          : Promise.reject({ code: "set.reorder_mismatch", params: {} });
      default:
        return Promise.resolve([]);
    }
  });
}

function present(items: SetItem[]) {
  const state = liveOn(items);
  backend(state);
  usePresentationStore.setState({ state, focusedOutput: "one", output: "one", pendingSelection: null });
  return render(<OperatorPresentationLayout />);
}

const setPane = () => screen.getByText("Conjunto").closest("div")!.parentElement as HTMLElement;
const handles = () => within(setPane()).getAllByRole("button", { name: /^Reordenar / });
/** The pane's rows, top to bottom, by the item each handle names. */
const paneOrder = () => handles().map((h) => h.getAttribute("aria-label")!.replace("Reordenar ", ""));
const reorderCalls = () => vi.mocked(invoke).mock.calls.filter(([c]) => c === "reorder_set_items");
const called = (cmd: string) => vi.mocked(invoke).mock.calls.some(([c]) => c === cmd);

async function dropOn(active: string, over: string) {
  await act(async () => {
    drop!({ active: { id: active }, over: { id: over } } as unknown as DragEndEvent);
  });
}

const abcd = () => [songItem("A", 0), songItem("B", 1), songItem("C", 2), songItem("D", 3)];

describe("Live set reorder (P23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    drop = undefined;
    reorderResult = "ok";
    useLibraryStore.setState({ songs: [], allSongs: null, search: "", activeSetId: "set-1" });
    useCountdownStore.setState({ armedItem: null });
  });

  it("a drag handle on every row of the editable list only", async () => {
    present(abcd());
    await waitFor(() => expect(paneOrder()).toEqual(["A", "B", "C", "D"]));
    // B is on screen and has its handle like the others.
    expect(within(setPane()).getByRole("button", { name: "Reordenar B" })).toBeEnabled();
    expect(setPane().querySelector('[aria-current="true"]')).toHaveTextContent("B");

    const readOnly = render(<SetItemList />);
    expect(within(readOnly.container).queryByRole("button", { name: /^Reordenar / })).not.toBeInTheDocument();
    expect(within(readOnly.container).getAllByRole("button")).toHaveLength(4);
  });

  it("a drop reorders the pane and sends the ids in the new order", async () => {
    present(abcd());
    await waitFor(() => expect(paneOrder()).toEqual(["A", "B", "C", "D"]));

    await dropOn("D", "B");

    expect(paneOrder()).toEqual(["A", "D", "B", "C"]);
    expect(reorderCalls()).toHaveLength(1);
    expect(reorderCalls()[0][1]).toEqual({ setId: "set-1", itemIds: ["A", "D", "B", "C"] });
    // The wall is not asked to go anywhere, and B stays the highlighted row.
    expect(called("go_to_item")).toBe(false);
    expect(setPane().querySelector('[aria-current="true"]')).toHaveTextContent("B");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a drop on its own place sends nothing", async () => {
    present(abcd());
    await waitFor(() => expect(paneOrder()).toEqual(["A", "B", "C", "D"]));

    await dropOn("C", "C");

    expect(reorderCalls()).toHaveLength(0);
    expect(paneOrder()).toEqual(["A", "B", "C", "D"]);
  });

  it("the backend's order replaces the dropped one when it arrives", async () => {
    present(abcd());
    await waitFor(() => expect(paneOrder()).toEqual(["A", "B", "C", "D"]));
    await dropOn("D", "B");

    // The backend applied it; another window then removed C.
    const next = [songItem("A", 0), songItem("D", 1), songItem("B", 2)];
    act(() => {
      usePresentationStore.setState({ state: { ...liveOn(next), currentItemIndex: 2 } });
    });

    expect(paneOrder()).toEqual(["A", "D", "B"]);
    expect(setPane().querySelector('[aria-current="true"]')).toHaveTextContent("B");
  });

  it("clicking a row still selects it", async () => {
    present(abcd());
    await waitFor(() => expect(paneOrder()).toEqual(["A", "B", "C", "D"]));

    fireEvent.click(within(setPane()).getByText("D"));

    await waitFor(() => expect(called("go_to_item")).toBe(true));
    const [, args] = vi.mocked(invoke).mock.calls.find(([c]) => c === "go_to_item")!;
    expect(args).toMatchObject({ itemIndex: 3, slideIndex: 0 });
    expect(reorderCalls()).toHaveLength(0);
  });

  it("a row dropped elsewhere still selects its own item until the backend answers", async () => {
    present(abcd());
    await waitFor(() => expect(paneOrder()).toEqual(["A", "B", "C", "D"]));
    await dropOn("D", "A");
    expect(paneOrder()).toEqual(["D", "A", "B", "C"]);

    // D is drawn first but is still item 3 for the backend.
    fireEvent.click(within(setPane()).getByText("D"));

    await waitFor(() => expect(called("go_to_item")).toBe(true));
    const [, args] = vi.mocked(invoke).mock.calls.find(([c]) => c === "go_to_item")!;
    expect(args).toMatchObject({ itemIndex: 3, slideIndex: 0 });
  });

  it("a failed reorder restores the order and shows the error", async () => {
    reorderResult = "refuse";
    present(abcd());
    await waitFor(() => expect(paneOrder()).toEqual(["A", "B", "C", "D"]));

    await dropOn("D", "B");

    await waitFor(() =>
      expect(within(setPane()).getByRole("alert")).toHaveTextContent(
        "O conjunto mudou; a nova ordem não foi salva. Tente de novo",
      ),
    );
    expect(paneOrder()).toEqual(["A", "B", "C", "D"]);
    expect(reorderCalls()).toHaveLength(1);
  });

  it("an armed schedule follows its item through a reorder", async () => {
    // [Song, Countdown (armed 19:00), Song]; the widget holds it by index.
    present([songItem("A", 0), countdownItem("K", 1), songItem("C", 2)]);
    useCountdownStore.setState({ armedItem: { setId: "set-1", itemIndex: 1 } });
    await waitFor(() => expect(paneOrder()).toEqual(["A", "Regressivo", "C"]));

    await dropOn("K", "A");

    await waitFor(() =>
      expect(useCountdownStore.getState().armedItem).toEqual({ setId: "set-1", itemIndex: 0 }),
    );

    // A schedule armed for another set is not this reorder's to move.
    useCountdownStore.setState({ armedItem: { setId: "set-9", itemIndex: 1 } });
    useCountdownStore.getState().followReorder("set-1", ["A", "K", "C"], ["K", "A", "C"]);
    expect(useCountdownStore.getState().armedItem).toEqual({ setId: "set-9", itemIndex: 1 });
  });

  it("a refused reorder leaves the armed schedule where it was", async () => {
    reorderResult = "refuse";
    present([songItem("A", 0), countdownItem("K", 1), songItem("C", 2)]);
    useCountdownStore.setState({ armedItem: { setId: "set-1", itemIndex: 1 } });
    await waitFor(() => expect(paneOrder()).toEqual(["A", "Regressivo", "C"]));

    await dropOn("K", "A");

    await waitFor(() => expect(within(setPane()).getByRole("alert")).toBeInTheDocument());
    expect(useCountdownStore.getState().armedItem).toEqual({ setId: "set-1", itemIndex: 1 });
  });
});
