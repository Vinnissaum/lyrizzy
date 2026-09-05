import type { RtspTransport, WebViewConfig, WebViewMode } from '../types';

/** Modes that support saved stream profiles (switching connections without losing settings). */
export const PROFILE_MODES: WebViewMode[] = ['rtsp', 'mjpeg'];

/** The resolved connection details for whichever source is currently active. */
export interface ActiveSource {
  url: string;
  transport?: RtspTransport;
}

/**
 * Resolves the active stream source for a `WebViewConfig`, following the
 * profile fallback chain:
 * - No profiles (empty/absent) → falls back to `cfg.url` + `cfg.rtspTransport`.
 * - `activeProfileId` matches a profile → that profile's url/transport.
 * - `activeProfileId` absent → first profile.
 * - `activeProfileId` points at a missing/deleted profile → first remaining profile.
 */
export function resolveActiveSource(cfg: WebViewConfig): ActiveSource {
  const profiles = cfg.profiles ?? [];
  if (profiles.length === 0) {
    return { url: cfg.url, transport: cfg.rtspTransport };
  }

  const active =
    (cfg.activeProfileId !== undefined &&
      profiles.find((p) => p.id === cfg.activeProfileId)) ||
    profiles[0];

  return { url: active.url, transport: active.rtspTransport };
}
