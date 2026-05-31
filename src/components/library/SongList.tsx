import React, { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "../../stores/library";
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
          </div>
        </div>
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
                <SongListItem song={song} onClick={onSongClick} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
