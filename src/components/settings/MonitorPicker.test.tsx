import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

vi.mock("../../api/commands", () => ({
  PRESENTATION_MONITOR_KEY: "presentation.monitor_index",
  OUTPUT2_MONITOR_KEY: "output.two.monitor_index",
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  listMonitors: vi.fn().mockResolvedValue([]),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { MonitorPicker } from "./MonitorPicker";
import { getSetting, setSetting } from "../../api/commands";
import { useSettingsStore } from "../../stores/settings";

const BASE_MONITORS = [
  { name: "HDMI-1", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 },
  { name: "HDMI-2", width: 1280, height: 720, x: 1920, y: 0, scaleFactor: 1 },
];

describe("MonitorPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ monitors: BASE_MONITORS, monitorNames: {} });
  });

  it("defaults to output One's key and the generic label", async () => {
    render(<MonitorPicker />);
    await waitFor(() =>
      expect(getSetting).toHaveBeenCalledWith("presentation.monitor_index"),
    );
    expect(
      screen.getByText("settings.windows.monitorLabel"),
    ).toBeInTheDocument();

    await waitFor(() => screen.getByText(/HDMI-2/));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "1" },
    });
    expect(setSetting).toHaveBeenCalledWith("presentation.monitor_index", "1");
  });

  it("reads/writes the passed settingKey and shows the custom label", async () => {
    render(
      <MonitorPicker settingKey="output2.monitor_index" label="Monitor da Tela 2" />,
    );
    await waitFor(() =>
      expect(getSetting).toHaveBeenCalledWith("output2.monitor_index"),
    );
    expect(screen.getByText("Monitor da Tela 2")).toBeInTheDocument();

    await waitFor(() => screen.getByText(/HDMI-2/));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "1" },
    });
    expect(setSetting).toHaveBeenCalledWith("output2.monitor_index", "1");
  });

  it("renders the operator name from the store in preference to the OS name", async () => {
    useSettingsStore.setState({
      monitors: BASE_MONITORS,
      monitorNames: { "name:HDMI-2": "Projetor" },
    });
    render(<MonitorPicker />);
    expect(await screen.findByText("Projetor")).toBeInTheDocument();
    expect(screen.queryByText(/^HDMI-2 /)).toBeNull();
  });

  it("reflects a store name change in option labels without remounting", async () => {
    render(<MonitorPicker />);
    await waitFor(() => screen.getByText(/HDMI-2/));
    expect(screen.queryByText("Projetor")).toBeNull();

    act(() => {
      useSettingsStore.setState({
        monitorNames: { "name:HDMI-2": "Projetor" },
      });
    });

    expect(await screen.findByText("Projetor")).toBeInTheDocument();
  });
});
