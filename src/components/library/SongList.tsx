import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { save } from "@tauri-apps/plugin-dialog";
import { useLibraryStore } from "../../stores/library";
import { exportSongs, onBackupProgress } from "../../api/commands";
import { EmptyState } from "./EmptyState";
import { SongListItem } from "./SongListItem";
import type { Song } from "../../types";

interface Props {
  onSongClick: (song: Song) => void;
  onImportHolyrics: () => void;
  onCreateSong: () => void;
}

export const SongList: React.FC<Props> = ({
  onSongClick,
  onImportHolyrics,
  onCreateSong,
}) => {
  const { t } = useTranslation();
  const { songs, isLoading, search, setSearch, refresh } = useLibraryStore();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const toggleSelect = useCallback((song: Song) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(song.id)) next.delete(song.id);
      else next.add(song.id);
      return next;
    });
  }, []);

  const stopSelecting = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  const handleExportSelected = async () => {
    if (selectedIds.size === 0) return;
    setStatus(null);
    const outPath = await save({
      filters: [{ name: "Lyrizzy Artifact", extensions: ["tlz"] }],
      defaultPath: `songs-${new Date().toISOString().slice(0, 10)}.tlz`,
    });
    if (!outPath) return; // cancelled — silent no-op

    setExporting(true);
    const unlisten = await onBackupProgress(() => {});
    try {
      const summary = await exportSongs([...selectedIds], outPath);
      setStatus(
        t("artifact.export.success", {
          songs: summary.counts.songs,
          media: summary.counts.media,
        })
      );
      stopSelecting();
    } catch (err: unknown) {
      setStatus(t("artifact.export.failed", { detail: String(err) }));
    } finally {
      (await unlisten)();
      setExporting(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const focusSearch = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    window.addEventListener("app:focus-search", focusSearch);
    return () => window.removeEventListener("app:focus-search", focusSearch);
  }, [focusSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      refresh();
    }, 150);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold">{t("library.title")}</h2>
          <div className="flex gap-2 shrink-0">
            {selecting ? (
              <>
                <button
                  data-testid="cta-export-selected"
                  onClick={handleExportSelected}
                  disabled={selectedIds.size === 0 || exporting}
                  className="px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-fg-on-primary disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  {exporting
                    ? t("artifact.export.running")
                    : `${t("artifact.export.songsButton")} (${selectedIds.size})`}
                </button>
                <button
                  onClick={stopSelecting}
                  disabled={exporting}
                  className="px-3 py-1.5 text-sm bg-surface-2 hover:bg-surface-3 border border-border rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {t("artifact.export.cancelSelect")}
                </button>
              </>
            ) : (
              <>
                <button
                  data-testid="cta-select-songs"
                  onClick={() => setSelecting(true)}
                  disabled={songs.length === 0}
                  className="px-3 py-1.5 text-sm bg-surface-2 hover:bg-surface-3 border border-border rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {t("artifact.export.select")}
                </button>
                <button
                  data-testid="cta-import-holyrics"
                  onClick={onImportHolyrics}
                  className="px-3 py-1.5 text-sm bg-surface-2 hover:bg-surface-3 border border-border rounded-lg font-medium transition-colors"
                >
                  {t("library.empty.importHolyrics")}
                </button>
                <button
                  data-testid="cta-create-song"
                  onClick={onCreateSong}
                  className="px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-fg-on-primary rounded-lg font-medium transition-colors"
                >
                  {t("library.empty.createSong")}
                </button>
              </>
            )}
          </div>
        </div>
        {status && (
          <p className="text-xs text-muted mb-2" data-testid="export-status">
            {status}
          </p>
        )}
        <input
          ref={inputRef}
          type="search"
          value={search}
          onChange={handleSearchChange}
          placeholder={t("library.searchPlaceholder")}
          className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-fg placeholder:text-muted focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-muted text-sm text-center py-8">
            {t("loading")}
          </p>
        ) : songs.length === 0 ? (
          <EmptyState
            onImportHolyrics={onImportHolyrics}
            onCreateSong={onCreateSong}
          />
        ) : (
          <ul className="space-y-1">
            {songs.map((song) => (
              <li key={song.id}>
                <SongListItem
                  song={song}
                  onClick={onSongClick}
                  selectable={selecting}
                  selected={selectedIds.has(song.id)}
                  onToggleSelect={toggleSelect}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
