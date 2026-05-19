import React, { useEffect } from "react";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import type { PresentationMode, ServiceSet } from "../../types";

const MODE_LABELS: Record<PresentationMode, string> = {
  idle: "Inativo",
  live: "Ao Vivo",
  blank: "Tela Preta",
  frozen: "Congelado",
};

const MODE_COLORS: Record<PresentationMode, string> = {
  idle: "bg-gray-600",
  live: "bg-emerald-600",
  blank: "bg-gray-800 border border-gray-600",
  frozen: "bg-blue-700",
};

interface ItemRowProps {
  label: string;
  subtitle?: string;
  isCurrent: boolean;
  slideCount: number;
  currentSlide: number;
  onClick: () => void;
}

const ItemRow: React.FC<ItemRowProps> = ({
  label,
  subtitle,
  isCurrent,
  slideCount,
  currentSlide,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
      isCurrent
        ? "bg-emerald-700 border border-emerald-500"
        : "bg-gray-800 hover:bg-gray-700"
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{label}</p>
        {subtitle && (
          <p className="text-xs text-gray-400 truncate">{subtitle}</p>
        )}
      </div>
      {isCurrent && (
        <span className="text-xs text-emerald-300 shrink-0 tabular-nums">
          {currentSlide + 1}/{slideCount}
        </span>
      )}
    </div>
  </button>
);

interface Props {
  serviceSet: ServiceSet;
}

export const SlideController: React.FC<Props> = ({ serviceSet }) => {
  const { state, next, prev, jumpToItem, setMode } = usePresentationStore();
  const { setView, songs, refresh } = useLibraryStore();
  const songMap = new Map(songs.map((s) => [s.id, s]));

  useEffect(() => {
    if (songs.length === 0) refresh();
  }, []);

  if (!state) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Sem apresentação ativa.
      </div>
    );
  }

  const currentMode = state.mode;
  const modes: PresentationMode[] = ["live", "blank", "frozen"];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setView("set-builder")}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors"
          >
            ←
          </button>
          <h2 className="text-base font-semibold truncate flex-1">{serviceSet.name}</h2>
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${MODE_COLORS[currentMode]}`}
          >
            {MODE_LABELS[currentMode]}
          </span>
        </div>

        {/* Mode buttons */}
        <div className="flex gap-1.5 mb-2">
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                currentMode === m
                  ? `${MODE_COLORS[m]} text-white`
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {serviceSet.items.map((item, idx) => {
          const isCurrent = state.currentItemIndex === idx;
          const slideCount = state.itemSlideCounts[idx] ?? 1;
          const song = item.songId ? songMap.get(item.songId) : undefined;
          const label =
            item.itemType === "blank"
              ? "Tela em branco"
              : song?.title ?? `Item ${idx + 1}`;
          const subtitle = song?.artist;

          return (
            <ItemRow
              key={item.id}
              label={label}
              subtitle={subtitle}
              isCurrent={isCurrent}
              slideCount={slideCount}
              currentSlide={isCurrent ? state.currentSlideIndex : 0}
              onClick={() => jumpToItem(idx)}
            />
          );
        })}
      </div>

      {/* Navigation */}
      <div className="px-4 py-3 border-t border-gray-700">
        {state.currentSlide && (
          <div className="mb-3 px-3 py-2 bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">
              {state.currentSlide.sectionLabel || "Slide atual"}
            </p>
            <div className="space-y-0.5">
              {state.currentSlide.lines.length > 0 ? (
                state.currentSlide.lines.map((line, i) => (
                  <p key={i} className="text-sm text-white/80 leading-snug">
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-sm text-gray-600 italic">Tela em branco</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={prev}
            className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            ← Anterior
          </button>
          <button
            onClick={next}
            className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            Próximo →
          </button>
        </div>
      </div>
    </div>
  );
};
