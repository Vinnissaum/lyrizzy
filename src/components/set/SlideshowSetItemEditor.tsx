import React from "react";
import { useTranslation } from "react-i18next";
import { useMediaStore } from "../../stores/media";
import { mediaUrl } from "../../api/assets";
import type { SetItem } from "../../types";

interface Props {
  item: SetItem;
}

export const SlideshowSetItemEditor: React.FC<Props> = ({ item }) => {
  const { t } = useTranslation();
  const { media } = useMediaStore();
  const m = item.mediaId ? media.find((x) => x.id === item.mediaId) : undefined;

  if (!m) {
    return (
      <div className="p-3">
        <p className="text-xs text-danger">{t("builder.invalidRef")}</p>
      </div>
    );
  }

  const thumbUrl = mediaUrl(`${m.id}/slide_000.png`);
  const slideCount = m.slideCount ?? 0;

  return (
    <div className="p-3 flex items-center gap-3">
      <img
        src={thumbUrl}
        alt=""
        className="w-20 h-12 object-cover rounded bg-black shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{m.displayName}</p>
        <p className="text-xs text-muted">
          {slideCount === 1
            ? t("media.slideshow.slide")
            : t("media.slideshow.slides", { count: slideCount })}
        </p>
      </div>
    </div>
  );
};
