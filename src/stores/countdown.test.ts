import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/commands", () => ({
  armCountdown: vi.fn(),
  getCountdownState: vi.fn(),
  onCountdownTick: vi.fn(),
  pauseCountdown: vi.fn(),
  resetCountdown: vi.fn(),
  setCountdownDuration: vi.fn(),
  startCountdown: vi.fn(),
}));

import { armCountdown, resetCountdown } from "../api/commands";
import { useCountdownStore } from "./countdown";
import type { CountdownState } from "../types";

const scheduledState: CountdownState = {
  mode: "scheduled",
  durationMs: 60_000,
  remainingMs: 60_000,
  endBehavior: "holdZero",
};

const idleState: CountdownState = {
  mode: "idle",
  durationMs: 0,
  remainingMs: 0,
  endBehavior: "holdZero",
};

describe("useCountdownStore — armedItem tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCountdownStore.setState({
      state: idleState,
      armedItem: null,
      isSubscribed: false,
    });
  });

  it("arm with setId + itemIndex sets armedItem", async () => {
    vi.mocked(armCountdown).mockResolvedValue(scheduledState);

    await useCountdownStore.getState().arm({
      scheduledStart: { hour: 19, minute: 30 },
      durationMs: 60_000,
      setId: "set-1",
      itemIndex: 3,
    });

    expect(useCountdownStore.getState().armedItem).toEqual({
      setId: "set-1",
      itemIndex: 3,
    });
  });

  it("reset clears armedItem to null", async () => {
    vi.mocked(armCountdown).mockResolvedValue(scheduledState);
    vi.mocked(resetCountdown).mockResolvedValue(idleState);

    await useCountdownStore.getState().arm({
      scheduledStart: { hour: 19, minute: 30 },
      durationMs: 60_000,
      setId: "set-1",
      itemIndex: 3,
    });
    expect(useCountdownStore.getState().armedItem).not.toBeNull();

    await useCountdownStore.getState().reset();

    expect(useCountdownStore.getState().armedItem).toBeNull();
  });

  it("arm without setId / itemIndex leaves armedItem null", async () => {
    vi.mocked(armCountdown).mockResolvedValue(scheduledState);

    await useCountdownStore.getState().arm({
      scheduledStart: { hour: 19, minute: 30 },
      durationMs: 60_000,
    });

    expect(useCountdownStore.getState().armedItem).toBeNull();
  });
});
