import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Trash2 } from "lucide-react";
import { mediaUrl } from "../../api/assets";
import type { Media } from "../../types";

/**
 * Media as large cards, for the dialogs that pick media for a set (P24): the
 * presenter's `Imagem` and Home's `Mídia`. Columns are at least 11rem (176 px)
 * wide, so a thumbnail is never under 160 px, and each row is as tall as its
 * cards (`auto-rows-max`): cards clip their content, which in a grid of bounded
 * height would otherwise let the rows shrink and overlap (AD-092).
 */
export const MediaCardGrid: React.FC<{
  items: Media[];
  onPick: (media: Media) => void;
  /** Cards to mark `Adicionada` (the presenter's dialog). */
  addedIds?: ReadonlySet<string>;
  /** When given, every card gets a delete control (Home's dialog). */
  onDelete?: (media: Media) => void;
  testId?: string;
}> = ({ items, onPick, addedIds, onDelete, testId }) => {
  const { t } = useTranslation();
  return (
    <div
      data-testid={testId}
      className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] auto-rows-max gap-3"
    >
      {items.map((m) => (
        <div key={m.id} className="relative">
          <button
            type="button"
            onClick={() => onPick(m)}
            title={m.displayName}
            className="w-full flex flex-col rounded-lg overflow-hidden border-2 border-transparent hover:border-primary focus-visible:border-primary transition-colors text-left"
          >
            <span className="block aspect-video bg-surface-2 relative">
              <img
                src={mediaUrl(m.thumbnailFile ?? m.fileName)}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              {m.kind === "video" && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded"
                >
                  VIDEO
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 px-1.5 py-1 min-w-0">
              <span className="text-xs truncate flex-1">{m.displayName}</span>
              {addedIds?.has(m.id) && (
                <span className="shrink-0 inline-flex items-center gap-0.5 text-xs text-primary">
                  <Check size={12} aria-hidden="true" />
                  {t("presentation.liveSet.added")}
                </span>
              )}
            </span>
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(m)}
              aria-label={`${t("media.detail.delete")} ${m.displayName}`}
              title={t("media.detail.delete")}
              className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/60 text-white hover:bg-danger focus-visible:bg-danger transition-colors"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
