import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SongBackground } from "../presentation/SongBackground";
import type { BackgroundInfo, Slide } from "../../types";

const VIRTUAL_W = 1920;
const VIRTUAL_H = 1080;
const DEFAULT_SCALE = 480 / VIRTUAL_W;

interface Props {
  slide: Slide | null;
  background?: BackgroundInfo;
  label: string;
}

function SlideContent({ slide, background }: { slide: Slide; background?: BackgroundInfo }) {
  const { t } = useTranslation();
  const pseudo = slide.sectionLabel;

  if (pseudo === "media") {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400 text-4xl font-medium">{t("stage.preview.media")}</p>
      </div>
    );
  }
  if (pseudo === "countdown") {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400 text-4xl font-medium">{t("stage.preview.countdown")}</p>
      </div>
    );
  }
  if (pseudo === "webview") {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-400 text-4xl font-medium">{t("stage.preview.webview")}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full bg-black overflow-hidden">
      {background && <SongBackground background={background} />}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-16">
        {slide.lines.length > 0 ? (
          <div className="w-full max-w-4xl text-center space-y-2">
            {slide.sectionLabel && (
              <p className="text-gray-400/60 text-xl uppercase tracking-widest mb-4">
                {slide.sectionLabel}
              </p>
            )}
            {slide.lines.map((line, i) => (
              <p
                key={i}
                className="text-white font-medium leading-relaxed drop-shadow-lg"
                style={{ fontSize: "clamp(2rem, 5vw, 4rem)" }}
              >
                {line}
              </p>
            ))}
          </div>
        ) : (
          <div className="h-full bg-transparent" />
        )}
      </div>
    </div>
  );
}

export const StagePreview: React.FC<Props> = ({ slide, background, label }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / VIRTUAL_W);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      className="relative rounded overflow-hidden bg-black border border-gray-700"
      style={{ aspectRatio: "16 / 9" }}
    >
      <div className="absolute top-1 left-2 z-20 text-xs font-medium text-white/50 bg-black/50 px-1.5 py-0.5 rounded">
        {label}
      </div>
      <div ref={containerRef} className="absolute inset-0">
        {slide === null ? (
          <div className="h-full flex items-center justify-center bg-gray-900">
            <p className="text-gray-500 text-4xl font-medium">{t("stage.endOfService")}</p>
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${VIRTUAL_W}px`,
              height: `${VIRTUAL_H}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <SlideContent slide={slide} background={background} />
          </div>
        )}
      </div>
    </div>
  );
};
