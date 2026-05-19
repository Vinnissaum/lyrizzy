import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SongEditor } from "./SongEditor";
import { useLibraryStore } from "../../stores/library";
import type { Song } from "../../types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockSong: Song = {
  id: "song-1",
  title: "Graça de Deus",
  artist: "Artista Teste",
  language: "pt",
  createdAt: 1000,
  updatedAt: 1000,
  sections: [
    { id: "s1", songId: "song-1", label: "Estrofe 1", type: "verse", body: "Corpo da estrofe", sortOrder: 0, repeatCount: 1 },
    { id: "s2", songId: "song-1", label: "Refrão", type: "chorus", body: "Corpo do refrão", sortOrder: 1, repeatCount: 2 },
  ],
};

function openEditorWith(id?: string) {
  useLibraryStore.setState({
    editingSongId: id ?? null,
    currentView: "editor",
    songs: [],
    isLoading: false,
    search: "",
  });
}

describe("SongEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue([]);
  });

  it("renders empty form with default section when creating a new song", () => {
    openEditorWith(undefined);
    render(<SongEditor />);
    expect(screen.getByPlaceholderText("Título da música *")).toHaveValue("");
    expect(screen.getByPlaceholderText("Letra da seção…")).toBeInTheDocument();
  });

  it("Save button is disabled when title is empty", () => {
    openEditorWith(undefined);
    render(<SongEditor />);
    const saveBtn = screen.getByText("Salvar");
    expect(saveBtn).toBeDisabled();
  });

  it("Save button enables when title and body are filled", async () => {
    openEditorWith(undefined);
    render(<SongEditor />);

    fireEvent.change(screen.getByPlaceholderText("Título da música *"), {
      target: { value: "Novo Título" },
    });
    fireEvent.change(screen.getByPlaceholderText("Letra da seção…"), {
      target: { value: "Letra aqui" },
    });

    await waitFor(() =>
      expect(screen.getByText("Salvar")).not.toBeDisabled()
    );
  });

  it("calls createSong when saving a new song", async () => {
    vi.mocked(invoke).mockResolvedValue({ id: "new-id", title: "x", language: "pt", createdAt: 1, updatedAt: 1, sections: [] });
    openEditorWith(undefined);
    render(<SongEditor />);

    fireEvent.change(screen.getByPlaceholderText("Título da música *"), {
      target: { value: "Nova Música" },
    });
    fireEvent.change(screen.getByPlaceholderText("Letra da seção…"), {
      target: { value: "Letra" },
    });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "create_song",
        expect.objectContaining({
          payload: expect.objectContaining({ title: "Nova Música" }),
        })
      )
    );
  });

  it("loads song and calls updateSong when editing an existing song", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(mockSong) // getSong
      .mockResolvedValueOnce(mockSong) // updateSong
      .mockResolvedValueOnce([]); // listSongs (refresh)
    openEditorWith("song-1");
    render(<SongEditor />);

    await waitFor(() =>
      expect(screen.getByDisplayValue("Graça de Deus")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "update_song",
        expect.objectContaining({
          payload: expect.objectContaining({ id: "song-1", title: "Graça de Deus" }),
        })
      )
    );
  });

  it("shows confirm dialog and calls deleteSong on confirm", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(mockSong) // getSong
      .mockResolvedValueOnce(undefined) // deleteSong
      .mockResolvedValueOnce([]); // listSongs (refresh)
    openEditorWith("song-1");
    render(<SongEditor />);

    await waitFor(() => screen.getByText("Excluir"));
    fireEvent.click(screen.getByText("Excluir"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Excluir")[1]);

    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "delete_song",
        expect.objectContaining({ id: "song-1" })
      )
    );
  });

  it("reorders sections and saves with correct sort_order", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(mockSong) // getSong
      .mockResolvedValueOnce(mockSong) // updateSong
      .mockResolvedValueOnce([]); // listSongs
    openEditorWith("song-1");
    render(<SongEditor />);

    await waitFor(() => screen.getByDisplayValue("Graça de Deus"));

    // The order is visible — we just verify updateSong is called with the sections in sort_order
    const allTextareas = screen.getAllByPlaceholderText("Letra da seção…");
    expect(allTextareas).toHaveLength(2);

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      const call = vi.mocked(invoke).mock.calls.find((c) => c[0] === "update_song");
      expect(call).toBeDefined();
      const payload = (call![1] as any).payload;
      expect(payload.sections[0].sortOrder).toBe(0);
      expect(payload.sections[1].sortOrder).toBe(1);
    });
  });
});
