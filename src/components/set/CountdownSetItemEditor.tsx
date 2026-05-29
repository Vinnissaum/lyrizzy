import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { updateSetItem } from "../../api/commands";
import { MediaPicker } from "../common/MediaPicker";
import { NotesField } from "../common/NotesField";
import type { CountdownConfig, CountdownEndBehavior, CountdownPosition, SetItem } from "../../types";

interface Props {
  item: SetItem;
}

function msToDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function durationToMs(value: string): number | null {
  const parts = value.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s < 0 || s > 59) return null;
    return (m * 60 + s) * 1000;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (s < 0 || s > 59 || m < 0 || m > 59) return null;
    return (h * 3600 + m * 60 + s) * 1000;
  }
  return null;
}

const END_BEHAVIOR_VALUES: CountdownEndBehavior[] = ["holdZero", "blackout", "advanceSet"];

// 3×3 grid of anchor positions, in display order (row-major).
const POSITION_GRID: CountdownPosition[] = [
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
];

export const CountdownSetItemEditor: React.FC<Props> = ({ item }) => {
  const { t } = useTranslation();
  const config = item.countdownConfig;

  const initMode = config?.target?.kind === "fixedTime" ? "fixedTime" : "duration";
  const configDurationMs = config?.target?.kind === "duration" ? config.target.durationMs : 600_000;
  const initFixedTime =
    config?.target?.kind === "fixedTime"
      ? { hour: config.target.hour, minute: config.target.minute }
      : { hour: 9, minute: 0 };

  const [mode, setMode] = useState<"duration" | "fixedTime">(initMode);
  const [durationInput, setDurationInput] = useState(msToDuration(configDurationMs));
  const [fixedTime, setFixedTime] = useState(initFixedTime);
  const [message, setMessage] = useState(config?.message ?? t("countdown.editor.defaultMessage"));
  const [endBehavior, setEndBehavior] = useState<CountdownEndBehavior>(
    config?.endBehavior ?? "holdZero"
  );
  const [backgroundMediaId, setBackgroundMediaId] = useState<string | undefined>(
    config?.backgroundMediaId
  );
  const [position, setPosition] = useState<CountdownPosition>(config?.position ?? "center");
  const [durationError, setDurationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cfg = item.countdownConfig;
    const newMode = cfg?.target?.kind === "fixedTime" ? "fixedTime" : "duration";
    const newDurationMs = cfg?.target?.kind === "duration" ? cfg.target.durationMs : 600_000;
    const newFixedTime =
      cfg?.target?.kind === "fixedTime"
        ? { hour: cfg.target.hour, minute: cfg.target.minute }
        : { hour: 9, minute: 0 };
    setMode(newMode);
    setDurationInput(msToDuration(newDurationMs));
    setFixedTime(newFixedTime);
    setMessage(cfg?.message ?? t("countdown.editor.defaultMessage"));
    setEndBehavior(cfg?.endBehavior ?? "holdZero");
    setBackgroundMediaId(cfg?.backgroundMediaId);
    setPosition(cfg?.position ?? "center");
    setDurationError(null);
    setNotes(item.notes ?? "");
  }, [item.id]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      updateSetItem({ id: item.id, notes: value || undefined }).catch(console.error);
    }, 300);
  };

  const buildConfig = (overrides?: Partial<CountdownConfig>): CountdownConfig | null => {
    let target: CountdownConfig["target"];
    if (mode === "duration") {
      const durationMs = durationToMs(durationInput);
      if (durationMs === null || durationMs <= 0) return null;
      target = { kind: "duration", durationMs };
    } else {
      target = { kind: "fixedTime", hour: fixedTime.hour, minute: fixedTime.minute };
    }
    return {
      target,
      message: message.trim() || undefined,
      endBehavior,
      backgroundMediaId,
      position,
      ...overrides,
    };
  };

  // Persist the current config with optional overrides applied. Used by the
  // controls that save immediately (end behavior, background, position), since
  // their new value isn't reflected in state yet at save time.
  const persist = (overrides?: Partial<CountdownConfig>) => {
    const newConfig = buildConfig(overrides);
    if (!newConfig) return;
    updateSetItem({ id: item.id, countdownConfig: newConfig }).catch(console.error);
  };

  const handleSave = async () => {
    const newConfig = buildConfig();
    if (!newConfig) {
      setDurationError(t("countdown.editor.durationError"));
      return;
    }
    setDurationError(null);
    setSaving(true);
    try {
      await updateSetItem({ id: item.id, countdownConfig: newConfig });
    } catch (err) {
      console.error("save countdown failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const timeValue = `${String(fixedTime.hour).padStart(2, "0")}:${String(fixedTime.minute).padStart(2, "0")}`;

  const toggleBtnClass = (active: boolean) =>
    `px-3 py-1 text-sm rounded border transition-colors ${
      active
        ? "bg-primary text-fg-on-primary border-primary"
        : "bg-surface-2 border-border text-muted hover:text-inherit"
    }`;

  return (
    <div className="p-3 space-y-3">
      {/* Mode toggle + target input */}
      <div>
        <div className="flex gap-1 mb-2">
          <button type="button" onClick={() => setMode("duration")} className={toggleBtnClass(mode === "duration")}>
            {t("countdown.mode.duration")}
          </button>
          <button type="button" onClick={() => setMode("fixedTime")} className={toggleBtnClass(mode === "fixedTime")}>
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
              onBlur={handleSave}
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
              onBlur={handleSave}
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
          onBlur={handleSave}
          maxLength={200}
          className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded text-sm focus:outline-none focus:border-primary"
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
                onChange={() => {
                  setEndBehavior(value);
                  persist({ endBehavior: value });
                }}
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
          onSelect={(media) => {
            const newId = media?.id ?? undefined;
            setBackgroundMediaId(newId);
            persist({ backgroundMediaId: newId });
          }}
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
              onClick={() => {
                setPosition(pos);
                persist({ position: pos });
              }}
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

      {saving && <p className="text-xs text-muted">{t("countdown.editor.saving")}</p>}

      <div>
        <p className="text-xs text-muted mb-1">{t("builder.itemNotes.label")}</p>
        <NotesField value={notes} onChange={handleNotesChange} placeholder={t("builder.itemNotes.placeholder")} />
      </div>
    </div>
  );
};
