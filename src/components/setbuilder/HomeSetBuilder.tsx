import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  addSetItem,
  clearOverlay,
  getSet,
  importPresentation,
  listSongs,
  loadSetForPresentation,
  onSongsChanged,
  setAnnouncementOverlay,
  setMediaOverlay,
} from "../../api/commands";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { mediaUrl } from "../../api/assets";
import { usePresentationStore } from "../../stores/presentation";
import { SetBuilder } from "../set/SetBuilder";
import { SetPicker } from "./SetPicker";
import { OverlayActionBar } from "../presentation/OverlayActionBar";
import { useRequestPresentation } from "../presentation/PresentationLaunchProvider";
import type { Song } from "../../types";

export const HomeSetBuilder: React.FC = () => {
  const { t } = useTranslation();
  const { activeSetId } = useLibraryStore();
  const { state: presState } = usePresentationStore();
  const { media, refresh: refreshMedia } = useMediaStore();
  const requestPresentation = useRequestPresentation();

  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");

  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const [isImportingPresentation, setIsImportingPresentation] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const announcementRef = useRef<HTMLTextAreaElement>(null);

  const loadSongs = async () => {
    try {
      const result = await listSongs();
      setSongs(result);
    } catch (err) {
      console.error("load songs failed:", err);
    }
  };

  useEffect(() => {
    refreshMedia();
    loadSongs();

    const unlistenPromise = onSongsChanged(() => loadSongs());
    return () => {
      unlistenPromise.then((u) => u());
    };
  }, []);

  const filteredSongs = useMemo(() => {
    const lower = sidebarSearch.toLowerCase();
    if (!lower) return songs;
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(lower) ||
        (s.artist ?? "").toLowerCase().includes(lower)
    );
  }, [songs, sidebarSearch]);

  const handleApresentar = async () => {
    if (!activeSetId) return;
    try {
      const currentSet = await getSet(activeSetId);
      if (currentSet.items.length === 0) {
        setErrorToast(t("error.presentation.empty_set"));
        setTimeout(() => setErrorToast(null), 5000);
        return;
      }
      await loadSetForPresentation(activeSetId);
      await requestPresentation(activeSetId);
    } catch (err) {
      const payload = err as { code?: string; params?: Record<string, string> };
      setErrorToast(t(`error.${payload.code ?? "unknown"}`, payload.params));
      setTimeout(() => setErrorToast(null), 5000);
    }
  };

  const ensurePresentation = async () => {
    if (!activeSetId) return;
    try {
      await requestPresentation(activeSetId);
    } catch (err) {
      console.error("open presentation window failed:", err);
    }
  };

  const handleAddSong = async (songId: string) => {
    if (!activeSetId) return;
    try {
      await addSetItem({ setId: activeSetId, itemType: "song", songId });
    } catch (err) {
      console.error("add song failed:", err);
    }
  };

  const handleSongDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const songId = e.dataTransfer.getData("text/song-id");
    if (!songId) return;
    await handleAddSong(songId);
  };

  const handleOferta = () => {
    refreshMedia();
    setShowMediaPicker(true);
  };

  const handleSelectMediaOverlay = async (mediaId: string) => {
    setShowMediaPicker(false);
    await ensurePresentation();
    try {
      await setMediaOverlay(mediaId);
    } catch (err) {
      console.error("set media overlay failed:", err);
    }
  };

  const handleConfirmAnnouncement = async () => {
    const text = announcementText.trim();
    if (!text) return;
    setShowAnnouncementDialog(false);
    setAnnouncementText("");
    await ensurePresentation();
    try {
      await setAnnouncementOverlay(text);
    } catch (err) {
      console.error("set announcement overlay failed:", err);
    }
  };

  const handleClearOverlay = async () => {
    try {
      await clearOverlay();
    } catch (err) {
      console.error("clear overlay failed:", err);
    }
  };

  const handleAvisoClick = () => {
    setAnnouncementText("");
    setShowAnnouncementDialog(true);
    setTimeout(() => announcementRef.current?.focus(), 50);
  };

  const handleImportPresentation = async () => {
    if (!activeSetId) return;
    const selected = await open({
      title: t("media.slideshow.import"),
      filters: [{ name: "Presentation", extensions: ["pptx", "ppt", "pdf"] }],
      multiple: false,
    });
    if (!selected) return;
    setIsImportingPresentation(true);
    try {
      const imported = await importPresentation(selected as string);
      await addSetItem({
        setId: activeSetId,
        itemType: "slide_show",
        mediaId: imported.id,
      });
    } catch (err) {
      console.error("import presentation failed:", err);
      const payload = err as { code?: string; params?: Record<string, string> };
      setErrorToast(t(`error.${payload.code ?? "unknown"}`, payload.params));
      setTimeout(() => setErrorToast(null), 6000);
    } finally {
      setIsImportingPresentation(false);
    }
  };

  const isOverlayActive = !!presState?.overlay;
  const isPresenting =
    presState?.mode === "live" ||
    presState?.mode === "blank" ||
    presState?.mode === "frozen";
  const imageMedia = media.filter((m) => m.kind === "image");

  if (!activeSetId) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Error toast */}
      {errorToast !== null && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-warning text-fg-on-primary text-sm rounded-lg shadow-lg pointer-events-none">
          {errorToast}
        </div>
      )}

      {/* Active set picker */}
      <div className="px-3 py-2 border-b border-border">
        <SetPicker disabled={isPresenting} />
      </div>

      {/* Overlay action bar */}
      <OverlayActionBar
        showApresentarButton={true}
        onApresentar={handleApresentar}
        onOferta={handleOferta}
        onAviso={handleAvisoClick}
        onPdf={handleImportPresentation}
        onClearOverlay={handleClearOverlay}
        isOverlayActive={isOverlayActive}
        isImportingPresentation={isImportingPresentation}
      />

      {/* Content area */}
      <div className="flex-1 min-h-0 flex">
        {/* Set builder (drop target) */}
        <div
          className={`flex-1 min-w-0 transition-colors ${
            isDragOver ? "ring-2 ring-inset ring-primary/40" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleSongDrop}
        >
          <SetBuilder setId={activeSetId} hidePresentButton />
        </div>

        {/* Sidebar collapse toggle */}
        <button
          onClick={() => setShowSidebar((v) => !v)}
          className="w-5 shrink-0 bg-surface-2 hover:bg-border border-l border-border flex items-center justify-center text-muted hover:text-inherit text-xs transition-colors"
          title={showSidebar ? t("home.sidebar.title") : t("home.sidebar.title")}
          aria-label={t("home.sidebar.title")}
        >
          {showSidebar ? "›" : "‹"}
        </button>

        {/* Song search sidebar */}
        {showSidebar && (
          <div className="w-60 shrink-0 border-l border-border flex flex-col bg-surface">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
                {t("home.sidebar.title")}
              </p>
              <input
                type="search"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder={t("home.sidebar.searchPlaceholder")}
                className="w-full px-2 py-1.5 bg-surface-2 border border-border rounded text-sm placeholder-muted focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {filteredSongs.length === 0 ? (
                <p className="text-center text-muted text-xs py-6">
                  {t("home.sidebar.empty")}
                </p>
              ) : (
                filteredSongs.map((song) => (
                  <div
                    key={song.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/song-id", song.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => handleAddSong(song.id)}
                    className="px-3 py-2 rounded cursor-grab active:cursor-grabbing hover:bg-surface-2 transition-colors select-none"
                    title={t("home.sidebar.dragHint")}
                  >
                    <p className="text-sm truncate">{song.title}</p>
                    {song.artist && (
                      <p className="text-xs text-muted truncate">{song.artist}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Announcement dialog */}
      {showAnnouncementDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface rounded-xl shadow-2xl w-96 flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">{t("home.overlay.announcementTitle")}</h3>
            </div>
            <div className="p-4">
              <textarea
                ref={announcementRef}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    handleConfirmAnnouncement();
                  }
                  if (e.key === "Escape") {
                    setShowAnnouncementDialog(false);
                  }
                }}
                placeholder={t("home.overlay.announcementPlaceholder")}
                className="w-full h-28 px-3 py-2 bg-surface-2 border border-border rounded text-sm resize-none focus:outline-none focus:border-primary placeholder-muted"
              />
            </div>
            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowAnnouncementDialog(false)}
                className="px-4 py-2 text-sm rounded-lg bg-surface-2 hover:bg-border transition-colors"
              >
                {t("home.overlay.cancel")}
              </button>
              <button
                onClick={handleConfirmAnnouncement}
                disabled={!announcementText.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-fg-on-primary font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("home.overlay.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media picker (image overlay) */}
      {showMediaPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-surface rounded-xl shadow-2xl w-[520px] max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">{t("home.overlay.selectMedia")}</h3>
              <button
                onClick={() => setShowMediaPicker(false)}
                className="text-muted hover:text-inherit inline-flex items-center"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2">
              {imageMedia.length === 0 ? (
                <p className="col-span-3 text-center text-muted py-8 text-sm">
                  {t("media.picker.noMedia")}
                </p>
              ) : (
                imageMedia.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMediaOverlay(m.id)}
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
                    <p className="text-xs text-muted truncate px-1 py-0.5">
                      {m.displayName}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
