import React from "react";
import type { Song } from "../../types";

interface Props {
  song: Song;
  onClick: (song: Song) => void;
}

export const SongListItem: React.FC<Props> = ({ song, onClick }) => (
  <button
    onClick={() => onClick(song)}
    className="w-full text-left px-4 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
  >
    <div className="min-w-0">
      <p className="font-medium text-gray-900 dark:text-white truncate">{song.title}</p>
      {song.artist && (
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{song.artist}</p>
      )}
    </div>
    <span className="ml-4 text-xs text-gray-400 dark:text-gray-500 shrink-0">
      {song.sections.length}{" "}
      {song.sections.length === 1 ? "seção" : "seções"}
    </span>
  </button>
);
