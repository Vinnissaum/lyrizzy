import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateSetItem } from "../../api/commands";
import { useCountdownStore } from "../../stores/countdown";
import { MediaPicker } from "../common/MediaPicker";
import { msToDuration, durationToMs } from "./countdownDuration";
import { formatCommandError } from "../../i18n/commandError";
import type {
  CountdownConfig,
  CountdownEndBehavior,
  CountdownPosition,
  SetItem,
} from "../../types";

interface Props {
  item: SetItem;
  setId: string;
  itemIndex: number;
  onClose: () => void;
  /**
   * Opened from the presenter's set pane (P23, AD-093). The backend carries a
   * save to a countdown counting from this item, so the dialog must not reset
   * or re-arm over it: while a countdown is running or paused on the focused
   * output the schedule fields are unavailable and the stored schedule is kept;
   * otherwise a schedule arms as on Home, and turning this item's own armed
   * schedule off disarms it - never another item's.
   */
  live?: boolean;
}

const END_BEHAVIOR_VALUES: CountdownEndBehavior[] = ["holdZero", "blackout", "advanceSet"];

// 3×3 grid of anchor positions, in display order (row-major).
const POSITION_GRID: CountdownPosition[] = [
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
];

export const CountdownScheduleModal: React.FC<Props> = ({
  item,
  setId,
  itemIndex,
  onClose,
  live = false,
}) => {
  const { t } = useTranslation();
  const config = item.countdownConfig;
  const countdownMode = useCountdownStore((s) => s.state.mode);
  // An output holds one countdown: arming a schedule would replace the one
  // counting on the wall.
  const scheduleLocked = live && (countdownMode === "running" || countdownMode === "paused");

  const initMode = config?.target?.kind === "fixedTime" ? "fixedTime" : "duration";
  const configDurationMs = config?.target?.kind === "duration" ? config.target.durationMs : 600_000;
  const initFixedTime =
    config?.target?.kind === "fixedTime"
      ? { hour: config.target.hour, minute: config.target.minute }
      : { hour: 9, minute: 0 };

  const [mode, setMode] = useState<"duration" | "fixedTime">(initMode);
  const [durationInput, setDurationInput] = useState(msToDuration(configDurationMs));
  const [fixedTime, setFixedTime] = useState(initFixedTime);
  const [name, setName] = useState(config?.name ?? "");
  const [message, setMessage] = useState(config?.message ?? t("countdown.editor.defaultMessage"));
  const [messageScale, setMessageScale] = useState<number>(config?.messageScale ?? 100);
  const [digitsScale, setDigitsScale] = useState<number>(config?.digitsScale ?? 100);
  const [endBehavior, setEndBehavior] = useState<CountdownEndBehavior>(
    config?.endBehavior ?? "holdZero"
  );
  const [backgroundMediaId, setBackgroundMediaId] = useState<string | undefined>(
    config?.backgroundMediaId
  );
  const [position, setPosition] = useState<CountdownPosition>(config?.position ?? "center");
  const [scheduledEnabled, setScheduledEnabled] = useState<boolean>(!!config?.scheduledStart);
  const [scheduledTime, setScheduledTime] = useState<string>(
    config?.scheduledStart
      ? `${String(config.scheduledStart.hour).padStart(2, "0")}:${String(config.scheduledStart.minute).padStart(2, "0")}`
      : "09:00"
  );
  const [durationError, setDurationError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // A fixed-time target + a separate schedule trigger is contradictory.
  const scheduleDisabled = mode === "fixedTime" || scheduleLocked;
  const scheduleOn = scheduledEnabled && !scheduleDisabled;
  // While locked the stored schedule is shown, disabled, not hidden.
  const scheduleShown = scheduleLocked ? scheduledEnabled && mode !== "fixedTime" : scheduleOn;

  const timeValue = `${String(fixedTime.hour).padStart(2, "0")}:${String(fixedTime.minute).padStart(2, "0")}`;

  const toggleBtnClass = (active: boolean) =>
    `px-3 py-1 text-sm rounded border transition-colors ${
      active
        ? "bg-primary text-fg-on-primary border-primary"
        : "bg-surface-2 border-border text-muted hover:text-inherit"
    }`;

  const parseScheduled = (): { hour: number; minute: number } | null => {
    const [h, m] = scheduledTime.split(":").map((x) => parseInt(x, 10));
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { hour: h, minute: m };
  };

  const handleSave = async () => {
    setDurationError(null);
    setScheduleError(null);
    setSaveError(null);

    // Build target / duration.
    let target: CountdownConfig["target"];
    let durationMs = 0;
    if (mode === "duration") {
      const ms = durationToMs(durationInput);
      if (ms === null || ms <= 0) {
        setDurationError(t("countdown.editor.durationError"));
        return;
      }
      durationMs = ms;
      target = { kind: "duration", durationMs: ms };
    } else {
      target = { kind: "fixedTime", hour: fixedTime.hour, minute: fixedTime.minute };
    }

    // Resolve schedule trigger (duration mode only).
    let scheduledStart: { hour: number; minute: number } | undefined;
    if (scheduleLocked) {
      // Unavailable right now: what is stored stays as it is.
      scheduledStart = mode === "fixedTime" ? undefined : config?.scheduledStart;
    } else if (scheduleOn) {
      const parsed = parseScheduled();
      if (!parsed) {
        setScheduleError(t("countdown.schedule.pastTimeError"));
        return;
      }
      // Refuse a trigger time already past today.
      const now = new Date();
      const trigger = new Date();
      trigger.setHours(parsed.hour, parsed.minute, 0, 0);
      if (trigger.getTime() <= now.getTime()) {
        setScheduleError(t("countdown.schedule.pastTimeError"));
        return;
      }
      scheduledStart = parsed;
    }

    const newConfig: CountdownConfig = {
      target,
      name: name.trim() || undefined,
      message: message.trim() || undefined,
      endBehavior,
      backgroundMediaId,
      position,
      scheduledStart,
      messageScale,
      digitsScale,
    };

    setSaving(true);
    try {
      await updateSetItem({ id: item.id, countdownConfig: newConfig });
      if (scheduleLocked) {
        // The backend already carried the edit to the countdown on the wall.
      } else if (live && !scheduledStart) {
        // Only this item's own armed schedule is this save's to disarm.
        const store = useCountdownStore.getState();
        const armed = store.armedItem;
        if (
          store.state.mode === "scheduled" &&
          armed?.setId === setId &&
          armed.itemIndex === itemIndex
        ) {
          await store.reset();
        }
      } else if (scheduledStart) {
        await useCountdownStore.getState().arm({
          scheduledStart,
          durationMs,
          message: newConfig.message,
          endBehavior,
          setId,
          itemIndex,
          position,
          backgroundMediaId,
          messageScale,
          digitsScale,
        });
      } else {
        await useCountdownStore.getState().reset();
      }
      onClose();
    } catch (err) {
      console.error("save countdown schedule failed:", err);
      setSaveError(formatCommandError(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        data-testid="countdown-schedule-modal"
        className="bg-surface rounded-xl shadow-2xl w-[420px] max-h-[85vh] flex flex-col"
      >
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{t("countdown.modal.title")}</h2>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="text-xs text-muted mb-1 block">{t("countdown.editor.name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              aria-label={t("countdown.editor.name")}
              className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Mode toggle + target input */}
          <div>
            <div className="flex gap-1 mb-2">
              <button
                type="button"
                onClick={() => setMode("duration")}
                className={toggleBtnClass(mode === "duration")}
              >
                {t("countdown.mode.duration")}
              </button>
              <button
                type="button"
                onClick={() => setMode("fixedTime")}
                className={toggleBtnClass(mode === "fixedTime")}
              >
                {t("countdown.mode.fixedTime")}
              </button>
            </div>

            {mode === "duration" ? (
              <>
                <label className="text-xs text-muted mb-1 block">{t("countdown.editor.duration")}</label>
                <input
                  type="text"
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  placeholder="10:00"
                  className={`w-full px-3 py-1.5 bg-surface-2 border rounded text-sm font-mono focus:outline-none focus:border-primary ${
                    durationError ? "border-danger" : "border-border"
                  }`}
                />
                {durationError && <p className="text-xs text-danger mt-1">{durationError}</p>}
              </>
            ) : (
              <>
                <label className="text-xs text-muted mb-1 block">{t("countdown.fixedTime.input.label")}</label>
                <input
                  type="time"
                  value={timeValue}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    if (!isNaN(h) && !isNaN(m)) {
                      setFixedTime({ hour: h, minute: m });
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded text-sm focus:outline-none focus:border-primary"
                />
              </>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="text-xs text-muted mb-1 block">{t("countdown.editor.message")}</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Message scale */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted">{t("countdown.editor.messageScale")}</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{messageScale}%</span>
                <button
                  type="button"
                  onClick={() => setMessageScale(100)}
                  className="text-xs text-primary hover:underline"
                >
                  {t("countdown.editor.scaleReset")}
                </button>
              </div>
            </div>
            <input
              type="range"
              min={50}
              max={300}
              step={5}
              value={messageScale}
              onChange={(e) => setMessageScale(Number(e.target.value))}
              aria-label={t("countdown.editor.messageScale")}
              className="w-full accent-primary"
            />
          </div>

          {/* Digits scale */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted">{t("countdown.editor.digitsScale")}</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{digitsScale}%</span>
                <button
                  type="button"
                  onClick={() => setDigitsScale(100)}
                  className="text-xs text-primary hover:underline"
                >
                  {t("countdown.editor.scaleReset")}
                </button>
              </div>
            </div>
            <input
              type="range"
              min={50}
              max={300}
              step={5}
              value={digitsScale}
              onChange={(e) => setDigitsScale(Number(e.target.value))}
              aria-label={t("countdown.editor.digitsScale")}
              className="w-full accent-primary"
            />
          </div>

          {/* End behavior */}
          <div>
            <label className="text-xs text-muted mb-1 block">{t("countdown.editor.endBehavior")}</label>
            <div className="space-y-1">
              {END_BEHAVIOR_VALUES.map((value) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`end-behavior-${item.id}`}
                    value={value}
                    checked={endBehavior === value}
                    onChange={() => setEndBehavior(value)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t(`countdown.endBehavior.${value}`)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Background media picker */}
          <div>
            <label className="text-xs text-muted mb-1 block">{t("countdown.editor.background")}</label>
            <MediaPicker
              value={backgroundMediaId}
              kind="video"
              label={t("countdown.editor.bgLabel")}
              onSelect={(media) => setBackgroundMediaId(media?.id ?? undefined)}
            />
          </div>

          {/* Position */}
          <div>
            <label className="text-xs text-muted mb-1 block">{t("countdown.editor.position")}</label>
            <div className="grid grid-cols-3 gap-1 w-24">
              {POSITION_GRID.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  aria-label={t(`countdown.position.${pos}`)}
                  aria-pressed={position === pos}
                  title={t(`countdown.position.${pos}`)}
                  onClick={() => setPosition(pos)}
                  className={`h-7 rounded border transition-colors ${
                    position === pos
                      ? "bg-primary border-primary"
                      : "bg-surface-2 border-border hover:border-primary"
                  }`}
                >
                  <span
                    className={`block w-1.5 h-1.5 rounded-full m-auto ${
                      position === pos ? "bg-fg-on-primary" : "bg-muted"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="border-t border-border pt-3">
            <label
              className={`flex items-center gap-2 mb-1 ${
                scheduleDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                checked={scheduleShown}
                disabled={scheduleDisabled}
                onChange={(e) => setScheduledEnabled(e.target.checked)}
                className="accent-primary"
              />
              <span className="text-sm">{t("countdown.schedule.toggle")}</span>
            </label>
            {scheduleShown && (
              <>
                <label className="text-xs text-muted mb-1 block">
                  {t("countdown.schedule.triggerLabel")}
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  disabled={scheduleLocked}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className={`w-full px-3 py-1.5 bg-surface-2 border rounded text-sm focus:outline-none focus:border-primary ${
                    scheduleError ? "border-danger" : "border-border"
                  }`}
                />
                {scheduleError && <p className="text-xs text-danger mt-1">{scheduleError}</p>}
              </>
            )}
            {scheduleLocked && (
              <p className="text-xs text-muted mt-1">
                {t("countdown.schedule.unavailableWhileCounting")}
              </p>
            )}
          </div>
          {saveError && (
            <p role="alert" className="text-xs text-danger">
              {saveError}
            </p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-surface-2 hover:bg-border transition-colors"
          >
            {t("countdown.modal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-fg-on-primary hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {t("countdown.modal.save")}
          </button>
        </div>
      </div>
    </div>
  );
};
