import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("../../api/commands", () => ({
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  listMonitors: vi.fn().mockResolvedValue([]),
  PRESENTATION_MONITOR_KEY: "presentation.monitor_index",
  OUTPUT2_MONITOR_KEY: "output.two.monitor_index",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { MonitorNameSettings } from "./MonitorNameSettings";
import { listMonitors, setSetting } from "../../api/commands";
import { useSettingsStore } from "../../stores/settings";
import { DEFAULT_OUTPUT_MONITOR_INDEX } from "../../stores/settings";

const MONITORS = [
  { name: "HDMI-1", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 },
  { name: "HDMI-2", width: 1280, height: 720, x: 1920, y: 0, scaleFactor: 1 },
];

describe("MonitorNameSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      monitors: MONITORS,
      monitorNames: {},
      outputMonitorIndex: { ...DEFAULT_OUTPUT_MONITOR_INDEX },
    });
  });

  it("lists every detected monitor from the store, with its resolution", async () => {
    render(<MonitorNameSettings />);
    await waitFor(() => screen.getByText("1920×1080"));
    expect(screen.getByText("1280×720")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(listMonitors).not.toHaveBeenCalled();
  });

  it("calls the store's setMonitorName with the monitor's identity key when typed", async () => {
    render(<MonitorNameSettings />);
    await waitFor(() => screen.getByText("1920×1080"));
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[1], { target: { value: "Stage" } });
    await waitFor(() =>
      expect(setSetting).toHaveBeenCalledWith(
        "display.monitor_names",
        JSON.stringify({ "name:HDMI-2": "Stage" }),
      ),
    );
    expect(useSettingsStore.getState().monitorNames).toEqual({
      "name:HDMI-2": "Stage",
    });
  });

  it("shows names already loaded into the store on mount", async () => {
    useSettingsStore.setState({
      monitors: MONITORS,
      monitorNames: { "name:HDMI-1": "Foyer" },
    });
    render(<MonitorNameSettings />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Foyer")).toBeInTheDocument(),
    );
  });

  it("falls back through OS name to the positional default when a name is cleared", async () => {
    useSettingsStore.setState({
      monitors: MONITORS,
      monitorNames: { "name:HDMI-1": "Foyer" },
    });
    render(<MonitorNameSettings />);
    const inputs = await screen.findAllByDisplayValue("Foyer");
    fireEvent.change(inputs[0], { target: { value: "" } });
    await waitFor(() =>
      expect(useSettingsStore.getState().monitorNames).toEqual({
        "name:HDMI-1": "",
      }),
    );
    expect(
      screen.getByPlaceholderText("HDMI-1"),
    ).toBeInTheDocument();

    // Second monitor has no OS name override chosen and no OS name at all —
    // falls through to the positional default.
    useSettingsStore.setState({
      monitors: [
        { name: "", width: 1280, height: 720, x: 1920, y: 0, scaleFactor: 1 },
      ],
      monitorNames: {},
    });
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Monitor 1 — 1280×720"),
      ).toBeInTheDocument(),
    );
  });
});
