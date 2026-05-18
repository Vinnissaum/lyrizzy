import React, { useEffect, useState } from "react";
import { onStateChanged } from "../../api/commands";

export const PresentationApp: React.FC = () => {
  const [counter, setCounter] = useState<number>(0);

  useEffect(() => {
    // Subscribe to state_changed events — presentation window is read-only
    const unlistenPromise = onStateChanged((state) => {
      setCounter(state.counter);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <div className="h-screen bg-black text-white flex flex-col items-center justify-center gap-8">
      <h1 className="text-4xl font-bold">Trinity Lyrics</h1>

      {/* Phase 0: counter synced from operator via state_changed */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-gray-500 text-sm uppercase tracking-widest">
          IPC Counter
        </p>
        <p className="text-8xl font-mono font-bold text-white">{counter}</p>
      </div>

      {/* Phase 0: MP4 video via asset:// protocol */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-gray-500 text-sm uppercase tracking-widest">
          asset:// Video Demo
        </p>
        <video
          src="asset://media/test.mp4"
          controls
          autoPlay
          loop
          muted
          className="w-80 h-48 bg-gray-900 rounded-lg"
          onError={() => console.warn("test.mp4 not found — place a file at %APPDATA%\\TrinityLyrics\\media\\test.mp4")}
        />
        <p className="text-gray-600 text-xs">
          Place test.mp4 in %APPDATA%\TrinityLyrics\media\ to test video playback
        </p>
      </div>
    </div>
  );
};
