import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { LiveImagePicker, IMAGE_EXTENSIONS } from "./LiveImagePicker";
import type { Media } from "../../types";

// The presenter's Imagem dialog: it uploads photos from the computer (P23 S2)
// and adds a clicked image to the set after the current item (P24 S1). The
// real dialog; the backend (invoke) and the OS file dialog are stubbed.

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

function image(id: string, name: string, createdAt: number): Media {
  return {
    id,
    fileName: `${id}.png`,
    displayName: name,
    kind: "image",
    mimeType: "image/png",
    byteSize: 1,
    createdAt,
    updatedAt: createdAt,
  };
}

let library: Media[];
/** Paths whose import fails, and import calls left hanging until released. */
let failing: Set<string>;
let held: Array<() => void>;
let hold: boolean;
let clock: number;
/** add_set_item: refused with this error when set, else held until released while `holdAdds`. */
let addError: unknown;
let holdAdds: boolean;
let heldAdds: Array<() => void>;
let addCount: number;

function backend() {
  vi.mocked(invoke).mockImplementation((cmd: string, args?: any) => {
    switch (cmd) {
      case "list_media":
        // The backend returns them in no order the dialog may rely on.
        return Promise.resolve(
          library.filter((m) => !args?.params?.kind || m.kind === args.params.kind),
        );
      case "import_media": {
        const path: string = args.sourcePath;
        const finish = () => {
          if (failing.has(path)) throw { code: "media.copy_error", params: { detail: "disk" } };
          const name = path.split("/").pop()!.replace(/\.\w+$/, "");
          const m = image(`new-${name}`, name, ++clock);
          library = [...library, m];
          return m;
        };
        if (!hold) {
          try {
            return Promise.resolve(finish());
          } catch (e) {
            return Promise.reject(e);
          }
        }
        return new Promise((resolve, reject) => {
          held.push(() => {
            try {
              resolve(finish());
            } catch (e) {
              reject(e);
            }
          });
        });
      }
      case "add_set_item": {
        if (addError) return Promise.reject(addError);
        const item = { id: `added-${++addCount}`, ...args.payload };
        if (!holdAdds) return Promise.resolve(item);
        return new Promise((resolve) => heldAdds.push(() => resolve(item)));
      }
      default:
        return Promise.resolve(undefined);
    }
  });
}

const calls = (cmd: string) => vi.mocked(invoke).mock.calls.filter(([c]) => c === cmd);
const uploadButton = () => screen.getByRole("button", { name: /Enviar imagem do computador|Importando/ });
const gridNames = () =>
  within(screen.getByTestId("live-image-grid"))
    .queryAllByRole("button")
    .map((b) => b.textContent);
/** Commands that change something: everything but the reads. */
const changes = () =>
  vi.mocked(invoke).mock.calls.map(([c]) => c).filter((c) => !c.startsWith("list_") && !c.startsWith("get_"));

/** The presenter on item B of the set "set-1". */
function show(onClose = vi.fn()) {
  render(<LiveImagePicker setId="set-1" anchorItemId="item-b" onClose={onClose} />);
  return { onClose };
}

