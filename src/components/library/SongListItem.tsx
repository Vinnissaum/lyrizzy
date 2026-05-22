import React from "react";
import type { Song } from "../../types";

interface Props {
  song: Song;
  onClick: (song: Song) => void;
}

export const SongListItem: React.FC<Props> = ({ song, onClick }) => (
  <button
    onClick={() => onClick(song)}
    className="w-full text-left px-4 py-3 rounded-lg bg-surface-2 hover:bg-border transition-colors flex items-center justify-between group"
  >
    <div className="min-w-0">
      <p className="font-medium text-fg truncate">{song.title}</p>
      {song.artist && (
        <p className="text-sm text-muted truncate">{song.artist}</p>
      )}
    </div>
    <span className="ml-4 text-xs text-muted shrink-0">
      {song.sections.length}{" "}
      {song.sections.length === 1 ? "seção" : "seções"}
    </span>
  </button>
);
