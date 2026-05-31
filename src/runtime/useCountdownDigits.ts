import { useCountdownStore } from "../stores/countdown";
import type { CountdownMode } from "../types";

export interface CountdownDigits {
  formattedTime: string;
  isFinished: boolean;
  isLow: boolean;
  isScheduled: boolean;
  remainingMs: number;
  mode: CountdownMode;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function useCountdownDigits(): CountdownDigits {
  const { state } = useCountdownStore();
  const isFinished = state.mode === "finished";
  const isScheduled = state.mode === "scheduled";
  const isLow =
    !isFinished && !isScheduled && state.remainingMs > 0 && state.remainingMs <= 60_000;
  return {
    formattedTime: formatMs(state.remainingMs),
    isFinished,
    isLow,
    isScheduled,
    remainingMs: state.remainingMs,
    mode: state.mode,
  };
}
