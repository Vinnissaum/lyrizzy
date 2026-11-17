import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { deleteMedia, getMediaReferences, listMedia } from "../../api/commands";
import { formatCommandError } from "../../i18n/commandError";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { MediaCardGrid } from "../common/MediaCardGrid";
import type { Media, MediaReferences } from "../../types";

type Filter = "all" | "image" | "video";
const FILTERS: Filter[] = ["all", "image", "video"];

/**
 * Home's `Mídia` dialog (P24): the whole library as large cards, newest first.
 * A card's click hands the media to the set builder, which adds it; a card's
 * delete control removes it from the library with the Mídia tab's
 * confirmation, and media still in use is refused as there (`Mídia em uso`).
 *
 * It keeps its own list instead of reading the media store, which holds
 * whatever the Mídia view last filtered or searched for, and no more than the
 * 200 newest.
 */
export const MediaAddDialog: React.FC<{
  onPick: (media: Media) => void;
  onClose: () => void;
}> = ({ onPick, onClose }) => {
  const { t } = useTranslation();
  const [library, setLibrary] = useState<Media[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingDelete, setPendingDelete] = useState<{
    media: Media;
    refs: MediaReferences;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMedia({ limit: -1 })
      .then((all) => setLibrary([...all].sort((a, b) => b.createdAt - a.createdAt)))
      .catch((err) => {
        setLibrary([]);
        setError(formatCommandError(err, t));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = (library ?? []).filter((m) => filter === "all" || m.kind === filter);
  const inUse =
    !!pendingDelete &&
    pendingDelete.refs.songs.length +
      pendingDelete.refs.setItems.length +
      pendingDelete.refs.sections.length >
      0;

  const askDelete = async (media: Media) => {
    setError(null);
    try {
      setPendingDelete({ media, refs: await getMediaReferences(media.id) });
    } catch (err) {
      setError(formatCommandError(err, t));
    }
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target || inUse) return;
    try {
      await deleteMedia(target.media.id);
      setLibrary((list) => list?.filter((m) => m.id !== target.media.id) ?? null);
    } catch (err) {
      setError(formatCommandError(err, t));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        role="dialog"
        aria-labelledby="media-add-dialog-title"
        className="bg-surface rounded-xl shadow-2xl w-[min(64rem,calc(100vw-2rem))] h-[min(85vh,56rem)] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 id="media-add-dialog-title" className="text-sm font-semibold">
            {t("builder.mediaDialog.title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("builder.mediaDialog.close")}
            className="text-muted hover:text-inherit"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-border flex items-center gap-1 shrink-0">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filter === f
                  ? "bg-primary text-fg-on-primary"
                  : "bg-surface-2 text-muted hover:bg-border"
              }`}
            >
              {t(`builder.mediaFilter.${f}`)}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="px-4 pt-2 text-xs text-warning shrink-0">
            {error}
          </p>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {library === null ? null : shown.length === 0 ? (
            <p className="text-center text-muted py-8 text-sm">{t("builder.noMedia")}</p>
          ) : (
            <MediaCardGrid
              testId="media-add-grid"
              items={shown}
              onPick={onPick}
              onDelete={askDelete}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title={inUse ? t("media.delete.inUseTitle") : t("media.delete.confirmTitle")}
        message={
          !pendingDelete
            ? ""
            : inUse
              ? t("media.delete.inUseMessage", {
                  songs: pendingDelete.refs.songs.length,
                  items: pendingDelete.refs.setItems.length,
                  sections: pendingDelete.refs.sections.length,
                })
              : t("media.delete.confirmMessage", { name: pendingDelete.media.displayName })
        }
        confirmLabel={inUse ? t("media.delete.understood") : t("media.detail.delete")}
        cancelLabel={inUse ? undefined : t("sets.cancelButton")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
