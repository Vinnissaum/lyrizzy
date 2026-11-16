import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { OperatorPresentationLayout } from "./OperatorPresentationLayout";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import type { PresentationState, ServiceSet, Song } from "../../types";

// P23 S1: song rows keep their titles while presenting, whatever the Biblioteca
// search holds. The real layout, set list, picker and library store; only the
// backend (invoke, listen) and the panes this slice does not touch are stubbed.
// `list_songs` filters by its `search` param, as the backend does.

const listeners = new Map<string, Array<(e: { payload: unknown }) => void>>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, cb: (e: { payload: unknown }) => void) => {
    listeners.set(event, [...(listeners.get(event) ?? []), cb]);
    return Promise.resolve(() => {});
  }),
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

function song(id: string, title: string, artist: string): Song {
  return { id, title, artist, language: "pt", scrimOpacity: 35, createdAt: 0, updatedAt: 0, sections: [] };
}

function songItem(id: string, songId: string, sortOrder: number) {
  return { id, setId: "set-1", itemType: "song" as const, songId, sortOrder };
}

const twoSongSet: ServiceSet = {
  id: "set-1",
  name: "Culto",
  createdAt: 0,
  updatedAt: 0,
  items: [songItem("item-1", "song-1", 0), songItem("item-2", "song-2", 1)],
};

const threeSongSet: ServiceSet = {
  ...twoSongSet,
  items: [...twoSongSet.items!, songItem("item-3", "song-3", 2)],
};

/** Live on AJUNTAMENTO (item 1). */
function liveOn(set: ServiceSet): PresentationState {
  return { mode: "live", currentItemIndex: 0, currentSlideIndex: 0, itemSlideCounts: set.items!.map(() => 2), set };
}

let library: Song[];

const matches = (s: Song, search: string) =>
  `${s.title} ${s.artist ?? ""}`.toLowerCase().includes(search.toLowerCase());

function backend(state: PresentationState) {
  vi.mocked(invoke).mockImplementation((cmd: string, args?: any) => {
    switch (cmd) {
      case "list_songs": {
        const search: string | undefined = args?.params?.search;
        return Promise.resolve(search ? library.filter((s) => matches(s, search)) : library);
      }
      case "get_presentation_state":
        return Promise.resolve(args?.output === "two" ? { ...state, set: null, mode: "idle" } : state);
      default:
        return Promise.resolve([]);
    }
  });
}

/** Leave the library store as the Biblioteca view does after a search. */
function searchedLibrary(search: string) {
  useLibraryStore.setState({
    search,
    songs: search ? library.filter((s) => matches(s, search)) : library,
    allSongs: null,
    editingSongId: null,
    isLiveEdit: false,
    currentView: "home",
    activeSetId: "set-1",
  });
}

function present(set: ServiceSet) {
  const state = liveOn(set);
  backend(state);
  usePresentationStore.setState({ state, focusedOutput: "one", output: "one", pendingSelection: null });
  return render(<OperatorPresentationLayout />);
}

const setPane = () => screen.getByText("Conjunto").closest("div")!.parentElement as HTMLElement;

describe("Presenter song titles under a library search (P23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
    library = [
      song("song-1", "AJUNTAMENTO", "Jorge Camargo"),
      song("song-2", "O AMOR DE DEUS", "Rachel Novaes"),
      song("song-3", "GALILEU", "Fernandinho"),
    ];
  });

  it.each(["amor", "zzz", ""])(
    "song rows keep their titles under a library search (%j)",
    async (search) => {
      searchedLibrary(search);
      present(twoSongSet);

      await waitFor(() => expect(within(setPane()).getByText("AJUNTAMENTO")).toBeInTheDocument());
      expect(within(setPane()).getByText("Jorge Camargo")).toBeInTheDocument();
      expect(within(setPane()).getByText("O AMOR DE DEUS")).toBeInTheDocument();
      expect(within(setPane()).getByText("Rachel Novaes")).toBeInTheDocument();
      expect(within(setPane()).queryByText("—")).not.toBeInTheDocument();
    },
  );

  it("strophes header names the song under a library search", async () => {
    searchedLibrary("amor");
    present(twoSongSet);

    await waitFor(() =>
      expect(screen.getByText(/^Estrofes — /)).toHaveTextContent("Estrofes — AJUNTAMENTO — Jorge Camargo"),
    );
  });

  it("remove confirmation names the song under a library search", async () => {
    searchedLibrary("amor");
    present(threeSongSet);

    fireEvent.click(await screen.findByRole("button", { name: "Remover GALILEU" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Remover “GALILEU” do conjunto?");
  });

  it("the song picker lists every library song under a library search", async () => {
    searchedLibrary("amor");
    present(twoSongSet);
    await waitFor(() => expect(within(setPane()).getByText("AJUNTAMENTO")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Adicionar música" }));

    const list = screen.getByTestId("live-song-picker-list");
    for (const s of library) expect(within(list).getByText(s.title)).toBeInTheDocument();
    expect(within(list).getAllByRole("button")).toHaveLength(3);
  });

  it("a renamed song relabels its row under a library search", async () => {
    searchedLibrary("amor");
    present(twoSongSet);
    await waitFor(() => expect(within(setPane()).getByText("AJUNTAMENTO")).toBeInTheDocument());

    library = library.map((s) => (s.id === "song-1" ? { ...s, title: "AJUNTAMENTO 2" } : s));
    expect(listeners.get("songs_changed")?.length).toBeGreaterThan(0);
    await act(async () => {
      for (const cb of listeners.get("songs_changed") ?? []) cb({ payload: undefined });
    });

    await waitFor(() => expect(within(setPane()).getByText("AJUNTAMENTO 2")).toBeInTheDocument());
    expect(within(setPane()).queryByText("AJUNTAMENTO")).not.toBeInTheDocument();
    // The Biblioteca view's own list and search are not the presenter's to change.
    expect(useLibraryStore.getState().search).toBe("amor");
    expect(useLibraryStore.getState().songs.map((s) => s.id)).toEqual(["song-2"]);
  });
});
