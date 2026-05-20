import React from "react";
import type { BackgroundInfo, CountdownConfig } from "../../types";
import { SongBackground } from "./SongBackground";
import { useCountdownDigits } from "../../runtime/useCountdownDigits";

interface Props {
  config: CountdownConfig;
  background?: BackgroundInfo;
  frozen?: boolean;
}

export const CountdownRenderer: React.FC<Props> = ({ config, background, frozen }) => {
  const { formattedTime, isFinished, isLow } = useCountdownDigits();

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
          {formattedTime}
        </p>
      </div>
    </div>
  );
};
