import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { OperatorApp } from "./OperatorApp";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Song, ServiceSet } from "../../types";

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

const defaultSet: ServiceSet = {
  id: "set-1",
  name: "Culto Dominical",
  createdAt: 0,
  updatedAt: 0,
  items: [],
};

describe("OperatorApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listen).mockResolvedValue(() => {});
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
      if (cmd === "get_or_create_default_set") return Promise.resolve(defaultSet);
      if (cmd === "get_set") return Promise.resolve(defaultSet);
      if (cmd === "check_for_updates") return Promise.resolve(null);
      return Promise.resolve([]);
    });
  });

  it("renders the Biblioteca nav button", () => {
    render(<OperatorApp />);
    expect(screen.getByRole("button", { name: "Biblioteca" })).toBeInTheDocument();
  });

  it("shows both library CTAs when navigating to library with no songs", async () => {
    render(<OperatorApp />);
    fireEvent.click(screen.getByRole("button", { name: "Biblioteca" }));
    await waitFor(() => {
      expect(screen.getByTestId("cta-import-holyrics")).toBeInTheDocument();
      expect(screen.getByTestId("cta-create-song")).toBeInTheDocument();
    });
  });

  it("renders song rows in library when listSongs returns songs", async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
      if (cmd === "get_or_create_default_set") return Promise.resolve(defaultSet);
      if (cmd === "get_set") return Promise.resolve(defaultSet);
      if (cmd === "check_for_updates") return Promise.resolve(null);
      if (cmd === "list_songs") return Promise.resolve([
        mockSong("1", "Graça Infinita", "Artista A"),
        mockSong("2", "Santo Espírito"),
      ]);
      return Promise.resolve([]);
    });
    render(<OperatorApp />);
    fireEvent.click(screen.getByRole("button", { name: "Biblioteca" }));
    await waitFor(() => {
      expect(screen.getByText("Graça Infinita")).toBeInTheDocument();
      expect(screen.getByText("Santo Espírito")).toBeInTheDocument();
    });
  });

  it("does not render a presentation window button in the toolbar", () => {
    render(<OperatorApp />);
    expect(screen.queryByText("Janela de Apresentação")).toBeNull();
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
