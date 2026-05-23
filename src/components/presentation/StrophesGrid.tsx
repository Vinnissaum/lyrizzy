import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { goToItem } from "../../api/commands";
import { itemIcon, itemLabel } from "./itemMeta";
import type { Slide, SetItem } from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSectionLabel(slide: Slide, slideIdx: number, itemType: string): string {
  if (slide.sectionLabel) {
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
  onClick: () => void;
  activeRef?: React.RefCallback<HTMLButtonElement>;
}

const SlideCard: React.FC<SlideCardProps> = ({
  slide,
  slideIdx,
  isActive,
  itemType,
  onClick,
  activeRef,
}) => {
  const sectionLabel = getSectionLabel(slide, slideIdx, itemType);

  return (
    <button
      ref={isActive ? activeRef : undefined}
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className={`aspect-video border rounded-md bg-surface p-1.5 flex flex-col gap-1 text-left w-full transition-colors ${
        isActive
          ? "ring-2 ring-primary bg-primary/10 border-primary"
          : "border-border hover:bg-surface-2"
      }`}
    >
      <span className="text-[10px] font-bold text-primary uppercase truncate">
        {sectionLabel}
      </span>
      <p className="line-clamp-4 leading-snug whitespace-pre-wrap text-xs text-fg">
        {slide.lines?.join("\n") ?? ""}
      </p>
    </button>
  );
};

// ─── StrophesGrid ─────────────────────────────────────────────────────────────

export const StrophesGrid: React.FC = () => {
  const { t } = useTranslation();
  const { state } = usePresentationStore();
  const { songs } = useLibraryStore();
  const { media } = useMediaStore();

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
        <span className="text-2xl">{itemIcon(activeItem)}</span>
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
      className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 p-2 overflow-y-auto h-full"
    >
      {slides.map((slide, slideIdx) => (
        <SlideCard
          key={slideIdx}
          slide={slide}
          slideIdx={slideIdx}
          isActive={slideIdx === currentSlideIndex}
          itemType={activeItem.itemType}
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
