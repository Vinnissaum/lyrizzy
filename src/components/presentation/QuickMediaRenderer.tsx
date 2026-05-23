import React from "react";
import { useMediaStore } from "../../stores/media";
import { MediaSlideRenderer } from "./MediaSlideRenderer";

interface Props {
  mediaId: string;
}

function buildAssetUrl(fileName: string): string {
  return `asset://localhost/media/${fileName}`;
}

export const QuickMediaRenderer: React.FC<Props> = ({ mediaId }) => {
  const { media } = useMediaStore();
  const item = media.find((m) => m.id === mediaId);

  if (!item || item.kind === "presentation") {
    return <div className="h-screen bg-black" />;
  }

  return (
    <MediaSlideRenderer
      assetUrl={buildAssetUrl(item.fileName)}
      kind={item.kind}
    />
  );
};
