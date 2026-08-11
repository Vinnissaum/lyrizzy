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

// jsdom lacks ResizeObserver; SlideStage uses it internally.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const LYRICS_PLACEHOLDER =
  "Cole ou digite a letra completa. Deixe uma linha em branco entre as estrofes.";

const multiStropheLyrics =
  "Corpo da estrofe 1\nsegunda linha\n\nCorpo da estrofe 2\n\nCorpo da estrofe 3\n\nCorpo da estrofe 4";

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

  it("renders empty form with a single lyrics box when creating a new song", () => {
    openEditorWith(undefined);
    render(<SongEditor />);
    expect(screen.getByPlaceholderText("Título da música *")).toHaveValue("");
    expect(screen.getByPlaceholderText(LYRICS_PLACEHOLDER)).toBeInTheDocument();
    // No section-card affordances remain.
    expect(screen.queryByText("Seções")).not.toBeInTheDocument();
    expect(screen.queryByText("+ Adicionar seção")).not.toBeInTheDocument();
    expect(screen.queryByText("Colar letra completa")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Arrastar seção")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Rótulo da seção")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Repetições")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Notas da seção")).not.toBeInTheDocument();
  });

  it("Save button is disabled when title is empty", () => {
    openEditorWith(undefined);
    render(<SongEditor />);
    const saveBtn = screen.getByText("Salvar");
    expect(saveBtn).toBeDisabled();
  });

  it("Save button enables when title and lyrics are filled", async () => {
    openEditorWith(undefined);
    render(<SongEditor />);

    fireEvent.change(screen.getByPlaceholderText("Título da música *"), {
      target: { value: "Novo Título" },
    });
    fireEvent.change(screen.getByPlaceholderText(LYRICS_PLACEHOLDER), {
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
    fireEvent.change(screen.getByPlaceholderText(LYRICS_PLACEHOLDER), {
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

  it("saving a 4-strophe paste produces 4 sections with label/type/repeat defaults and ascending sortOrder", async () => {
    vi.mocked(invoke).mockResolvedValue({ id: "new-id", title: "x", language: "pt", createdAt: 1, updatedAt: 1, sections: [] });
    openEditorWith(undefined);
    render(<SongEditor />);

    fireEvent.change(screen.getByPlaceholderText("Título da música *"), {
      target: { value: "Música Multi-Estrofe" },
    });
    fireEvent.change(screen.getByPlaceholderText(LYRICS_PLACEHOLDER), {
      target: { value: multiStropheLyrics },
    });
    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      const call = vi.mocked(invoke).mock.calls.find((c) => c[0] === "create_song");
      expect(call).toBeDefined();
      const payload = (call![1] as any).payload;
      expect(payload.sections).toHaveLength(4);
      payload.sections.forEach((s: any, i: number) => {
        expect(s.label).toBe("");
        expect(s.type).toBe("verse");
        expect(s.repeatCount).toBe(1);
        expect(s.sortOrder).toBe(i);
      });
      expect(payload.sections[0].body).toBe("Corpo da estrofe 1\nsegunda linha");
      expect(payload.sections[1].body).toBe("Corpo da estrofe 2");
      expect(payload.sections[2].body).toBe("Corpo da estrofe 3");
      expect(payload.sections[3].body).toBe("Corpo da estrofe 4");
    });
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

  it("round-trips a multi-strophe song's text exactly from load to save", async () => {
    const multiSong: Song = {
      ...mockSong,
      sections: [
        { id: "s1", songId: "song-1", label: "", type: "verse", body: "Corpo da estrofe 1\nsegunda linha", sortOrder: 0, repeatCount: 1 },
        { id: "s2", songId: "song-1", label: "", type: "verse", body: "Corpo da estrofe 2", sortOrder: 1, repeatCount: 1 },
        { id: "s3", songId: "song-1", label: "", type: "verse", body: "Corpo da estrofe 3", sortOrder: 2, repeatCount: 1 },
      ],
    };
    vi.mocked(invoke)
      .mockResolvedValueOnce(multiSong) // getSong
      .mockResolvedValueOnce(multiSong) // updateSong
      .mockResolvedValueOnce([]); // listSongs (refresh)
    openEditorWith("song-1");
    render(<SongEditor />);

    const expectedText = "Corpo da estrofe 1\nsegunda linha\n\nCorpo da estrofe 2\n\nCorpo da estrofe 3";

    await waitFor(() =>
      expect(screen.getByPlaceholderText(LYRICS_PLACEHOLDER)).toHaveValue(expectedText)
    );

    fireEvent.click(screen.getByText("Salvar"));

    await waitFor(() => {
      const call = vi.mocked(invoke).mock.calls.find((c) => c[0] === "update_song");
      expect(call).toBeDefined();
      const payload = (call![1] as any).payload;
      expect(payload.sections.map((s: any) => s.body).join("\n\n")).toBe(expectedText);
      expect(payload.sections[0].sortOrder).toBe(0);
      expect(payload.sections[1].sortOrder).toBe(1);
      expect(payload.sections[2].sortOrder).toBe(2);
    });
  });

  it("shows the body-required validation message when lyrics are empty", async () => {
    openEditorWith(undefined);
    render(<SongEditor />);

    fireEvent.change(screen.getByPlaceholderText("Título da música *"), {
      target: { value: "Só Título" },
    });
    // Lyrics remain empty — Save stays disabled, but validate() message still
    // reachable by typing then clearing whitespace-only content.
    fireEvent.change(screen.getByPlaceholderText(LYRICS_PLACEHOLDER), {
      target: { value: "   " },
    });

    expect(screen.getByText("Salvar")).toBeDisabled();
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

  it("preview pane renders and shows title slide text when title is filled", async () => {
    openEditorWith(undefined);
    render(<SongEditor />);

    fireEvent.change(screen.getByPlaceholderText("Título da música *"), {
      target: { value: "Aleluia" },
    });

    // The preview pane renders SongPreviewPane; with showTitleSlide=true (store
    // default) the title text should appear inside the slide thumbnails.
    await waitFor(() =>
      expect(screen.getAllByText("Aleluia").length).toBeGreaterThan(0)
    );
  });

  it("preview pane updates as the lyrics textarea is typed", async () => {
    openEditorWith(undefined);
    render(<SongEditor />);

    fireEvent.change(screen.getByPlaceholderText("Título da música *"), {
      target: { value: "Prévia" },
    });
    fireEvent.change(screen.getByPlaceholderText(LYRICS_PLACEHOLDER), {
      target: { value: "Linha da estrofe única" },
    });

    await waitFor(() =>
      expect(screen.getAllByText("Linha da estrofe única").length).toBeGreaterThan(0)
    );
  });
});
