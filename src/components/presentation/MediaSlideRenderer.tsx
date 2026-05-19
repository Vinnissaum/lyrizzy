import React, { useRef, useEffect } from "react";
import type { MediaItemOptions } from "../../types";

interface Props {
  assetUrl: string;
  kind: "image" | "video";
  options?: MediaItemOptions;
  onEnded?: () => void;
  frozen?: boolean;
}

export const MediaSlideRenderer: React.FC<Props> = ({
  assetUrl,
  kind,
  options,
  onEnded,
  frozen,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const loop = options?.loop ?? false;
  const muted = options?.mute ?? false;
  const autoAdvanceOnEnd = options?.autoAdvanceOnEnd ?? true;

  useEffect(() => {
    if (!videoRef.current) return;
    if (frozen) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [frozen]);

  const handleEnded = () => {
    if (!loop && autoAdvanceOnEnd && onEnded) {
      onEnded();
    }
  };

  if (kind === "video") {
    return (
      <div className="h-screen bg-black overflow-hidden">
        <video
          ref={videoRef}
          key={assetUrl}
          src={assetUrl}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          loop={loop}
          muted={muted}
          onEnded={handleEnded}
        />
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex items-center justify-center overflow-hidden">
      <img
        key={assetUrl}
        src={assetUrl}
        className="w-full h-full object-contain"
        alt=""
      />
    </div>
  );
};
