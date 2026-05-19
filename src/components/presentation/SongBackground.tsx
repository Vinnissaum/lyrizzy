import React, { useRef, useEffect } from "react";
import type { BackgroundInfo } from "../../types";

interface Props {
  background: BackgroundInfo;
  frozen?: boolean;
}

export const SongBackground: React.FC<Props> = ({ background, frozen }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrimStyle = { backgroundColor: `rgba(0,0,0,${background.scrimOpacity / 100})` };

  useEffect(() => {
    if (!videoRef.current) return;
    if (frozen) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [frozen]);

  return (
    <>
      {background.mediaKind === "video" ? (
        <video
          ref={videoRef}
          key={background.assetUrl}
          src={background.assetUrl}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img
          key={background.assetUrl}
          src={background.assetUrl}
          className="absolute inset-0 w-full h-full object-cover"
          alt=""
        />
      )}
      <div className="absolute inset-0" style={scrimStyle} />
    </>
  );
};
