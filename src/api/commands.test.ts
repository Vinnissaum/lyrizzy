import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(), emit: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import {
  emitVideoCommand,
  emitVideoReport,
  exitPresentation,
  onVideoCommand,
  onVideoReport,
} from "./commands";
import type { VideoCommand, VideoReport } from "../types";

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

describe("video events (P23, AD-094)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(emit).mockResolvedValue(undefined);
    vi.mocked(listen).mockResolvedValue(() => {});
  });

  it("video events use the documented names and payloads", async () => {
    const report: VideoReport = {
      output: "two",
      itemId: "vid-1",
      status: "playing",
      positionMs: 65_000,
      durationMs: 200_000,
      muted: false,
    };
    const gone: VideoReport = { ...report, itemId: null, status: "loading", positionMs: 0, durationMs: null };
    await emitVideoReport(report);
    await emitVideoReport(gone);
    const command: VideoCommand = { output: "one", itemId: "vid-1", action: { kind: "seek", positionMs: 50_000 } };
    await emitVideoCommand(command);
    expect(vi.mocked(emit).mock.calls).toEqual([
      ["video_report", report],
      ["video_report", gone],
      ["video_command", command],
    ]);
    // Frontend events only: nothing reaches a Rust command.
    expect(vi.mocked(invoke)).not.toHaveBeenCalled();

    // Every report reaches the operator, whichever output sent it.
    const onReport = vi.fn();
    await onVideoReport(onReport);
    expect(vi.mocked(listen).mock.calls[0][0]).toBe("video_report");
    const reportHandler = vi.mocked(listen).mock.calls[0][1] as (e: { payload: unknown }) => void;
    reportHandler({ payload: report });
    expect(onReport).toHaveBeenCalledWith(report);

    // A wall hears only the commands addressed to its own output.
    const onCommand = vi.fn();
    await onVideoCommand("two", onCommand);
    expect(vi.mocked(listen).mock.calls[1][0]).toBe("video_command");
    const commandHandler = vi.mocked(listen).mock.calls[1][1] as (e: { payload: unknown }) => void;
    commandHandler({ payload: command });
    expect(onCommand).not.toHaveBeenCalled();
    const forTwo: VideoCommand = { output: "two", itemId: "vid-1", action: { kind: "mute", muted: true } };
    commandHandler({ payload: forTwo });
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith(forTwo);
  });
});
