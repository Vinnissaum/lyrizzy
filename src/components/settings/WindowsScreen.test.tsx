import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WindowsScreen } from "./WindowsScreen";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    currentMonitor: vi.fn(() => Promise.resolve({ name: "Monitor 0" })),
  })),
}));

import { invoke } from "@tauri-apps/api/core";
import type { MonitorInfo } from "../../types";

const mockMonitors: MonitorInfo[] = [
  { name: "Monitor 0", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 },
  { name: "Monitor 1", width: 2560, height: 1440, x: 1920, y: 0, scaleFactor: 1.5 },
];

describe("WindowsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "list_monitors") return Promise.resolve(mockMonitors);
      if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
      return Promise.resolve(null);
    });
  });

  it("renders both window sections", async () => {
    render(<WindowsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Janela de Apresentação")).toBeInTheDocument();
      expect(screen.getByText("Janela de Stage")).toBeInTheDocument();
    });
  });

  it("renders monitor options from list_monitors", async () => {
    render(<WindowsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText(/Monitor 1.*2560/)).toHaveLength(2); // two window rows
    });
  });

  it("calls open_presentation_window when presentation open button is clicked", async () => {
    render(<WindowsScreen />);
    const [presentationBtn] = await screen.findAllByText("Abrir / Reabrir nesta tela");
    fireEvent.click(presentationBtn);
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "open_presentation_window",
        expect.objectContaining({ monitorIndex: undefined })
      )
    );
  });

  it("calls open_stage_window when stage open button is clicked", async () => {
    render(<WindowsScreen />);
    const buttons = await screen.findAllByText("Abrir / Reabrir nesta tela");
    fireEvent.click(buttons[1]);
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        "open_stage_window",
        expect.objectContaining({ monitorIndex: undefined })
      )
    );
  });
});
