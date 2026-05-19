import React, { useEffect, useRef } from "react";
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

  useEffect(() => {
    refresh();
  }, []);

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
      <div className="px-4 pt-4 pb-3 border-b border-gray-700">
        <h2 className="text-lg font-semibold mb-3">{t("library.title")}</h2>
        <input
          type="search"
          value={search}
          onChange={handleSearchChange}
          placeholder={t("library.searchPlaceholder")}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-gray-500 text-sm text-center py-8">
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
