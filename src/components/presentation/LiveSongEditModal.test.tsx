import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LiveSongEditModal } from "./LiveSongEditModal";
import { useLibraryStore } from "../../stores/library";
import type { Song } from "../../types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

// jsdom lacks ResizeObserver; SlideStage (via SongEditor's preview pane) uses it.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const mockSong: Song = {
  id: "song-1",
  title: "Graça de Deus",
  artist: "Artista Teste",
  language: "pt",
  scrimOpacity: 35,
  createdAt: 1000,
  updatedAt: 1000,
  sections: [
    { id: "s1", songId: "song-1", label: "Estrofe 1", type: "verse", body: "Corpo da estrofe", sortOrder: 0, repeatCount: 1 },
  ],
};

function resetStore() {
  useLibraryStore.setState({
    editingSongId: null,
    editingSetId: null,
    currentView: "home",
    isLiveEdit: false,
    songs: [],
    isLoading: false,
    search: "",
  });
}

describe("LiveSongEditModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_song") return Promise.resolve(mockSong);
      if (cmd === "update_song") return Promise.resolve(mockSong);
      return Promise.resolve([]);
    });
  });

  it("renders nothing when songId is null", () => {
    render(<LiveSongEditModal songId={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId("live-song-edit-modal")).not.toBeInTheDocument();
  });

  it("opening the modal renders SongEditor and leaves currentView on the presentation layout", async () => {
    useLibraryStore.setState({ currentView: "home" });

    render(<LiveSongEditModal songId="song-1" onClose={vi.fn()} />);

    expect(screen.getByTestId("live-song-edit-modal")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByDisplayValue("Graça de Deus")).toBeInTheDocument()
    );

    expect(useLibraryStore.getState().currentView).toBe("home");
    expect(useLibraryStore.getState().editingSongId).toBe("song-1");
    expect(useLibraryStore.getState().isLiveEdit).toBe(true);
  });

  it("cancel (X button) closes without calling update_song and restores pre-open state", async () => {
    useLibraryStore.setState({ currentView: "home" });
    const onClose = vi.fn();

    render(<LiveSongEditModal songId="song-1" onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Graça de Deus")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByLabelText("Cancelar"));

    expect(onClose).toHaveBeenCalled();
    expect(useLibraryStore.getState().editingSongId).toBeNull();
    expect(useLibraryStore.getState().isLiveEdit).toBe(false);
    expect(useLibraryStore.getState().currentView).toBe("home");
    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith(
      "update_song",
      expect.anything()
    );
  });

  it("saving inside SongEditor calls update_song, does not touch currentView, and closes the modal", async () => {
    useLibraryStore.setState({ currentView: "home" });
    const onClose = vi.fn();

    render(<LiveSongEditModal songId="song-1" onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Graça de Deus")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "update_song",
        expect.objectContaining({
          payload: expect.objectContaining({ id: "song-1" }),
        })
      )
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useLibraryStore.getState().currentView).toBe("home");
    expect(useLibraryStore.getState().editingSongId).toBeNull();
  });
});
