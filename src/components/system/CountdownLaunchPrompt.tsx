import React from "react";
import { useTranslation } from "react-i18next";
import { AlarmClock } from "lucide-react";

interface Props {
  /** The scheduled fire time, pre-formatted as "HH:MM". */
  scheduledHHMM: string;
  /** Milliseconds from now until the scheduled fire time. */
  remainingMs: number;
  onKeep: () => void;
  onDisable: () => void;
}

/** Format a positive duration as hh:mm:ss (drops the hour segment when < 1h). */
function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * One-shot launch dialog (operator window only). Warns that a scheduled
 * countdown in the current set will take over the screen at HH:MM, and lets the
 * operator keep it armed or switch it off for this session. No internal timers —
 * a pure decision dialog driven entirely by props.
 */
export const CountdownLaunchPrompt: React.FC<Props> = ({
  scheduledHHMM,
  remainingMs,
  onKeep,
  onDisable,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="countdown-launch-title"
      data-testid="countdown-launch-prompt"
    >
      <div className="bg-surface rounded-xl shadow-2xl w-[28rem] max-w-[90vw] flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <AlarmClock size={16} className="text-primary" />
          <h3 id="countdown-launch-title" className="text-sm font-semibold">
            {t("countdown.launch.title")}
          </h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted">
            {t("countdown.launch.body", {
              time: scheduledHHMM,
              remaining: formatRemaining(remainingMs),
            })}
          </p>
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button
            onClick={onDisable}
            data-testid="countdown-launch-disable"
            className="px-4 py-2 text-sm rounded-lg bg-surface-2 hover:bg-border transition-colors"
          >
            {t("countdown.launch.disable")}
          </button>
          <button
            onClick={onKeep}
            data-testid="countdown-launch-keep"
            className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-fg-on-primary font-medium transition-colors"
          >
            {t("countdown.launch.keep")}
          </button>
        </div>
      </div>
    </div>
  );
};
