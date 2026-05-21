import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addSetItem,
  duplicateSetItem,
  getSet,
  loadSetForPresentation,
  onSetChanged,
  removeSetItem,
  reorderSetItems,
  updateSet,
} from "../../api/commands";
import { useLibraryStore } from "../../stores/library";
import { usePresentationStore } from "../../stores/presentation";
import { useMediaStore } from "../../stores/media";
import { listSongs } from "../../api/commands";
import { CountdownSetItemEditor } from "./CountdownSetItemEditor";
import { WebViewSetItemEditor } from "./WebViewSetItemEditor";
import { MediaSetItemEditor } from "./MediaSetItemEditor";
import { BlankItemNotesEditor } from "./BlankItemNotesEditor";
import type { Media, ServiceSet, SetItem, Song } from "../../types";

interface Props {
  setId: string | null;
}

function itemIcon(item: SetItem): string {
  switch (item.itemType) {
    case "song": return "♪";
    case "media": return item.mediaKind === "video" ? "▶" : "🖼";
    case "countdown": return "⏱";
    case "web_view": return "🌐";
    default: return "▪";
  }
}

function isExpandable(item: SetItem): boolean {
  return (
    item.itemType === "countdown" ||
    item.itemType === "web_view" ||
    item.itemType === "blank" ||
    (item.itemType === "media" && item.mediaKind === "video")
  );
}

