import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ImageOverlayDialog, IMAGE_EXTENSIONS } from "./ImageOverlayDialog";
import type { Media } from "../../types";

// P23 S2: the Imagem dialog uploads photos from the computer. The real dialog
// and the real media store; the backend (invoke) and the OS file dialog are
// stubbed.

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
      default:
        return Promise.resolve(undefined);
    }
  });
}

const calls = (cmd: string) => vi.mocked(invoke).mock.calls.filter(([c]) => c === cmd);
const uploadButton = () => screen.getByRole("button", { name: /Enviar imagem do computador|Importando/ });
const gridNames = () =>
  within(screen.getByTestId("image-overlay-grid"))
    .queryAllByRole("button")
    .map((b) => b.textContent);

function show(onSelect = vi.fn(), onClose = vi.fn()) {
  render(<ImageOverlayDialog onSelect={onSelect} onClose={onClose} />);
  return { onSelect, onClose };
}

describe("ImageOverlayDialog (P23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    library = [image("old-1", "Oferta", 10), image("old-2", "Boas-vindas", 20)];
    failing = new Set();
    held = [];
    hold = false;
    clock = 100;
    backend();
  });

  it("upload control shows with images and with none", async () => {
    show();
    expect(screen.getByRole("dialog")).toHaveTextContent("Selecionar imagem");
    await waitFor(() => expect(gridNames()).toHaveLength(2));
    expect(screen.getByRole("button", { name: "Enviar imagem do computador" })).toBeEnabled();

    library = [];
    render(<ImageOverlayDialog onSelect={vi.fn()} onClose={vi.fn()} />);
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
    const { onSelect, onClose } = show();
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
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clicking a thumbnail hands its id to the host", async () => {
    vi.mocked(open).mockResolvedValue(["/fotos/batismo.jpg"] as never);
    const { onSelect } = show();
    fireEvent.click(uploadButton());

    fireEvent.click(await screen.findByRole("button", { name: "batismo" }));

    expect(onSelect).toHaveBeenCalledWith("new-batismo");
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
