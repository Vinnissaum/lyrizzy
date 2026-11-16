import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/commands", () => ({
  getOrCreateDefaultSet: vi.fn(),
  getSet: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn().mockResolvedValue(undefined),
  listSongs: vi.fn(),
}));

import {
  getOrCreateDefaultSet,
  getSet,
  getSetting,
  listSongs,
  setSetting,
} from "../api/commands";
import { useLibraryStore, ACTIVE_SET_KEY } from "./library";
import type { ServiceSet, Song } from "../types";

const mockGetOrCreateDefaultSet = vi.mocked(getOrCreateDefaultSet);
const mockGetSet = vi.mocked(getSet);
const mockGetSetting = vi.mocked(getSetting);
const mockSetSetting = vi.mocked(setSetting);

const makeSet = (id: string): ServiceSet =>
  ({ id, name: `Set ${id}` }) as unknown as ServiceSet;

describe("useLibraryStore — loadActiveSet / setActiveSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLibraryStore.setState({ activeSetId: null });
  });

  it("(a) uses the stored id when it exists", async () => {
    mockGetSetting.mockResolvedValue("set-1");
    mockGetSet.mockResolvedValue(makeSet("set-1"));

    await useLibraryStore.getState().loadActiveSet();

    expect(useLibraryStore.getState().activeSetId).toBe("set-1");
    expect(mockGetOrCreateDefaultSet).not.toHaveBeenCalled();
  });

  it("(b) falls back to the default set when getSetting rejects", async () => {
    mockGetSetting.mockRejectedValue(new Error("no such key"));
    mockGetOrCreateDefaultSet.mockResolvedValue(makeSet("default-set"));

    await useLibraryStore.getState().loadActiveSet();

    expect(useLibraryStore.getState().activeSetId).toBe("default-set");
    expect(mockGetSet).not.toHaveBeenCalled();
  });

  it("(c) falls back to the default set when the stored id's getSet rejects", async () => {
    mockGetSetting.mockResolvedValue("stale-set");
    mockGetSet.mockRejectedValue(new Error("not found"));
    mockGetOrCreateDefaultSet.mockResolvedValue(makeSet("default-set"));

    await useLibraryStore.getState().loadActiveSet();

    expect(useLibraryStore.getState().activeSetId).toBe("default-set");
  });

  it("(d) setActiveSet updates state immediately and persists via setSetting", async () => {
    await useLibraryStore.getState().setActiveSet("set-42");

    expect(useLibraryStore.getState().activeSetId).toBe("set-42");
    expect(mockSetSetting).toHaveBeenCalledWith(ACTIVE_SET_KEY, "set-42");
  });

  it("setActiveSet does not throw when the persist call rejects", async () => {
    mockSetSetting.mockRejectedValue(new Error("db error"));

    await expect(
      useLibraryStore.getState().setActiveSet("set-99"),
    ).resolves.toBeUndefined();

    expect(useLibraryStore.getState().activeSetId).toBe("set-99");
  });
});

describe("useLibraryStore — the presenter's unfiltered songs (P23)", () => {
  const song = (id: string, title: string) => ({ id, title }) as unknown as Song;
  const library = [song("s1", "AJUNTAMENTO"), song("s2", "O AMOR DE DEUS")];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSongs).mockImplementation(async (params) =>
      params?.search
        ? library.filter((s) => s.title.toLowerCase().includes(params.search!.toLowerCase()))
        : library,
    );
  });

  it("loading presenter titles leaves the search and its result alone", async () => {
    useLibraryStore.setState({ search: "amor", songs: [library[1]], allSongs: null });

    await useLibraryStore.getState().refreshAllSongs();

    const s = useLibraryStore.getState();
    expect(s.search).toBe("amor");
    expect(s.songs).toEqual([library[1]]);
    expect(s.allSongs).toEqual(library);
    expect(vi.mocked(listSongs)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(listSongs).mock.calls[0][0]?.search).toBeUndefined();
  });

  it("a library refresh under a search keeps the whole library current too", async () => {
    useLibraryStore.setState({ search: "amor", songs: [], allSongs: null });

    await useLibraryStore.getState().refresh();

    expect(useLibraryStore.getState().songs).toEqual([library[1]]);
    expect(useLibraryStore.getState().allSongs).toEqual(library);
  });
});
