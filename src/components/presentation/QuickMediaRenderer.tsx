import React, { useEffect } from "react";
import { useMediaStore } from "../../stores/media";
import { mediaUrl } from "../../api/assets";
import { MediaSlideRenderer } from "./MediaSlideRenderer";

interface Props {
  mediaId: string;
}

export const QuickMediaRenderer: React.FC<Props> = ({ mediaId }) => {
  const { media, refresh } = useMediaStore();
  const item = media.find((m) => m.id === mediaId);
  const missing = !item;

  // The wall loads the media list when its window opens. An image imported
  // after that (the Imagem dialog's upload, P23) is not in it yet: reload once
  // for this overlay instead of leaving the wall black.
  useEffect(() => {
    if (missing) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, missing]);

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
