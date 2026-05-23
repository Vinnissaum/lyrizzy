import React, { useRef, useEffect } from "react";
import type { BackgroundInfo, BackgroundPreset } from "../../types";

const PRESET_BG: Record<BackgroundPreset, string> = {
  "preto-branco": "#000000",
  "branco-preto": "#FFFFFF",
};

interface Props {
  background: BackgroundInfo;
  frozen?: boolean;
}

export const SongBackground: React.FC<Props> = ({ background, frozen }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (frozen) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [frozen]);

  if (background.preset) {
    return (
      <div
        className="absolute inset-0"
        style={{ backgroundColor: PRESET_BG[background.preset] }}
      />
    );
  }

  if (!background.assetUrl) return null;

  const scrimStyle = { backgroundColor: `rgba(0,0,0,${background.scrimOpacity / 100})` };

  // Section-level backgrounds (restartOnSectionBoundary=true): key on assetUrl so React
  // unmounts and remounts the element when the section background changes.
  // Song-level backgrounds (restartOnSectionBoundary=false): prefix key with "song:" so
  // React keeps the element mounted even if the URL somehow changes between sections.
  const mediaKey = background.restartOnSectionBoundary
    ? background.assetUrl
    : `song:${background.assetUrl}`;

  return (
    <>
      {background.mediaKind === "video" ? (
        <video
          ref={videoRef}
          key={mediaKey}
          src={background.assetUrl}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img
          key={mediaKey}
          src={background.assetUrl}
          className="absolute inset-0 w-full h-full object-cover"
          alt=""
        />
      )}
      <div className="absolute inset-0" style={scrimStyle} />
    </>
  );
};
