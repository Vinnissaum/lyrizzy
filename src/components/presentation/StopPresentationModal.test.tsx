import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));

import { StopPresentationModal } from "./StopPresentationModal";
import { useSettingsStore } from "../../stores/settings";
import type { MonitorInfo, OutputId } from "../../types";
import type { MonitorNameMap } from "../../utils/monitorNames";

function mockSettings(opts: {
  monitors?: MonitorInfo[];
  monitorNames?: MonitorNameMap;
  outputMonitorIndex?: Record<OutputId, number | null>;
} = {}) {
  const state = {
    monitors: opts.monitors ?? [],
    monitorNames: opts.monitorNames ?? {},
    outputMonitorIndex: opts.outputMonitorIndex ?? { one: null, two: null },
  };
  vi.mocked(useSettingsStore).mockImplementation((sel: any) => sel(state));
}

const both = new Set<OutputId>(["one", "two"]);

function renderModal(
  presentingOutputs: ReadonlySet<OutputId> = both,
  overrides: Partial<{
    onStopOne: (o: OutputId) => void;
    onStopAll: () => void;
    onCancel: () => void;
  }> = {},
) {
  const handlers = {
    onStopOne: vi.fn(),
    onStopAll: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<StopPresentationModal presentingOutputs={presentingOutputs} {...handlers} />);
  return handlers;
}

describe("StopPresentationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings();
  });
  afterEach(() => cleanup());

  it("states the situation and warns the stop is unrecoverable", () => {
    // P16-19: the operator must know control is lost for good before choosing.
    renderModal();
    expect(screen.getByText(/2 telas com controle individual/)).toBeTruthy();
    expect(screen.getByText(/não poderá ser retomado/)).toBeTruthy();
    expect(screen.getByText("Qual tela deve parar?")).toBeTruthy();
  });

  it("offers one stop button per presenting screen, plus stop-all and cancel", () => {
    // P16-20 (GA-2).
    renderModal();
    expect(screen.getByTestId("stop-output-one")).toBeTruthy();
    expect(screen.getByTestId("stop-output-two")).toBeTruthy();
    expect(screen.getByTestId("stop-all")).toBeTruthy();
    expect(screen.getByTestId("stop-cancel")).toBeTruthy();
  });

  it("only lists screens that are actually presenting", () => {
    renderModal(new Set<OutputId>(["two"]));
    expect(screen.queryByTestId("stop-output-one")).toBeNull();
    expect(screen.getByTestId("stop-output-two")).toBeTruthy();
  });

  it("labels a lone screen 2 by its own number, not by its list position", () => {
    // Guards the numbered fallback: indexing the filtered list would call the
    // only presenting screen "Tela 1".
    renderModal(new Set<OutputId>(["two"]));
    expect(screen.getByTestId("stop-output-two").textContent).toContain("Tela 2");
  });

  it("labels buttons with the operator's configured monitor names", () => {
    // P16-20: a screen renamed in Settings is named the same way here.
    mockSettings({
      monitors: [
        { name: "HDMI-1", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 },
      ],
      monitorNames: { "name:HDMI-1": "Projetor" },
      outputMonitorIndex: { one: 0, two: null },
    });
    renderModal();
    expect(screen.getByTestId("stop-output-one").textContent).toContain("Projetor");
  });

  it("picking a screen reports only that output", () => {
    // P16-21 — the component reports the choice; the caller does the stopping.
    const h = renderModal();
    fireEvent.click(screen.getByTestId("stop-output-two"));
    expect(h.onStopOne).toHaveBeenCalledTimes(1);
    expect(h.onStopOne).toHaveBeenCalledWith("two");
    expect(h.onStopAll).not.toHaveBeenCalled();
    expect(h.onCancel).not.toHaveBeenCalled();
  });

  it("stop-all reports onStopAll", () => {
    // P16-22.
    const h = renderModal();
    fireEvent.click(screen.getByTestId("stop-all"));
    expect(h.onStopAll).toHaveBeenCalledTimes(1);
    expect(h.onStopOne).not.toHaveBeenCalled();
  });

  it("Esc cancels and reports no stop", () => {
    // P16-23.
    const h = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(h.onCancel).toHaveBeenCalledTimes(1);
    expect(h.onStopOne).not.toHaveBeenCalled();
    expect(h.onStopAll).not.toHaveBeenCalled();
  });

  it("the close control cancels and reports no stop", () => {
    const h = renderModal();
    fireEvent.click(screen.getByLabelText("Cancelar"));
    expect(h.onCancel).toHaveBeenCalledTimes(1);
    expect(h.onStopOne).not.toHaveBeenCalled();
  });

  it("the cancel button cancels and reports no stop", () => {
    const h = renderModal();
    fireEvent.click(screen.getByTestId("stop-cancel"));
    expect(h.onCancel).toHaveBeenCalledTimes(1);
    expect(h.onStopOne).not.toHaveBeenCalled();
    expect(h.onStopAll).not.toHaveBeenCalled();
  });
});
