import React, { useEffect } from "react";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import { useMediaStore } from "../../stores/media";
import { useSettingsStore } from "../../stores/settings";
import { SongBackground } from "../../components/presentation/SongBackground";
import { MediaSlideRenderer } from "../../components/presentation/MediaSlideRenderer";
import { TransitionStage } from "../../components/presentation/TransitionStage";
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
  sectionLabel,
  background,
  frozen,
  mode,
}: {
  slideLines: string[];
  sectionLabel: string;
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
            {sectionLabel && (
              <p className="text-gray-400/60 text-xs uppercase tracking-widest mb-4">
                {sectionLabel}
              </p>
            )}
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
  const { state, subscribe: subscribePresentation, next } = usePresentationStore();
  const { state: countdown, subscribe: subscribeCountdown } = useCountdownStore();
  const { refresh: refreshMedia, media } = useMediaStore();
  const { transitionMs, reduceMotion } = useSettingsStore();

  useEffect(() => {
    const unsub = subscribePresentation();
    const unsubCd = subscribeCountdown();
    // Ensure media records are available for resolving MediaSlideRenderer URLs
    refreshMedia();
    return () => {
      unsub.then((u) => u());
      unsubCd.then((u) => u());
    };
  }, []);

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

  // Determine current set item
  const currentItem = state?.set?.items[state.currentItemIndex];
  const itemType = currentItem?.itemType ?? "blank";

  // Compute a stable transition key: changes on item or slide
  const transitionKey = `${state?.currentItemIndex ?? 0}-${state?.currentSlideIndex ?? 0}`;

  let content: React.ReactNode;

  if (itemType === "media") {
    // Look up media record for the file_name
    const mediaRecord = currentItem?.mediaId
      ? media.find((m) => m.id === currentItem.mediaId)
      : undefined;
    const assetUrl = mediaRecord ? buildAssetUrl(mediaRecord.fileName) : "";
    const kind = currentItem?.mediaKind ?? "image";

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
  } else {
    // Song, Blank, Countdown (placeholder), WebView (placeholder)
    content = (
      <SongSlide
        slideLines={slide?.lines ?? []}
        sectionLabel={slide?.sectionLabel ?? ""}
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
