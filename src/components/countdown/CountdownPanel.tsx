import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCountdownStore } from "../../stores/countdown";

function formatMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export const CountdownPanel: React.FC = () => {
  const { t } = useTranslation();
  const { state, setDuration, start, pause, reset } = useCountdownStore();
  const [minutes, setMinutes] = useState("10");
  const [seconds, setSeconds] = useState("00");

  const handleSetDuration = () => {
    const m = Math.max(0, parseInt(minutes, 10) || 0);
    const s = Math.max(0, Math.min(59, parseInt(seconds, 10) || 0));
    const ms = (m * 60 + s) * 1000;
    if (ms > 0) setDuration(ms);
  };

  const displayMs = state.remainingMs > 0 ? state.remainingMs : state.durationMs;
  const isRunning = state.mode === "running";
  const isFinished = state.mode === "finished";

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <h2 className="text-base font-semibold">{t("countdown.title")}</h2>

      {/* Big display */}
      <div className="flex-1 flex items-center justify-center">
        <div
          className={`text-8xl font-mono font-bold tabular-nums tracking-tight select-none ${
            isFinished
              ? "text-danger"
              : isRunning
              ? "text-success"
              : ""
          }`}
        >
          {formatMs(displayMs)}
        </div>
      </div>

      {/* Duration input */}
      <div className="bg-surface rounded-xl p-4 space-y-3">
        <p className="text-xs text-muted font-medium uppercase tracking-wider">
          {t("countdown.setDuration")}
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted mb-1 block">{t("countdown.min")}</label>
            <input
              type="number"
              min="0"
              max="99"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-center text-lg font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <span className="text-muted text-2xl font-mono pb-2">:</span>
          <div className="flex-1">
            <label className="text-xs text-muted mb-1 block">{t("countdown.sec")}</label>
            <input
              type="number"
              min="0"
              max="59"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-center text-lg font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleSetDuration}
            className="px-4 py-2 bg-surface-2 hover:bg-border rounded-lg text-sm font-medium transition-colors"
          >
            {t("countdown.setButton")}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {isRunning ? (
          <button
            onClick={pause}
            className="flex-1 py-3 bg-warning hover:bg-warning text-fg-on-primary rounded-xl text-sm font-semibold transition-colors"
          >
            {t("countdown.pause")}
          </button>
        ) : (
          <button
            onClick={() => start()}
            disabled={state.durationMs === 0}
            className="flex-1 py-3 bg-primary hover:bg-primary-hover text-fg-on-primary disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
          >
            {t("countdown.start")}
          </button>
        )}
        <button
          onClick={reset}
          disabled={state.durationMs === 0}
          className="px-5 py-3 bg-surface-2 hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
        >
          {t("countdown.reset")}
        </button>
      </div>

      {isFinished && (
        <p className="text-center text-danger text-sm font-medium animate-pulse">
          {t("countdown.finished")}
        </p>
      )}
    </div>
  );
};
