import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("../../api/commands", () => ({
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

import { MonitorNameSettings } from "./MonitorNameSettings";
import { getSetting, setSetting } from "../../api/commands";

describe("MonitorNameSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists every detected monitor with its resolution", async () => {
    render(<MonitorNameSettings />);
    await waitFor(() => screen.getByText("1920×1080"));
    expect(screen.getByText("1280×720")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("persists a typed name under the monitor's identity key, not its index", async () => {
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
  });

  it("shows names loaded from settings on mount", async () => {
    vi.mocked(getSetting).mockResolvedValue(
      JSON.stringify({ "name:HDMI-1": "Foyer" }),
    );
    render(<MonitorNameSettings />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Foyer")).toBeInTheDocument(),
    );
  });
});
