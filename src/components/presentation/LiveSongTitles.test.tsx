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

// jsdom lacks ResizeObserver; the live editor's preview pane uses it.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function song(id: string, title: string, artist: string): Song {
  return {
    id, title, artist, language: "pt", scrimOpacity: 35, createdAt: 0, updatedAt: 0,
    sections: [
      { id: `${id}-s1`, songId: id, label: "Estrofe 1", type: "verse", body: `${title} verso`, sortOrder: 0, repeatCount: 1 },
    ],
  };
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
        // As the backend: by title, the first 200 unless a limit is given; a
        // negative limit is no limit (src-tauri/tests/songs.rs).
        const search: string | undefined = args?.params?.search;
        const limit: number = args?.params?.limit ?? 200;
        const hits = (search ? library.filter((s) => matches(s, search)) : library)
          .slice()
          .sort((a, b) => a.title.localeCompare(b.title));
        return Promise.resolve(limit < 0 ? hits : hits.slice(0, limit));
      }
      case "get_presentation_state":
        return Promise.resolve(args?.output === "two" ? { ...state, set: null, mode: "idle" } : state);
      case "get_song":
        return Promise.resolve(library.find((s) => s.id === args.id));
      case "update_song": {
        // Saved; no `songs_changed` here, so only the editor's own reload runs.
        const p = args.payload;
        library = library.map((s) => (s.id === p.id ? { ...s, title: p.title } : s));
        return Promise.resolve(library.find((s) => s.id === p.id));
      }
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

  it("a song saved in the live editor under a library search keeps every row titled", async () => {
    searchedLibrary("amor");
    present(twoSongSet);
    await waitFor(() => expect(within(setPane()).getByText("AJUNTAMENTO")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Editar música O AMOR DE DEUS" }));
    const dialog = await screen.findByTestId("live-song-edit-modal");
    await waitFor(() => expect(within(dialog).getByDisplayValue("O AMOR DE DEUS")).toBeInTheDocument());
    fireEvent.change(within(dialog).getByDisplayValue("O AMOR DE DEUS"), { target: { value: "O GRANDE AMOR DE DEUS" } });
    fireEvent.click(within(dialog).getByText("Salvar"));

    await waitFor(() => expect(screen.queryByTestId("live-song-edit-modal")).not.toBeInTheDocument());
    await waitFor(() => expect(within(setPane()).getByText("O GRANDE AMOR DE DEUS")).toBeInTheDocument());
    // The song that does not match the search keeps its title too.
    expect(within(setPane()).getByText("AJUNTAMENTO")).toBeInTheDocument();
    expect(within(setPane()).getByText("Jorge Camargo")).toBeInTheDocument();
    expect(within(setPane()).queryByText("—")).not.toBeInTheDocument();
    // The Biblioteca view still holds its search and what matches it.
    expect(useLibraryStore.getState().search).toBe("amor");
    expect(useLibraryStore.getState().songs.map((s) => s.id)).toEqual(["song-2"]);
  });

  it("a set song past the first 200 by title keeps its title", async () => {
    // 250 songs sort before ZELO, the set's second song.
    library = [
      ...Array.from({ length: 250 }, (_, k) => song(`m-${k}`, `MÚSICA ${String(k + 1).padStart(3, "0")}`, "")),
      song("song-1", "AJUNTAMENTO", "Jorge Camargo"),
      song("song-2", "ZELO", "Coral"),
    ];
    searchedLibrary("");
    present(twoSongSet);
    // The presenter's own load of the library, not the Biblioteca's list.
    await waitFor(() => expect(useLibraryStore.getState().allSongs).not.toBeNull());

    await waitFor(() => expect(within(setPane()).getByText("ZELO")).toBeInTheDocument());
    expect(within(setPane()).getByText("Coral")).toBeInTheDocument();
    expect(within(setPane()).getByText("AJUNTAMENTO")).toBeInTheDocument();
    expect(within(setPane()).queryByText("—")).not.toBeInTheDocument();

    // The song picker holds the whole library too.
    fireEvent.click(screen.getByRole("button", { name: "Adicionar música" }));
    const list = screen.getByTestId("live-song-picker-list");
    expect(within(list).getAllByRole("button")).toHaveLength(252);
    expect(within(list).getByText("ZELO")).toBeInTheDocument();
  });
});
