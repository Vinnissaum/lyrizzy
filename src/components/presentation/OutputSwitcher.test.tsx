import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OutputSwitcher } from "./OutputSwitcher";

vi.mock("../../stores/presentation", () => ({
  usePresentationStore: vi.fn(),
}));
vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));
vi.mock("../../utils/outputDispatch", () => ({
  engageMirror: vi.fn().mockResolvedValue(undefined),
}));

import { usePresentationStore } from "../../stores/presentation";
import { useSettingsStore } from "../../stores/settings";
import { engageMirror } from "../../utils/outputDispatch";
import type { MonitorInfo, OutputId } from "../../types";
import type { MonitorNameMap } from "../../utils/monitorNames";

const setFocusedOutput = vi.fn();
const setMirrorEnabled = vi.fn();

function mockStores(opts: {
  enabled: boolean;
  focused?: "one" | "two";
  mirror?: boolean;
  monitors?: MonitorInfo[];
  monitorNames?: MonitorNameMap;
  outputMonitorIndex?: Record<OutputId, number | null>;
}) {
  const settingsState = {
    multiScreenEnabled: opts.enabled,
    mirrorEnabled: opts.mirror ?? false,
    setMirrorEnabled,
    monitors: opts.monitors ?? [],
    monitorNames: opts.monitorNames ?? {},
    outputMonitorIndex: opts.outputMonitorIndex ?? { one: null, two: null },
  };
  vi.mocked(useSettingsStore).mockImplementation((sel: any) =>
    sel(settingsState),
  );
  vi.mocked(usePresentationStore).mockImplementation((sel: any) =>
    sel({ focusedOutput: opts.focused ?? "one", setFocusedOutput }),
  );
  return settingsState;
}

describe("OutputSwitcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing when multi-screen is disabled", () => {
    mockStores({ enabled: false });
    render(<OutputSwitcher />);
    expect(screen.queryByTestId("output-switcher")).toBeNull();
  });

  it("renders both screen tabs when enabled and marks the focused one", () => {
    mockStores({ enabled: true, focused: "two" });
    render(<OutputSwitcher />);
    expect(screen.getByText("Tela 1")).toBeInTheDocument();
    expect(screen.getByText("Tela 2")).toBeInTheDocument();
    // Tela 2 is focused → aria-current true; Tela 1 not.
    expect(screen.getByText("Tela 2").getAttribute("aria-current")).toBe("true");
    expect(screen.getByText("Tela 1").getAttribute("aria-current")).toBe(
      "false",
    );
  });

  it("switches focus to the clicked output", () => {
    mockStores({ enabled: true, focused: "one" });
    render(<OutputSwitcher />);
    fireEvent.click(screen.getByText("Tela 2"));
    expect(setFocusedOutput).toHaveBeenCalledWith("two");
  });

  it("requests launch when clicking a tab whose output is not presenting", () => {
    mockStores({ enabled: true, focused: "one" });
    const onRequestLaunch = vi.fn();
    render(
      <OutputSwitcher
        presentingOutputs={new Set(["one"])}
        onRequestLaunch={onRequestLaunch}
      />,
    );
    fireEvent.click(screen.getByText("Tela 2"));
    expect(setFocusedOutput).toHaveBeenCalledWith("two");
    expect(onRequestLaunch).toHaveBeenCalledWith("two");
  });

  it("does not request launch when the clicked output is already presenting", () => {
    mockStores({ enabled: true, focused: "one" });
    const onRequestLaunch = vi.fn();
    render(
      <OutputSwitcher
        presentingOutputs={new Set(["one", "two"])}
        onRequestLaunch={onRequestLaunch}
      />,
    );
    fireEvent.click(screen.getByText("Tela 2"));
    expect(setFocusedOutput).toHaveBeenCalledWith("two");
    expect(onRequestLaunch).not.toHaveBeenCalled();
  });

  it("enabling Simultânea sets mirror on and engages the mirror", () => {
    mockStores({ enabled: true, mirror: false });
    render(<OutputSwitcher />);
    fireEvent.click(screen.getByTestId("mirror-toggle"));
    expect(setMirrorEnabled).toHaveBeenCalledWith(true);
    expect(engageMirror).toHaveBeenCalledTimes(1);
  });

  it("hides the per-screen tabs and does not re-engage when mirror is on", () => {
    mockStores({ enabled: true, mirror: true });
    render(<OutputSwitcher />);
    // Tabs hidden under mirror; only the toggle remains.
    expect(screen.queryByText("Tela 1")).toBeNull();
    expect(screen.queryByText("Tela 2")).toBeNull();
    fireEvent.click(screen.getByTestId("mirror-toggle"));
    expect(setMirrorEnabled).toHaveBeenCalledWith(false);
    expect(engageMirror).not.toHaveBeenCalled();
  });

  it("renders a stored monitor name for the assigned output", () => {
    mockStores({
      enabled: true,
      focused: "one",
      monitors: [
        { name: "HDMI-1", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 },
      ],
      monitorNames: { "name:HDMI-1": "Projetor" },
      outputMonitorIndex: { one: 0, two: null },
    });

    render(<OutputSwitcher />);
    expect(screen.getByText("Projetor")).toBeInTheDocument();
  });

  it("falls back to the generated label when no name is stored", () => {
    mockStores({
      enabled: true,
      focused: "one",
      monitors: [],
      monitorNames: {},
      outputMonitorIndex: { one: null, two: null },
    });

    render(<OutputSwitcher />);
    expect(screen.getByText("Tela 1")).toBeInTheDocument();
    expect(screen.getByText("Tela 2")).toBeInTheDocument();
  });

  it("updates the tab label when the store name changes, with no remount", () => {
    const state = mockStores({
      enabled: true,
      focused: "one",
      monitors: [
        { name: "HDMI-1", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 },
      ],
      monitorNames: {},
      outputMonitorIndex: { one: 0, two: null },
    });

    const { rerender } = render(<OutputSwitcher />);
    expect(screen.getByText("HDMI-1")).toBeInTheDocument();

    state.monitorNames = { "name:HDMI-1": "Projetor" };
    rerender(<OutputSwitcher />);
    expect(screen.queryByText("HDMI-1")).toBeNull();
    expect(screen.getByText("Projetor")).toBeInTheDocument();
  });
});
