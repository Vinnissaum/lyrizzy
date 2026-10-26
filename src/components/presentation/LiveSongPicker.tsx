import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { addSetItem } from "../../api/commands";
import { useLibraryStore } from "../../stores/library";
import { formatCommandError } from "../../i18n/commandError";

/**
 * Picks songs to add to the live set (P21). The first pick lands right after
 * `anchorItemId` (the focused output's current item); each later pick in the
 * same session lands after the previous one, so the songs keep the order they
 * were picked in. The set is saved and every screen showing it updates from
 * the backend's `state_changed`.
 */
export const LiveSongPicker: React.FC<{
  setId: string;
  anchorItemId: string | undefined;
  onClose: () => void;
}> = ({ setId, anchorItemId, onClose }) => {
  const { t } = useTranslation();
  const songs = useLibraryStore((s) => s.songs);
  const [search, setSearch] = useState("");
  const [lastAddedId, setLastAddedId] = useState<string | undefined>(undefined);
  const [addedSongIds, setAddedSongIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase();
    if (!lower) return songs;
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(lower) ||
        (s.artist ?? "").toLowerCase().includes(lower),
    );
  }, [songs, search]);

  const pick = async (songId: string) => {
    try {
      const item = await addSetItem({
        setId,
        itemType: "song",
        songId,
        afterItemId: lastAddedId ?? anchorItemId,
      });
      setLastAddedId(item.id);
      setAddedSongIds((ids) => [...ids, songId]);
      setError(null);
    } catch (err) {
      setError(formatCommandError(err, t));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        role="dialog"
        aria-label={t("presentation.liveSet.pickerTitle")}
        className="bg-surface rounded-xl shadow-2xl w-[520px] max-w-[calc(100vw-2rem)] max-h-[70vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{t("presentation.liveSet.pickerTitle")}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("presentation.liveSet.close")}
            className="text-muted hover:text-inherit"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-border">
          <input
            type="search"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("presentation.liveSet.searchPlaceholder")}
            className="w-full px-2 py-1.5 bg-surface-2 border border-border rounded text-sm placeholder-muted focus:outline-none focus:border-primary"
          />
          {error && (
            <p role="alert" className="mt-1.5 text-xs text-warning">
              {error}
            </p>
          )}
        </div>
        <div data-testid="live-song-picker-list" className="flex-1 overflow-y-auto p-1 space-y-0.5">
          {songs.length === 0 ? (
            <p className="text-center text-muted text-xs py-6">
              {t("presentation.liveSet.libraryEmpty")}
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted text-xs py-6">
              {t("presentation.liveSet.noMatch")}
            </p>
          ) : (
            filtered.map((song) => {
              const added = addedSongIds.includes(song.id);
              return (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => pick(song.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded text-left hover:bg-surface-2 transition-colors"
                >
                  <span className="min-w-0 flex-1 flex flex-col">
                    <span className="text-sm truncate">{song.title}</span>
                    {song.artist && (
                      <span className="text-xs text-muted truncate">{song.artist}</span>
                    )}
                  </span>
                  {added && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs text-primary">
                      <Check size={12} aria-hidden="true" />
                      {t("presentation.liveSet.added")}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
