/**
 * Audio device discovery + resolution helpers for the multi-screen camera/mic
 * feature. Device labels are only populated after a getUserMedia grant, and
 * deviceIds can change across replug/sessions — so we persist a device by
 * {deviceId, label, groupId} and resolve it leniently.
 */

export interface SavedAudioDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface AudioDevices {
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
}

/** Enumerate audio input (mic) and output (speaker/HDMI) devices. */
export async function enumerateAudioDevices(): Promise<AudioDevices> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [] };
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    inputs: devices.filter((d) => d.kind === "audioinput"),
    outputs: devices.filter((d) => d.kind === "audiooutput"),
  };
}

/**
 * Resolve a saved device against the current device list. Tries the exact
 * deviceId first, then falls back to matching by (label, groupId) so a device
 * that came back with a new id after a replug is still found. Returns the
 * resolved deviceId, or undefined when nothing matches.
 */
export function resolveDeviceId(
  devices: MediaDeviceInfo[],
  saved: SavedAudioDevice | null | undefined,
): string | undefined {
  if (!saved) return undefined;
  const byId = devices.find((d) => d.deviceId === saved.deviceId);
  if (byId) return byId.deviceId;
  if (saved.label) {
    const byLabel = devices.find(
      (d) => d.label === saved.label && d.groupId === saved.groupId,
    );
    if (byLabel) return byLabel.deviceId;
  }
  return undefined;
}

/** Snapshot a device for persistence. */
export function toSavedDevice(d: MediaDeviceInfo): SavedAudioDevice {
  return { deviceId: d.deviceId, label: d.label, groupId: d.groupId };
}

/**
 * Whether the runtime can route a Web Audio graph to a chosen output device
 * (AudioContext.setSinkId — Chromium >= 110). The mic-delay path depends on it.
 */
export function supportsAudioOutputSelection(): boolean {
  return (
    typeof AudioContext !== "undefined" &&
    typeof (AudioContext.prototype as { setSinkId?: unknown }).setSinkId ===
      "function"
  );
}
