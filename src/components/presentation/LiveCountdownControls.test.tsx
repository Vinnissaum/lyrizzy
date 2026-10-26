import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../api/commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/commands")>();
  return {
    ...actual,
    adjustCountdown: vi.fn(),
    pauseCountdown: vi.fn(),
    resumeCountdown: vi.fn(),
    restartCountdown: vi.fn(),
  };
});

import {
  adjustCountdown,
  pauseCountdown,
  restartCountdown,
  resumeCountdown,
} from "../../api/commands";
import { useCountdownStore } from "../../stores/countdown";
import { useSettingsStore } from "../../stores/settings";
import { LiveCountdownControls } from "./LiveCountdownControls";
import type { CountdownMode, CountdownState } from "../../types";

function countdown(mode: CountdownMode, remainingMs: number): CountdownState {
  return {
    mode,
    durationMs: 600_000,
    remainingMs,
    endBehavior: "holdZero",
    messageScale: 100,
    digitsScale: 100,
  };
}

function show(state: CountdownState) {
  useCountdownStore.setState({ state, output: "one" });
  return render(<LiveCountdownControls />);
}

const button = (name: string) => screen.getByRole("button", { name: new RegExp(name) });

describe("LiveCountdownControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ mirrorEnabled: false });
    for (const fn of [adjustCountdown, pauseCountdown, resumeCountdown, restartCountdown]) {
      vi.mocked(fn).mockResolvedValue(countdown("running", 270_000));
    }
  });

  it("shows the remaining time as the wall formats it", () => {
    show(countdown("running", 270_000));
    expect(screen.getByTestId("live-countdown-remaining")).toHaveTextContent("04:30");
  });

  it("plus buttons send 60000 and 300000 for the focused output", async () => {
    show(countdown("running", 270_000));
    fireEvent.click(button("\\+1 min"));
    await waitFor(() => expect(adjustCountdown).toHaveBeenCalledWith(60_000, "one"));
    fireEvent.click(button("\\+5 min"));
    await waitFor(() => expect(adjustCountdown).toHaveBeenCalledWith(300_000, "one"));
    expect(adjustCountdown).toHaveBeenCalledTimes(2);
  });

  it("minus button sends -60000", async () => {
    show(countdown("running", 270_000));
    fireEvent.click(button("−1 min"));
    await waitFor(() => expect(adjustCountdown).toHaveBeenCalledWith(-60_000, "one"));
  });

  it("minus button is disabled at 60000 ms and enabled at 60001 ms", () => {
    const { unmount } = show(countdown("running", 60_000));
    expect(button("−1 min")).toBeDisabled();
    unmount();
    show(countdown("running", 60_001));
    expect(button("−1 min")).toBeEnabled();
  });

  it("pause and resume: Pausar sends pause; while paused Retomar sends resume", async () => {
    const { unmount } = show(countdown("running", 270_000));
    expect(screen.queryByRole("button", { name: /Retomar/ })).not.toBeInTheDocument();
    fireEvent.click(button("Pausar"));
    await waitFor(() => expect(pauseCountdown).toHaveBeenCalledWith("one"));
    unmount();

    show(countdown("paused", 270_000));
    expect(screen.queryByRole("button", { name: /Pausar/ })).not.toBeInTheDocument();
    fireEvent.click(button("Retomar"));
    await waitFor(() => expect(resumeCountdown).toHaveBeenCalledWith("one"));
  });

  it("restart button sends restart_countdown", async () => {
    show(countdown("finished", 0));
    fireEvent.click(button("Reiniciar"));
    await waitFor(() => expect(restartCountdown).toHaveBeenCalledWith("one"));
  });

  it("mirror sends to both screens; without it only the focused one", async () => {
    useSettingsStore.setState({ mirrorEnabled: true });
    const { unmount } = show(countdown("running", 270_000));
    fireEvent.click(button("\\+1 min"));
    await waitFor(() => expect(adjustCountdown).toHaveBeenCalledWith(60_000, "two"));
    expect(adjustCountdown).toHaveBeenCalledWith(60_000, "one");
    fireEvent.click(button("Pausar"));
    await waitFor(() => expect(pauseCountdown).toHaveBeenCalledWith("two"));
    fireEvent.click(button("Reiniciar"));
    await waitFor(() => expect(restartCountdown).toHaveBeenCalledWith("two"));
    unmount();

    vi.clearAllMocks();
    vi.mocked(adjustCountdown).mockResolvedValue(countdown("running", 330_000));
    useSettingsStore.setState({ mirrorEnabled: false });
    show(countdown("running", 270_000));
    fireEvent.click(button("\\+1 min"));
    await waitFor(() => expect(adjustCountdown).toHaveBeenCalledWith(60_000, "one"));
    expect(adjustCountdown).not.toHaveBeenCalledWith(60_000, "two");
  });

  it("shows the command error as its localized message", async () => {
    vi.mocked(adjustCountdown).mockRejectedValueOnce({
      code: "countdown.below_minimum",
      params: {},
    });
    show(countdown("running", 61_000));
    fireEvent.click(button("−1 min"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falta 1 minuto ou menos — não é possível tirar mais tempo",
    );
  });
});
