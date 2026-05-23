import React from "react";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { goToItem } from "../../api/commands";
import { itemIcon, itemLabel } from "./itemMeta";

export const SetItemList: React.FC = () => {
  const items = usePresentationStore((s) => s.state?.set?.items ?? []);
  const currentItemIndex = usePresentationStore((s) => s.state?.currentItemIndex ?? -1);
  const songs = useLibraryStore((s) => s.songs);
  const media = useMediaStore((s) => s.media);

  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-1">
      {items.map((item, idx) => {
        const isActive = idx === currentItemIndex;
        return (
          <button
            key={idx}
            aria-current={isActive ? "true" : undefined}
            onClick={() => {
              if (!isActive) goToItem(idx, 0).catch(console.error);
            }}
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm w-full
              ${isActive
                ? "bg-primary/10 ring-1 ring-primary text-fg"
                : "text-fg hover:bg-surface-2"
              }`}
          >
            <span>{itemIcon(item)}</span>
            {isActive && <span>&#9654;</span>}
            <span className="truncate">{itemLabel(item, songs, media)}</span>
          </button>
        );
      })}
    </div>
  );
};
