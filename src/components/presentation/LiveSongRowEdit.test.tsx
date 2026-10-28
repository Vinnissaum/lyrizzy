import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { OperatorPresentationLayout } from "./OperatorPresentationLayout";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import type { PresentationState, ServiceSet, Song } from "../../types";

// P22: the set pane's row edit control, end to end through the real set list
// and the real live editor dialog. Only the backend (invoke) and the panes this
// feature does not touch are stubbed.

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
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

// jsdom lacks ResizeObserver; SongEditor's preview pane uses it.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function song(id: string, title: string, artist: string): Song {
  return {
    id,
    title,
    artist,
    language: "pt",
    scrimOpacity: 35,
    createdAt: 0,
    updatedAt: 0,
    sections: [
      { id: `${id}-s1`, songId: id, label: "Estrofe 1", type: "verse", body: `${title} verso`, sortOrder: 0, repeatCount: 1 },
    ],
  };
}

const set: ServiceSet = {
  id: "set-1",
  name: "Culto",
  createdAt: 0,
  updatedAt: 0,
  items: [
    { id: "item-1", setId: "set-1", itemType: "song", songId: "song-1", sortOrder: 0 },
    { id: "item-2", setId: "set-1", itemType: "song", songId: "song-2", sortOrder: 1 },
  ],
};

// Live on song 1, strophe 3.
const live: PresentationState = {
  mode: "live",
  currentItemIndex: 0,
  currentSlideIndex: 3,
  itemSlideCounts: [6, 3],
  set,
};

let library: Song[];

function backend() {
  vi.mocked(invoke).mockImplementation((cmd: string, args?: any) => {
    switch (cmd) {
      case "get_song":
        return Promise.resolve(library.find((s) => s.id === args.id));
      case "update_song": {
        const p = args.payload;
        library = library.map((s) =>
          s.id === p.id ? { ...s, title: p.title, artist: p.artist ?? "" } : s,
        );
        return Promise.resolve(library.find((s) => s.id === p.id));
      }
      case "list_songs":
        return Promise.resolve(library);
      case "get_presentation_state":
        return Promise.resolve(args?.output === "two" ? { ...live, set: null, mode: "idle" } : live);
      default:
        return Promise.resolve([]);
    }
  });
}

const called = (cmd: string) => vi.mocked(invoke).mock.calls.some(([c]) => c === cmd);
const header = () => screen.getByText(/^Estrofes — /);
const setPane = () => screen.getByText("Conjunto").closest("div")!.parentElement as HTMLElement;

async function openRowEditor(title: string) {
  fireEvent.click(screen.getByRole("button", { name: `Editar música ${title}` }));
  const dialog = await screen.findByTestId("live-song-edit-modal");
  await waitFor(() => expect(within(dialog).getByDisplayValue(title)).toBeInTheDocument());
  return dialog;
}

describe("Live song row edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    library = [song("song-1", "Ajuntamento", "Jorge Camargo"), song("song-2", "O Amor de Deus", "Rachel Novaes")];
    backend();
    useLibraryStore.setState({
      songs: library,
      editingSongId: null,
      isLiveEdit: false,
      currentView: "home",
      activeSetId: "set-1",
    });
    usePresentationStore.setState({ state: live, focusedOutput: "one", output: "one", pendingSelection: null });
  });

  it("row edit opens that song without moving the wall", async () => {
    render(<OperatorPresentationLayout />);
    expect(header()).toHaveTextContent("Estrofes — Ajuntamento — Jorge Camargo");

    const dialog = await openRowEditor("O Amor de Deus");

    expect(within(dialog).getByText("Editar música")).toBeInTheDocument();
    expect(called("go_to_item")).toBe(false);
    expect(usePresentationStore.getState().state?.currentItemIndex).toBe(0);
    expect(usePresentationStore.getState().state?.currentSlideIndex).toBe(3);
    expect(header()).toHaveTextContent("Estrofes — Ajuntamento — Jorge Camargo");
    const current = setPane().querySelectorAll('[aria-current="true"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Ajuntamento");
  });

  it("row edit saves that song and closes", async () => {
    render(<OperatorPresentationLayout />);
    const dialog = await openRowEditor("O Amor de Deus");

    fireEvent.click(within(dialog).getByText("Salvar"));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "update_song",
        expect.objectContaining({ payload: expect.objectContaining({ id: "song-2" }) }),
      ),
    );
    await waitFor(() => expect(screen.queryByTestId("live-song-edit-modal")).not.toBeInTheDocument());
    expect(called("go_to_item")).toBe(false);
  });

  it("renamed song relabels its row and the strophes header", async () => {
    render(<OperatorPresentationLayout />);

    // A song that is not the current item: its row only.
    let dialog = await openRowEditor("O Amor de Deus");
    fireEvent.change(within(dialog).getByDisplayValue("O Amor de Deus"), { target: { value: "O Grande Amor" } });
    fireEvent.change(within(dialog).getByDisplayValue("Rachel Novaes"), { target: { value: "Coral" } });
    fireEvent.click(within(dialog).getByText("Salvar"));
    await waitFor(() => expect(screen.queryByTestId("live-song-edit-modal")).not.toBeInTheDocument());
    await waitFor(() => expect(within(setPane()).getByText("O Grande Amor")).toBeInTheDocument());
    expect(within(setPane()).getByText("Coral")).toBeInTheDocument();
    expect(within(setPane()).queryByText("O Amor de Deus")).not.toBeInTheDocument();
    expect(header()).toHaveTextContent("Estrofes — Ajuntamento — Jorge Camargo");

    // The current item's song, from its own row: the header follows.
    dialog = await openRowEditor("Ajuntamento");
    fireEvent.change(within(dialog).getByDisplayValue("Ajuntamento"), { target: { value: "Ajuntamento Novo" } });
    fireEvent.click(within(dialog).getByText("Salvar"));
    await waitFor(() => expect(header()).toHaveTextContent("Estrofes — Ajuntamento Novo — Jorge Camargo"));
    expect(within(setPane()).getByText("Ajuntamento Novo")).toBeInTheDocument();
  });

  it("row edit closed with X writes nothing", async () => {
    render(<OperatorPresentationLayout />);
    await openRowEditor("O Amor de Deus");

    fireEvent.click(screen.getByLabelText("Cancelar"));

    expect(screen.queryByTestId("live-song-edit-modal")).not.toBeInTheDocument();
    expect(called("update_song")).toBe(false);
    expect(called("go_to_item")).toBe(false);
    expect(header()).toHaveTextContent("Estrofes — Ajuntamento — Jorge Camargo");
    expect(within(setPane()).getByText("O Amor de Deus")).toBeInTheDocument();
    const current = setPane().querySelectorAll('[aria-current="true"]');
    expect(current[0]).toHaveTextContent("Ajuntamento");
  });
});