describe("LiveImagePicker (P23, P24)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    library = [image("old-1", "Oferta", 10), image("old-2", "Boas-vindas", 20)];
    failing = new Set();
    held = [];
    hold = false;
    clock = 100;
    addError = undefined;
    holdAdds = false;
    heldAdds = [];
    addCount = 0;
    backend();
  });

  it("upload control shows with images and with none", async () => {
    show();
    expect(screen.getByRole("dialog")).toHaveTextContent("Adicionar imagem ao conjunto");
    await waitFor(() => expect(gridNames()).toHaveLength(2));
    expect(screen.getByRole("button", { name: "Enviar imagem do computador" })).toBeEnabled();

    library = [];
    render(<LiveImagePicker setId="set-1" anchorItemId="item-b" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Nenhuma mídia disponível.")).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: "Enviar imagem do computador" })).toHaveLength(2);
  });

  it("upload opens the file dialog for images, several files", async () => {
    vi.mocked(open).mockResolvedValue(null);
    show();

    fireEvent.click(uploadButton());

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    const options = vi.mocked(open).mock.calls[0][0]!;
    expect(options.multiple).toBe(true);
    expect(options.filters).toHaveLength(1);
    expect(options.filters![0].extensions).toEqual(["png", "jpg", "jpeg", "webp", "gif"]);
    expect(IMAGE_EXTENSIONS).toEqual(["png", "jpg", "jpeg", "webp", "gif"]);
  });

  it("picked files are imported and listed first without projecting", async () => {
    vi.mocked(open).mockResolvedValue(["/fotos/batismo.jpg", "/fotos/ceia.png"] as never);
    const { onClose } = show();
    await waitFor(() => expect(gridNames()).toHaveLength(2));

    fireEvent.click(uploadButton());

    await waitFor(() => expect(gridNames()).toHaveLength(4));
    expect(calls("import_media").map(([, a]) => (a as any).sourcePath)).toEqual([
      "/fotos/batismo.jpg",
      "/fotos/ceia.png",
    ]);
    // Newest first: the two uploads lead, the last one imported on top.
    expect(gridNames()).toEqual(["ceia", "batismo", "Boas-vindas", "Oferta"]);
    expect(calls("set_media_overlay")).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a clicked image is added after the anchor and marked Adicionada", async () => {
    const { onClose } = show();

    fireEvent.click(await screen.findByRole("button", { name: "Oferta" }));

    await waitFor(() => expect(gridNames()).toContain("OfertaAdicionada"));
    expect(calls("add_set_item")).toEqual([
      [
        "add_set_item",
        {
          payload: {
            setId: "set-1",
            itemType: "media",
            mediaId: "old-1",
            mediaOptions: { loop: false, mute: false, autoAdvanceOnEnd: true },
            afterItemId: "item-b",
          },
        },
      ],
    ]);
    // Added, never projected, and no wall moved.
    expect(changes()).toEqual(["add_set_item"]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a second pick lands right after the first, even while the first is pending", async () => {
    holdAdds = true;
    show();
    await waitFor(() => expect(gridNames()).toHaveLength(2));

    fireEvent.click(screen.getByRole("button", { name: "Oferta" }));
    fireEvent.click(screen.getByRole("button", { name: "Boas-vindas" }));
    // The second waits for the item the first creates.
    await waitFor(() => expect(calls("add_set_item")).toHaveLength(1));
    expect((calls("add_set_item")[0][1] as any).payload.afterItemId).toBe("item-b");

    heldAdds.shift()!();
    await waitFor(() => expect(calls("add_set_item")).toHaveLength(2));
    const second = (calls("add_set_item")[1][1] as any).payload;
    expect(second.mediaId).toBe("old-2");
    expect(second.afterItemId).toBe("added-1");

    heldAdds.shift()!();
    await waitFor(() => expect(gridNames()).toEqual(["Boas-vindasAdicionada", "OfertaAdicionada"]));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("the first pick follows the current item at the click", async () => {
    const { rerender } = render(<LiveImagePicker setId="set-1" anchorItemId="item-b" onClose={vi.fn()} />);
    await waitFor(() => expect(gridNames()).toHaveLength(2));
    // The wall moved on while the dialog was open (a video ended, an arrow key).
    rerender(<LiveImagePicker setId="set-1" anchorItemId="item-c" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Oferta" }));

    await waitFor(() => expect(calls("add_set_item")).toHaveLength(1));
    expect((calls("add_set_item")[0][1] as any).payload.afterItemId).toBe("item-c");
  });

  it("a later pick still follows the first after the current item moves", async () => {
    const { rerender } = render(<LiveImagePicker setId="set-1" anchorItemId="item-b" onClose={vi.fn()} />);
    await waitFor(() => expect(gridNames()).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Oferta" }));
    await waitFor(() => expect(gridNames()).toContain("OfertaAdicionada"));

    rerender(<LiveImagePicker setId="set-1" anchorItemId="item-c" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Boas-vindas" }));

    await waitFor(() => expect(calls("add_set_item")).toHaveLength(2));
    expect((calls("add_set_item")[0][1] as any).payload.afterItemId).toBe("item-b");
    expect((calls("add_set_item")[1][1] as any).payload.afterItemId).toBe("added-1");
  });

  it("uploaded images are listed first and nothing is added to the set", async () => {
    vi.mocked(open).mockResolvedValue(["/fotos/batismo.jpg", "/fotos/ceia.png"] as never);
    show();
    await waitFor(() => expect(gridNames()).toHaveLength(2));

    fireEvent.click(uploadButton());

    await waitFor(() => expect(gridNames()).toEqual(["ceia", "batismo", "Boas-vindas", "Oferta"]));
    expect(calls("import_media")).toHaveLength(2);
    expect(calls("add_set_item")).toHaveLength(0);
  });

  it("a refused add keeps the dialog open with the error", async () => {
    addError = { code: "set.item_not_found", params: {} };
    const { onClose } = show();

    fireEvent.click(await screen.findByRole("button", { name: "Oferta" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Item não encontrado"));
    expect(gridNames()).toEqual(["Boas-vindas", "Oferta"]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("upload shows its progress and is disabled meanwhile", async () => {
    hold = true;
    vi.mocked(open).mockResolvedValue(["/fotos/a.png", "/fotos/b.png"] as never);
    show();

    fireEvent.click(uploadButton());

    await waitFor(() => expect(uploadButton()).toHaveTextContent("Importando 1/2…"));
    expect(uploadButton()).toBeDisabled();
    expect(calls("import_media")).toHaveLength(1);

    held.shift()!();
    await waitFor(() => expect(uploadButton()).toHaveTextContent("Importando 2/2…"));
    expect(uploadButton()).toBeDisabled();

    held.shift()!();
    await waitFor(() => expect(uploadButton()).toHaveTextContent("Enviar imagem do computador"));
    expect(uploadButton()).toBeEnabled();
  });

  it("a failed file is counted and the others are imported", async () => {
    failing.add("/fotos/b.png");
    vi.mocked(open).mockResolvedValue(["/fotos/a.png", "/fotos/b.png", "/fotos/c.png"] as never);
    const { onClose } = show();
    await waitFor(() => expect(gridNames()).toHaveLength(2));

    fireEvent.click(uploadButton());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("1 arquivo não foi importado"));
    expect(calls("import_media")).toHaveLength(3);
    expect(gridNames()).toEqual(["c", "a", "Boas-vindas", "Oferta"]);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("two failed files read in the plural", async () => {
    failing.add("/fotos/a.png");
    failing.add("/fotos/b.png");
    vi.mocked(open).mockResolvedValue(["/fotos/a.png", "/fotos/b.png"] as never);
    show();

    fireEvent.click(uploadButton());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("2 arquivos não foram importados"),
    );
  });

  it("cancelling the file dialog imports nothing", async () => {
    vi.mocked(open).mockResolvedValue(null);
    const { onClose } = show();
    await waitFor(() => expect(gridNames()).toHaveLength(2));
    const listed = calls("list_media").length;

    fireEvent.click(uploadButton());
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    // Let the cancelled pick settle.
    await Promise.resolve();

    expect(calls("import_media")).toHaveLength(0);
    expect(calls("list_media")).toHaveLength(listed);
    expect(gridNames()).toEqual(["Boas-vindas", "Oferta"]);
    expect(uploadButton()).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
