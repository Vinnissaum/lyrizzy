import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { Play, Plus, Trash2 } from "lucide-react";
import { removeSetItem } from "../../api/commands";
import { useOutputStates } from "../../hooks/useOutputStates";
import { onScreenItemIds } from "../../utils/onScreen";
import { formatCommandError } from "../../i18n/commandError";
import { ItemTypeIcon, itemLabel, songArtist } from "./itemMeta";
import { LiveSongPicker } from "./LiveSongPicker";
import type { SetItem } from "../../types";

export const SetItemList: React.FC<{
  /** Live set editing (P21): add songs, remove items not on screen. */
  editable?: boolean;
}> = ({ editable = false }) => {
  const { t } = useTranslation();
  const items = usePresentationStore((s) => s.state?.set?.items ?? []);
  const currentItemIndex = usePresentationStore((s) => s.state?.currentItemIndex ?? -1);
  const pendingSelection = usePresentationStore((s) => s.pendingSelection);
  const selectSlide = usePresentationStore((s) => s.selectSlide);
  const songs = useLibraryStore((s) => s.songs);
  const media = useMediaStore((s) => s.media);

  // Optimistic highlight: prefer the pending selection target so the active
  // item lights up instantly, before the authoritative state catches up.
  const activeItemIndex = pendingSelection ? pendingSelection.itemIndex : currentItemIndex;

  const row = (item: SetItem, idx: number) => {
    const isActive = idx === activeItemIndex;
    const artist = songArtist(item, songs);
    return (
      <button
        key={editable ? undefined : idx}
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
          <span className="truncate">{itemLabel(item, songs, media, t)}</span>
          {artist && <span className="truncate text-xs text-muted">{artist}</span>}
        </span>
      </button>
    );
  };

  if (!editable) {
    return (
      <div className="flex flex-col gap-1 overflow-y-auto p-1">
        {items.map((item, idx) => row(item, idx))}
      </div>
    );
  }
  return <EditableSetItemList items={items} row={row} />;
};

/** The live-editing variant: the same rows, plus add and remove. */
const EditableSetItemList: React.FC<{
  items: SetItem[];
  row: (item: SetItem, idx: number) => React.ReactNode;
}> = ({ items, row }) => {
  const { t } = useTranslation();
  const focusedState = usePresentationStore((s) => s.state);
  const songs = useLibraryStore((s) => s.songs);
  const media = useMediaStore((s) => s.media);
  const outputs = useOutputStates();
  const [picking, setPicking] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<SetItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setId = focusedState?.set?.id;
  const onScreen = onScreenItemIds([focusedState, outputs.one, outputs.two], setId);
  const anchorItemId = items[focusedState?.currentItemIndex ?? -1]?.id;

  const confirmRemoval = async () => {
    const item = pendingRemoval;
    setPendingRemoval(null);
    if (!item) return;
    try {
      await removeSetItem(item.id);
      setError(null);
    } catch (err) {
      setError(formatCommandError(err, t));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-1 pt-1">
        <button
          type="button"
          onClick={() => setPicking(true)}
          disabled={!setId}
          className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md bg-surface-2 hover:bg-border transition-colors disabled:opacity-50"
        >
          <Plus size={14} aria-hidden="true" />
          {t("presentation.liveSet.addSong")}
        </button>
        {error && (
          <p role="alert" className="mt-1 text-xs text-warning">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto p-1">
        {items.map((item, idx) => {
          const locked = onScreen.has(item.id);
          const label = itemLabel(item, songs, media, t);
          return (
            <div key={item.id} className="flex items-center gap-1">
              <div className="min-w-0 flex-1">{row(item, idx)}</div>
              <span title={locked ? t("presentation.liveSet.onAir") : undefined}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => setPendingRemoval(item)}
                  aria-label={`${t("presentation.liveSet.remove")} ${label}`}
                  title={locked ? t("presentation.liveSet.onAir") : t("presentation.liveSet.remove")}
                  className="shrink-0 p-1.5 rounded text-muted hover:text-warning hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:bg-transparent"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {pendingRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div
            role="alertdialog"
            aria-labelledby="live-remove-title"
            className="bg-surface rounded-xl shadow-2xl w-[420px] max-w-[calc(100vw-2rem)] p-4 flex flex-col gap-4"
          >
            <p id="live-remove-title" className="text-sm">
              {t("presentation.liveSet.confirmRemove", {
                name: itemLabel(pendingRemoval, songs, media, t),
              })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                className="px-3 py-1.5 text-sm rounded-lg bg-surface-2 hover:bg-border transition-colors"
              >
                {t("presentation.liveSet.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmRemoval}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-warning-bg text-warning border border-warning transition-colors"
              >
                {t("presentation.liveSet.remove")}
              </button>
            </div>
          </div>
        </div>
      )}

      {picking && setId && (
        <LiveSongPicker
          setId={setId}
          anchorItemId={anchorItemId}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
};
