import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OperatorApp } from "./OperatorApp";

// Mock Tauri IPC modules — commands.ts uses these under the hood
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

describe("OperatorApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listen).mockResolvedValue(() => {});
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  it("renders counter at 0 on initial mount", () => {
    render(<OperatorApp />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("calls increment_counter when Increment Counter is clicked", async () => {
    render(<OperatorApp />);
    fireEvent.click(screen.getByText("Increment Counter"));
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("increment_counter")
    );
  });

  it("calls open_presentation_window when Open Presentation Window is clicked", async () => {
    render(<OperatorApp />);
    fireEvent.click(screen.getByText("Open Presentation Window"));
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("open_presentation_window")
    );
  });

  it("subscribes to state_changed on mount", () => {
    render(<OperatorApp />);
    expect(vi.mocked(listen)).toHaveBeenCalledWith(
      "state_changed",
      expect.any(Function)
    );
  });

  it("calls unlisten on unmount", async () => {
    const unlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlisten);
    const { unmount } = render(<OperatorApp />);
    unmount();
    await waitFor(() => expect(unlisten).toHaveBeenCalled());
  });
});
