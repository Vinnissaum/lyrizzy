import type { CountdownState, PresentationState, VideoReport } from "../types";

/** What `−10 s` and `+10 s` move the video by. */
export const SKIP_MS = 10_000;

/** Shown for a time the video does not know yet. */
export const UNKNOWN_TIME = "--:--";

/** `mm:ss`, or `h:mm:ss` from one hour up. Whole seconds, rounded down. */
export function formatVideoTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export interface VideoTimes {
  elapsed: string;
  /** `--:--` while the duration is unknown. */
  total: string;
  /** With its minus sign, e.g. `−02:15`; `--:--` while the duration is unknown. */
  remaining: string;
  /** Position over duration, 0..1; 0 while the duration is unknown. */
  fraction: number;
}

/**
 * The strip's times for a position in a video. Elapsed and remaining are both
 * whole seconds of the same clock, so they always add up to the total.
 */
export function videoTimes(positionMs: number, durationMs: number | null): VideoTimes {
  const position = Math.max(0, positionMs);
  if (durationMs === null) {
    return {
      elapsed: formatVideoTime(position),
      total: UNKNOWN_TIME,
      remaining: UNKNOWN_TIME,
      fraction: 0,
    };
  }
  const within = Math.min(position, durationMs);
  const leftSec = Math.floor(durationMs / 1000) - Math.floor(within / 1000);
  return {
    elapsed: formatVideoTime(within),
    total: formatVideoTime(durationMs),
    remaining: `−${formatVideoTime(leftSec * 1000)}`,
    fraction: durationMs > 0 ? within / durationMs : 0,
  };
}

/** A position kept inside the video: never before 0, never past its end. */
export function clampPosition(positionMs: number, durationMs: number | null): number {
  const floor = Math.max(0, positionMs);
  return durationMs === null ? floor : Math.min(floor, durationMs);
}

/** Where a skip of `deltaMs` from `positionMs` lands, clamped to the video. */
export function skipTarget(
  positionMs: number,
  deltaMs: number,
  durationMs: number | null,
): number {
  return clampPosition(positionMs + deltaMs, durationMs);
}

/**
 * Whether the operator's video strip shows: the focused output's wall reports
 * a video, it is the item that output is on, and nothing covers or replaces
 * it. The wall withdraws its report when the video leaves; the rest guards
 * against a wall that went away without saying so.
 */
export function videoOnWall(
  report: VideoReport | null | undefined,
  presentation: PresentationState | null | undefined,
  countdown: CountdownState,
): boolean {
  if (!report || report.itemId === null || !presentation) return false;
  if (presentation.mode !== "live" && presentation.mode !== "frozen") return false;
  if (presentation.overlay) return false;
  if (countdown.takeover && countdown.mode !== "idle") return false;
  const current = presentation.set?.items?.[presentation.currentItemIndex];
  return current?.id === report.itemId;
}

export interface VideoControlState {
  /** `Pausar` / `Retomar`. */
  pauseResume: boolean;
  restart: boolean;
  /** `−10 s` and `+10 s`. */
  skip: boolean;
  /** The progress bar. */
  seek: boolean;
  mute: boolean;
}

/**
 * Which video controls are usable. Mirrors what the wall will accept: a frozen
 * output holds its video, a video that failed has nothing to drive, an ended
 * one can only be sent back, and seeking needs a known duration.
 */
export function videoControlState(report: VideoReport, frozen: boolean): VideoControlState {
  if (report.status === "failed") {
    return { pauseResume: false, restart: false, skip: false, seek: false, mute: false };
  }
  if (frozen) {
    return { pauseResume: false, restart: false, skip: false, seek: false, mute: true };
  }
  const known = report.durationMs !== null;
  return {
    pauseResume: report.status !== "ended",
    restart: true,
    skip: known,
    seek: known,
    mute: true,
  };
}
