import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MicAudioSettings } from "./MicAudioSettings";

vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));

import { useSettingsStore } from "../../stores/settings";
import type { MonitorInfo, OutputId } from "../../types";
import type { MonitorNameMap } from "../../utils/monitorNames";

const setOutputAudio = vi.fn();

const DEFAULT_OUTPUT_AUDIO = {
  micEnabled: false,
  micMuted: false,
  micDelayMs: 0,
  cameraUnmuted: false,
  micDevice: null,
  outputDevice: null,
};

function mockStore(opts: {
  monitors?: MonitorInfo[];
  monitorNames?: MonitorNameMap;
  outputMonitorIndex?: Record<OutputId, number | null>;
}) {
  const state = {
    audio: {
      one: { ...DEFAULT_OUTPUT_AUDIO },
      two: { ...DEFAULT_OUTPUT_AUDIO },
    },
    setOutputAudio,
    monitors: opts.monitors ?? [],
    monitorNames: opts.monitorNames ?? {},
    outputMonitorIndex: opts.outputMonitorIndex ?? { one: null, two: null },
  };
  vi.mocked(useSettingsStore).mockImplementation((sel: any) => sel(state));
  return state;
}

describe("MicAudioSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the plain Tela N label when the output has no assigned monitor", () => {
    mockStore({ monitors: [], monitorNames: {}, outputMonitorIndex: { one: null, two: null } });
    render(<MicAudioSettings />);
    expect(screen.getByText("Tela 1")).toBeInTheDocument();
    expect(screen.getByText("Tela 2")).toBeInTheDocument();
  });

  it("shows the resolved monitor name alongside the Tela N label when assigned", () => {
    mockStore({
      monitors: [
        { name: "HDMI-1", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 },
      ],
      monitorNames: { "name:HDMI-1": "Projetor" },
      outputMonitorIndex: { one: 0, two: null },
    });
    render(<MicAudioSettings />);
    expect(screen.getByText("Tela 1 — Projetor")).toBeInTheDocument();
    expect(screen.getByText("Tela 2")).toBeInTheDocument();
  });

  it("updates the heading when the store name changes, with no remount", () => {
    const state = mockStore({
      monitors: [
        { name: "HDMI-1", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 },
      ],
      monitorNames: {},
      outputMonitorIndex: { one: 0, two: null },
    });

    const { rerender } = render(<MicAudioSettings />);
    expect(screen.getByText("Tela 1 — HDMI-1")).toBeInTheDocument();

    state.monitorNames = { "name:HDMI-1": "Projetor" };
    rerender(<MicAudioSettings />);
    expect(screen.queryByText("Tela 1 — HDMI-1")).toBeNull();
    expect(screen.getByText("Tela 1 — Projetor")).toBeInTheDocument();
  });
});
