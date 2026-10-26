import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../api/commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/commands")>();
  return { ...actual, addSetItem: vi.fn() };
});

import { addSetItem } from "../../api/commands";
import { useLibraryStore } from "../../stores/library";
import { LiveSongPicker } from "./LiveSongPicker";
import type { SetItem, Song } from "../../types";

function song(id: string, title: string, artist: string): Song {
  return { id, title, artist, language: "pt", scrimOpacity: 35, createdAt: 0, updatedAt: 0 } as Song;
}

const LIBRARY = [
  song("s1", "Grande é o Senhor", "Adhemar de Campos"),
  song("s2", "Aleluia", "Fernandinho"),
  song("s3", "Galileu", "Fernandinho"),
];

function added(id: string, songId: string): SetItem {
  return { id, setId: "set-1", itemType: "song", songId, sortOrder: 0 };
}

function open(songs: Song[] = LIBRARY) {
  useLibraryStore.setState({ songs });
  return render(<LiveSongPicker setId="set-1" anchorItemId="B" onClose={vi.fn()} />);
}

const search = () => screen.getByPlaceholderText("Pesquisar por título ou artista…");

describe("LiveSongPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists and filters by title or artist, with the search outside the scrolling list", () => {
    open();
    for (const s of LIBRARY) expect(screen.getByText(s.title)).toBeInTheDocument();
    expect(screen.getByText("Adhemar de Campos")).toBeInTheDocument();
    expect(screen.getAllByText("Fernandinho")).toHaveLength(2);
    expect(screen.getByTestId("live-song-picker-list").contains(search())).toBe(false);

    fireEvent.change(search(), { target: { value: "gra" } });
    expect(screen.getByText("Grande é o Senhor")).toBeInTheDocument();
    expect(screen.queryByText("Aleluia")).not.toBeInTheDocument();
    expect(screen.queryByText("Galileu")).not.toBeInTheDocument();

    fireEvent.change(search(), { target: { value: "FERNANDINHO" } });
    expect(screen.getByText("Aleluia")).toBeInTheDocument();
    expect(screen.getByText("Galileu")).toBeInTheDocument();
    expect(screen.queryByText("Grande é o Senhor")).not.toBeInTheDocument();
  });

  it("empty and no match each show their message", () => {
    const { unmount } = open([]);
    expect(screen.getByText("Nenhuma música na biblioteca.")).toBeInTheDocument();
    unmount();

    open();
    fireEvent.change(search(), { target: { value: "zzz" } });
    expect(screen.getByText("Nenhuma música corresponde à pesquisa.")).toBeInTheDocument();
  });

  it("picks anchor on the current item, then on the previous pick", async () => {
    vi.mocked(addSetItem)
      .mockResolvedValueOnce(added("new-1", "s2"))
      .mockResolvedValueOnce(added("new-2", "s3"));
    open();

    fireEvent.click(screen.getByText("Aleluia"));
    await waitFor(() =>
      expect(addSetItem).toHaveBeenCalledWith({
        setId: "set-1",
        itemType: "song",
        songId: "s2",
        afterItemId: "B",
      }),
    );
    fireEvent.click(screen.getByText("Galileu"));
    await waitFor(() =>
      expect(addSetItem).toHaveBeenLastCalledWith({
        setId: "set-1",
        itemType: "song",
        songId: "s3",
        afterItemId: "new-1",
      }),
    );
  });

  it("shows the add error and adds nothing to the session", async () => {
    vi.mocked(addSetItem)
      .mockRejectedValueOnce({ code: "set.item_not_found", params: {} })
      .mockResolvedValueOnce(added("new-1", "s3"));
    open();

    fireEvent.click(screen.getByText("Aleluia"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Item não encontrado");
    expect(screen.queryByText("Adicionada")).not.toBeInTheDocument();

    // The failed pick left no anchor behind: the next one still follows B.
    fireEvent.click(screen.getByText("Galileu"));
    await waitFor(() =>
      expect(addSetItem).toHaveBeenLastCalledWith(
        expect.objectContaining({ songId: "s3", afterItemId: "B" }),
      ),
    );
  });
});
