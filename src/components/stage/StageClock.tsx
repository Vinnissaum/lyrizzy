import React, { useEffect, useState } from "react";
import { useCountdownDigits } from "../../runtime/useCountdownDigits";
import type { SetItem } from "../../types";

interface Props {
  currentItem?: SetItem;
}

function wallClockTime(): string {
  const now = new Date();
  return now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export const StageClock: React.FC<Props> = ({ currentItem }) => {
  const { formattedTime, isFinished, isLow } = useCountdownDigits();
  const [wallClock, setWallClock] = useState(wallClockTime);

  const isCountdownItem = currentItem?.itemType === "countdown";

  useEffect(() => {
    if (isCountdownItem) return;
    const id = setInterval(() => setWallClock(wallClockTime()), 1000);
    return () => clearInterval(id);
  }, [isCountdownItem]);

  if (isCountdownItem) {
    return (
      <span
        className={`font-mono font-bold tabular-nums ${
          isFinished ? "text-red-400" : isLow ? "text-amber-400" : "text-white"
        }`}
      >
        {formattedTime}
      </span>
    );
  }

  return <span className="font-mono text-white tabular-nums">{wallClock}</span>;
};
