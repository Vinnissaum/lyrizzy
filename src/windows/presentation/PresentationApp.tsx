import React, { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import { onLocaleChanged, onSettingChanged } from "../../api/commands";
import { mediaUrl } from "../../api/assets";
import { forwardKeydown } from "../../runtime/keyboard";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import { useMediaStore } from "../../stores/media";
import { useSettingsStore } from "../../stores/settings";
import { PRESET_COLORS } from "../../components/presentation/layout";
import { MediaSlideRenderer } from "../../components/presentation/MediaSlideRenderer";
import { CountdownRenderer } from "../../components/presentation/CountdownRenderer";
import { WebViewRenderer } from "../../components/presentation/WebViewRenderer";
import { TransitionStage } from "../../components/presentation/TransitionStage";
import { QuickMediaRenderer } from "../../components/presentation/QuickMediaRenderer";
import { QuickWebViewRenderer } from "../../components/presentation/QuickWebViewRenderer";
import { SlideshowRenderer } from "../../components/presentation/SlideshowRenderer";
import { SlideStage } from "../../components/presentation/SlideStage";
import { SlideContent } from "../../components/presentation/SlideContent";
import type {
  BackgroundInfo,
  BackgroundPreset,
  FontFamily,
  FontSize,
  Margin,
  ScreenPosition,
  BoldLevel,
  LineSpacing,
} from "../../types";

interface Appearance {
  fontFamily: FontFamily;
  fontSize: FontSize;
  preset: BackgroundPreset;
  position: ScreenPosition;
  margin: Margin;
  lineSpacing: LineSpacing;
  boldLevel: BoldLevel;
}

function formatMs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}


