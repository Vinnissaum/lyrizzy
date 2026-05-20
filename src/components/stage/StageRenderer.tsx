import React from "react";
import { useTranslation } from "react-i18next";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import { StagePreview } from "./StagePreview";
import { StageClock } from "./StageClock";
import { StageBlankIndicator } from "./StageBlankIndicator";
import { StageNotesPanel } from "./StageNotesPanel";

export const StageRenderer: React.FC = () => {
  const { t } = useTranslation();
  const { state } = usePresentationStore();
  const { state: _countdown } = useCountdownStore();

  if (!state) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-600 text-sm select-none">{t("stage.noSet")}</p>
      </div>
    );
  }

  const currentItem = state.set?.items[state.currentItemIndex];
  const currentSlide = state.currentSlide ?? null;
  const nextSlide = state.nextSlide ?? null;
  const background = state.background;

  return (
    <div
      className="relative h-screen bg-gray-950 overflow-hidden select-none"
      style={{ display: "grid", gridTemplateRows: "3fr 2fr", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "0.75rem" }}
    >
      <StageBlankIndicator mode={state.mode} />

      {/* Current preview — top-left */}
      <StagePreview
        slide={currentSlide}
        background={background}
        label={t("stage.current")}
      />

      {/* Next preview — top-right */}
      <StagePreview
        slide={nextSlide}
        label={t("stage.next")}
      />

      {/* Notes panel — bottom, spans both columns */}
      <StageNotesPanel />

      {/* Clock — absolute bottom-right */}
      <div className="absolute bottom-3 right-4 text-sm font-semibold text-gray-300">
        <StageClock currentItem={currentItem} />
      </div>
    </div>
  );
};
