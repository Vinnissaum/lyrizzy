import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { exitPresentation, onLocaleChanged } from "../../api/commands";
import { forwardKeydown } from "../../runtime/keyboard";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import { useMediaStore } from "../../stores/media";
import { useSettingsStore } from "../../stores/settings";
import { SongBackground } from "../../components/presentation/SongBackground";
import { MediaSlideRenderer } from "../../components/presentation/MediaSlideRenderer";
import { CountdownRenderer } from "../../components/presentation/CountdownRenderer";
import { WebViewRenderer } from "../../components/presentation/WebViewRenderer";
import { TransitionStage } from "../../components/presentation/TransitionStage";
import { AnnouncementRenderer } from "../../components/presentation/AnnouncementRenderer";
import { QuickMediaRenderer } from "../../components/presentation/QuickMediaRenderer";
import { QuickWebViewRenderer } from "../../components/presentation/QuickWebViewRenderer";
import { SlideshowRenderer } from "../../components/presentation/SlideshowRenderer";
import type { BackgroundInfo } from "../../types";

function formatMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function buildAssetUrl(fileName: string): string {
  return `asset://localhost/media/${fileName}`;
}

function SongSlide({
  slideLines,
  background,
  frozen,
  mode,
}: {
  slideLines: string[];
  background?: BackgroundInfo;
  frozen?: boolean;
  mode: string;
}) {
  return (
    <div className="relative h-full bg-black overflow-hidden select-none">
      {background && <SongBackground background={background} frozen={frozen} />}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-16">
        {mode === "frozen" && (
          <div className="absolute top-3 right-4 text-xs text-blue-400/60 font-medium uppercase tracking-wider">
            Congelado
          </div>
        )}
        {slideLines.length > 0 ? (
          <div className="w-full max-w-4xl text-center space-y-2">
            {slideLines.map((line, i) => (
              <p
                key={i}
                className="text-white font-medium leading-relaxed drop-shadow-lg"
                style={{ fontSize: "clamp(1.5rem, 4vw, 3rem)" }}
              >
                {line}
              </p>
            ))}
          </div>
        ) : (
          <div className="h-screen bg-transparent" />
        )}
      </div>
    </div>
  );
}

