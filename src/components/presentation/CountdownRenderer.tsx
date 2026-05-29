import React from "react";
import type { BackgroundInfo, CountdownConfig, CountdownPosition } from "../../types";
import { SongBackground } from "./SongBackground";
import { useCountdownDigits } from "../../runtime/useCountdownDigits";

interface Props {
  config: CountdownConfig;
  background?: BackgroundInfo;
  frozen?: boolean;
}

// Map a 9-point anchor to flex alignment classes. `justify-*` controls the
// vertical axis (flex-col), `items-*` the horizontal axis, and `text-*` keeps
// the message/digits aligned with the anchor.
const POSITION_CLASS: Record<CountdownPosition, string> = {
  "top-left": "justify-start items-start text-left",
  "top-center": "justify-start items-center text-center",
  "top-right": "justify-start items-end text-right",
  "center-left": "justify-center items-start text-left",
  center: "justify-center items-center text-center",
  "center-right": "justify-center items-end text-right",
  "bottom-left": "justify-end items-start text-left",
  "bottom-center": "justify-end items-center text-center",
  "bottom-right": "justify-end items-end text-right",
};

export const CountdownRenderer: React.FC<Props> = ({ config, background, frozen }) => {
  const { formattedTime, isFinished, isLow } = useCountdownDigits();
  const positionClass = POSITION_CLASS[config.position ?? "center"];

  return (
    <div className="relative h-full bg-black overflow-hidden select-none">
      {background && <SongBackground background={background} frozen={frozen} />}
      <div className={`relative z-10 h-full flex flex-col gap-4 p-16 ${positionClass}`}>
        {config.message && (
          <p
            className="text-gray-200 font-medium"
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
