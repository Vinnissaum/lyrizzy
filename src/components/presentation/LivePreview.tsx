import React from "react";
import { useTranslation } from "react-i18next";
import { Film, Image as ImageIcon, Timer, Globe, Square, Tv } from "lucide-react";
import { usePresentationStore } from "../../stores/presentation";
import { useMediaStore } from "../../stores/media";
import { mediaUrl } from "../../api/assets";
import { AnnouncementRenderer } from "./AnnouncementRenderer";
import { CountdownRenderer } from "./CountdownRenderer";
import { SlideshowRenderer } from "./SlideshowRenderer";
import type { BackgroundInfo, BackgroundPreset, PresentationState, SetItem } from "../../types";

// ---------------------------------------------------------------------------
// Private helpers
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

const FrameTag: React.FC<{ label: string }> = ({ label }) => (
  <span className="absolute top-1 right-1 text-[9px] text-white bg-black/70 px-1 rounded z-10">
    {label}
  </span>
);

// ---------------------------------------------------------------------------
// Song slide preview (text-only, scale-friendly)
// ---------------------------------------------------------------------------

const PRESET_BG_PREVIEW: Record<BackgroundPreset, { bg: string; fg: string }> = {
  "preto-branco": { bg: "#000000", fg: "#FFFFFF" },
  "branco-preto": { bg: "#FFFFFF", fg: "#000000" },
};

function SongSlidePreview({
  lines,
  background,
}: {
  lines: string[];
  background?: BackgroundInfo;
}) {
  if (background?.preset) {
    const { bg, fg } = PRESET_BG_PREVIEW[background.preset];
    return (
      <div className="w-full h-full relative flex items-center justify-center" style={{ backgroundColor: bg }}>
        <div className="relative z-10 w-full px-2">
          <p className="text-center text-xs leading-snug whitespace-pre-wrap line-clamp-6" style={{ color: fg }}>
            {lines.join("\n")}
          </p>
        </div>
      </div>
    );
  }

  const bgStyle: React.CSSProperties = background?.assetUrl
    ? background.mediaKind === "image"
      ? {
          backgroundImage: `url(${background.assetUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : { backgroundColor: "#000" }
    : { backgroundColor: "#000" };

  const scrimStyle: React.CSSProperties = background
    ? { backgroundColor: `rgba(0,0,0,${background.scrimOpacity / 100})` }
    : {};

  return (
    <div className="w-full h-full relative flex items-center justify-center" style={bgStyle}>
      {background && (
        <div className="absolute inset-0" style={scrimStyle} />
      )}
      <div className="relative z-10 w-full px-2">
        <p className="text-center text-xs leading-snug whitespace-pre-wrap line-clamp-6 text-white">
          {lines.join("\n")}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active item content (no overlay)
// ---------------------------------------------------------------------------

function ActiveItemContent({
  state,
}: {
  state: PresentationState;
}) {
  const { t } = useTranslation();
  const { media } = useMediaStore();

  const items = state.set?.items ?? [];
  const currentItem: SetItem | undefined = items[state.currentItemIndex];
  const itemType = currentItem?.itemType ?? "blank";

  if (itemType === "song" || itemType === "blank") {
    const slide = state.currentSlide;
    return (
      <SongSlidePreview
        lines={slide?.lines ?? []}
        background={state.background}
      />
    );
  }

  if (itemType === "media") {
    const mediaRecord = currentItem?.mediaId
      ? media.find((m) => m.id === currentItem.mediaId)
      : undefined;

    if (mediaRecord?.kind === "video") {
      return <PlaceholderCard icon={<Film size={28} />} label={mediaRecord.displayName} />;
    }
    if (mediaRecord?.kind === "image") {
      const assetUrl = mediaUrl(mediaRecord.fileName);
      return (
        <img
          src={assetUrl}
          alt=""
          className="w-full h-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      );
    }
    return <PlaceholderCard icon={<ImageIcon size={28} />} label={t("media.picker.noMedia")} />;
  }

  if (itemType === "countdown") {
    const cdConfig = currentItem?.countdownConfig;
    let cdBackground: BackgroundInfo | undefined = undefined;
    if (cdConfig?.backgroundMediaId) {
      const bgMedia = media.find((m) => m.id === cdConfig.backgroundMediaId);
      if (bgMedia) {
        cdBackground = {
          mediaKind: bgMedia.kind,
          assetUrl: mediaUrl(bgMedia.fileName),
          scrimOpacity: 35,
          restartOnSectionBoundary: false,
        };
      }
    }
    return cdConfig ? (
      <CountdownRenderer config={cdConfig} background={cdBackground} />
    ) : (
      <PlaceholderCard icon={<Timer size={28} />} label={t("builder.add.countdown")} />
    );
  }

  if (itemType === "web_view") {
    const url = currentItem?.webviewConfig?.url ?? "";
    return <PlaceholderCard icon={<Globe size={28} />} label={url || t("builder.noUrl")} />;
  }

  if (itemType === "slide_show") {
    const mediaId = currentItem?.mediaId ?? "";
    const slide = state.currentSlide;
    const slideIndex = slide?.sectionId ? parseInt(slide.sectionId, 10) : 0;
    return (
      <SlideshowRenderer
        mediaId={mediaId}
        slideIndex={isNaN(slideIndex) ? 0 : slideIndex}
      />
    );
  }

  return <PlaceholderCard icon={<Square size={28} />} label={t("builder.blank")} />;
}

// ---------------------------------------------------------------------------
// Overlay content
// ---------------------------------------------------------------------------

function OverlayContent({ state }: { state: PresentationState }) {
  const { t } = useTranslation();
  const { media } = useMediaStore();
  const overlay = state.overlay;

  if (!overlay) return null;

  if (overlay.type === "announcement") {
    return <AnnouncementRenderer text={overlay.text} />;
  }

  if (overlay.type === "media") {
    const mediaRecord = media.find((m) => m.id === overlay.mediaId);
    if (mediaRecord?.kind === "video") {
      return <PlaceholderCard icon={<Film size={28} />} label={mediaRecord.displayName} />;
    }
    if (mediaRecord?.kind === "image") {
      const assetUrl = mediaUrl(mediaRecord.fileName);
      return (
        <img
          src={assetUrl}
          alt=""
          className="w-full h-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      );
    }
    return <PlaceholderCard icon={<ImageIcon size={28} />} label={t("media.picker.noMedia")} />;
  }

  if (overlay.type === "webView") {
    return <PlaceholderCard icon={<Globe size={28} />} label={overlay.url} />;
  }

  return null;
}

// ---------------------------------------------------------------------------
// LivePreview (exported)
// ---------------------------------------------------------------------------

export const LivePreview: React.FC = () => {
  const { t } = useTranslation();
  const state = usePresentationStore((s) => s.state);

  if (!state?.set) {
    return (
      <div
        data-testid="live-preview"
        className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative flex items-center justify-center"
      >
        <PlaceholderCard icon={<Tv size={28} />} label={t("presentation.empty")} />
      </div>
    );
  }

  const mode = state.mode;

  return (
    <div
      data-testid="live-preview"
      className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative"
    >
      {mode === "blank" ? (
        <>
          <FrameTag label="BLACKOUT" />
        </>
      ) : state.overlay ? (
        <OverlayContent state={state} />
      ) : (
        <>
          <ActiveItemContent state={state} />
          {mode === "frozen" && <FrameTag label="CONGELADO" />}
        </>
      )}
    </div>
  );
};
