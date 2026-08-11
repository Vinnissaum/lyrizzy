import { describe, it, expect, vi, afterEach } from "vitest";
import {
  monitorIdentity,
  resolveMonitorName,
  loadMonitorNames,
  saveMonitorName,
  outputScreenName,
  MONITOR_NAMES_KEY,
} from "./monitorNames";
import type { MonitorInfo } from "../types";
import * as commands from "../api/commands";

function mon(overrides: Partial<MonitorInfo> = {}): MonitorInfo {
  return {
    width: 1920,
    height: 1080,
    x: 0,
    y: 0,
    scaleFactor: 1,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("monitorIdentity", () => {
  it("named monitor produces a name: key", () => {
    expect(monitorIdentity(mon({ name: "HDMI TV" }))).toBe("name:HDMI TV");
  });

  it("unnamed monitor produces a geom: key", () => {
    expect(monitorIdentity(mon({ x: 1920, y: 0 }))).toBe(
      "geom:1920x1080@1920,0",
    );
  });

  it("whitespace-only OS name is treated as absent", () => {
    expect(monitorIdentity(mon({ name: "   " }))).toBe("geom:1920x1080@0,0");
  });
});

describe("resolveMonitorName", () => {
  it("uses the operator-chosen name when present", () => {
    const m = mon({ name: "HDMI TV" });
    const names = { [monitorIdentity(m)]: "Sanctuary Screen" };
    expect(resolveMonitorName(m, 0, names)).toBe("Sanctuary Screen");
  });

  it("falls back to the OS name when no operator name is stored", () => {
    const m = mon({ name: "HDMI TV" });
    expect(resolveMonitorName(m, 0, {})).toBe("HDMI TV");
  });

  it("falls back to the positional default when both are absent", () => {
    const m = mon({ x: 0, y: 0 });
    expect(resolveMonitorName(m, 1, {})).toBe("Monitor 2 — 1920×1080");
  });
});

describe("outputScreenName", () => {
  it("returns the fallback when index is null", () => {
    const monitors = [mon({ name: "HDMI TV" })];
    expect(outputScreenName(monitors, {}, null, "No Screen")).toBe(
      "No Screen",
    );
  });

  it("returns the fallback when index is out of range (monitor unplugged)", () => {
    const monitors = [mon({ name: "HDMI TV" })];
    expect(() =>
      outputScreenName(monitors, {}, 5, "No Screen"),
    ).not.toThrow();
    expect(outputScreenName(monitors, {}, 5, "No Screen")).toBe("No Screen");
  });

  it("returns the operator-chosen name for a valid index", () => {
    const m = mon({ name: "HDMI TV" });
    const monitors = [m];
    const names = { [monitorIdentity(m)]: "Sanctuary Screen" };
    expect(outputScreenName(monitors, names, 0, "No Screen")).toBe(
      "Sanctuary Screen",
    );
  });

  it("falls back through OS name, then Monitor N — W×H, when no chosen name exists", () => {
    const named = mon({ name: "Projector" });
    const unnamed = mon({ name: "", x: 1920 });
    const monitors = [named, unnamed];
    expect(outputScreenName(monitors, {}, 0, "No Screen")).toBe("Projector");
    expect(outputScreenName(monitors, {}, 1, "No Screen")).toBe(
      "Monitor 2 — 1920×1080",
    );
  });
});

describe("loadMonitorNames / saveMonitorName", () => {
  it("loads an empty map when nothing is stored", async () => {
    vi.spyOn(commands, "getSetting").mockResolvedValue("");
    expect(await loadMonitorNames()).toEqual({});
  });

  it("loads an empty map on malformed JSON", async () => {
    vi.spyOn(commands, "getSetting").mockResolvedValue("{not json");
    expect(await loadMonitorNames()).toEqual({});
  });

  it("loads an empty map when getSetting rejects", async () => {
    vi.spyOn(commands, "getSetting").mockRejectedValue(new Error("no row"));
    expect(await loadMonitorNames()).toEqual({});
  });

  it("saving one name keeps an unrelated stored entry for an absent monitor", async () => {
    vi.spyOn(commands, "getSetting").mockResolvedValue(
      JSON.stringify({ "geom:800x600@0,0": "Old Monitor" }),
    );
    const setSpy = vi.spyOn(commands, "setSetting").mockResolvedValue();

    await saveMonitorName("name:HDMI TV", "Sanctuary Screen");

    expect(setSpy).toHaveBeenCalledWith(
      MONITOR_NAMES_KEY,
      JSON.stringify({
        "geom:800x600@0,0": "Old Monitor",
        "name:HDMI TV": "Sanctuary Screen",
      }),
    );
  });

  it("two monitors swapping enumeration order keep their own names (identity-keyed, not index-keyed)", async () => {
    const monitorA = mon({ name: "HDMI TV" });
    const monitorB = mon({ name: "Projector", x: 1920 });
    const names = {
      [monitorIdentity(monitorA)]: "Sanctuary Screen",
      [monitorIdentity(monitorB)]: "Lobby Screen",
    };

    // Original order: A at index 0, B at index 1.
    expect(resolveMonitorName(monitorA, 0, names)).toBe("Sanctuary Screen");
    expect(resolveMonitorName(monitorB, 1, names)).toBe("Lobby Screen");

    // Swapped enumeration order: B at index 0, A at index 1 — names follow
    // identity, not the array position.
    expect(resolveMonitorName(monitorB, 0, names)).toBe("Lobby Screen");
    expect(resolveMonitorName(monitorA, 1, names)).toBe("Sanctuary Screen");
  });
});
