import React from "react";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { Play } from "lucide-react";
import { ItemTypeIcon, itemLabel, songArtist } from "./itemMeta";

export const SetItemList: React.FC = () => {
  const items = usePresentationStore((s) => s.state?.set?.items ?? []);
  const currentItemIndex = usePresentationStore((s) => s.state?.currentItemIndex ?? -1);
  const pendingSelection = usePresentationStore((s) => s.pendingSelection);
  const selectSlide = usePresentationStore((s) => s.selectSlide);
  const songs = useLibraryStore((s) => s.songs);
  const media = useMediaStore((s) => s.media);

  // Optimistic highlight: prefer the pending selection target so the active
  // item lights up instantly, before the authoritative state catches up.
  const activeItemIndex = pendingSelection ? pendingSelection.itemIndex : currentItemIndex;

  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-1">
      {items.map((item, idx) => {
        const isActive = idx === activeItemIndex;
        const artist = songArtist(item, songs);
        return (
          <button
            key={idx}
            aria-current={isActive ? "true" : undefined}
            onClick={() => {
              const liveIdx = usePresentationStore.getState().state?.currentItemIndex ?? -1;
              if (idx !== liveIdx) selectSlide(idx, 0).catch(console.error);
            }}
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm w-full
              ${isActive
                ? "bg-primary/10 ring-1 ring-primary text-fg"
                : "text-fg hover:bg-surface-2"
              }`}
          >
            <ItemTypeIcon item={item} size={16} className="shrink-0" />
            {isActive && <Play size={12} className="shrink-0 fill-current" />}
            <span className="min-w-0 flex-1 flex flex-col">
              <span className="truncate">{itemLabel(item, songs, media)}</span>
              {artist && <span className="truncate text-xs text-muted">{artist}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
};
