import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { useSettingsStore } from "../../stores/settings";
import { goToItem } from "../../api/commands";
import { ItemTypeIcon, itemLabel } from "./itemMeta";
import { SlideStage } from "./SlideStage";
import { SlideContent } from "./SlideContent";
import { PRESET_COLORS } from "./layout";
import type { ChipAppearance } from "./SlideContent";
import type { Slide, SetItem } from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BLACKOUT_SENTINEL = "__blackout__";

function getSectionLabel(slide: Slide, slideIdx: number, itemType: string): string {
  if (slide.sectionLabel && slide.sectionLabel !== BLACKOUT_SENTINEL) {
    return slide.sectionLabel;
  }
  if (itemType === "slide_show") {
    return `Slide ${slideIdx + 1}`;
  }
  return String(slideIdx + 1);
}

function isSongOrSlideshow(item: SetItem): boolean {
  return item.itemType === "song" || item.itemType === "slide_show";
}

// ─── SlideCard ────────────────────────────────────────────────────────────────

interface SlideCardProps {
  slide: Slide;
  slideIdx: number;
  isActive: boolean;
  itemType: string;
  activeItem: SetItem;
  appearance: ChipAppearance;
  onClick: () => void;
  activeRef?: React.RefCallback<HTMLButtonElement>;
}

const SlideCard: React.FC<SlideCardProps> = ({
  slide,
  slideIdx,
  isActive,
  itemType,
  activeItem,
  appearance,
  onClick,
  activeRef,
}) => {
  const { t } = useTranslation();

  const isBlackout = slide.sectionLabel === BLACKOUT_SENTINEL;
  const badgeLabel = isBlackout
    ? t("presentation.blackoutSlide")
    : getSectionLabel(slide, slideIdx, itemType);

  const bgColor = PRESET_COLORS[appearance.preset].bg;

  const slideContentItemType =
    itemType === "slide_show" ? ("slide_show" as const) : ("song" as const);

  const slideshowMediaId =
    itemType === "slide_show" && "mediaId" in activeItem
      ? (activeItem.mediaId as string | undefined)
      : undefined;

  return (
    <button
      ref={isActive ? activeRef : undefined}
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className={`flex flex-col w-full text-left transition-colors rounded-md overflow-hidden border ${
        isActive
          ? "ring-2 ring-primary bg-primary/10 border-primary"
          : "border-border hover:bg-surface-2"
      }`}
    >
      {/* Faithful 16:9 thumbnail */}
      <div className="aspect-video w-full overflow-hidden rounded relative">
        <SlideStage backgroundColor={bgColor}>
          <SlideContent
            itemType={slideContentItemType}
            appearance={appearance}
            previewMode
            slideLines={slide.lines ?? []}
            sectionLabel={slide.sectionLabel}
            slideshowMediaId={slideshowMediaId}
            slideshowIndex={itemType === "slide_show" ? slideIdx : undefined}
          />
        </SlideStage>
        {/* Section-label badge overlay */}
        <span className="absolute top-1 left-1 text-[10px] font-bold uppercase bg-black/70 text-white px-1 rounded z-10">
          {badgeLabel}
        </span>
      </div>
    </button>
  );
};

// ─── StrophesGrid ─────────────────────────────────────────────────────────────

export const StrophesGrid: React.FC = () => {
  const { t } = useTranslation();
  const { state } = usePresentationStore();
  const { songs } = useLibraryStore();
  const { media } = useMediaStore();

  // Build appearance from settings store once; passed down to each SlideCard.
  const presentationFontFamily = useSettingsStore((s) => s.presentationFontFamily);
  const presentationFontSize = useSettingsStore((s) => s.presentationFontSize);
  const presentationPreset = useSettingsStore((s) => s.presentationPreset);
  const presentationPosition = useSettingsStore((s) => s.presentationPosition);
  const presentationMargin = useSettingsStore((s) => s.presentationMargin);

  const appearance: ChipAppearance = {
    fontFamily: presentationFontFamily,
    fontSize: presentationFontSize,
    preset: presentationPreset,
    position: presentationPosition,
    margin: presentationMargin,
  };

  const activeCardRef = useRef<HTMLButtonElement | null>(null);

  const currentItemIndex = state?.currentItemIndex ?? 0;
  const currentSlideIndex = state?.currentSlideIndex ?? 0;
  const allSlidesPerItem = state?.allSlidesPerItem;
  const items = state?.set?.items ?? [];

  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentSlideIndex]);

  const activeItem = items[currentItemIndex];
  const slides = allSlidesPerItem?.[currentItemIndex] ?? [];

  if (!activeItem) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        {t("presentation.noSlides")}
      </div>
    );
  }

  if (!isSongOrSlideshow(activeItem)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-fg">
        <ItemTypeIcon item={activeItem} size={32} />
        <p className="text-sm font-medium mt-2">{itemLabel(activeItem, songs, media)}</p>
        <p className="text-xs text-muted mt-1">{t("presentation.singleItem.hint")}</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        {t("presentation.noSlides")}
      </div>
    );
  }

  const setRef: React.RefCallback<HTMLButtonElement> = (el) => {
    activeCardRef.current = el;
  };

  return (
    <div
      data-testid="strophes-grid"
      className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 p-2 overflow-y-auto h-full"
    >
      {slides.map((slide, slideIdx) => (
        <SlideCard
          key={slideIdx}
          slide={slide}
          slideIdx={slideIdx}
          isActive={slideIdx === currentSlideIndex}
          itemType={activeItem.itemType}
          activeItem={activeItem}
          appearance={appearance}
          activeRef={slideIdx === currentSlideIndex ? setRef : undefined}
          onClick={() => {
            const live = usePresentationStore.getState().state;
            const idx = live?.currentItemIndex ?? 0;
            goToItem(idx, slideIdx).catch(console.error);
          }}
        />
      ))}
    </div>
  );
};
