import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import {
  addSetItem,
  getSet,
  listSongs,
  loadSetForPresentation,
  onSongsChanged,
} from "../../api/commands";
import { useLibraryStore } from "../../stores/library";
import { SetBuilder } from "../set/SetBuilder";
import { SetPicker } from "./SetPicker";
import { useRequestPresentation } from "../presentation/PresentationLaunchProvider";
import type { Song } from "../../types";

export const HomeSetBuilder: React.FC = () => {
  const { t } = useTranslation();
  const { activeSetId } = useLibraryStore();
  const requestPresentation = useRequestPresentation();

  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const [errorToast, setErrorToast] = useState<string | null>(null);

  const loadSongs = async () => {
    try {
      const result = await listSongs();
      setSongs(result);
    } catch (err) {
      console.error("load songs failed:", err);
    }
  };

  useEffect(() => {
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

      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-3 flex-wrap shrink-0">
        <SetPicker />
        <div className="flex-1" />
        <button
          onClick={handleApresentar}
          data-testid="apresentar-button"
          className="px-5 py-2.5 text-sm font-semibold bg-primary hover:bg-primary-hover text-fg-on-primary rounded-lg inline-flex items-center gap-2"
        >
          <Play size={16} className="fill-current" />
          {t("presentation.action.present")}
        </button>
      </div>

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
    </div>
  );
};