export const PresentationApp: React.FC = () => {
  const { i18n, t } = useTranslation();
  const { state, subscribe: subscribePresentation, next } = usePresentationStore();
  const {
    state: countdown,
    subscribe: subscribeCountdown,
    start: startCountdown,
    arm: armCountdown,
  } = useCountdownStore();
  const { refresh: refreshMedia, media } = useMediaStore();
  const {
    transitionMs,
    reduceMotion,
    setLocale,
    loadLocale,
    presentationFontFamily,
    presentationFontSize,
    presentationPreset,
    presentationPosition,
    presentationMargin,
    presentationLineSpacing,
    presentationBoldLevel,
    loadPresentationSettings,
  } = useSettingsStore();

  const appearance: Appearance = {
    fontFamily: presentationFontFamily,
    fontSize: presentationFontSize,
    preset: presentationPreset,
    position: presentationPosition,
    margin: presentationMargin,
    lineSpacing: presentationLineSpacing,
    boldLevel: presentationBoldLevel,
  };

  const currentItem = state?.set?.items[state?.currentItemIndex ?? 0];

  useEffect(() => {
    const unsub = subscribePresentation();
    const unsubCd = subscribeCountdown();
    const unsubLocale = onLocaleChanged((locale) => {
      i18n.changeLanguage(locale);
      setLocale(locale);
    });
    const unsubSetting = onSettingChanged((key) => {
      if (key.startsWith("presentation.") || key.startsWith("announcement.")) {
        loadPresentationSettings();
      }
    });
    loadPresentationSettings();
    loadLocale();
    refreshMedia();

    // P10-02: Esc local-fallback timer. Cleared on unmount to avoid leaks.
    let escFallbackTimer: ReturnType<typeof setTimeout> | undefined;

    const keydownHandler = (e: KeyboardEvent) => {
      const s = usePresentationStore.getState();
      const mode = s.state?.mode;

      if (e.key === "Escape") {
        // Esc ALWAYS escapes the presentation window, from any mode (P10-02).
        e.preventDefault();
        // 1. Clean single-owner exit: forward to the operator window, which owns
        //    the one `exitPresentation()` / `clearOverlay()` call. Calling those
        //    here too caused a cross-window double-dispatch race that froze the
        //    close.
        forwardKeydown(e);
        // 2. Local fallback: if the operator round-trip stalls or the operator
        //    window is gone, close this window directly. Idempotent — no-op if
        //    the window is already closing/gone (errors swallowed).
        if (escFallbackTimer === undefined) {
          escFallbackTimer = setTimeout(() => {
            escFallbackTimer = undefined;
            try {
              // close() may return a promise; swallow sync throws AND async
              // rejections ("window not found") so a double-Esc never throws.
              Promise.resolve(getCurrentWindow().close()).catch(() => {});
            } catch {
              // Window already closing/gone — ignore.
            }
          }, 400);
        }
        return;
      }

      if (e.key === "F10") {
        const isPresenting =
          mode === "live" || mode === "blank" || mode === "frozen";
        if (isPresenting) {
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
      unsubSetting.then((u) => u());
      window.removeEventListener("keydown", keydownHandler);
      if (escFallbackTimer !== undefined) clearTimeout(escFallbackTimer);
    };
  }, []);

  // Auto-start (or auto-arm) countdown when the runtime lands on a countdown
  // set item. `scheduledStart` arms the timer and waits until HH:MM.
  useEffect(() => {
    if (currentItem?.itemType === "countdown" && currentItem.countdownConfig) {
      const { target, message, endBehavior, scheduledStart } = currentItem.countdownConfig;
      if (scheduledStart) {
        const durationMs =
          target.kind === "duration" ? target.durationMs : 0;
        if (durationMs > 0) {
          armCountdown({
            scheduledStart,
            durationMs,
            message,
            endBehavior,
            setId: state?.set?.id,
            itemIndex: state?.currentItemIndex,
          });
          return;
        }
      }
      startCountdown({ target, message, endBehavior });
    }
  }, [currentItem?.id]);

  const mode = state?.mode ?? "idle";
  const slide = state?.currentSlide;
  const background = state?.background;
  const frozen = mode === "frozen";

  // Render precedence (P10-01):
  //   1. blank  → solid black (intentional F10 blackout beats everything)
  //   2. overlay → render the overlay (now reachable from idle too)
  //   3. idle   → countdown if armed, else "Aguardando apresentação…"
  //   4. live/frozen → set content (below)
  if (mode === "blank") {
    return <div className="h-screen bg-black" />;
  }

  // Overlay takes precedence over idle and normal set content (but not over blank)
  const overlay = state?.overlay;
  if (overlay) {
    if (overlay.type === "announcement") {
      const { announcementPreset } = useSettingsStore.getState();
      return (
        <div className="h-screen w-screen overflow-hidden">
          <SlideStage backgroundColor={PRESET_COLORS[announcementPreset].bg}>
            <SlideContent itemType="blank" appearance={appearance} warningText={overlay.text} />
          </SlideStage>
        </div>
      );
    }
    if (overlay.type === "media") {
      return <QuickMediaRenderer mediaId={overlay.mediaId} />;
    }
    if (overlay.type === "webView") {
      return <QuickWebViewRenderer url={overlay.url} />;
    }
  }

  // Idle: show countdown when active, else the waiting screen
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

  const itemType = currentItem?.itemType ?? "blank";

  // Compute a stable transition key: changes on item or slide
  const transitionKey = `${state?.currentItemIndex ?? 0}-${state?.currentSlideIndex ?? 0}`;

  let content: React.ReactNode;

  if (itemType === "media") {
    const mediaRecord = currentItem?.mediaId
      ? media.find((m) => m.id === currentItem.mediaId)
      : undefined;
    const assetUrl = mediaRecord ? mediaUrl(mediaRecord.fileName) : "";
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
          assetUrl: mediaUrl(bgMedia.fileName),
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
      <div className="h-screen bg-black flex items-center justify-center">
        <p className="text-white text-sm">{t("presentation.countdown.noConfig")}</p>
      </div>
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
    const presetBg = background?.assetUrl ? "#000000" : PRESET_COLORS[appearance.preset].bg;
    content = (
      <SlideStage backgroundColor={presetBg}>
        <SlideContent
          itemType={itemType === "blank" ? "blank" : "song"}
          appearance={appearance}
          previewMode={false}
          frozen={frozen}
          slideLines={slide?.lines ?? []}
          sectionLabel={slide?.sectionLabel}
          background={background}
        />
      </SlideStage>
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
