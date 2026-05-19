import React from "react";
import type { BackgroundInfo, CountdownConfig } from "../../types";
import { SongBackground } from "./SongBackground";
import { useCountdownStore } from "../../stores/countdown";

interface Props {
  config: CountdownConfig;
  background?: BackgroundInfo;
  frozen?: boolean;
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

export const CountdownRenderer: React.FC<Props> = ({ config, background, frozen }) => {
  const { state } = useCountdownStore();

  const isFinished = state.mode === "finished";
  const isLow = !isFinished && state.remainingMs > 0 && state.remainingMs <= 60_000;
  const displayMs = state.remainingMs;

  return (
    <div className="relative h-full bg-black overflow-hidden select-none">
      {background && <SongBackground background={background} frozen={frozen} />}
      <div className="relative z-10 h-full flex flex-col items-center justify-center gap-4 px-8">
        {config.message && (
          <p
            className="text-gray-200 font-medium text-center"
            style={{ fontSize: "clamp(1rem, 3vmin, 2rem)" }}
          >
            {config.message}
          </p>
        )}
        <p
          className={`font-mono font-bold tabular-nums tracking-tight ${
            isFinished ? "text-red-400" : isLow ? "text-amber-400" : "text-white"
          }`}
          style={{ fontSize: "clamp(4rem, 30vmin, 18rem)" }}
        >
          {formatMs(displayMs)}
        </p>
      </div>
    </div>
  );
};
