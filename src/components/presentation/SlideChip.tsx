import React, { useLayoutEffect, useRef, useState } from "react";
import {
  BOLD_WEIGHT,
  FONT_CLASS,
  LINE_SPACING,
  PREVIEW_SIZE_PX,
  POSITION_CLASS,
  MARGIN_CLASS,
  PRESET_COLORS,
  stepSize,
  titleWeight,
} from "./layout";
import type {
  BackgroundInfo,
  BackgroundPreset,
  BoldLevel,
  FontFamily,
  FontSize,
  LineSpacing,
  Margin,
  ScreenPosition,
} from "../../types";

// Virtual stage the chip renders at before being transform-scaled to fit. A
// 16:9 stage keeps margins/positions proportional to the live presentation.
const STAGE_W = 1280;
const STAGE_H = 720;

export interface ChipAppearance {
  fontFamily: FontFamily;
  fontSize: FontSize;
  preset: BackgroundPreset;
  position: ScreenPosition;
  margin: Margin;
  lineSpacing: LineSpacing;
  boldLevel: BoldLevel;
}

interface Props {
  lines: string[];
  variant: "title" | "lyric";
  appearance: ChipAppearance;
  /** Optional per-song media background shown behind the text. */
  background?: BackgroundInfo;
  /** Author/credit line, title variant only. */
  authorLine?: string;
}

/**
 * A faithful, scaled-down slide thumbnail. Renders the same preset colors,
 * font family, screen position, margin, and (proportional) font size as the
 * live presentation slide, so editors can preview exactly how a section reads
 * on screen. Honors the title/author sizing rule (title one notch larger).
 */
export const SlideChip: React.FC<Props> = ({
  lines,
  variant,
  appearance,
  background,
  authorLine,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.125);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / STAGE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasMedia = !!background?.assetUrl;
  const presetColors = PRESET_COLORS[appearance.preset];
  const fg = hasMedia ? "#FFFFFF" : presetColors.fg;
  const fontClass = FONT_CLASS[appearance.fontFamily];
  const lyricSize = PREVIEW_SIZE_PX[appearance.fontSize];
  // Title matches the lyric size; the author stays one notch below.
  const titleSize = lyricSize;
  const authorSize = PREVIEW_SIZE_PX[stepSize(appearance.fontSize, -1)];
  const { lineHeight, gapEm } = LINE_SPACING[appearance.lineSpacing];
  const lyricWeight = BOLD_WEIGHT[appearance.boldLevel];

  const mediaStyle: React.CSSProperties =
    hasMedia && background!.mediaKind === "image"
      ? {
          backgroundImage: `url(${background!.assetUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {};

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded border border-border bg-black"
      style={{ aspectRatio: "16 / 9" }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          backgroundColor: hasMedia ? "#000000" : presetColors.bg,
          ...mediaStyle,
        }}
      >
        {hasMedia && (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0,0,0,${background!.scrimOpacity / 100})` }}
          />
        )}
        <div
          className={`relative z-10 h-full flex flex-col ${MARGIN_CLASS[appearance.margin]} ${POSITION_CLASS[appearance.position]}`}
        >
          {variant === "title" ? (
            <div className="w-full space-y-3">
              <p
                className={`leading-tight ${fontClass}`}
                style={{ color: fg, fontSize: titleSize, fontWeight: titleWeight(appearance.boldLevel) }}
              >
                {lines[0] ?? ""}
              </p>
              {authorLine && (
                <p
                  className={`font-medium leading-relaxed opacity-80 ${fontClass}`}
                  style={{ color: fg, fontSize: authorSize }}
                >
                  {authorLine}
                </p>
              )}
            </div>
          ) : (
            <div className="w-full flex flex-col" style={{ gap: `${gapEm}em` }}>
              {lines.map((line, i) => (
                <p
                  key={i}
                  className={fontClass}
                  style={{ color: fg, fontSize: lyricSize, fontWeight: lyricWeight, lineHeight }}
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