export const PresentationApp: React.FC = () => {
  const { i18n } = useTranslation();
  const { state, subscribe: subscribePresentation, next } = usePresentationStore();
  const { state: countdown, subscribe: subscribeCountdown, start: startCountdown } =
    useCountdownStore();
  const { refresh: refreshMedia, media } = useMediaStore();
  const { transitionMs, reduceMotion, setLocale } = useSettingsStore();

  const currentItem = state?.set?.items[state?.currentItemIndex ?? 0];

  useEffect(() => {
    const unsub = subscribePresentation();
    const unsubCd = subscribeCountdown();
    const unsubLocale = onLocaleChanged((locale) => {
      i18n.changeLanguage(locale);
      setLocale(locale);
    });
    refreshMedia();

    const keydownHandler = (e: KeyboardEvent) => {
      const s = usePresentationStore.getState();
      const mode = s.state?.mode;
      const isPresenting = mode === "live" || mode === "blank" || mode === "frozen";
      if (isPresenting) {
        if (e.key === "Escape") {
          e.preventDefault();
          exitPresentation().catch(console.error);
          return;
        }
        if (e.key === "F10") {
          e.preventDefault();
          s.setMode(mode === "blank" ? "live" : "blank");
          return;
        }
      }
      forwardKeydown(e);
    };
    window.addEventListener("keydown", keydownHandler);
    return () => {
      unsub.then((u) => u());
      unsubCd.then((u) => u());
      unsubLocale.then((u) => u());
      window.removeEventListener("keydown", keydownHandler);
    };
  }, []);

  // Auto-start countdown when the runtime lands on a countdown set item.
  useEffect(() => {
    if (currentItem?.itemType === "countdown" && currentItem.countdownConfig) {
      const { target, message, endBehavior } = currentItem.countdownConfig;
      startCountdown({ target, message, endBehavior });
    }
  }, [currentItem?.id]);

  const mode = state?.mode ?? "idle";
  const slide = state?.currentSlide;
  const background = state?.background;
  const frozen = mode === "frozen";

  // Idle: show countdown when active
  if (mode === "idle") {
    if (countdown.durationMs > 0 && countdown.mode !== "idle") {
      return (
        <div className="h-screen bg-black flex items-center justify-center select-none">
          <p
            className={`font-mono font-bold tabular-nums tracking-tight ${
              countdown.remainingMs <= 60_000 ? "text-red-400" : "text-white"
            }`}
            style={{ fontSize: "clamp(6rem, 20vw, 18rem)" }}
          >
            {formatMs(countdown.remainingMs)}
          </p>
        </div>
      );
    }
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <p className="text-gray-700 text-sm select-none">Aguardando apresentação…</p>
      </div>
    );
  }

  if (mode === "blank") {
    return <div className="h-screen bg-black" />;
  }

  // Overlay takes precedence over normal set content (but not over blank)
  const overlay = state?.overlay;
  if (overlay) {
    if (overlay.type === "announcement") {
      return <AnnouncementRenderer text={overlay.text} />;
    }
    if (overlay.type === "media") {
      return <QuickMediaRenderer mediaId={overlay.mediaId} />;
    }
    if (overlay.type === "webView") {
      return <QuickWebViewRenderer url={overlay.url} />;
    }
  }

  const itemType = currentItem?.itemType ?? "blank";

  // Compute a stable transition key: changes on item or slide
  const transitionKey = `${state?.currentItemIndex ?? 0}-${state?.currentSlideIndex ?? 0}`;

  let content: React.ReactNode;

  if (itemType === "media") {
    const mediaRecord = currentItem?.mediaId
      ? media.find((m) => m.id === currentItem.mediaId)
      : undefined;
    const assetUrl = mediaRecord ? buildAssetUrl(mediaRecord.fileName) : "";
    const kind: "image" | "video" = currentItem?.mediaKind === "video" ? "video" : "image";

    content = assetUrl ? (
      <MediaSlideRenderer
        assetUrl={assetUrl}
        kind={kind}
        options={currentItem?.mediaOptions}
        onEnded={next}
        frozen={frozen}
      />
    ) : (
      <div className="h-screen bg-black flex items-center justify-center">
        <p className="text-gray-600 text-sm">Mídia não encontrada</p>
      </div>
    );
  } else if (itemType === "countdown") {
    const cdConfig = currentItem?.countdownConfig;
    // Resolve background for countdown from backgroundMediaId if set
    let cdBackground: BackgroundInfo | undefined = undefined;
    if (cdConfig?.backgroundMediaId) {
      const bgMedia = media.find((m) => m.id === cdConfig.backgroundMediaId);
      if (bgMedia) {
        cdBackground = {
          mediaKind: bgMedia.kind,
          assetUrl: buildAssetUrl(bgMedia.fileName),
          scrimOpacity: 35,
          restartOnSectionBoundary: false,
        };
      }
    }
    content = cdConfig ? (
      <CountdownRenderer
        config={cdConfig}
        background={cdBackground}
        frozen={frozen}
      />
    ) : (
      <div className="h-screen bg-black" />
    );
  } else if (itemType === "web_view") {
    const wvConfig = currentItem?.webviewConfig;
    content = wvConfig ? (
      <WebViewRenderer config={wvConfig} />
    ) : (
      <div className="h-screen bg-black relative select-none">
        <p className="absolute bottom-4 right-4 text-xs text-gray-500">
          WebView não configurada
        </p>
      </div>
    );
  } else if (itemType === "slide_show") {
    const mediaId = currentItem?.mediaId ?? "";
    const slideIndex = slide?.sectionId ? parseInt(slide.sectionId, 10) : 0;
    content = (
      <SlideshowRenderer
        mediaId={mediaId}
        slideIndex={isNaN(slideIndex) ? 0 : slideIndex}
      />
    );
  } else {
    // Song or Blank
    content = (
      <SongSlide
        slideLines={slide?.lines ?? []}
        background={background}
        frozen={frozen}
        mode={mode}
      />
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <TransitionStage
        contentKey={transitionKey}
        durationMs={reduceMotion ? 0 : transitionMs}
      >
        {content}
      </TransitionStage>
    </div>
  );
};
