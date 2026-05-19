import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlainTextImport } from "./PlainTextImport";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import type { ParsedTextSection } from "../../api/commands";

const parsedSections: ParsedTextSection[] = [
  { label: "Estrofe 1", sectionType: "verse", body: "Corpo da estrofe" },
  { label: "Refrão", sectionType: "chorus", body: "Corpo do refrão" },
];

describe("PlainTextImport", () => {
  const onImported = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue([]);
  });

  it("renders step 1 with title and lyrics fields", () => {
    render(<PlainTextImport onImported={onImported} onCancel={onCancel} />);
    expect(screen.getByPlaceholderText("Nome da música")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cole a letra aqui…")).toBeInTheDocument();
    expect(screen.getByText("Pré-visualizar")).toBeInTheDocument();
  });

  it("next button is disabled when title is empty", () => {
    render(<PlainTextImport onImported={onImported} onCancel={onCancel} />);
    expect(screen.getByText("Pré-visualizar")).toBeDisabled();
  });

  it("shows preview on step 2 after parsing", async () => {
    vi.mocked(invoke).mockResolvedValue(parsedSections);
    render(<PlainTextImport onImported={onImported} onCancel={onCancel} />);

    fireEvent.change(screen.getByPlaceholderText("Nome da música"), {
      target: { value: "Minha Música" },
    });
    fireEvent.change(screen.getByPlaceholderText("Cole a letra aqui…"), {
      target: { value: "Estrofe\n\n[Refrão]\ncorpo" },
    });
    fireEvent.click(screen.getByText("Pré-visualizar"));

    await waitFor(() => expect(screen.getByText("Importar")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Estrofe 1")).toBeInTheDocument();
  });

  it("calls createSong with correct payload on import", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(parsedSections) // parse_plain_text_import
      .mockResolvedValueOnce({ id: "new-song", title: "x", language: "pt", createdAt: 1, updatedAt: 1, sections: [] }); // create_song

    render(<PlainTextImport onImported={onImported} onCancel={onCancel} />);

    fireEvent.change(screen.getByPlaceholderText("Nome da música"), {
      target: { value: "Graça" },
    });
    fireEvent.change(screen.getByPlaceholderText("Cole a letra aqui…"), {
      target: { value: "letra" },
    });
    fireEvent.click(screen.getByText("Pré-visualizar"));

    await waitFor(() => screen.getByText("Importar"));
    fireEvent.click(screen.getByText("Importar"));

    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "create_song",
        expect.objectContaining({
          payload: expect.objectContaining({ title: "Graça" }),
        })
      )
    );
  });
});