export const SetBuilder: React.FC<Props> = ({ setId }) => {
  const { t } = useTranslation();
  const { setView } = useLibraryStore();
  const { media, refresh: refreshMedia } = useMediaStore();
  const [serviceSet, setServiceSet] = useState<ServiceSet | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songSearch, setSongSearch] = useState("");
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<"all" | "image" | "video">("all");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSet = async () => {
    if (!setId) return;
    try {
      const s = await getSet(setId);
      setServiceSet(s);
      setNameInput(s.name);
    } catch (err) {
      console.error("load set failed:", err);
    }
  };

  const loadSongs = async () => {
    try {
      const result = await listSongs();
      setSongs(result);
      setFilteredSongs(result);
    } catch (err) {
      console.error("load songs failed:", err);
    }
  };

  useEffect(() => {
    loadSet();
    loadSongs();
    refreshMedia();
    const unlistenPromise = onSetChanged(() => loadSet());
    return () => {
      unlistenPromise.then((u) => u());
    };
  }, [setId]);

  const handleSearchChange = (value: string) => {
    setSongSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const lower = value.toLowerCase();
      setFilteredSongs(
        songs.filter(
          (s) =>
            s.title.toLowerCase().includes(lower) ||
            (s.artist ?? "").toLowerCase().includes(lower)
        )
      );
    }, 150);
  };

  const handleSaveName = async () => {
    if (!serviceSet || !nameInput.trim()) return;
    try {
      await updateSet({ id: serviceSet.id, name: nameInput.trim() });
      setEditingName(false);
    } catch (err) {
      console.error("update set name failed:", err);
    }
  };

  const handleAddSong = async (song: Song) => {
    if (!serviceSet) return;
    try {
      await addSetItem({ setId: serviceSet.id, itemType: "song", songId: song.id });
      setShowSongPicker(false);
    } catch (err) {
      console.error("add song failed:", err);
    }
  };

  const handleAddMedia = async (mediaItem: Media) => {
    if (!serviceSet) return;
    try {
      const item = await addSetItem({
        setId: serviceSet.id,
        itemType: "media",
        mediaId: mediaItem.id,
        mediaOptions: { loop: false, mute: false, autoAdvanceOnEnd: true },
      });
      setShowMediaPicker(false);
      if (mediaItem.kind === "video") setExpandedItemId(item.id);
    } catch (err) {
      console.error("add media failed:", err);
    }
  };

  const handleAddCountdown = async () => {
    if (!serviceSet) return;
    try {
      const item = await addSetItem({
        setId: serviceSet.id,
        itemType: "countdown",
        countdownConfig: {
          durationMs: 600_000,
          message: t("countdown.editor.defaultMessage"),
          endBehavior: "holdZero",
        },
      });
      setExpandedItemId(item.id);
    } catch (err) {
      console.error("add countdown failed:", err);
    }
  };

  const handleAddWebView = async () => {
    if (!serviceSet) return;
    try {
      const item = await addSetItem({
        setId: serviceSet.id,
        itemType: "web_view",
        webViewConfig: { mode: "iframe", url: "" },
      });
      setExpandedItemId(item.id);
    } catch (err) {
      console.error("add webview failed:", err);
    }
  };

  const handleAddBlank = async () => {
    if (!serviceSet) return;
    try {
      await addSetItem({ setId: serviceSet.id, itemType: "blank" });
    } catch (err) {
      console.error("add blank failed:", err);
    }
  };

  const handleRemoveItem = async (item: SetItem) => {
    try {
      await removeSetItem(item.id);
    } catch (err) {
      console.error("remove item failed:", err);
    }
  };

  const handleDuplicate = async (item: SetItem) => {
    try {
      await duplicateSetItem(item.id);
    } catch (err) {
      console.error("duplicate item failed:", err);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (!serviceSet) return;
    const items = [...serviceSet.items];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    try {
      await reorderSetItems(serviceSet.id, items.map((i) => i.id));
    } catch (err) {
      console.error("reorder failed:", err);
    }
  };

  const handleLoadForPresentation = async () => {
    if (!serviceSet) return;
    setIsLoading(true);
    try {
      await loadSetForPresentation(serviceSet.id);
      usePresentationStore.getState().syncState();
      setView("set-player");
    } catch (err) {
      console.error("load presentation failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const songById = (id?: string) => songs.find((s) => s.id === id);
  const mediaById = (id?: string) => media.find((m) => m.id === id);

  const isInvalidRef = (item: SetItem): boolean => {
    if (item.itemType === "song") return !songById(item.songId);
    if (item.itemType === "media") return !mediaById(item.mediaId);
    return false;
  };

  const filteredMedia = showMediaPicker
    ? mediaFilter === "all"
      ? media
      : media.filter((m) => m.kind === mediaFilter)
    : [];

  if (!serviceSet) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        {t("builder.loading")}
      </div>
    );
  }

  const itemSummary = (item: SetItem) => {
    const song = item.itemType === "song" ? songById(item.songId) : undefined;
    const mediaItem = item.itemType === "media" ? mediaById(item.mediaId) : undefined;
    const invalid = isInvalidRef(item);

    if (invalid) {
      return (
        <p className="text-xs text-red-400 font-medium">
          {t("builder.invalidRef")}
        </p>
      );
    }

    switch (item.itemType) {
      case "song":
        return (
          <>
            <p className="text-sm font-medium truncate">{song!.title}</p>
            {song!.artist && (
              <p className="text-xs text-muted truncate">{song!.artist}</p>
            )}
          </>
        );
      case "media":
        return (
          <p className="text-sm text-blue-400 font-medium truncate">
            {mediaItem?.displayName ?? "Mídia"}
          </p>
        );
      case "countdown": {
        const cfg = item.countdownConfig;
        const durLabel = cfg ? `${Math.floor(cfg.durationMs / 60000)}min` : "10min";
        return (
          <p className="text-sm text-amber-400 font-medium">
            {t("builder.countdownSummary", { dur: durLabel })}
          </p>
        );
      }
      case "web_view": {
        const wv = item.webviewConfig;
        const urlShort = wv?.url
          ? wv.url.replace(/^https?:\/\//, "").slice(0, 30)
          : t("builder.noUrl");
        return (
          <p className="text-sm text-purple-400 font-medium truncate">
            {wv?.mode === "mjpeg" ? "Câmera" : "Web"} — {urlShort}
          </p>
        );
      }
      default:
        return <p className="text-sm text-muted italic">{t("builder.blank")}</p>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setView("sets")}
            className="text-muted hover:text-inherit p-1 rounded transition-colors"
          >
            ←
          </button>
          {editingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveName();
              }}
              className="flex-1 flex gap-2"
            >
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 px-2 py-1 bg-surface border border-primary rounded text-sm focus:outline-none"
              />
              <button
                type="submit"
                className="px-2 py-1 text-xs bg-primary hover:bg-primary-hover text-white rounded transition-colors"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingName(false);
                  setNameInput(serviceSet.name);
                }}
                className="px-2 py-1 text-xs bg-surface-2 hover:bg-border rounded transition-colors"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex-1 text-left text-base font-semibold hover:text-primary transition-colors"
              title={t("builder.renameTip")}
            >
              {serviceSet.name}
            </button>
          )}
        </div>
        <p className="text-xs text-muted pl-7">
          {t("builder.item", { count: serviceSet.items.length })}
        </p>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {serviceSet.items.length === 0 ? (
          <p className="text-center text-muted text-sm py-8">
            {t("builder.empty")}
          </p>
        ) : (
          serviceSet.items.map((item, idx) => {
            const expanded = expandedItemId === item.id;
            const canExpand = isExpandable(item);

            return (
              <div key={item.id} className="rounded-lg bg-surface overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 group">
                  <span className="text-xs text-muted w-5 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm shrink-0 w-4 text-center">
                    {itemIcon(item)}
                  </span>
                  <div
                    className={`flex-1 min-w-0 ${canExpand ? "cursor-pointer" : ""}`}
                    onClick={() =>
                      canExpand && setExpandedItemId(expanded ? null : item.id)
                    }
                  >
                    {itemSummary(item)}
                  </div>
                  {canExpand && (
                    <button
                      onClick={() => setExpandedItemId(expanded ? null : item.id)}
                      className="p-1 rounded text-muted hover:text-inherit hover:bg-surface-2 transition-all text-xs"
                      title={t("builder.actions.edit")}
                    >
                      {expanded ? "▲" : "▼"}
                    </button>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleDuplicate(item)}
                      className="p-1 rounded text-muted hover:text-primary hover:bg-surface-2 transition-all"
                      title={t("builder.actions.duplicate")}
                    >
                      ⧉
                    </button>
                    <button
                      onClick={() => handleMove(idx, "up")}
                      disabled={idx === 0}
                      className="p-1 rounded text-muted hover:text-inherit hover:bg-surface-2 disabled:opacity-20 transition-all"
                      title={t("builder.actions.moveUp")}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMove(idx, "down")}
                      disabled={idx === serviceSet.items.length - 1}
                      className="p-1 rounded text-muted hover:text-inherit hover:bg-surface-2 disabled:opacity-20 transition-all"
                      title={t("builder.actions.moveDown")}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleRemoveItem(item)}
                      className="p-1 rounded text-muted hover:text-red-400 hover:bg-surface-2 transition-all"
                      title={t("builder.actions.remove")}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-border">
                    {item.itemType === "countdown" && (
                      <CountdownSetItemEditor item={item} />
                    )}
                    {item.itemType === "web_view" && (
                      <WebViewSetItemEditor item={item} />
                    )}
                    {item.itemType === "media" && (
                      <MediaSetItemEditor item={item} />
                    )}
                    {item.itemType === "blank" && (
                      <BlankItemNotesEditor item={item} />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Song picker panel */}
      {showSongPicker && (
        <div className="border-t border-border flex flex-col h-64">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <input
              autoFocus
              type="search"
              value={songSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t("builder.songSearch")}
              className="flex-1 px-2 py-1.5 bg-surface border border-border rounded text-sm placeholder-muted focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => setShowSongPicker(false)}
              className="text-muted hover:text-inherit p-1"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filteredSongs.map((song) => (
              <button
                key={song.id}
                onClick={() => handleAddSong(song)}
                className="w-full text-left px-3 py-2 rounded hover:bg-surface-2 transition-colors"
              >
                <p className="text-sm">{song.title}</p>
                {song.artist && (
                  <p className="text-xs text-muted">{song.artist}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Media picker panel */}
      {showMediaPicker && (
        <div className="border-t border-border flex flex-col h-64">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <div className="flex gap-1">
              {(["all", "image", "video"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setMediaFilter(f)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    mediaFilter === f
                      ? "bg-primary text-white"
                      : "bg-surface-2 text-muted hover:bg-border"
                  }`}
                >
                  {f === "all"
                    ? t("builder.mediaFilter.all")
                    : f === "image"
                    ? t("builder.mediaFilter.image")
                    : t("builder.mediaFilter.video")}
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <button
              onClick={() => setShowMediaPicker(false)}
              className="text-muted hover:text-inherit p-1"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-2">
            {filteredMedia.length === 0 ? (
              <p className="col-span-3 text-center text-muted py-6 text-sm">
                {t("builder.noMedia")}
              </p>
            ) : (
              filteredMedia.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleAddMedia(m)}
                  className="flex flex-col rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                >
                  <div className="aspect-video bg-surface relative">
                    <img
                      src={`asset://localhost/media/${m.thumbnailFile ?? m.fileName}`}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {m.kind === "video" && (
                      <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1 rounded">
                        VIDEO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted truncate px-1 py-0.5">
                    {m.displayName}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-border space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => {
              setSongSearch("");
              setFilteredSongs(songs);
              setShowMediaPicker(false);
              setShowSongPicker((v) => !v);
            }}
            className="px-2 py-1.5 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors"
          >
            {t("builder.add.song")}
          </button>
          <button
            onClick={() => {
              setShowSongPicker(false);
              setMediaFilter("all");
              refreshMedia();
              setShowMediaPicker((v) => !v);
            }}
            className="px-2 py-1.5 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors text-blue-400"
          >
            {t("builder.add.media")}
          </button>
          <button
            onClick={handleAddCountdown}
            className="px-2 py-1.5 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors text-amber-400"
          >
            {t("builder.add.countdown")}
          </button>
          <button
            onClick={handleAddWebView}
            className="px-2 py-1.5 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors text-purple-400"
          >
            {t("builder.add.webView")}
          </button>
          <button
            onClick={handleAddBlank}
            className="px-2 py-1.5 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors text-muted"
          >
            {t("builder.add.blank")}
          </button>
        </div>
        <button
          onClick={handleLoadForPresentation}
          disabled={isLoading || serviceSet.items.length === 0}
          className="w-full px-3 py-2 text-sm bg-primary hover:bg-primary-hover text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {isLoading ? t("builder.loading") : t("builder.present")}
        </button>
      </div>
    </div>
  );
};
