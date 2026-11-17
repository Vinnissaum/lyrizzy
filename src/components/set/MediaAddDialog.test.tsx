import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MediaAddDialog } from "./MediaAddDialog";
import { useMediaStore } from "../../stores/media";
import type { Media, MediaReferences } from "../../types";

// P24 S3: Home's `Mídia` dialog. The real dialog, grid and confirmation; the
// backend (invoke) is stubbed.

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

import { invoke } from "@tauri-apps/api/core";

function media(id: string, displayName: string, kind: Media["kind"], createdAt: number): Media {
  return {
    id, displayName, kind, createdAt, updatedAt: createdAt, byteSize: 1,
    fileName: `${id}.${kind === "video" ? "webm" : "png"}`,
    mimeType: kind === "video" ? "video/webm" : "image/png",
  };
}

const NO_REFS: MediaReferences = { songs: [], setItems: [], sections: [] };

let library: Media[];
let refs: Record<string, MediaReferences>;
let deleteError: unknown;

function backend() {
  vi.mocked(invoke).mockImplementation((cmd: string, args?: any) => {
    switch (cmd) {
      case "list_media":
        return Promise.resolve(library);
      case "get_media_references":
        return Promise.resolve(refs[args.id] ?? NO_REFS);
      case "delete_media":
        if (deleteError) return Promise.reject(deleteError);
        library = library.filter((m) => m.id !== args.id);
        return Promise.resolve(undefined);
      default:
        return Promise.resolve(undefined);
    }
  });
}

const calls = (cmd: string) => vi.mocked(invoke).mock.calls.filter(([c]) => c === cmd);
/** Card names in the grid, in order: each card's pick button carries its title. */
const cards = () =>
  [...screen.getByTestId("media-add-grid").querySelectorAll("button[title]:not([aria-label])")].map(
    (b) => b.getAttribute("title"),
  );
const confirmation = () => screen.getAllByRole("dialog").find((d) => d.getAttribute("aria-modal") === "true");

function show() {
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(<MediaAddDialog onPick={onPick} onClose={onClose} />);
  return { onPick, onClose };
}

