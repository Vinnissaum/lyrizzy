import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act, within } from "@testing-library/react";
import {
  PresentationLaunchProvider,
  useRequestPresentation,
} from "./PresentationLaunchProvider";
import { useSettingsStore } from "../../stores/settings";
import * as outputDispatch from "../../utils/outputDispatch";
import * as commands from "../../api/commands";
import type { MonitorInfo } from "../../types";

vi.mock("../../utils/outputDispatch", async () => {
  const actual = await vi.importActual<typeof outputDispatch>("../../utils/outputDispatch");
  return {
    ...actual,
    startPresentationPlan: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../api/commands", async () => {
  const actual = await vi.importActual<typeof commands>("../../api/commands");
  return {
    ...actual,
    exitPresentation: vi.fn().mockResolvedValue(undefined),
  };
});

const startPresentationPlan = vi.mocked(outputDispatch.startPresentationPlan);
const exitPresentation = vi.mocked(commands.exitPresentation);

const TestHarness: React.FC<{ setId?: string }> = ({ setId = "set-1" }) => {
  const requestPresentation = useRequestPresentation();
  return (
    <button onClick={() => requestPresentation(setId)}>request</button>
  );
};

function renderHarness(setId?: string) {
  return render(
    <PresentationLaunchProvider>
      <TestHarness setId={setId} />
    </PresentationLaunchProvider>,
  );
}

describe("PresentationLaunchProvider", () => {
  const initialSettings = useSettingsStore.getState();

  beforeEach(() => {
    startPresentationPlan.mockClear();
    exitPresentation.mockClear();
  });

  afterEach(() => {
    cleanup();
    useSettingsStore.setState(initialSettings, true);
  });

  it("policy mirror_all: no modal, startPresentationPlan(mirrorAll, setId) called", async () => {
    useSettingsStore.setState({ launchPolicy: "mirror_all", multiScreenEnabled: true });
    renderHarness("set-1");

    fireEvent.click(screen.getByText("request"));

    await waitFor(() =>
      expect(startPresentationPlan).toHaveBeenCalledWith("mirrorAll", "set-1"),
    );
    expect(screen.queryByTestId("multi-screen-launch-modal")).toBeNull();
  });

  it("policy main_only: no modal, startPresentationPlan(mainOnly, setId) called", async () => {
    useSettingsStore.setState({ launchPolicy: "main_only", multiScreenEnabled: true });
    renderHarness("set-2");

    fireEvent.click(screen.getByText("request"));

    await waitFor(() =>
      expect(startPresentationPlan).toHaveBeenCalledWith("mainOnly", "set-2"),
    );
    expect(screen.queryByTestId("multi-screen-launch-modal")).toBeNull();
  });

  it("policy ask + multi-screen on: modal shown; answering yes runs the mirror plan", async () => {
    useSettingsStore.setState({ launchPolicy: "ask", multiScreenEnabled: true });
    renderHarness("set-3");

    fireEvent.click(screen.getByText("request"));

    expect(await screen.findByTestId("multi-screen-launch-modal")).toBeInTheDocument();
    expect(startPresentationPlan).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Espelhar as duas"));

    await waitFor(() =>
      expect(startPresentationPlan).toHaveBeenCalledWith("mirrorAll", "set-3"),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("multi-screen-launch-modal")).toBeNull(),
    );
  });

  it("policy ask + multi-screen off: no modal, main-only plan runs directly", async () => {
    useSettingsStore.setState({ launchPolicy: "ask", multiScreenEnabled: false });
    renderHarness("set-4");

    fireEvent.click(screen.getByText("request"));

    await waitFor(() =>
      expect(startPresentationPlan).toHaveBeenCalledWith("mainOnly", "set-4"),
    );
    expect(screen.queryByTestId("multi-screen-launch-modal")).toBeNull();
  });

  it("cancel via Esc: no plan executed, no store mutation, and the staged launch is torn down", async () => {
    useSettingsStore.setState({ launchPolicy: "ask", multiScreenEnabled: true });
    renderHarness("set-5");

    fireEvent.click(screen.getByText("request"));

    expect(await screen.findByTestId("multi-screen-launch-modal")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByTestId("multi-screen-launch-modal")).toBeNull(),
    );
    expect(startPresentationPlan).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().mirrorEnabled).toBe(false);
    // The set was already loaded (→ output "one" Live) before the question was
    // asked, so dismissing must stop it rather than leave the operator stranded
    // in the presentation layout. Output "two" was never staged.
    expect(exitPresentation).toHaveBeenCalledWith("one");
    expect(exitPresentation).toHaveBeenCalledTimes(1);
  });

  it("cancel via the close button stops the presentation too", async () => {
    useSettingsStore.setState({ launchPolicy: "ask", multiScreenEnabled: true });
    renderHarness("set-5b");

    fireEvent.click(screen.getByText("request"));

    const modal = await screen.findByTestId("multi-screen-launch-modal");
    fireEvent.click(within(modal).getByLabelText("Cancelar"));

    await waitFor(() =>
      expect(screen.queryByTestId("multi-screen-launch-modal")).toBeNull(),
    );
    expect(startPresentationPlan).not.toHaveBeenCalled();
    expect(exitPresentation).toHaveBeenCalledWith("one");
  });

  it("answering does NOT tear down the launch", async () => {
    useSettingsStore.setState({ launchPolicy: "ask", multiScreenEnabled: true });
    renderHarness("set-5c");

    fireEvent.click(screen.getByText("request"));
    await screen.findByTestId("multi-screen-launch-modal");

    fireEvent.click(screen.getByText("Espelhar as duas"));

    await waitFor(() =>
      expect(screen.queryByTestId("multi-screen-launch-modal")).toBeNull(),
    );
    expect(exitPresentation).not.toHaveBeenCalled();
  });

  it("shows the resolved monitor names in the launch modal", async () => {
    const monitors: MonitorInfo[] = [
      { name: "LG Ultrawide", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 },
      { name: "Projector", width: 1280, height: 720, x: 1920, y: 0, scaleFactor: 1 },
    ];
    useSettingsStore.setState({
      launchPolicy: "ask",
      multiScreenEnabled: true,
      monitors,
      monitorNames: { "name:LG Ultrawide": "Palco", "name:Projector": "Telão" },
      outputMonitorIndex: { one: 0, two: 1 },
    });
    renderHarness("set-6");

    fireEvent.click(screen.getByText("request"));

    const modal = await screen.findByTestId("multi-screen-launch-modal");
    expect(modal.textContent).toContain("Palco");
    expect(modal.textContent).toContain("Telão");
  });

  it("reflects a monitor rename applied after the initial render without remounting the provider", async () => {
    const monitors: MonitorInfo[] = [
      { name: "LG Ultrawide", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 },
    ];
    useSettingsStore.setState({
      launchPolicy: "ask",
      multiScreenEnabled: true,
      monitors,
      monitorNames: { "name:LG Ultrawide": "Palco" },
      outputMonitorIndex: { one: 0, two: null },
    });
    renderHarness("set-7");

    fireEvent.click(screen.getByText("request"));

    const modalBefore = await screen.findByTestId("multi-screen-launch-modal");
    expect(modalBefore.textContent).toContain("Palco");

    act(() => {
      useSettingsStore.setState({
        monitorNames: { "name:LG Ultrawide": "Auditório" },
      });
    });

    const modalAfter = await screen.findByTestId("multi-screen-launch-modal");
    expect(modalAfter.textContent).toContain("Auditório");
    expect(modalAfter.textContent).not.toContain("Palco");
  });

  it("falls back to 'Tela N' for outputs with no assigned/detected monitor", async () => {
    useSettingsStore.setState({
      launchPolicy: "ask",
      multiScreenEnabled: true,
      monitors: [],
      monitorNames: {},
      outputMonitorIndex: { one: null, two: null },
    });
    renderHarness("set-8");

    fireEvent.click(screen.getByText("request"));

    const modal = await screen.findByTestId("multi-screen-launch-modal");
    expect(modal.textContent).toContain("Tela 1");
    expect(modal.textContent).toContain("Tela 2");
  });
});
