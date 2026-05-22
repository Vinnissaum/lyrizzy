import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import type { PresentationMode, ServiceSet } from "../../types";

const MODE_COLORS: Record<PresentationMode, string> = {
  idle: "bg-surface-2 text-muted",
  live: "bg-green-600 text-white",
  blank: "bg-surface-2 border border-border text-muted",
  frozen: "bg-blue-700 text-white",
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
        ? "bg-primary/20 border border-primary"
        : "bg-surface-2 hover:bg-border"
    }`}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg truncate">{label}</p>
        {subtitle && (
          <p className="text-xs text-muted truncate">{subtitle}</p>
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
  const { t } = useTranslation();
  const { state, next, prev, jumpToItem, setMode } = usePresentationStore();
  const { setView, songs, refresh } = useLibraryStore();
  const songMap = new Map(songs.map((s) => [s.id, s]));

  useEffect(() => {
    if (songs.length === 0) refresh();
  }, []);

  if (!state) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        {t("presentation.noPresentation")}
      </div>
    );
  }

  const currentMode = state.mode;
  const modes: PresentationMode[] = ["live", "blank", "frozen"];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setView("set-builder")}
            className="text-muted hover:text-inherit p-1 rounded transition-colors"
          >
            ←
          </button>
          <h2 className="text-base font-semibold truncate flex-1">{serviceSet.name}</h2>
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${MODE_COLORS[currentMode]}`}
          >
            {t(`presentation.mode.${currentMode}`)}
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
                  ? MODE_COLORS[m]
                  : "bg-surface-2 hover:bg-border text-muted"
              }`}
            >
              {t(`presentation.mode.${m}`)}
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
              ? t("presentation.blankSlide")
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
      <div className="px-4 py-3 border-t border-border">
        {state.currentSlide && (
          <div className="mb-3 px-3 py-2 bg-surface-2 rounded-lg">
            <p className="text-xs text-muted mb-1">
              {state.currentSlide.sectionLabel || t("presentation.currentSlide")}
            </p>
            <div className="space-y-0.5">
              {state.currentSlide.lines.length > 0 ? (
                state.currentSlide.lines.map((line, i) => (
                  <p key={i} className="text-sm text-fg leading-snug">
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted italic">{t("presentation.blankSlide")}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={prev}
            className="flex-1 py-2.5 bg-surface-2 hover:bg-border rounded-lg text-sm font-medium transition-colors"
          >
            {t("presentation.prev")}
          </button>
          <button
            onClick={next}
            className="flex-1 py-2.5 bg-surface-2 hover:bg-border rounded-lg text-sm font-medium transition-colors"
          >
            {t("presentation.next")}
          </button>
        </div>
      </div>
    </div>
  );
};
