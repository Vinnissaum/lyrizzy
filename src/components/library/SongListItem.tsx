import React from "react";
import { Check } from "lucide-react";
import type { Song } from "../../types";

interface Props {
  song: Song;
  onClick: (song: Song) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (song: Song) => void;
}

export const SongListItem: React.FC<Props> = ({
  song,
  onClick,
  selectable,
  selected,
  onToggleSelect,
}) => (
  <button
    onClick={() => (selectable ? onToggleSelect?.(song) : onClick(song))}
    aria-pressed={selectable ? selected : undefined}
    className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between group ${
      selectable && selected
        ? "bg-primary/15 ring-1 ring-primary"
        : "bg-surface-2 hover:bg-border"
    }`}
  >
    <div className="flex items-center gap-3 min-w-0">
      {selectable && (
        <span
          className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
            selected ? "bg-primary border-primary" : "border-border"
          }`}
        >
          {selected && <Check size={12} className="text-fg-on-primary" />}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-medium text-fg truncate">{song.title}</p>
        {song.artist && (
          <p className="text-sm text-muted truncate">{song.artist}</p>
        )}
      </div>
    </div>
    <span className="ml-4 text-xs text-muted shrink-0">
      {song.sections.length}{" "}
      {song.sections.length === 1 ? "seção" : "seções"}
    </span>
  </button>
);