describe("MediaAddDialog (P24)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    library = [
      media("pix", "Pix", "image", 30),
      media("abertura", "Abertura", "video", 20),
      media("slides", "Slides", "presentation", 10),
      media("logo", "Logo", "image", 40),
    ];
    refs = {};
    deleteError = undefined;
    backend();
  });

  it("lists the library newest first under Todos, Imagens and Vídeos", async () => {
    show();
    expect(screen.getByRole("dialog")).toHaveTextContent("Adicionar mídia ao conjunto");
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => expect(cards()).toEqual(["Logo", "Pix", "Abertura", "Slides"]));

    fireEvent.click(screen.getByRole("button", { name: "Imagens" }));
    expect(cards()).toEqual(["Logo", "Pix"]);
    expect(screen.getByRole("button", { name: "Imagens" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Vídeos" }));
    expect(cards()).toEqual(["Abertura"]);
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(cards()).toEqual(["Logo", "Pix", "Abertura", "Slides"]);
  });

  it("lists the whole library whatever the Mídia view holds", async () => {
    // The Mídia view on "Vídeos" with the search "abc".
    useMediaStore.setState({ media: [library[1]], filter: "video", search: "abc" });
    library = Array.from({ length: 250 }, (_, i) => media(`m${i}`, `Imagem ${i}`, "image", i));
    show();

    await waitFor(() => expect(cards()).toHaveLength(250));
    expect(calls("list_media")).toEqual([["list_media", { params: { limit: -1 } }]]);
  });

  it("the delete control asks before deleting and picks nothing", async () => {
    const { onPick } = show();

    fireEvent.click(await screen.findByRole("button", { name: "Excluir Pix" }));

    await waitFor(() => expect(confirmation()).toBeDefined());
    const ask = confirmation()!;
    expect(ask).toHaveTextContent("Excluir mídia");
    expect(ask).toHaveTextContent('Excluir "Pix"? Esta ação não pode ser desfeita.');
    expect(within(ask).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(within(ask).getByRole("button", { name: "Excluir" })).toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
    expect(calls("delete_media")).toHaveLength(0);
  });

  it("Excluir deletes the media and drops its card", async () => {
    const { onPick, onClose } = show();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir Pix" }));
    await waitFor(() => expect(confirmation()).toBeDefined());

    fireEvent.click(within(confirmation()!).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(cards()).toEqual(["Logo", "Abertura", "Slides"]));
    expect(calls("delete_media")).toEqual([["delete_media", { id: "pix" }]]);
    expect(confirmation()).toBeUndefined();
    expect(screen.getByRole("dialog")).toHaveTextContent("Adicionar mídia ao conjunto");
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Cancelar deletes nothing", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir Pix" }));
    await waitFor(() => expect(confirmation()).toBeDefined());

    fireEvent.click(within(confirmation()!).getByRole("button", { name: "Cancelar" }));

    expect(confirmation()).toBeUndefined();
    expect(calls("delete_media")).toHaveLength(0);
    expect(cards()).toEqual(["Logo", "Pix", "Abertura", "Slides"]);
  });

  it("media in use is refused with Mídia em uso", async () => {
    const song = { songId: "s1", songTitle: "Graça" };
    const setItem = { setId: "set-1", setName: "Culto", itemId: "i1" };
    const section = { songId: "s1", songTitle: "Graça", sectionId: "sec-1", sectionLabel: "Verso" };
    const cases: Array<[MediaReferences, string]> = [
      [{ ...NO_REFS, songs: [song] as never }, "1 música(s), 0 item(s) de conjunto e 0 seção(ões)"],
      [{ ...NO_REFS, sections: [section] as never }, "0 música(s), 0 item(s) de conjunto e 1 seção(ões)"],
      [{ ...NO_REFS, setItems: [setItem] as never }, "0 música(s), 1 item(s) de conjunto e 0 seção(ões)"],
    ];
    for (const [used, counts] of cases) {
      refs = { pix: used };
      const { unmount } = render(<MediaAddDialog onPick={vi.fn()} onClose={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: "Excluir Pix" }));
      await waitFor(() => expect(confirmation()).toBeDefined());
      const ask = confirmation()!;
      expect(ask).toHaveTextContent("Mídia em uso");
      expect(ask).toHaveTextContent(
        `Esta mídia está em uso por ${counts}. Remova as referências antes de excluir.`,
      );

      fireEvent.click(within(ask).getByRole("button", { name: "Entendido" }));

      expect(confirmation()).toBeUndefined();
      expect(cards()).toContain("Pix");
      unmount();
    }
    expect(calls("delete_media")).toHaveLength(0);
  });

  it("a failed delete shows the error and keeps the card", async () => {
    deleteError = { code: "media.db_error", params: { detail: "disk" } };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir Pix" }));
    await waitFor(() => expect(confirmation()).toBeDefined());

    fireEvent.click(within(confirmation()!).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Erro no banco de dados: disk"));
    expect(cards()).toContain("Pix");
  });

  it("an empty library or filter shows Nenhuma mídia disponível", async () => {
    library = [];
    const { unmount } = render(<MediaAddDialog onPick={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Nenhuma mídia disponível.")).toBeInTheDocument());
    unmount();

    library = [media("pix", "Pix", "image", 30)];
    show();
    await waitFor(() => expect(cards()).toEqual(["Pix"]));
    fireEvent.click(screen.getByRole("button", { name: "Vídeos" }));
    expect(screen.getByText("Nenhuma mídia disponível.")).toBeInTheDocument();
  });

  it("the close control adds and deletes nothing", async () => {
    const { onPick, onClose } = show();
    await waitFor(() => expect(cards()).toHaveLength(4));

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
    expect(calls("delete_media")).toHaveLength(0);
    expect(calls("add_set_item")).toHaveLength(0);
  });
});
