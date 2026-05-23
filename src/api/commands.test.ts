import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(), emit: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { exitPresentation } from "./commands";

describe("exitPresentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("coalesces concurrent calls — invoke called exactly once", async () => {
    let resolveFirst!: () => void;
    vi.mocked(invoke).mockReturnValueOnce(
      new Promise<void>((r) => {
        resolveFirst = r;
      }),
    );

    const p1 = exitPresentation();
    const p2 = exitPresentation();

    expect(vi.mocked(invoke)).toHaveBeenCalledTimes(1);
    expect(p1).toBe(p2);

    resolveFirst();
    await p1;
  });

  it("creates a fresh call after the previous one resolves", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await exitPresentation();
    await exitPresentation();

    expect(vi.mocked(invoke)).toHaveBeenCalledTimes(2);
  });
});
