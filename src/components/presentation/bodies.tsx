import React from "react";
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
import { SongBackground } from "./SongBackground";
import { useSettingsStore } from "../../stores/settings";
import type { BackgroundInfo } from "../../types";
import type { ChipAppearance } from "./SlideChip";

// Re-export so consumers can import ChipAppearance from either location.
export type { ChipAppearance } from "./SlideChip";

// Sentinel labels that the Rust slide builder emits.
const BLACKOUT_LABEL = "__blackout__";
const TITLE_LABEL = "__title__";

// ── SongSlideBody ─────────────────────────────────────────────────────────────

export interface SongSlideBodyProps {
  slideLines: string[];
  sectionLabel?: string;
  appearance: ChipAppearance;
  background?: BackgroundInfo;
  frozen?: boolean;
  /** true in operator/editor previews (static bg), false on the projector (live media). */
  previewMode?: boolean;
}

/**
 * Renders slide content inside a fixed 1280×720 virtual stage.
 * Uses PREVIEW_SIZE_PX (fixed px) — NOT the vw-clamp SIZE_STYLE map.
 * The parent SlideStage applies a transform:scale() so all sizes stay
 * proportional to the live presentation slide.
 */
export const SongSlideBody: React.FC<SongSlideBodyProps> = ({
  slideLines,
  sectionLabel,
  appearance,
  background,
  frozen,
  previewMode = false,
}) => {
  // 1. Blackout: solid black, no text.
  if (sectionLabel === BLACKOUT_LABEL) {
    return (
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "#000000" }}
      />
    );
  }

  const hasMedia = !!background?.assetUrl;
  const presetColors = PRESET_COLORS[appearance.preset];
  const fg = hasMedia ? "#FFFFFF" : presetColors.fg;
  const ff = appearance.fontFamily;

  // 2. Background layer.
  let bgLayer: React.ReactNode;
  if (hasMedia) {
    if (!previewMode) {
      // Live projector: real SongBackground (plays video, handles image).
      bgLayer = <SongBackground background={background!} frozen={frozen} />;
    } else {
      // Operator/editor preview: static rendering, no video playback.
      const isImage = background!.mediaKind === "image";
      bgLayer = (
        <>
          <div
            className="absolute inset-0"
            style={
              isImage
                ? {
                    backgroundImage: `url(${background!.assetUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : { backgroundColor: "#000000" }
            }
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: `rgba(0,0,0,${background!.scrimOpacity / 100})`,
            }}
          />
        </>
      );
    }
  } else {
    bgLayer = (
      <div
        className="absolute inset-0"
        style={{ backgroundColor: presetColors.bg }}
      />
    );
  }

  // 3. Foreground text.
  const isTitle = sectionLabel === TITLE_LABEL;

  // Title variant: title matches the configured lyric size (slightly bolder),
  // author one notch BELOW. Lyric variant: configured size + line spacing/bold.
  const titlePx = PREVIEW_SIZE_PX[appearance.fontSize];
  const authorPx = PREVIEW_SIZE_PX[stepSize(appearance.fontSize, -1)];
  const lyricPx = PREVIEW_SIZE_PX[appearance.fontSize];
  const { lineHeight, gapEm } = LINE_SPACING[appearance.lineSpacing];
  const lyricWeight = BOLD_WEIGHT[appearance.boldLevel];

  let textContent: React.ReactNode = null;

  if (isTitle) {
    textContent = (
      <div className="w-full space-y-3">
        <p
          className={`leading-tight drop-shadow-lg ${FONT_CLASS[ff]}`}
          style={{ color: fg, fontSize: titlePx, fontWeight: titleWeight(appearance.boldLevel) }}
        >
          {slideLines[0] ?? ""}
        </p>
        {slideLines[1] && (
          <p
            className={`font-medium leading-relaxed opacity-80 drop-shadow-lg ${FONT_CLASS[ff]}`}
            style={{ color: fg, fontSize: authorPx }}
          >
            {slideLines[1]}
          </p>
        )}
      </div>
    );
  } else if (slideLines.length > 0) {
    textContent = (
      <div className="w-full flex flex-col" style={{ gap: `${gapEm}em` }}>
        {slideLines.map((line, i) => (
          <p
            key={i}
            className={`drop-shadow-lg ${FONT_CLASS[ff]}`}
            style={{ color: fg, fontSize: lyricPx, fontWeight: lyricWeight, lineHeight }}
          >
            {line}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {bgLayer}
      <div
        className={`relative z-10 h-full w-full flex flex-col ${MARGIN_CLASS[appearance.margin]} ${POSITION_CLASS[appearance.position]}`}
      >
        {textContent}
      </div>
    </div>
  );
};

// ── WarningBody ───────────────────────────────────────────────────────────────

export interface WarningBodyProps {
  text: string;
}

/**
 * Announcement/warning body rendered inside a 1280×720 virtual stage.
 * Fills the entire stage with the preset background (fixes gray-edge bug when
 * the stage has a different bg than the rendered content).
 */
export const WarningBody: React.FC<WarningBodyProps> = ({ text }) => {
  const announcementFontFamily = useSettingsStore((s) => s.announcementFontFamily);
  const announcementFontSize = useSettingsStore((s) => s.announcementFontSize);
  const announcementPreset = useSettingsStore((s) => s.announcementPreset);
  const announcementPosition = useSettingsStore((s) => s.announcementPosition);
  const announcementMargin = useSettingsStore((s) => s.announcementMargin);
  const announcementLineSpacing = useSettingsStore((s) => s.announcementLineSpacing);
  const announcementBoldLevel = useSettingsStore((s) => s.announcementBoldLevel);

  const { bg, fg } = PRESET_COLORS[announcementPreset];
  const { lineHeight } = LINE_SPACING[announcementLineSpacing];

  return (
    <div
      className="absolute inset-0"
      style={{ backgroundColor: bg }}
    >
      <div
        className={`h-full w-full flex flex-col ${MARGIN_CLASS[announcementMargin]} ${POSITION_CLASS[announcementPosition]}`}
      >
        <p
          className={`whitespace-pre-wrap ${FONT_CLASS[announcementFontFamily]}`}
          style={{
            color: fg,
            fontSize: PREVIEW_SIZE_PX[announcementFontSize],
            fontWeight: BOLD_WEIGHT[announcementBoldLevel],
            lineHeight,
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
};
