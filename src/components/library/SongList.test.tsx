import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SongList } from "./SongList";
import type { Song } from "../../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn().mockResolvedValue("/tmp/out.tlz"),
}));

vi.mock("../../api/commands", () => ({
  exportSongs: vi.fn().mockResolvedValue({
    outPath: "/tmp/out.tlz",
    byteSize: 10,
    counts: { songs: 2, sections: 0, sets: 0, setItems: 0, media: 0, settings: 0 },
    warnings: [],
  }),
  onBackupProgress: vi.fn().mockResolvedValue(() => {}),
}));

const songs: Song[] = [
  { id: "s1", title: "Alpha", artist: "", sections: [] } as unknown as Song,
  { id: "s2", title: "Beta", artist: "", sections: [] } as unknown as Song,
  { id: "s3", title: "Gamma", artist: "", sections: [] } as unknown as Song,
];

const refresh = vi.fn();
vi.mock("../../stores/library", () => ({
  useLibraryStore: () => ({
    songs,
    isLoading: false,
    search: "",
    setSearch: vi.fn(),
    refresh,
  }),
}));

import { exportSongs } from "../../api/commands";

describe("SongList export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports the selected song ids via the wrapper", async () => {
    render(
      <SongList
        onSongClick={vi.fn()}
        onImportHolyrics={vi.fn()}
        onCreateSong={vi.fn()}
      />
    );

    // Enter selection mode.
    fireEvent.click(screen.getByTestId("cta-select-songs"));

    // Select two songs.
    fireEvent.click(screen.getByText("Alpha"));
    fireEvent.click(screen.getByText("Gamma"));

    // Export.
    fireEvent.click(screen.getByTestId("cta-export-selected"));

    await waitFor(() => expect(exportSongs).toHaveBeenCalledTimes(1));
    const [ids, outPath] = (exportSongs as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect([...ids].sort()).toEqual(["s1", "s3"]);
    expect(outPath).toBe("/tmp/out.tlz");
  });

  it("disables export with zero selection", () => {
    render(
      <SongList
        onSongClick={vi.fn()}
        onImportHolyrics={vi.fn()}
        onCreateSong={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("cta-select-songs"));
    expect(screen.getByTestId("cta-export-selected")).toBeDisabled();
  });
});
