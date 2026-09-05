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

import { armCountdown, resetCountdown, startCountdown } from "../api/commands";
import { useCountdownStore } from "./countdown";
import type { CountdownState } from "../types";

const scheduledState: CountdownState = {
  mode: "scheduled",
  durationMs: 60_000,
  remainingMs: 60_000,
  endBehavior: "holdZero",
  messageScale: 100,
  digitsScale: 100,
};

const idleState: CountdownState = {
  mode: "idle",
  durationMs: 0,
  remainingMs: 0,
  endBehavior: "holdZero",
  messageScale: 100,
  digitsScale: 100,
};

const runningState: CountdownState = {
  mode: "running",
  durationMs: 60_000,
  remainingMs: 60_000,
  endBehavior: "holdZero",
  messageScale: 150,
  digitsScale: 200,
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

describe("useCountdownStore — messageScale/digitsScale forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCountdownStore.setState({
      state: idleState,
      armedItem: null,
      isSubscribed: false,
    });
  });

  it("start forwards messageScale and digitsScale to startCountdown", async () => {
    vi.mocked(startCountdown).mockResolvedValue(runningState);

    await useCountdownStore.getState().start({
      durationMs: 60_000,
      messageScale: 150,
      digitsScale: 200,
    });

    expect(startCountdown).toHaveBeenCalledWith(
      expect.objectContaining({ messageScale: 150, digitsScale: 200 }),
      "one",
    );
    expect(useCountdownStore.getState().state).toEqual(runningState);
  });

  it("arm forwards messageScale and digitsScale to armCountdown", async () => {
    vi.mocked(armCountdown).mockResolvedValue(runningState);

    await useCountdownStore.getState().arm({
      scheduledStart: { hour: 19, minute: 30 },
      durationMs: 60_000,
      messageScale: 150,
      digitsScale: 200,
    });

    expect(armCountdown).toHaveBeenCalledWith(
      expect.objectContaining({ messageScale: 150, digitsScale: 200 }),
      "one",
    );
    expect(useCountdownStore.getState().state).toEqual(runningState);
  });
});
