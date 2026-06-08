import { describe, it, expect, vi, afterEach } from "vitest";
import {
  enumerateAudioDevices,
  resolveDeviceId,
  supportsAudioOutputSelection,
  type SavedAudioDevice,
} from "./audioDevices";

function dev(
  deviceId: string,
  kind: MediaDeviceKind,
  label = "",
  groupId = "g",
): MediaDeviceInfo {
  return { deviceId, kind, label, groupId, toJSON: () => ({}) } as MediaDeviceInfo;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { AudioContext?: unknown }).AudioContext;
});

describe("enumerateAudioDevices", () => {
  it("splits inputs and outputs by kind", async () => {
    const list = [
      dev("mic1", "audioinput", "Mic 1"),
      dev("spk1", "audiooutput", "HDMI TV"),
      dev("cam1", "videoinput", "Cam"),
    ];
    Object.defineProperty(navigator, "mediaDevices", {
      value: { enumerateDevices: vi.fn().mockResolvedValue(list) },
      configurable: true,
    });
    const { inputs, outputs } = await enumerateAudioDevices();
    expect(inputs.map((d) => d.deviceId)).toEqual(["mic1"]);
    expect(outputs.map((d) => d.deviceId)).toEqual(["spk1"]);
  });

  it("returns empty lists when enumerateDevices is unavailable", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
    });
    expect(await enumerateAudioDevices()).toEqual({ inputs: [], outputs: [] });
  });
});

describe("resolveDeviceId", () => {
  const devices = [
    dev("hdmi-new", "audiooutput", "HDMI TV", "groupX"),
    dev("other", "audiooutput", "Speakers", "groupY"),
  ];

  it("matches by exact deviceId", () => {
    const saved: SavedAudioDevice = { deviceId: "other", label: "Speakers", groupId: "groupY" };
    expect(resolveDeviceId(devices, saved)).toBe("other");
  });

  it("falls back to label+groupId when the id changed (replug)", () => {
    const saved: SavedAudioDevice = { deviceId: "hdmi-old", label: "HDMI TV", groupId: "groupX" };
    expect(resolveDeviceId(devices, saved)).toBe("hdmi-new");
  });

  it("returns undefined when nothing matches or saved is null", () => {
    expect(resolveDeviceId(devices, { deviceId: "x", label: "Gone", groupId: "z" })).toBeUndefined();
    expect(resolveDeviceId(devices, null)).toBeUndefined();
  });
});

describe("supportsAudioOutputSelection", () => {
  it("true when AudioContext.prototype.setSinkId exists", () => {
    (globalThis as { AudioContext?: unknown }).AudioContext = class {
      setSinkId() {}
    };
    expect(supportsAudioOutputSelection()).toBe(true);
  });

  it("false when setSinkId is absent", () => {
    (globalThis as { AudioContext?: unknown }).AudioContext = class {};
    expect(supportsAudioOutputSelection()).toBe(false);
  });
});
