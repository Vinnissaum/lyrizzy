import React, { useState } from "react";
import { useCountdownStore } from "../../stores/countdown";

function formatMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export const CountdownPanel: React.FC = () => {
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
      <h2 className="text-base font-semibold text-white">Cronômetro</h2>

      {/* Big display */}
      <div className="flex-1 flex items-center justify-center">
        <div
          className={`text-8xl font-mono font-bold tabular-nums tracking-tight select-none ${
            isFinished
              ? "text-red-400"
              : isRunning
              ? "text-emerald-400"
              : "text-white"
          }`}
        >
          {formatMs(displayMs)}
        </div>
      </div>

      {/* Duration input */}
      <div className="bg-gray-800 rounded-xl p-4 space-y-3">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
          Definir duração
        </p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Min</label>
            <input
              type="number"
              min="0"
              max="99"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-center text-lg font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
          <span className="text-gray-400 text-2xl font-mono pb-2">:</span>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Seg</label>
            <input
              type="number"
              min="0"
              max="59"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-center text-lg font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={handleSetDuration}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm font-medium transition-colors"
          >
            Definir
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {isRunning ? (
          <button
            onClick={pause}
            className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl text-sm font-semibold transition-colors"
          >
            Pausar
          </button>
        ) : (
          <button
            onClick={start}
            disabled={state.durationMs === 0}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
          >
            Iniciar
          </button>
        )}
        <button
          onClick={reset}
          disabled={state.durationMs === 0}
          className="px-5 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
        >
          Resetar
        </button>
      </div>

      {isFinished && (
        <p className="text-center text-red-400 text-sm font-medium animate-pulse">
          Tempo esgotado!
        </p>
      )}
    </div>
  );
};
