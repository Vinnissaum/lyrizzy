import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { goToItem } from "../../api/commands";
import type { SetItem, Slide } from "../../types";

function itemIcon(item: SetItem): string {
  switch (item.itemType) {
    case "song": return "♪";
    case "media": return item.mediaKind === "video" ? "▶" : "🖼";
    case "countdown": return "⏱";
    case "web_view": return "🌐";
    case "slide_show": return "📄";
    default: return "▪";
  }
}

interface CardProps {
  slide: Slide | null;
  label?: string;
  isCurrent: boolean;
  onClick: () => void;
  refProp?: React.Ref<HTMLDivElement>;
}

const SlideCard: React.FC<CardProps> = ({ slide, label, isCurrent, onClick, refProp }) => (
  <div
    ref={refProp}
    role="button"
    tabIndex={0}
    aria-current={isCurrent ? "true" : undefined}
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
    className={`px-3 py-2 rounded-lg cursor-pointer text-xs select-none transition-colors ${
      isCurrent
        ? "bg-primary/10 ring-2 ring-primary text-fg"
        : "bg-surface hover:bg-surface-2 text-fg"
    }`}
  >
    {label && <p className="font-medium text-muted mb-0.5 text-[10px]">{label}</p>}
    {slide ? (
      <p className="line-clamp-4 leading-snug whitespace-pre-wrap">
        {slide.lines.join("\n")}
      </p>
    ) : null}
  </div>
);

export const PresentationNavigator: React.FC = () => {
  const { t } = useTranslation();
  const { state } = usePresentationStore();
  const { songs } = useLibraryStore();
  const { media } = useMediaStore();

  const currentRef = useRef<HTMLDivElement | null>(null);

  const currentItemIndex = state?.currentItemIndex ?? 0;
  const currentSlideIndex = state?.currentSlideIndex ?? 0;
  const allSlidesPerItem = state?.allSlidesPerItem;
  const set = state?.set;

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentItemIndex, currentSlideIndex]);

  if (!set || !allSlidesPerItem) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        {t("presentation.noSetLoaded")}
      </div>
    );
  }

  const songById = (id?: string) => songs.find((s) => s.id === id);
  const mediaById = (id?: string) => media.find((m) => m.id === id);

  function groupHeader(item: SetItem, itemIdx: number): string {
    const icon = itemIcon(item);
    switch (item.itemType) {
      case "song": {
        const song = songById(item.songId);
        return `${icon} ${song?.title ?? t("presentation.noSetLoaded")}`;
      }
      case "media": {
        const m = mediaById(item.mediaId);
        return `${icon} ${m?.displayName ?? "Mídia"}`;
      }
      case "countdown": {
        const cfg = item.countdownConfig;
        if (cfg?.target?.kind === "fixedTime") {
          const h = String(cfg.target.hour).padStart(2, "0");
          const min = String(cfg.target.minute).padStart(2, "0");
          return `${icon} Cronômetro — ${h}:${min}`;
        }
        const durMs = cfg?.target?.kind === "duration" ? cfg.target.durationMs : 0;
        const mins = Math.floor(durMs / 60000);
        const secs = Math.floor((durMs % 60000) / 1000);
        return `${icon} Cronômetro — ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      }
      case "web_view": {
        const url = item.webviewConfig?.url ?? "";
        const short = url.replace(/^https?:\/\//, "").slice(0, 30);
        return `${icon} ${short || "WebView"}`;
      }
      case "slide_show": {
        const m = mediaById(item.mediaId);
        return `${icon} ${m?.displayName ?? "Apresentação"}`;
      }
      default:
        return `${icon} Branco ${itemIdx + 1}`;
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-surface p-2 space-y-3">
      {set.items.map((item, itemIdx) => {
        const slides = allSlidesPerItem[itemIdx] ?? [];
        const isSongOrSlideshow = item.itemType === "song" || item.itemType === "slide_show";

        return (
          <div key={item.id}>
            <p className="sticky top-0 bg-surface px-1 py-1 text-[10px] font-semibold text-muted uppercase tracking-wider truncate z-10">
              {groupHeader(item, itemIdx)}
            </p>
            <div className="space-y-1 mt-1">
              {isSongOrSlideshow ? (
                slides.map((slide, slideIdx) => {
                  const isCurrent = itemIdx === currentItemIndex && slideIdx === currentSlideIndex;
                  const isSlideshow = item.itemType === "slide_show";
                  return (
                    <SlideCard
                      key={slideIdx}
                      slide={slide}
                      label={isSlideshow ? `Slide ${slideIdx + 1}/${slides.length}` : undefined}
                      isCurrent={isCurrent}
                      onClick={() => goToItem(itemIdx, slideIdx).catch(console.error)}
                      refProp={isCurrent ? currentRef : undefined}
                    />
                  );
                })
              ) : (
                <SlideCard
                  slide={null}
                  label={groupHeader(item, itemIdx)}
                  isCurrent={itemIdx === currentItemIndex}
                  onClick={() => goToItem(itemIdx, 0).catch(console.error)}
                  refProp={itemIdx === currentItemIndex ? currentRef : undefined}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
