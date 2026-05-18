import React, { useEffect, useState } from "react";
import { incrementCounter, onStateChanged } from "../../api/commands";

export const OperatorApp: React.FC = () => {
  const [counter, setCounter] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Subscribe to state_changed events from the Rust backend
    const unlistenPromise = onStateChanged((state) => {
      setCounter(state.counter);
    });

    return () => {
      // Cleanup listener on unmount
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleIncrement = async () => {
    setLoading(true);
    try {
      await incrementCounter();
    } catch (err) {
      console.error("Failed to increment counter:", err);
    } finally {
      setLoading(false);
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
          disabled={loading}
          className="mt-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
        >
          {loading ? "..." : "Increment Counter"}
        </button>
      </div>

      <p className="text-gray-600 text-xs">
        Both windows will sync when the counter changes.
      </p>
    </div>
  );
};
