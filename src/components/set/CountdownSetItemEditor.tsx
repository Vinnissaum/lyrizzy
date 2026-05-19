import React, { useEffect, useState } from "react";
import { updateSetItem } from "../../api/commands";
import { MediaPicker } from "../common/MediaPicker";
import type { CountdownConfig, CountdownEndBehavior, SetItem } from "../../types";

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

const END_BEHAVIOR_OPTIONS: { value: CountdownEndBehavior; label: string }[] = [
  { value: "holdZero", label: "Manter 00:00" },
  { value: "blackout", label: "Tela preta" },
  { value: "advanceSet", label: "Avançar conjunto" },
];

export const CountdownSetItemEditor: React.FC<Props> = ({ item }) => {
  const config = item.countdownConfig;

  const [durationInput, setDurationInput] = useState(
    msToDuration(config?.durationMs ?? 600_000)
  );
  const [message, setMessage] = useState(config?.message ?? "O culto começa em…");
  const [endBehavior, setEndBehavior] = useState<CountdownEndBehavior>(
    config?.endBehavior ?? "holdZero"
  );
  const [backgroundMediaId, setBackgroundMediaId] = useState<string | undefined>(
    config?.backgroundMediaId
  );
  const [durationError, setDurationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync local state when a different item is selected.
  useEffect(() => {
    setDurationInput(msToDuration(config?.durationMs ?? 600_000));
    setMessage(config?.message ?? "O culto começa em…");
    setEndBehavior(config?.endBehavior ?? "holdZero");
    setBackgroundMediaId(config?.backgroundMediaId);
    setDurationError(null);
  }, [item.id]);

  const buildConfig = (): CountdownConfig | null => {
    const durationMs = durationToMs(durationInput);
    if (durationMs === null || durationMs <= 0) return null;
    return {
      durationMs,
      message: message.trim() || undefined,
      endBehavior,
      backgroundMediaId,
    };
  };

  const handleSave = async () => {
    const newConfig = buildConfig();
    if (!newConfig) {
      setDurationError("Formato inválido. Use mm:ss ou hh:mm:ss");
      return;
    }
    setDurationError(null);
    setSaving(true);
    try {
      await updateSetItem({ id: item.id, countdownConfig: newConfig });
    } catch (err) {
      console.error("Falha ao salvar contagem:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 space-y-3">
      {/* Duration */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Duração (mm:ss)</label>
        <input
          type="text"
          value={durationInput}
          onChange={(e) => setDurationInput(e.target.value)}
          onBlur={handleSave}
          placeholder="10:00"
          className={`w-full px-3 py-1.5 bg-gray-700 border rounded text-sm text-white font-mono focus:outline-none focus:border-blue-500 ${
            durationError ? "border-red-500" : "border-gray-600"
          }`}
        />
        {durationError && (
          <p className="text-xs text-red-400 mt-1">{durationError}</p>
        )}
      </div>

      {/* Message */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Mensagem</label>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={handleSave}
          maxLength={200}
          className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* End behavior */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Ao terminar</label>
        <div className="space-y-1">
          {END_BEHAVIOR_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name={`end-behavior-${item.id}`}
                value={opt.value}
                checked={endBehavior === opt.value}
                onChange={() => {
                  setEndBehavior(opt.value);
                  // Auto-save on radio change
                  const durationMs = durationToMs(durationInput);
                  if (durationMs && durationMs > 0) {
                    updateSetItem({
                      id: item.id,
                      countdownConfig: {
                        durationMs,
                        message: message.trim() || undefined,
                        endBehavior: opt.value,
                        backgroundMediaId,
                      },
                    }).catch(console.error);
                  }
                }}
                className="accent-blue-500"
              />
              <span className="text-sm text-gray-300">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Background media picker */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Fundo (vídeo)</label>
        <MediaPicker
          value={backgroundMediaId}
          kind="video"
          label="Selecionar vídeo de fundo…"
          onSelect={(media) => {
            const newId = media?.id ?? undefined;
            setBackgroundMediaId(newId);
            const durationMs = durationToMs(durationInput);
            if (durationMs && durationMs > 0) {
              updateSetItem({
                id: item.id,
                countdownConfig: {
                  durationMs,
                  message: message.trim() || undefined,
                  endBehavior,
                  backgroundMediaId: newId,
                },
              }).catch(console.error);
            }
          }}
        />
      </div>

      {saving && (
        <p className="text-xs text-gray-500">Salvando…</p>
      )}
    </div>
  );
};
