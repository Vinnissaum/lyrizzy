import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlarmClock } from "lucide-react";
import { useCountdownStore } from "../../stores/countdown";

export interface ArmedItemRef {
  setId: string;
  itemIndex: number;
}

interface ScheduledCountdownWidgetProps {
  /** Opens the schedule modal for the armed item (modal owned by OperatorApp). */
  onEdit: (armedItem: ArmedItemRef) => void;
  /**
   * Optional: clear the persisted schedule on the armed item so it won't
   * re-arm next launch. Cancel always calls `reset()`; if this is provided it
   * is also invoked (OperatorApp owns the set lookup → item id → updateSetItem).
   */
  onCancel?: (armedItem: ArmedItemRef) => void;
}

/** Format milliseconds as hh:mm:ss, dropping the hour segment when < 1h. */
export function msToClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Derive the local HH:MM trigger time from an epoch-ms value. */
function epochToHHMM(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduledCountdownWidget({
  onEdit,
  onCancel,
}: ScheduledCountdownWidgetProps) {
  const { t } = useTranslation();
  const state = useCountdownStore((s) => s.state);
  const armedItem = useCountdownStore((s) => s.armedItem);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Don't start a drag from the action buttons.
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const startOffset = { ...offset };
      setDragging(true);

      const handle = (ev: PointerEvent) => {
        setOffset({
          x: startOffset.x + (ev.clientX - startX),
          y: startOffset.y + (ev.clientY - startY),
        });
      };
      const stop = () => {
        setDragging(false);
        window.removeEventListener("pointermove", handle);
        window.removeEventListener("pointerup", stop);
      };
      window.addEventListener("pointermove", handle);
      window.addEventListener("pointerup", stop);
    },
    [offset],
  );

  const visible =
    state.mode === "scheduled" ||
    (state.mode === "running" && state.takeover === true);

  if (!visible) return null;

  const triggerTime =
    typeof state.scheduledStartEpochMs === "number"
      ? epochToHHMM(state.scheduledStartEpochMs)
      : null;

  const remaining = msToClock(state.remainingMs);

  const handleEdit = () => {
    if (armedItem) onEdit(armedItem);
  };

  const handleCancel = () => {
    void useCountdownStore.getState().reset();
    if (armedItem && onCancel) onCancel(armedItem);
  };

  return (
    <div
      data-testid="scheduled-countdown-widget"
      className="fixed bottom-4 right-4 z-40 w-64 rounded-lg border border-border bg-surface shadow-lg"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <div
        onPointerDown={onPointerDown}
        className={`flex items-center gap-2 rounded-t-lg border-b border-border px-3 py-2 select-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <AlarmClock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        {triggerTime && (
          <span className="text-sm font-medium text-fg" data-testid="widget-trigger-time">
            {triggerTime}
          </span>
        )}
        <span className="ml-auto text-sm tabular-nums text-muted" data-testid="widget-remaining">
          {t("countdown.widget.remaining", { remaining })}
        </span>
      </div>
      <div className="flex gap-2 px-3 py-2">
        <button
          type="button"
          onClick={handleEdit}
          disabled={!armedItem}
          className="flex-1 rounded-md bg-primary px-2 py-1 text-sm text-fg-on-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("countdown.widget.edit")}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 rounded-md bg-warning-bg px-2 py-1 text-sm text-warning"
        >
          {t("countdown.widget.cancel")}
        </button>
      </div>
    </div>
  );
}
