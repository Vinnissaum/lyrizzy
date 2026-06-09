import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMicAudio } from "./useMicAudio";

const setSinkId = vi.fn().mockResolvedValue(undefined);
const close = vi.fn().mockResolvedValue(undefined);
const stop = vi.fn();
const getUserMedia = vi.fn();

let ctxInstances: FakeAudioContext[] = [];

class FakeAudioContext {
  destination = {};
  setSinkId = setSinkId;
  close = close;
  delayNode = { delayTime: { value: -1 }, connect: vi.fn() };
  source = { connect: vi.fn() };
  constructor() {
    ctxInstances.push(this);
  }
  createMediaStreamSource() {
    return this.source;
  }
  createDelay() {
    return this.delayNode;
  }
}

beforeEach(() => {
  ctxInstances = [];
  vi.clearAllMocks();
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });
  (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    configurable: true,
  });
});

afterEach(() => {
  delete (globalThis as { AudioContext?: unknown }).AudioContext;
});

describe("useMicAudio", () => {
  it("does nothing when disabled", () => {
    renderHook(() => useMicAudio({ enabled: false, delayMs: 0 }));
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("captures the mic, routes to the sink, and applies the delay", async () => {
    renderHook(() =>
      useMicAudio({ enabled: true, deviceId: "mic1", sinkId: "hdmi", delayMs: 500 }),
    );
    await waitFor(() => expect(ctxInstances.length).toBe(1));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { deviceId: { exact: "mic1" } } });
    expect(setSinkId).toHaveBeenCalledWith("hdmi");
    expect(ctxInstances[0].delayNode.delayTime.value).toBeCloseTo(0.5);
  });

  it("tears down the stream and context on unmount", async () => {
    const { unmount } = renderHook(() => useMicAudio({ enabled: true, delayMs: 0 }));
    await waitFor(() => expect(ctxInstances.length).toBe(1));
    unmount();
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(stop).toHaveBeenCalled();
  });

  it("live-adjusts the delay without rebuilding the graph", async () => {
    const { rerender } = renderHook(
      ({ d }: { d: number }) => useMicAudio({ enabled: true, delayMs: d }),
      { initialProps: { d: 200 } },
    );
    await waitFor(() => expect(ctxInstances.length).toBe(1));
    rerender({ d: 1000 });
    await waitFor(() =>
      expect(ctxInstances[0].delayNode.delayTime.value).toBeCloseTo(1.0),
    );
    expect(ctxInstances.length).toBe(1); // no second AudioContext was created
  });
});
