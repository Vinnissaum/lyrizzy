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

  it("keeps the per-screen tabs visible and does not re-engage when mirror is on", () => {
    // P16-09: the tabs used to unmount the moment mirror engaged, which made the
    // whole control group jump. They now stay, marked as mirrored.
    mockStores({ enabled: true, mirror: true });
    render(<OutputSwitcher />);
    expect(screen.getByText("Tela 1")).toBeTruthy();
    expect(screen.getByText("Tela 2")).toBeTruthy();
    expect(screen.getByText("Tela 1").getAttribute("data-mirrored")).toBe("true");
    expect(screen.getByText("Tela 2").getAttribute("data-mirrored")).toBe("true");
    // Neither tab is "current" while mirroring — both screens are being driven.
    expect(screen.getByText("Tela 1").getAttribute("aria-current")).toBe("false");
    expect(screen.getByText("Tela 2").getAttribute("aria-current")).toBe("false");

    fireEvent.click(screen.getByTestId("mirror-toggle"));
    expect(setMirrorEnabled).toHaveBeenCalledWith(false);
    expect(engageMirror).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "puts the Simultânea toggle immediately after the tabs (mirror=%s)",
    (mirror) => {
      // P16-10: `ml-auto` used to shove the toggle to the far end of the bar,
      // so engaging Simultânea made the control group jump.
      mockStores({ enabled: true, mirror });
      render(<OutputSwitcher />);

      const bar = screen.getByTestId("output-switcher");
      const toggle = screen.getByTestId("mirror-toggle");
      expect(toggle.className).not.toContain("ml-auto");
      // Two tabs, then the toggle — the toggle is the last tab's next sibling.
      expect(bar.children).toHaveLength(3);
      expect(bar.children[2]).toBe(toggle);
    },
  );

  it("uses a colour distinct from an active screen tab when Simultânea is on", () => {
    // P16-11: ON used to be byte-identical to a focused tab (`bg-primary`), so
    // "mirroring" and "Tela 2 focused" rendered the same.
    mockStores({ enabled: true, mirror: true });
    render(<OutputSwitcher />);
    const on = screen.getByTestId("mirror-toggle").className;
    expect(on).toContain("bg-warning");
    expect(on).not.toContain("bg-primary");
  });

  it("clicking a tab while mirroring re-points the master without disengaging", () => {
    // P16-12: focus still moves (it selects the mirror master), mirror stays on,
    // and no launch is requested for a screen that is already presenting.
    const onRequestLaunch = vi.fn();
    mockStores({ enabled: true, mirror: true, focused: "one" });
    render(
      <OutputSwitcher
        presentingOutputs={new Set<OutputId>(["one", "two"])}
        onRequestLaunch={onRequestLaunch}
      />,
    );
    fireEvent.click(screen.getByText("Tela 2"));
    expect(setFocusedOutput).toHaveBeenCalledWith("two");
    expect(setMirrorEnabled).not.toHaveBeenCalled();
    expect(onRequestLaunch).not.toHaveBeenCalled();
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
