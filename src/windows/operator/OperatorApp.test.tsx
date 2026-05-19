import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OperatorApp } from "./OperatorApp";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Song } from "../../types";

const mockSong = (id: string, title: string, artist?: string): Song => ({
  id,
  title,
  artist,
  language: "pt",
  scrimOpacity: 35,
  createdAt: 1000,
  updatedAt: 1000,
  sections: [{ id: "s1", songId: id, label: "E1", type: "verse", body: "corpo", sortOrder: 0, repeatCount: 1 }],
});

describe("OperatorApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listen).mockResolvedValue(() => {});
    vi.mocked(invoke).mockResolvedValue([]);
  });

  it("renders the library heading", async () => {
    render(<OperatorApp />);
    // Both the nav tab and the SongList heading say "Biblioteca"
    await waitFor(() => expect(screen.getAllByText("Biblioteca").length).toBeGreaterThan(0));
  });

  it("shows both CTAs when songs list is empty", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    render(<OperatorApp />);
    await waitFor(() => {
      expect(screen.getByTestId("cta-import-holyrics")).toBeInTheDocument();
      expect(screen.getByTestId("cta-create-song")).toBeInTheDocument();
    });
  });

  it("renders song rows when listSongs returns songs", async () => {
    vi.mocked(invoke).mockResolvedValue([
      mockSong("1", "Graça Infinita", "Artista A"),
      mockSong("2", "Santo Espírito"),
    ]);
    render(<OperatorApp />);
    await waitFor(() => {
      expect(screen.getByText("Graça Infinita")).toBeInTheDocument();
      expect(screen.getByText("Santo Espírito")).toBeInTheDocument();
    });
  });

  it("renders the presentation window button", () => {
    render(<OperatorApp />);
    expect(screen.getByText("Janela de Apresentação")).toBeInTheDocument();
  });

  it("calls open_presentation_window when the button is clicked", async () => {
    render(<OperatorApp />);
    screen.getByText("Janela de Apresentação").click();
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "open_presentation_window",
        { monitorIndex: undefined }
      )
    );
  });

  it("subscribes to songs_changed on mount", async () => {
    render(<OperatorApp />);
    await waitFor(() =>
      expect(vi.mocked(listen)).toHaveBeenCalledWith(
        "songs_changed",
        expect.any(Function)
      )
    );
  });
});
