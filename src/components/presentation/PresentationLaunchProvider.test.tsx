import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import {
  PresentationLaunchProvider,
  useRequestPresentation,
} from "./PresentationLaunchProvider";
import { useSettingsStore } from "../../stores/settings";
import * as outputDispatch from "../../utils/outputDispatch";

vi.mock("../../utils/outputDispatch", async () => {
  const actual = await vi.importActual<typeof outputDispatch>("../../utils/outputDispatch");
  return {
    ...actual,
    startPresentationPlan: vi.fn().mockResolvedValue(undefined),
  };
});

const startPresentationPlan = vi.mocked(outputDispatch.startPresentationPlan);

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

  it("cancel: no plan executed and no store mutation", async () => {
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
  });
});
