import React, { useEffect, useState } from "react";
import {
  incrementCounter,
  onStateChanged,
  openPresentationWindow,
} from "../../api/commands";

export const OperatorApp: React.FC = () => {
  const [counter, setCounter] = useState<number>(0);
  const [counterLoading, setCounterLoading] = useState(false);
  const [presentationLoading, setPresentationLoading] = useState(false);

  useEffect(() => {
    const unlistenPromise = onStateChanged((state) => {
      setCounter(state.counter);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleIncrement = async () => {
    setCounterLoading(true);
    try {
      await incrementCounter();
    } catch (err) {
      console.error("Failed to increment counter:", err);
    } finally {
      setCounterLoading(false);
    }
  };

  const handleOpenPresentation = async () => {
    setPresentationLoading(true);
    try {
      await openPresentationWindow();
    } catch (err) {
      console.error("Failed to open presentation window:", err);
    } finally {
      setPresentationLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">Trinity Lyrics — Operator Console</h1>

      <div className="flex flex-col items-center gap-4 p-8 bg-gray-800 rounded-xl">
        <p className="text-gray-400 text-sm uppercase tracking-wider">
          Phase 0 — IPC Demo
        </p>
        <p className="text-6xl font-mono font-bold text-green-400">{counter}</p>
        <p className="text-gray-500 text-xs">counter (synced via state_changed event)</p>
        <button
          onClick={handleIncrement}
          disabled={counterLoading}
          className="mt-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
        >
          {counterLoading ? "..." : "Increment Counter"}
        </button>
      </div>

      <button
        onClick={handleOpenPresentation}
        disabled={presentationLoading}
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
      >
        {presentationLoading ? "..." : "Open Presentation Window"}
      </button>

      <p className="text-gray-600 text-xs">
        Both windows will sync when the counter changes.
      </p>
    </div>
  );
};
