import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MediaLibrary } from "./MediaLibrary";
import { useMediaStore } from "../../stores/media";
import type { Media, MediaReferences } from "../../types";

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
import { listen } from "@tauri-apps/api/event";

const makeMedia = (
  id: string,
  kind: "image" | "video" = "image",
  overrides: Partial<Media> = {}
): Media => ({
  id,
  fileName: `${id}.${kind === "video" ? "mp4" : "jpg"}`,
  displayName: `File ${id}`,
  kind,
  mimeType: kind === "image" ? "image/jpeg" : "video/mp4",
  byteSize: 2 * 1024 * 1024,
  width: 1920,
  height: 1080,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const emptyRefs: MediaReferences = { songs: [], setItems: [] };

describe("MediaLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listen).mockResolvedValue(() => {});
    // Default: listMedia returns empty list
    vi.mocked(invoke).mockResolvedValue([]);
    useMediaStore.setState({
      media: [],
      isLoading: false,
      filter: undefined,
      search: "",
    });
  });

  it("shows empty state when no media", async () => {
    render(<MediaLibrary />);
    await waitFor(() =>
      expect(screen.getByTestId("empty-state")).toBeInTheDocument()
    );
    expect(screen.getByTestId("cta-add-media")).toBeInTheDocument();
  });

  it("renders media grid when items are present", async () => {
    const items = [makeMedia("1"), makeMedia("2", "video")];
    vi.mocked(invoke).mockResolvedValue(items);

    render(<MediaLibrary />);

    await waitFor(() =>
      expect(screen.getByTestId("media-card-1")).toBeInTheDocument()
    );
    expect(screen.getByTestId("media-card-2")).toBeInTheDocument();
  });

  it("shows filter chips with Todos active by default", async () => {
    render(<MediaLibrary />);
    const todosChip = screen.getByTestId("filter-todos");
    expect(todosChip).toBeInTheDocument();
    expect(todosChip.className).toMatch(/bg-blue-600/);
  });

  it("clicking filter chip calls setFilter and refreshes", async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    render(<MediaLibrary />);

    fireEvent.click(screen.getByTestId("filter-imagens"));

    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "list_media",
        expect.objectContaining({
          params: expect.objectContaining({ kind: "image" }),
        })
      )
    );
  });

  it("clicking a card opens the detail panel", async () => {
    const items = [makeMedia("a")];
    vi.mocked(invoke).mockResolvedValue(items);

    render(<MediaLibrary />);

    await waitFor(() =>
      expect(screen.getByTestId("media-card-a")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId("media-card-a"));

    await waitFor(() =>
      expect(screen.getByTestId("detail-close")).toBeInTheDocument()
    );
    expect(screen.getByTestId("display-name")).toHaveTextContent("File a");
  });

  it("closing the detail panel hides it", async () => {
    const items = [makeMedia("b")];
    vi.mocked(invoke).mockResolvedValue(items);

    render(<MediaLibrary />);

    await waitFor(() => screen.getByTestId("media-card-b"));
    fireEvent.click(screen.getByTestId("media-card-b"));
    await waitFor(() => screen.getByTestId("detail-close"));
    fireEvent.click(screen.getByTestId("detail-close"));

    await waitFor(() =>
      expect(screen.queryByTestId("detail-close")).not.toBeInTheDocument()
    );
  });

  it("delete without references calls delete_media and closes panel", async () => {
    const items = [makeMedia("c")];
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "list_media") return Promise.resolve(items);
      if (cmd === "get_media_references") return Promise.resolve(emptyRefs);
      if (cmd === "delete_media") return Promise.resolve(undefined);
      return Promise.resolve([]);
    });

    render(<MediaLibrary />);
    await waitFor(() => screen.getByTestId("media-card-c"));
    fireEvent.click(screen.getByTestId("media-card-c"));
    await waitFor(() => screen.getByTestId("delete-button"));
    fireEvent.click(screen.getByTestId("delete-button"));

    // Confirm dialog should appear
    const dialog = await waitFor(() => screen.getByRole("dialog"));
    expect(within(dialog).getByText(/Excluir "File c"/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByText("Excluir"));

    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "delete_media",
        expect.objectContaining({ id: "c" })
      )
    );
  });

  it("delete with references shows blocked message", async () => {
    const items = [makeMedia("d")];
    const refs: MediaReferences = {
      songs: [{ id: "s1", title: "Música Teste" }],
      setItems: [],
    };
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "list_media") return Promise.resolve(items);
      if (cmd === "get_media_references") return Promise.resolve(refs);
      return Promise.resolve([]);
    });

    render(<MediaLibrary />);
    await waitFor(() => screen.getByTestId("media-card-d"));
    fireEvent.click(screen.getByTestId("media-card-d"));
    await waitFor(() => screen.getByTestId("delete-button"));
    fireEvent.click(screen.getByTestId("delete-button"));

    await waitFor(() =>
      expect(
        screen.getByText(/Esta mídia está em uso por/)
      ).toBeInTheDocument()
    );
    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith(
      "delete_media",
      expect.anything()
    );
  });

  it("Adicionar mídia button toggles dropzone", async () => {
    render(<MediaLibrary />);
    expect(screen.queryByTestId("upload-dropzone")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("add-media-button"));
    expect(screen.getByTestId("upload-dropzone")).toBeInTheDocument();
  });
});
