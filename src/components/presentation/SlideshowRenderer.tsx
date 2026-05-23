import React from "react";
import { mediaUrl } from "../../api/assets";

interface Props {
  mediaId: string;
  slideIndex: number;
}

const slideUrl = (mediaId: string, index: number) =>
  mediaUrl(`${mediaId}/slide_${String(index).padStart(3, "0")}.png`);

export const SlideshowRenderer: React.FC<Props> = ({ mediaId, slideIndex }) => {
  if (!mediaId) {
    return <div className="w-full h-full bg-black" data-testid="slideshow-placeholder" />;
  }

  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <img
        src={slideUrl(mediaId, slideIndex)}
        alt=""
        className="max-w-full max-h-full object-contain"
        data-testid="slideshow-image"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
};
