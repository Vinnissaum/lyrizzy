import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { StageApp } from "./StageApp";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    label: "stage",
    currentMonitor: vi.fn(() => Promise.resolve(null)),
  })),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const MUTATING_COMMANDS = [
  "next_slide",
  "prev_slide",
  "go_to_item",
  "set_presentation_mode",
  "load_set_for_presentation",
  "create_song",
  "update_song",
  "delete_song",
  "create_set",
  "update_set",
  "delete_set",
  "add_set_item",
  "remove_set_item",
  "update_set_item",
  "import_media",
  "delete_media",
];

describe("StageApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listen).mockResolvedValue(() => {});
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "get_presentation_state") return Promise.resolve(null);
      if (cmd === "get_countdown_state") return Promise.resolve({
        mode: "idle", durationMs: 0, remainingMs: 0, endBehavior: "holdZero",
      });
      if (cmd === "list_media") return Promise.resolve([]);
      return Promise.resolve(null);
    });
  });

  it("mounts without invoking mutating commands", async () => {
    render(<StageApp />);
    await waitFor(() => {
      const calls = vi.mocked(invoke).mock.calls.map(([cmd]) => cmd);
      for (const cmd of MUTATING_COMMANDS) {
        expect(calls, `mutating command '${cmd}' must not be called by StageApp`).not.toContain(cmd);
      }
    });
  });

  it("subscribes to state_changed and countdown_tick events", async () => {
    render(<StageApp />);
    await waitFor(() => {
      const events = vi.mocked(listen).mock.calls.map(([event]) => event);
      expect(events).toContain("state_changed");
      expect(events).toContain("countdown_tick");
      expect(events).toContain("locale_changed");
    });
  });
});
