import React from "react";
import { Film, Image as ImageIcon, Timer, Globe } from "lucide-react";
import type { BackgroundInfo, CountdownConfig } from "../../types";
import type { ChipAppearance } from "./bodies";
import { SongSlideBody, WarningBody } from "./bodies";
import { CountdownRenderer } from "./CountdownRenderer";
import { SlideshowRenderer } from "./SlideshowRenderer";

// Re-export so downstream tasks can import ChipAppearance from this module.
export type { ChipAppearance } from "./bodies";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlideContentItemType =
  | "song"
  | "blank"
  | "media"
  | "countdown"
  | "web_view"
  | "slide_show";

export interface SlideContentProps {
  itemType: SlideContentItemType;
  appearance: ChipAppearance;
  previewMode?: boolean; // default false
  frozen?: boolean;
  // song / blank (also carries the __title__ and __blackout__ sentinels via sectionLabel)
  slideLines?: string[];
  sectionLabel?: string;
  background?: BackgroundInfo;
  // media item
  mediaAssetUrl?: string;
  mediaKind?: "image" | "video";
  mediaLabel?: string; // shown on the video placeholder card
  // countdown item
  countdownConfig?: CountdownConfig;
  countdownBackground?: BackgroundInfo;
  // slideshow item
  slideshowMediaId?: string;
  slideshowIndex?: number;
  // web_view item
  webviewUrl?: string; // shown on the placeholder card
  // optional warning overlay (when set, render WarningBody regardless of itemType)
  warningText?: string;
}

// ---------------------------------------------------------------------------
// Private helper: PlaceholderCard
// Mirrors the private PlaceholderCard from LivePreview.tsx.
// ---------------------------------------------------------------------------

const PlaceholderCard: React.FC<{ icon: React.ReactNode; label: string }> = ({
  icon,
  label,
}) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white">
    <span className="text-xl">{icon}</span>
    <span className="text-xs">{label}</span>
  </div>
);

// ---------------------------------------------------------------------------
// SlideContent
// ---------------------------------------------------------------------------

/**
 * Unified, preview-safe item renderer for the 1280×720 virtual stage.
 * Must be placed INSIDE a <SlideStage> — it does NOT wrap itself in one.
 *
 * Branch priority:
 *   1. warningText → WarningBody
 *   2. song | blank → SongSlideBody
 *   3. countdown → CountdownRenderer (or Timer placeholder)
 *   4. media → <img> for images, Film placeholder for videos
 *   5. slide_show → SlideshowRenderer
 *   6. web_view → Globe placeholder
 *
 * Video and web_view are PLACEHOLDER-ONLY (D-34: never mount playing media in
 * previews; the projection keeps its own full-screen renderers outside this
 * component).
 */
export const SlideContent: React.FC<SlideContentProps> = ({
  itemType,
  appearance,
  previewMode = false,
  frozen,
  slideLines,
  sectionLabel,
  background,
  mediaAssetUrl,
  mediaKind,
  mediaLabel,
  countdownConfig,
  countdownBackground,
  slideshowMediaId,
  slideshowIndex,
  webviewUrl,
  warningText,
}) => {
  // 1. Warning overlay — highest priority, overrides itemType.
  if (warningText !== undefined) {
    return <WarningBody text={warningText} />;
  }

  // 2. Song / blank.
  if (itemType === "song" || itemType === "blank") {
    return (
      <SongSlideBody
        slideLines={slideLines ?? []}
        sectionLabel={sectionLabel}
        appearance={appearance}
        background={background}
        frozen={frozen}
        previewMode={previewMode}
      />
    );
  }

  // 3. Countdown.
  if (itemType === "countdown") {
    if (countdownConfig) {
      return (
        <CountdownRenderer
          config={countdownConfig}
          background={countdownBackground}
          frozen={frozen}
        />
      );
    }
    return <PlaceholderCard icon={<Timer size={28} />} label="Contagem Regressiva" />;
  }

  // 4. Media.
  if (itemType === "media") {
    if (mediaKind === "image" && mediaAssetUrl) {
      return (
        <img
          src={mediaAssetUrl}
          className="w-full h-full object-contain"
          alt=""
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      );
    }
    if (mediaKind === "video") {
      return (
        <PlaceholderCard
          icon={<Film size={28} />}
          label={mediaLabel ?? ""}
        />
      );
    }
    // No kind / no url → generic image placeholder.
    return <PlaceholderCard icon={<ImageIcon size={28} />} label="" />;
  }

  // 5. Slideshow.
  if (itemType === "slide_show") {
    return (
      <SlideshowRenderer
        mediaId={slideshowMediaId ?? ""}
        slideIndex={slideshowIndex ?? 0}
      />
    );
  }

  // 6. Web view — placeholder only (no iframe).
  // itemType === "web_view"
  return (
    <PlaceholderCard
      icon={<Globe size={28} />}
      label={webviewUrl ?? ""}
    />
  );
};
