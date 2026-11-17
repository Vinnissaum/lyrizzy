import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { addSetItem, importMedia, listMedia, normalizeError } from "../../api/commands";
import { formatCommandError } from "../../i18n/commandError";
import { MediaCardGrid } from "../common/MediaCardGrid";
import type { Media } from "../../types";

/** What the dialog offers; the file dialog offers nothing else. */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

/** What Home's set builder writes for any media item. */
const MEDIA_OPTIONS = { loop: false, mute: false, autoAdvanceOnEnd: true };

/**
 * The presenter's `Imagem` dialog (P24, AD-096): a click adds the image to the
 * set right after `anchorItemId` - the focused output's current item - and
 * each later pick right after the previous one, as `Adicionar música` does.
 * Nothing is projected and no wall moves; the operator selects the new row
 * when it is time. New photos are uploaded from the computer without leaving
 * the presentation (P23); an upload only imports.
 *
 * It keeps its own list of the whole library instead of reading the media
 * store, which holds whatever the Mídia view last filtered or searched for.
 */
export const LiveImagePicker: React.FC<{
  setId: string;
  anchorItemId: string | undefined;
  onClose: () => void;
}> = ({ setId, anchorItemId, onClose }) => {
  const { t } = useTranslation();
  const [images, setImages] = useState<Media[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [notImported, setNotImported] = useState(0);
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Picks apply in the order made: each add waits for the one before, so it
  // can land right after the item that one created.
  const lastAdd = useRef<Promise<string | undefined>>(Promise.resolve(anchorItemId));

  const load = async () => {
    try {
      const all = await listMedia({ kind: "image", limit: -1 });
      // Newest first, so what was just uploaded leads the grid.
      setImages([...all].sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error("list images failed:", err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pick = (image: Media) => {
    lastAdd.current = lastAdd.current.then(async (afterItemId) => {
      try {
        const item = await addSetItem({
          setId,
          itemType: "media",
          mediaId: image.id,
          mediaOptions: MEDIA_OPTIONS,
          afterItemId,
        });
        setAddedIds((ids) => new Set(ids).add(image.id));
        setError(null);
        return item.id;
      } catch (err) {
        setError(formatCommandError(err, t));
        return afterItemId;
      }
    });
  };

  const handleUpload = async () => {
    if (progress) return;
    const selected = await open({
      filters: [{ name: t("media.type.image"), extensions: IMAGE_EXTENSIONS }],
      multiple: true,
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    if (paths.length === 0) return;

    let failed = 0;
    setNotImported(0);
    for (let i = 0; i < paths.length; i++) {
      setProgress({ current: i + 1, total: paths.length });
      try {
        await importMedia(paths[i]);
      } catch (err) {
        console.warn("image not imported:", normalizeError(err).code, paths[i]);
        failed++;
      }
    }
    setProgress(null);
    setNotImported(failed);
    await load();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        role="dialog"
        aria-labelledby="live-image-picker-title"
        className="bg-surface rounded-xl shadow-2xl w-[min(64rem,calc(100vw-2rem))] h-[min(85vh,56rem)] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 id="live-image-picker-title" className="text-sm font-semibold">
            {t("presentation.liveSet.imagePickerTitle")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("presentation.liveSet.close")}
            className="text-muted hover:text-inherit"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-3 pt-3 shrink-0">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!!progress}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-surface-2 hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface-2"
          >
            <Upload size={14} aria-hidden="true" />
            {progress
              ? t("media.dropzone.uploading", progress)
              : t("home.overlay.uploadImage")}
          </button>
          {notImported > 0 && (
            <p role="alert" className="mt-2 text-xs text-warning">
              {t("home.overlay.uploadFailed", { count: notImported })}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-warning">
              {error}
            </p>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {images.length === 0 ? (
            <p className="text-center text-muted py-8 text-sm">{t("media.picker.noMedia")}</p>
          ) : (
            <MediaCardGrid
              testId="live-image-grid"
              items={images}
              onPick={pick}
              addedIds={addedIds}
            />
          )}
        </div>
      </div>
    </div>
  );
};
