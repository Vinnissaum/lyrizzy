/**
 * Stable per-monitor identity and operator-chosen display names.
 *
 * Monitor array/index order is OS-dependent and can change across sessions
 * (replug, driver update, enumeration order swap) — so names must never be
 * keyed by array index. Instead each monitor gets an identity key derived
 * from its OS name (when present) or its geometry, and names are persisted
 * as a single JSON map under one settings row.
 */
import { getSetting, setSetting } from "../api/commands";
import type { MonitorInfo } from "../types";

export const MONITOR_NAMES_KEY = "display.monitor_names";

export type MonitorNameMap = Record<string, string>;

/**
 * Stable identity key for a monitor: `name:<trimmed OS name>` when the OS
 * reports a non-empty name, else `geom:{w}x{h}@{x},{y}` derived from its
 * geometry.
 */
export function monitorIdentity(m: MonitorInfo): string {
  const trimmed = m.name?.trim();
  if (trimmed) return `name:${trimmed}`;
  return `geom:${m.width}x${m.height}@${m.x},${m.y}`;
}

/**
 * Resolve the display name for a monitor via the fallback chain:
 * operator-chosen name (looked up by identity) → OS name → positional
 * default (`Monitor {index+1} — {w}×{h}`).
 */
export function resolveMonitorName(
  m: MonitorInfo,
  index: number,
  names: MonitorNameMap,
): string {
  const chosen = names[monitorIdentity(m)];
  if (chosen) return chosen;
  const osName = m.name?.trim();
  if (osName) return osName;
  return `Monitor ${index + 1} — ${m.width}×${m.height}`;
}

/**
 * Resolve the display name for an output's assigned monitor index.
 *
 * `index` may be `null` (no monitor assigned) or point at a monitor that is
 * no longer present (unplugged) — in either case `fallback` is returned
 * instead of throwing.
 */
export function outputScreenName(
  monitors: MonitorInfo[],
  names: MonitorNameMap,
  index: number | null,
  fallback: string,
): string {
  if (index === null || index < 0 || index >= monitors.length) {
    return fallback;
  }
  return resolveMonitorName(monitors[index], index, names);
}

/**
 * Load the persisted name map. A missing or malformed settings row resolves
 * to an empty map rather than throwing.
 */
export async function loadMonitorNames(): Promise<MonitorNameMap> {
  try {
    const raw = await getSetting(MONITOR_NAMES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as MonitorNameMap;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Save a name for one monitor's identity, merging with (and preserving) any
 * existing entries for monitors not currently detected.
 */
export async function saveMonitorName(
  identity: string,
  name: string,
): Promise<void> {
  const existing = await loadMonitorNames();
  const next: MonitorNameMap = { ...existing, [identity]: name };
  await setSetting(MONITOR_NAMES_KEY, JSON.stringify(next));
}
