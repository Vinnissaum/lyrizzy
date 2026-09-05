import React from "react";
import { useTranslation } from "react-i18next";
import type { BackgroundInfo, CountdownConfig } from "../../types";
import { SongBackground } from "./SongBackground";
import { POSITION_CLASS } from "./layout";
import { useCountdownDigits } from "../../runtime/useCountdownDigits";

interface Props {
  config: CountdownConfig;
  background?: BackgroundInfo;
  frozen?: boolean;
}

const scaled = (min: string, mid: string, max: string, pct: number) =>
  `clamp(calc(${min} * ${pct / 100}), calc(${mid} * ${pct / 100}), calc(${max} * ${pct / 100}))`;

export const CountdownRenderer: React.FC<Props> = ({ config, background, frozen }) => {
  const { t } = useTranslation();
  const { formattedTime, isFinished, isLow, isScheduled } = useCountdownDigits();
  const positionClass = POSITION_CLASS[config.position ?? "center"];
  const messageScale = config.messageScale ?? 100;
  const digitsScale = config.digitsScale ?? 100;
  const messageFontSize = scaled("0.75rem", "3cqmin", "2rem", messageScale);
  const digitsFontSize = scaled("2rem", "30cqmin", "18rem", digitsScale);

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
        {isScheduled ? (
          <p
            className="text-amber-300 font-medium uppercase tracking-wider"
            style={{ fontSize: messageFontSize }}
          >
            {t("countdown.scheduled.rendererLabel")}
          </p>
        ) : (
          config.message && (
            <p
              className="text-gray-200 font-medium"
              style={{ fontSize: messageFontSize }}
            >
              {config.message}
            </p>
          )
        )}
        <p
          className={`font-mono font-bold tabular-nums tracking-tight ${
            isFinished
              ? "text-red-400"
              : isScheduled
              ? "text-amber-300"
              : isLow
              ? "text-amber-400"
              : "text-white"
          }`}
          style={{ fontSize: digitsFontSize }}
        >
          {formattedTime}
        </p>
      </div>
    </div>
  );
};
