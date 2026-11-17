import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { OperatorPresentationLayout } from "./OperatorPresentationLayout";
import { OutputLaunchModal } from "./OutputLaunchModal";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import type { Media, PresentationState, ServiceSet, Song } from "../../types";

// P24 C6: an image item keeps its name while presenting, whatever the Mídia
// view filters or searches. The real layout, set list, strophes pane, live
// preview, launch modal and media store; only the backend (invoke, listen) and
// the switchers this slice does not touch are stubbed. `list_media` filters by
// kind, search and limit, as the backend does.

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));
vi.mock("./OutputSwitcher", () => ({
  OutputSwitcher: () => null,
}));
vi.mock("./MicSwitch", () => ({
  MicSwitch: () => null,
}));
vi.mock("./StreamProfileSwitcher", () => ({
  StreamProfileSwitcher: () => null,
}));

import { invoke } from "@tauri-apps/api/core";

// jsdom lacks ResizeObserver; the live preview's stage uses it.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const song: Song = {
  id: "song-1", title: "AJUNTAMENTO", artist: "Jorge Camargo", language: "pt", scrimOpacity: 35,
  createdAt: 0, updatedAt: 0,
  sections: [{ id: "s1", songId: "song-1", label: "Estrofe 1", type: "verse", body: "verso", sortOrder: 0, repeatCount: 1 }],
};

const media = (id: string, displayName: string, kind: "image" | "video", createdAt: number): Media => ({
  id, displayName, kind, createdAt, updatedAt: createdAt, byteSize: 1,
  fileName: `${id}.${kind === "image" ? "png" : "webm"}`,
  mimeType: kind === "image" ? "image/png" : "video/webm",
});

// The video matches the Mídia view's search "abc"; the image matches neither its
// filter nor its search, so only the whole library holds it.
const library = [media("pix", "Pix", "image", 30), media("v1", "Vinheta abc", "video", 20)];

const set: ServiceSet = {
  id: "set-1",
  name: "Culto",
  createdAt: 0,
  updatedAt: 0,
  items: [
    { id: "item-1", setId: "set-1", itemType: "song", songId: "song-1", sortOrder: 0 },
    { id: "item-img", setId: "set-1", itemType: "media", mediaId: "pix", mediaKind: "image", sortOrder: 1,
      mediaOptions: { loop: false, mute: false, autoAdvanceOnEnd: true } },
  ],
};

const liveOn = (index: number): PresentationState => ({
  mode: "live", currentItemIndex: index, currentSlideIndex: 0, itemSlideCounts: [2, 1], set,
  currentSlide: index === 1 ? { lines: [], sectionLabel: "", sectionId: "media" } : undefined,
});

function backend(state: PresentationState) {
  vi.mocked(invoke).mockImplementation((cmd: string, args?: any) => {
    switch (cmd) {
      case "list_media": {
        // As the backend: newest first, by kind and search, the 200 newest
        // unless a limit is given; a negative limit is no limit.
        const p = args?.params ?? {};
        const hits = library
          .filter((m) => !p.kind || m.kind === p.kind)
          .filter((m) => !p.search || m.displayName.toLowerCase().includes(p.search.toLowerCase()))
          .sort((a, b) => b.createdAt - a.createdAt);
        const limit: number = p.limit ?? 200;
        return Promise.resolve(limit < 0 ? hits : hits.slice(0, limit));
      }
      case "list_songs":
        return Promise.resolve([song]);
      case "get_presentation_state":
        return Promise.resolve(args?.output === "two" ? { ...state, set: null, mode: "idle" } : state);
      default:
        return Promise.resolve([]);
    }
  });
}

/** The media store as the Mídia view leaves it on "Vídeos" with the search "abc". */
function mediaViewOnVideos() {
  useMediaStore.setState({ media: [library[1]], filter: "video", search: "abc", allMedia: null });
}

function present(index: number) {
  const state = liveOn(index);
  backend(state);
  useLibraryStore.setState({ songs: [song], allSongs: null, search: "", activeSetId: "set-1" });
  usePresentationStore.setState({ state, focusedOutput: "one", output: "one", pendingSelection: null });
  return render(<OperatorPresentationLayout />);
}

const setPane = () => screen.getByText("Conjunto").closest("div")!.parentElement as HTMLElement;

describe("Image items named from the whole media library (P24)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaViewOnVideos();
  });

  it("an image item is named from the whole library under a Mídia filter", async () => {
    present(0);

    // The set pane row, once the whole library has loaded.
    await waitFor(() => expect(within(setPane()).getByText("Pix")).toBeInTheDocument());

    // The remove confirmation (the image is not on screen, so it can go).
    fireEvent.click(within(setPane()).getByRole("button", { name: "Remover Pix" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Remover “Pix” do conjunto?");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    // With the image on screen: the strophes header and the strophes pane's card.
    act(() => {
      usePresentationStore.setState({ state: liveOn(1) });
    });
    expect(screen.getByText(/^Estrofes — Pix$/)).toBeInTheDocument();
    const strophes = screen.getByText(/^Estrofes — Pix$/).closest("header")!.parentElement as HTMLElement;
    expect(within(strophes).getAllByText("Pix").length).toBeGreaterThan(0);

    // The Mídia view keeps its own filter, search and list.
    const view = useMediaStore.getState();
    expect(view.media.map((m) => m.id)).toEqual(["v1"]);
    expect(view.filter).toBe("video");
    expect(view.search).toBe("abc");
  });

  it("the Tela 2 launch list names an image item from the whole library", async () => {
    backend(liveOn(0));
    useMediaStore.setState({ allMedia: library });
    usePresentationStore.setState({ state: liveOn(0), focusedOutput: "two", output: "one", pendingSelection: null });

    render(<OutputLaunchModal output="two" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Pix")).toBeInTheDocument());
    expect(screen.queryByText("Mídia")).toBeNull();
  });

  it("the live preview shows an image the Mídia view does not list", async () => {
    present(1);

    const pane = screen.getByTestId("live-pane");
    await waitFor(() =>
      expect(pane.querySelector("img")?.getAttribute("src")).toBe("http://asset.localhost/media/pix.png"),
    );
  });
});
