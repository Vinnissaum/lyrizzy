import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useLibraryStore } from "../../stores/library";
import { SongEditor } from "../library/SongEditor";

/**
 * Modal shell that mounts the unmodified `SongEditor` over the operator
 * presentation layout, so the operator can fix a typo or reorder a section
 * without leaving the presentation view.
 *
 * Navigation hazard: `useLibraryStore`'s `openEditor`/`closeEditor` pair
 * drives the top-level `currentView` router (see `OperatorApp`), which would
 * navigate the operator away from the presentation layout. This modal instead
 * uses the store's `openLiveEditor`/`closeLiveEditor` pair, which sets
 * `editingSongId` (what `SongEditor` actually reads) without touching
 * `currentView`. `SongEditor` itself still calls the shared `closeEditor()`
 * on save/delete; the store's `isLiveEdit` flag makes that call a no-op on
 * `currentView` while a live edit session is active.
 */
export const LiveSongEditModal: React.FC<{
  songId: string | null;
  onClose: () => void;
}> = ({ songId, onClose }) => {
  const { t } = useTranslation();
  const editingSongId = useLibraryStore((s) => s.editingSongId);
  const openLiveEditor = useLibraryStore((s) => s.openLiveEditor);
  const closeLiveEditor = useLibraryStore((s) => s.closeLiveEditor);

  // Start the live edit session when a song id is provided.
  useEffect(() => {
    if (songId) {
      openLiveEditor(songId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  // SongEditor clears editingSongId itself after a successful save/delete
  // (via closeEditor). Detect that and let the host clear `songId` too.
  useEffect(() => {
    if (songId && editingSongId === null) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSongId]);

  if (!songId) return null;

  const handleCancel = () => {
    closeLiveEditor();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      data-testid="live-song-edit-modal"
    >
      <div className="bg-surface rounded-xl shadow-2xl w-[95vw] h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold">{t("presentation.liveEdit.title")}</h3>
          <button
            onClick={handleCancel}
            className="text-muted hover:text-inherit"
            aria-label={t("home.overlay.cancel")}
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <SongEditor />
        </div>
      </div>
    </div>
  );
};
