import React from "react";
import { useMediaStore } from "../../stores/media";
import { mediaUrl } from "../../api/assets";
import { MediaSlideRenderer } from "./MediaSlideRenderer";

interface Props {
  mediaId: string;
}

export const QuickMediaRenderer: React.FC<Props> = ({ mediaId }) => {
  const { media } = useMediaStore();
  const item = media.find((m) => m.id === mediaId);

  if (!item || item.kind === "presentation") {
    return <div className="h-screen bg-black" />;
  }

  return (
    <MediaSlideRenderer
      assetUrl={mediaUrl(item.fileName)}
      kind={item.kind}
    />
  );
};
