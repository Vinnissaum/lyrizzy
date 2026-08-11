import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../api/commands", () => ({
  PRESENTATION_MONITOR_KEY: "presentation.monitor_index",
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  listMonitors: vi.fn().mockResolvedValue([
    { name: "HDMI-1", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 },
    { name: "HDMI-2", width: 1280, height: 720, x: 1920, y: 0, scaleFactor: 1 },
  ]),
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
import { MONITOR_NAMES_KEY } from "../../utils/monitorNames";

describe("MonitorPicker", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("renders the operator name in preference to the OS name", async () => {
    vi.mocked(getSetting).mockImplementation((key: string) =>
      Promise.resolve(
        key === MONITOR_NAMES_KEY
          ? JSON.stringify({ "name:HDMI-2": "Projetor" })
          : "auto",
      ),
    );
    render(<MonitorPicker />);
    expect(await screen.findByText("Projetor")).toBeInTheDocument();
    expect(screen.queryByText(/^HDMI-2 /)).toBeNull();
  });
});
