import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HolyricsImport } from "./HolyricsImport";
import type { ParsedFileResult } from "../../api/commands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const mockResult: ParsedFileResult = {
  songs: [
    {
      title: "Graça Infinita",
      artist: "Artista A",
      sections: [{ number: 1, description: "Estrofe 1", text: "letra" }],
    },
    {
      title: "Duplicada",
      artist: "Artista B",
      sections: [],
    },
  ],
  duplicateIndices: [1],
};

describe("HolyricsImport", () => {
  const onDone = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue({ imported: 0, skipped: 0, failed: [] });
  });

  it("renders file picker step initially", () => {
    render(<HolyricsImport onDone={onDone} onCancel={onCancel} />);
    expect(screen.getByText("Escolher arquivo…")).toBeInTheDocument();
  });

  it("shows preview with songs after file is selected", async () => {
    vi.mocked(open).mockResolvedValue("/path/to/file.json");
    vi.mocked(invoke).mockResolvedValue(mockResult);

    render(<HolyricsImport onDone={onDone} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Escolher arquivo…"));

    await waitFor(() =>
      expect(screen.getByText("Graça Infinita")).toBeInTheDocument()
    );
    expect(screen.getByText("Duplicada")).toBeInTheDocument();
    expect(
      screen.getByText("(duplicada — desmarcada por padrão)")
    ).toBeInTheDocument();
  });

  it("duplicate song is unchecked by default", async () => {
    vi.mocked(open).mockResolvedValue("/path/to/file.json");
    vi.mocked(invoke).mockResolvedValue(mockResult);

    render(<HolyricsImport onDone={onDone} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Escolher arquivo…"));

    await waitFor(() => screen.getByText("Duplicada"));
    const checkboxes = screen.getAllByRole("checkbox");
    // First song (index 0, not duplicate) should be checked
    expect(checkboxes[0]).toBeChecked();
    // Second song (index 1, duplicate) should be unchecked
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("calls importHolyricsBatch with only checked songs", async () => {
    vi.mocked(open).mockResolvedValue("/path/to/file.json");
    vi.mocked(invoke)
      .mockResolvedValueOnce(mockResult) // parseHolyricsFile
      .mockResolvedValueOnce({ imported: 1, skipped: 0, failed: [] }); // importHolyricsBatch

    render(<HolyricsImport onDone={onDone} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Escolher arquivo…"));

    await waitFor(() => screen.getByText(/Importar selecionadas/));
    fireEvent.click(screen.getByText(/Importar selecionadas/));

    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "import_holyrics_batch",
        expect.objectContaining({
          payload: expect.arrayContaining([
            expect.objectContaining({ title: "Graça Infinita" }),
          ]),
        })
      )
    );

    // Should NOT contain the duplicate
    const call = vi.mocked(invoke).mock.calls.find(
      (c) => c[0] === "import_holyrics_batch"
    );
    const payload = (call![1] as any).payload as { title: string }[];
    expect(payload.some((s) => s.title === "Duplicada")).toBe(false);
  });

  it("shows summary with correct counts after import", async () => {
    vi.mocked(open).mockResolvedValue("/path/to/file.json");
    vi.mocked(invoke)
      .mockResolvedValueOnce(mockResult)
      .mockResolvedValueOnce({ imported: 1, skipped: 0, failed: [] });

    render(<HolyricsImport onDone={onDone} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Escolher arquivo…"));
    await waitFor(() => screen.getByText(/Importar selecionadas/));
    fireEvent.click(screen.getByText(/Importar selecionadas/));

    await waitFor(() =>
      expect(screen.getByText("1 música importada")).toBeInTheDocument()
    );
    expect(screen.getByText("Ver biblioteca")).toBeInTheDocument();
  });
});
