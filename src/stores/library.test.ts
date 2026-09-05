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
  setSetting,
} from "../api/commands";
import { useLibraryStore, ACTIVE_SET_KEY } from "./library";
import type { ServiceSet } from "../types";

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
