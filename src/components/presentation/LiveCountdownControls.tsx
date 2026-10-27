import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlarmClock, Pause, Play, RotateCcw } from "lucide-react";
import { useCountdownStore } from "../../stores/countdown";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownDigits } from "../../runtime/useCountdownDigits";
import {
  countdownControlState,
  MINUTE_MS,
  restartTargetPassed,
} from "../../utils/countdownControls";
import { formatCommandError } from "../../i18n/commandError";

const BUTTON =
  "px-3 py-1 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface-2";

/**
 * Mid-presentation controls for the countdown on the focused output's wall
 * (P21). Adjustments are for this run only; the set item is never written.
 * The host decides when to mount it (`countdownOnWall`).
 */
export const LiveCountdownControls: React.FC = () => {
  const { t } = useTranslation();
  const countdown = useCountdownStore((s) => s.state);
  const items = usePresentationStore((s) => s.state?.set?.items);
  const { formattedTime } = useCountdownDigits();
  // Re-evaluated every tick, since each tick re-renders this component.
  const can = countdownControlState(
    countdown,
    restartTargetPassed(countdown, items ?? [], new Date()),
  );
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<void>) => {
    action().then(
      () => setError(null),
      (err) => setError(formatCommandError(err, t)),
    );
  };
  const store = useCountdownStore.getState;
  const paused = countdown.mode === "paused";

  return (
    <div
      data-testid="live-countdown-controls"
      role="group"
      aria-label={t("presentation.liveCountdown.label")}
      className="px-3 py-1.5 border-b border-border flex items-center gap-2 flex-wrap shrink-0"
    >
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <AlarmClock size={14} aria-hidden="true" />
        {t("presentation.liveCountdown.label")}
      </span>
      <span
        data-testid="live-countdown-remaining"
        className="text-sm font-semibold tabular-nums min-w-[3.5rem]"
      >
        {formattedTime}
      </span>
      <button
        type="button"
        className={BUTTON}
        disabled={!can.plus}
        onClick={() => run(() => store().adjust(MINUTE_MS))}
      >
        {t("presentation.liveCountdown.plusOne")}
      </button>
      <button
        type="button"
        className={BUTTON}
        disabled={!can.plus}
        onClick={() => run(() => store().adjust(5 * MINUTE_MS))}
      >
        {t("presentation.liveCountdown.plusFive")}
      </button>
      <button
        type="button"
        className={BUTTON}
        disabled={!can.minus}
        onClick={() => run(() => store().adjust(-MINUTE_MS))}
      >
        {t("presentation.liveCountdown.minusOne")}
      </button>
      {paused ? (
        <button
          type="button"
          className={BUTTON}
          disabled={!can.resume}
          onClick={() => run(() => store().resume())}
        >
          <Play size={12} className="fill-current" aria-hidden="true" />
          {t("presentation.liveCountdown.resume")}
        </button>
      ) : (
        <button
          type="button"
          className={BUTTON}
          disabled={!can.pause}
          onClick={() => run(() => store().pause({ mirror: true }))}
        >
          <Pause size={12} aria-hidden="true" />
          {t("presentation.liveCountdown.pause")}
        </button>
      )}
      <button
        type="button"
        className={BUTTON}
        disabled={!can.restart}
        onClick={() => run(() => store().restart())}
      >
        <RotateCcw size={12} aria-hidden="true" />
        {t("presentation.liveCountdown.restart")}
      </button>
      {error && (
        <span role="alert" className="text-xs text-warning">
          {error}
        </span>
      )}
    </div>
  );
};
