import React, { useEffect, useRef, useState } from "react";
import {
  addSetItem,
  getSet,
  loadSetForPresentation,
  onSetChanged,
  removeSetItem,
  reorderSetItems,
  updateSet,
} from "../../api/commands";
import { useLibraryStore } from "../../stores/library";
import { usePresentationStore } from "../../stores/presentation";
import { listSongs } from "../../api/commands";
import type { ServiceSet, SetItem, Song } from "../../types";

interface Props {
  setId: string | null;
}

export const SetBuilder: React.FC<Props> = ({ setId }) => {
  const { setView } = useLibraryStore();
  const [serviceSet, setServiceSet] = useState<ServiceSet | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songSearch, setSongSearch] = useState("");
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showSongPicker, setShowSongPicker] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSet = async () => {
    if (!setId) return;
    try {
      const s = await getSet(setId);
      setServiceSet(s);
      setNameInput(s.name);
    } catch (err) {
      console.error("Falha ao carregar conjunto:", err);
    }
  };

  const loadSongs = async () => {
    try {
      const result = await listSongs();
      setSongs(result);
      setFilteredSongs(result);
    } catch (err) {
      console.error("Falha ao carregar músicas:", err);
    }
  };

  useEffect(() => {
    loadSet();
    loadSongs();
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
      console.error("Falha ao atualizar nome:", err);
    }
  };

  const handleAddSong = async (song: Song) => {
    if (!serviceSet) return;
    try {
      await addSetItem({ setId: serviceSet.id, itemType: "song", songId: song.id });
      setShowSongPicker(false);
    } catch (err) {
      console.error("Falha ao adicionar música:", err);
    }
  };

  const handleRemoveItem = async (item: SetItem) => {
    try {
      await removeSetItem(item.id);
    } catch (err) {
      console.error("Falha ao remover item:", err);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (!serviceSet) return;
    const items = [...serviceSet.items];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    try {
      await reorderSetItems(
        serviceSet.id,
        items.map((i) => i.id)
      );
    } catch (err) {
      console.error("Falha ao reordenar:", err);
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
      console.error("Falha ao carregar apresentação:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const songById = (id?: string) => songs.find((s) => s.id === id);

  if (!serviceSet) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setView("sets")}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors"
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
                className="flex-1 px-2 py-1 bg-gray-800 border border-blue-500 rounded text-sm text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition-colors"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingName(false);
                  setNameInput(serviceSet.name);
                }}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex-1 text-left text-base font-semibold hover:text-blue-400 transition-colors"
              title="Clique para renomear"
            >
              {serviceSet.name}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 pl-7">
          {serviceSet.items.length} {serviceSet.items.length === 1 ? "item" : "itens"}
        </p>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {serviceSet.items.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8">
            Adicione músicas com o botão abaixo.
          </p>
        ) : (
          serviceSet.items.map((item, idx) => {
            const song = item.itemType === "song" ? songById(item.songId) : undefined;
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 group"
              >
                <span className="text-xs text-gray-500 w-5 text-right shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  {item.itemType === "song" ? (
                    <>
                      <p className="text-sm font-medium text-white truncate">
                        {song?.title ?? "(música removida)"}
                      </p>
                      {song?.artist && (
                        <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Tela em branco</p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleMove(idx, "up")}
                    disabled={idx === 0}
                    className="p-1 rounded text-gray-500 hover:text-white hover:bg-gray-700 disabled:opacity-20 transition-all"
                    title="Mover para cima"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMove(idx, "down")}
                    disabled={idx === serviceSet.items.length - 1}
                    className="p-1 rounded text-gray-500 hover:text-white hover:bg-gray-700 disabled:opacity-20 transition-all"
                    title="Mover para baixo"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleRemoveItem(item)}
                    className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-all"
                    title="Remover"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Song picker panel */}
      {showSongPicker && (
        <div className="border-t border-gray-700 flex flex-col h-64">
          <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2">
            <input
              autoFocus
              type="search"
              value={songSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Pesquisar música…"
              className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setShowSongPicker(false)}
              className="text-gray-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filteredSongs.map((song) => (
              <button
                key={song.id}
                onClick={() => handleAddSong(song)}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                <p className="text-sm text-white">{song.title}</p>
                {song.artist && (
                  <p className="text-xs text-gray-400">{song.artist}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-gray-700 flex gap-2">
        <button
          onClick={() => {
            setSongSearch("");
            setFilteredSongs(songs);
            setShowSongPicker((v) => !v);
          }}
          className="flex-1 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
        >
          + Adicionar música
        </button>
        <button
          onClick={handleLoadForPresentation}
          disabled={isLoading || serviceSet.items.length === 0}
          className="flex-1 px-3 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {isLoading ? "Carregando…" : "Apresentar"}
        </button>
      </div>
    </div>
  );
};
