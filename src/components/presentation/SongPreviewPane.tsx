import React, { useMemo } from "react";
import type { BackgroundInfo, RepeatMode, TextCasing } from "../../types";
import type { ChipAppearance } from "./bodies";
import { SlideStage } from "./SlideStage";
import { SlideContent } from "./SlideContent";
import { RatioBox } from "./RatioBox";
import { PRESET_COLORS } from "./layout";
import { splitSectionBody } from "../../utils/slidePreview";
import { creditLine } from "./credit";

export interface SongPreviewPaneProps {
  title: string;
  credit?: string;
  sections: { body: string }[];
  casing: TextCasing;
  repeatCounts: number[];
  repeatMode: RepeatMode;
  appearance: ChipAppearance;
  background?: BackgroundInfo;
  showTitleSlide: boolean;
  authorInParens: boolean;
  blackoutAfterSong: boolean;
}

interface SlideEntry {
  lines: string[];
  sectionLabel?: string;
}

export const SongPreviewPane: React.FC<SongPreviewPaneProps> = ({
  title,
  credit,
  sections,
  casing,
  repeatCounts,
  repeatMode,
  appearance,
  background,
  showTitleSlide,
  authorInParens,
  blackoutAfterSong,
}) => {
  const slides = useMemo<SlideEntry[]>(() => {
    const result: SlideEntry[] = [];

    // 1. Title slide
    if (showTitleSlide && title.trim()) {
      const credLine = creditLine(credit ?? "", authorInParens);
      result.push({
        lines: [title.trim(), ...(credLine ? [credLine] : [])],
        sectionLabel: "__title__",
      });
    }

    // 2. Section slides
    sections.forEach((section, idx) => {
      const repeatCount = repeatCounts[idx] ?? 1;
      splitSectionBody(section.body, {
        casing,
        repeatCount,
        repeatMode,
      }).forEach((lines) => {
        result.push({ lines });
      });
    });

    // 3. Blackout slide
    if (blackoutAfterSong) {
      result.push({ lines: [], sectionLabel: "__blackout__" });
    }

    return result;
  }, [
    title,
    credit,
    sections,
    casing,
    repeatCounts,
    repeatMode,
    showTitleSlide,
    authorInParens,
    blackoutAfterSong,
  ]);

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm py-8">
        Nenhum slide para mostrar
      </div>
    );
  }

  const bgColor = background?.assetUrl
    ? "#000"
    : PRESET_COLORS[appearance.preset].bg;

  return (
    <div className="space-y-3">
      {slides.map((s, i) => (
        <div key={i} className="space-y-1">
          <RatioBox className="rounded border border-border" contentClassName="overflow-hidden rounded">
            <SlideStage backgroundColor={bgColor}>
              <SlideContent
                itemType="song"
                appearance={appearance}
                previewMode
                slideLines={s.lines}
                sectionLabel={s.sectionLabel}
                background={background}
              />
            </SlideStage>
          </RatioBox>
          <p className="text-[10px] text-center text-muted">
            {i + 1}/{slides.length}
          </p>
        </div>
      ))}
    </div>
  );
};
