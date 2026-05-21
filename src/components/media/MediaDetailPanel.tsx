import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Pencil, Trash2, Check, Film, Image } from "lucide-react";
import {
  deleteMedia,
  getMediaReferences,
  normalizeError,
  renameMedia,
} from "../../api/commands";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { formatBytes } from "./MediaCard";
import type { Media, MediaReferences } from "../../types";

interface Props {
  media: Media;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const MediaDetailPanel: React.FC<Props> = ({ media, onClose }) => {
  const { t } = useTranslation();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(media.displayName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [references, setReferences] = useState<MediaReferences | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    setNameInput(media.displayName);
    setEditingName(false);
    setNameError("");
    setReferences(null);
    setDeleteError("");
  }, [media.id]);

  const previewUrl =
    media.kind === "image"
      ? `http://asset.localhost/media/${media.fileName}`
      : media.thumbnailFile
      ? `http://asset.localhost/media/${media.thumbnailFile}`
      : null;

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      setNameError(t("media.detail.errors.renameEmpty"));
      return;
    }
    setIsSavingName(true);
    setNameError("");
    try {
      await renameMedia(media.id, nameInput.trim());
      setEditingName(false);
    } catch (err) {
      const e = normalizeError(err);
      setNameError(e.params.detail ?? t("media.detail.errors.renameFailed"));
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDeleteClick = async () => {
    setDeleteError("");
    try {
      const refs = await getMediaReferences(media.id);
      setReferences(refs);
      setShowDeleteConfirm(true);
    } catch (err) {
      const e = normalizeError(err);
      setDeleteError(e.params.detail ?? t("media.detail.errors.refCheckFailed"));
    }
  };

  const handleConfirmDelete = async () => {
    if (!references) return;
    const hasRefs =
      references.songs.length > 0 || references.setItems.length > 0 || references.sections.length > 0;
    if (hasRefs) {
      setShowDeleteConfirm(false);
      return;
    }
    setIsDeleting(true);
    try {
      await deleteMedia(media.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      const e = normalizeError(err);
      setDeleteError(e.params.detail ?? t("media.detail.errors.deleteFailed"));
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasRefs =
    references &&
    (references.songs.length > 0 || references.setItems.length > 0 || references.sections.length > 0);

  return (
    <div className="flex flex-col h-full border-l border-border bg-bg w-72 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold">{t("media.detail.title")}</span>
        <button
          onClick={onClose}
          data-testid="detail-close"
          className="p-1 rounded hover:bg-surface-2 text-muted hover:text-inherit transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preview */}
      <div className="aspect-video bg-black flex items-center justify-center">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={media.displayName}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-muted">
            {media.kind === "video" ? (
              <Film className="w-12 h-12" />
            ) : (
              <Image className="w-12 h-12" />
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name */}
        <div>
          <p className="text-xs text-muted mb-1 uppercase tracking-wide">
            {t("media.detail.name")}
          </p>
          {editingName ? (
            <div className="flex gap-1">
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setNameInput(media.displayName);
                    setEditingName(false);
                  }
                }}
                data-testid="name-input"
                className="flex-1 min-w-0 px-2 py-1 bg-surface border border-border rounded text-sm focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleSaveName}
                disabled={isSavingName}
                className="p-1.5 bg-primary hover:bg-primary-hover rounded text-white transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p
                className="text-sm flex-1 break-words"
                data-testid="display-name"
              >
                {media.displayName}
              </p>
              <button
                onClick={() => setEditingName(true)}
                data-testid="rename-button"
                className="p-1 rounded hover:bg-surface-2 text-muted hover:text-inherit transition-colors shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {nameError && (
            <p className="text-red-400 text-xs mt-1">{nameError}</p>
          )}
        </div>

        {/* Metadata */}
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("media.detail.type")}</dt>
            <dd className="text-muted">
              {t(`media.type.${media.kind}`)}
            </dd>
          </div>
          {(media.width || media.height) && (
            <div className="flex justify-between">
              <dt className="text-muted">{t("media.detail.dimensions")}</dt>
              <dd className="text-muted">
                {media.width}×{media.height}
              </dd>
            </div>
          )}
          {media.durationMs !== undefined && media.durationMs > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">{t("media.detail.duration")}</dt>
              <dd className="text-muted">{formatDuration(media.durationMs)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">{t("media.detail.size")}</dt>
            <dd className="text-muted">{formatBytes(media.byteSize)}</dd>
          </div>
        </dl>

        {/* Delete error */}
        {deleteError && (
          <p className="text-red-400 text-xs">{deleteError}</p>
        )}

        {/* Delete button */}
        <button
          onClick={handleDeleteClick}
          disabled={isDeleting}
          data-testid="delete-button"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-700/30 hover:bg-red-700/50 text-red-400 hover:text-red-300 text-sm transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          {t("media.detail.delete")}
        </button>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title={hasRefs ? t("media.delete.inUseTitle") : t("media.delete.confirmTitle")}
        message={
          hasRefs
            ? t("media.delete.inUseMessage", {
                songs: references!.songs.length,
                items: references!.setItems.length,
                sections: references!.sections.length,
              })
            : t("media.delete.confirmMessage", { name: media.displayName })
        }
        confirmLabel={hasRefs ? t("media.delete.understood") : t("media.detail.delete")}
        cancelLabel={hasRefs ? undefined : t("sets.cancelButton")}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};
