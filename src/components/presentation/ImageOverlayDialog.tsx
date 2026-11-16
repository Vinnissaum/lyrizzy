import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { importMedia, listMedia, normalizeError } from "../../api/commands";
import { mediaUrl } from "../../api/assets";
import { useMediaStore } from "../../stores/media";
import type { Media } from "../../types";

/** What the image overlay can project; the file dialog offers nothing else. */
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

/**
 * The `Imagem` dialog: picks an image to project as the overlay, and uploads
 * new ones from the computer without leaving the presentation (P23). An upload
 * only imports - the operator still clicks a thumbnail to project it.
 *
 * It keeps its own image list instead of reading the media store, which holds
 * whatever the Mídia view last filtered or searched for.
 */
export const ImageOverlayDialog: React.FC<{
  onSelect: (mediaId: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const { t } = useTranslation();
  const { refresh: refreshMediaStore } = useMediaStore();
  const [images, setImages] = useState<Media[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [notImported, setNotImported] = useState(0);

  const load = async () => {
    try {
      const all = await listMedia({ kind: "image" });
      // Newest first, so what was just uploaded leads the grid.
      setImages([...all].sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.error("list images failed:", err);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
    // The rest of the operator window (previews, labels) reads the store.
    refreshMediaStore();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        role="dialog"
        aria-labelledby="image-overlay-title"
        className="bg-surface rounded-xl shadow-2xl w-[520px] max-w-[calc(100vw-2rem)] max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 id="image-overlay-title" className="text-sm font-semibold">
            {t("home.overlay.selectMedia")}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("home.overlay.cancel")}
            className="text-muted hover:text-inherit"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-3 pt-3">
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
        </div>
        <div
          data-testid="image-overlay-grid"
          className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2"
        >
          {images.length === 0 ? (
            <p className="col-span-3 text-center text-muted py-8 text-sm">
              {t("media.picker.noMedia")}
            </p>
          ) : (
            images.map((m) => (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="flex flex-col rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
              >
                <div className="aspect-video bg-surface-2 relative">
                  <img
                    src={mediaUrl(m.thumbnailFile ?? m.fileName)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <p className="text-xs text-muted truncate px-1 py-0.5">{m.displayName}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
