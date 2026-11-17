import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useMediaStore } from "./media";
import type { Media } from "../types";

const makeMedia = (id: string, kind: "image" | "video" = "image"): Media => ({
  id,
  fileName: `${id}.${kind === "video" ? "mp4" : "jpg"}`,
  displayName: `File ${id}`,
  kind,
  mimeType: kind === "image" ? "image/jpeg" : "video/mp4",
  byteSize: 1024 * 512,
  createdAt: 1000,
  updatedAt: 1000,
});

describe("useMediaStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listen).mockResolvedValue(() => {});
    vi.mocked(invoke).mockResolvedValue([]);
    useMediaStore.setState({
      media: [],
      allMedia: null,
      isLoading: false,
      filter: undefined,
      search: "",
    });
  });

  it("refresh populates media list from backend", async () => {
    const items = [makeMedia("1"), makeMedia("2", "video")];
    vi.mocked(invoke).mockResolvedValue(items);

    await useMediaStore.getState().refresh();

    expect(useMediaStore.getState().media).toEqual(items);
    expect(useMediaStore.getState().isLoading).toBe(false);
  });

  it("refresh passes kind filter to listMedia", async () => {
    useMediaStore.setState({ filter: "image" });
    vi.mocked(invoke).mockResolvedValue([]);

    await useMediaStore.getState().refresh();

    expect(vi.mocked(invoke)).toHaveBeenCalledWith(
      "list_media",
      expect.objectContaining({ params: expect.objectContaining({ kind: "image" }) })
    );
  });

  it("setFilter updates filter and triggers refresh", async () => {
    vi.mocked(invoke).mockResolvedValue([makeMedia("a")]);

    useMediaStore.getState().setFilter("video");

    expect(useMediaStore.getState().filter).toBe("video");
    await new Promise((r) => setTimeout(r, 0));
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("list_media", expect.anything());
  });

  it("subscribe loads media and wires up media_library_changed listener", async () => {
    let capturedCb: (() => void) | undefined;
    vi.mocked(listen).mockImplementation((event, cb) => {
      if (event === "media_library_changed") {
        capturedCb = () => cb({ event, id: 1, payload: undefined } as any);
      }
      return Promise.resolve(() => {});
    });

    const initial = [makeMedia("x")];
    vi.mocked(invoke).mockResolvedValue(initial);
    const unsub = await useMediaStore.getState().subscribe();
    expect(useMediaStore.getState().media).toEqual(initial);

    // Simulate media_library_changed event
    const updated = [makeMedia("x"), makeMedia("y")];
    vi.mocked(invoke).mockResolvedValue(updated);
    capturedCb?.();
    await new Promise((r) => setTimeout(r, 10));

    expect(useMediaStore.getState().media).toEqual(updated);
    await unsub();
  });

  it("subscribe returns an unlisten function", async () => {
    const unlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlisten);

    const unsub = await useMediaStore.getState().subscribe();
    await unsub();

    expect(unlisten).toHaveBeenCalled();
  });

  // ─── The whole library, for the presenter and the wall (P24) ──────────────

  it("the whole library is asked with no cap", async () => {
    let onChanged: (() => void) | undefined;
    vi.mocked(listen).mockImplementation((event, cb) => {
      if (event === "media_library_changed") {
        onChanged = () => cb({ event, id: 1, payload: undefined } as never);
      }
      return Promise.resolve(() => {});
    });
    const first = [makeMedia("a"), makeMedia("b", "video")];
    vi.mocked(invoke).mockResolvedValue(first);

    const unsub = await useMediaStore.getState().subscribeAllMedia();
    await vi.waitFor(() => expect(useMediaStore.getState().allMedia).toEqual(first));

    // No kind, no search, and a negative limit - SQLite's "no limit".
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("list_media", { params: { limit: -1 } });

    // A media_library_changed reloads it, again with no cap.
    vi.mocked(invoke).mockClear();
    const second = [...first, makeMedia("c")];
    vi.mocked(invoke).mockResolvedValue(second);
    onChanged?.();
    await vi.waitFor(() => expect(useMediaStore.getState().allMedia).toEqual(second));
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("list_media", { params: { limit: -1 } });
    await unsub();
  });

  it("loading the whole library leaves the Mídia view alone", async () => {
    // The Mídia view on "Vídeos" with the search "abc", holding one video.
    const filtered = [makeMedia("v1", "video")];
    useMediaStore.setState({ media: filtered, filter: "video", search: "abc" });
    const whole = [makeMedia("i1"), makeMedia("v1", "video"), makeMedia("i2")];
    vi.mocked(invoke).mockResolvedValue(whole);

    await useMediaStore.getState().refreshAllMedia();

    const s = useMediaStore.getState();
    expect(s.allMedia).toEqual(whole);
    expect(s.media).toEqual(filtered);
    expect(s.filter).toBe("video");
    expect(s.search).toBe("abc");
  });
});
