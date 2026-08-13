import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

vi.mock("../../api/commands", () => ({
  PRESENTATION_MONITOR_KEY: "presentation.monitor_index",
  OUTPUT2_MONITOR_KEY: "output2.monitor_index",
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

import { MonitorDetection, MONITOR_POLL_MS } from "./MonitorDetection";
import { listMonitors } from "../../api/commands";
import { useSettingsStore } from "../../stores/settings";

const LAPTOP = { name: "eDP-1", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1, isPrimary: true };
const TV_A = { name: "HDMI-1", width: 1920, height: 1080, x: 1920, y: 0, scaleFactor: 1, isPrimary: false };
const TV_B = { name: "HDMI-2", width: 1920, height: 1080, x: 3840, y: 0, scaleFactor: 1, isPrimary: false };

describe("MonitorDetection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ monitors: [] });
    vi.mocked(listMonitors).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-detects on mount so displays connected after launch appear", async () => {
    useSettingsStore.setState({ monitors: [LAPTOP, TV_A] });
    vi.mocked(listMonitors).mockResolvedValue([LAPTOP, TV_A, TV_B]);

    render(<MonitorDetection />);

    await waitFor(() =>
      expect(useSettingsStore.getState().monitors).toHaveLength(3),
    );
    expect(
      screen.getByText('settings.windows.detected:{"n":3}'),
    ).toBeInTheDocument();
  });

  it("re-detects when the operator clicks the button", async () => {
    render(<MonitorDetection />);
    await waitFor(() => expect(listMonitors).toHaveBeenCalledTimes(1));

    vi.mocked(listMonitors).mockResolvedValue([LAPTOP, TV_A, TV_B]);
    fireEvent.click(screen.getByText("settings.windows.redetect"));

    await waitFor(() =>
      expect(useSettingsStore.getState().monitors).toHaveLength(3),
    );
  });

  it("keeps polling while settings is open and stops on unmount", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<MonitorDetection />);
    expect(listMonitors).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(MONITOR_POLL_MS * 2);
    });
    expect(listMonitors).toHaveBeenCalledTimes(3);

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(MONITOR_POLL_MS * 2);
    });
    expect(listMonitors).toHaveBeenCalledTimes(3);
  });

  it("keeps the same monitors array when nothing changed", async () => {
    const initial = [LAPTOP, TV_A];
    useSettingsStore.setState({ monitors: initial });
    vi.mocked(listMonitors).mockResolvedValue([{ ...LAPTOP }, { ...TV_A }]);

    render(<MonitorDetection />);

    await waitFor(() => expect(listMonitors).toHaveBeenCalled());
    expect(useSettingsStore.getState().monitors).toBe(initial);
  });

  it("leaves the last known list in place when detection fails", async () => {
    useSettingsStore.setState({ monitors: [LAPTOP, TV_A] });
    vi.mocked(listMonitors).mockRejectedValue(new Error("no runtime"));

    render(<MonitorDetection />);

    await waitFor(() => expect(listMonitors).toHaveBeenCalled());
    expect(useSettingsStore.getState().monitors).toHaveLength(2);
  });
});
