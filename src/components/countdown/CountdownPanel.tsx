import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCountdownStore } from "../../stores/countdown";

function formatMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export const CountdownPanel: React.FC = () => {
  const { t } = useTranslation();
  const { state, setDuration, start, arm, pause, reset } = useCountdownStore();
  const [minutes, setMinutes] = useState("10");
  const [seconds, setSeconds] = useState("00");
  const [scheduleTime, setScheduleTime] = useState("");

  const handleSetDuration = () => {
    const m = Math.max(0, parseInt(minutes, 10) || 0);
    const s = Math.max(0, Math.min(59, parseInt(seconds, 10) || 0));
    const ms = (m * 60 + s) * 1000;
    if (ms > 0) setDuration(ms);
  };

  const handleArm = () => {
    const [h, m] = scheduleTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return;
    const mins = Math.max(0, parseInt(minutes, 10) || 0);
    const secs = Math.max(0, Math.min(59, parseInt(seconds, 10) || 0));
    const durationMs = (mins * 60 + secs) * 1000;
    if (durationMs === 0) return;
    arm({ scheduledStart: { hour: h, minute: m }, durationMs });
  };

  const displayMs = state.remainingMs > 0 ? state.remainingMs : state.durationMs;
  const isRunning = state.mode === "running";
  const isScheduled = state.mode === "scheduled";
  const isFinished = state.mode === "finished";

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <h2 className="text-base font-semibold">{t("countdown.title")}</h2>

      {/* Big display */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {isScheduled && (
          <p className="text-xs uppercase tracking-wider text-muted mb-2">
            {t("countdown.scheduled.label")}
          </p>
        )}
        <div
          className={`text-8xl font-mono font-bold tabular-nums tracking-tight select-none ${
            isFinished
              ? "text-danger"
              : isRunning
              ? "text-success"
              : isScheduled
              ? "text-warning"
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

      {/* Schedule input */}
      <div className="bg-surface rounded-xl p-4 space-y-3">
        <p className="text-xs text-muted font-medium uppercase tracking-wider">
          {t("countdown.schedule.heading")}
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted mb-1 block">
              {t("countdown.schedule.startAt")}
            </label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-center text-lg font-mono focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleArm}
            disabled={!scheduleTime || state.durationMs === 0}
            className="px-4 py-2 bg-warning text-fg-on-primary hover:bg-warning disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
          >
            {t("countdown.schedule.armButton")}
          </button>
        </div>
        <p className="text-xs text-muted">{t("countdown.schedule.hint")}</p>
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
      {isScheduled && (
        <p className="text-center text-warning text-sm font-medium">
          {t("countdown.scheduled.waiting")}
        </p>
      )}
    </div>
  );
};
