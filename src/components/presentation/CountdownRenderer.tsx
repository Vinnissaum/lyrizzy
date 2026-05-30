import React from "react";
import type { BackgroundInfo, CountdownConfig } from "../../types";
import { SongBackground } from "./SongBackground";
import { POSITION_CLASS } from "./layout";
import { useCountdownDigits } from "../../runtime/useCountdownDigits";

interface Props {
  config: CountdownConfig;
  background?: BackgroundInfo;
  frozen?: boolean;
}

export const CountdownRenderer: React.FC<Props> = ({ config, background, frozen }) => {
  const { formattedTime, isFinished, isLow } = useCountdownDigits();
  const positionClass = POSITION_CLASS[config.position ?? "center"];

  // Size relative to THIS box (container query units) rather than the viewport,
  // so the digits scale down correctly inside the small operator live preview
  // instead of overflowing/zooming. `containerType: size` establishes the
  // query container; full-screen the container ≈ the viewport, so sizing is
  // unchanged there.
  return (
    <div
      className="relative h-full bg-black overflow-hidden select-none"
      style={{ containerType: "size" }}
    >
      {background && <SongBackground background={background} frozen={frozen} />}
      <div className={`relative z-10 h-full flex flex-col gap-4 p-16 ${positionClass}`}>
        {config.message && (
          <p
            className="text-gray-200 font-medium"
            style={{ fontSize: "clamp(0.75rem, 3cqmin, 2rem)" }}
          >
            {config.message}
          </p>
        )}
        <p
          className={`font-mono font-bold tabular-nums tracking-tight ${
            isFinished ? "text-red-400" : isLow ? "text-amber-400" : "text-white"
          }`}
          style={{ fontSize: "clamp(2rem, 30cqmin, 18rem)" }}
        >
          {formattedTime}
        </p>
      </div>
    </div>
  );
};
