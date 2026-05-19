import React, { useEffect } from "react";
import { openPresentationWindow, onSongsChanged } from "../../api/commands";
import { SongList } from "../../components/library/SongList";
import { useLibraryStore } from "../../stores/library";
import type { Song } from "../../types";

import { SongEditor } from "../../components/library/SongEditor";
import { PlainTextImport } from "../../components/import/PlainTextImport";
import { HolyricsImport } from "../../components/import/HolyricsImport";

export const OperatorApp: React.FC = () => {
  const { currentView, openEditor, setView, refresh } = useLibraryStore();

  useEffect(() => {
    const unlistenPromise = onSongsChanged(() => {
      useLibraryStore.getState().refresh();
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleSongClick = (song: Song) => {
    openEditor(song.id);
  };

  const handleOpenPresentation = async () => {
    try {
      await openPresentationWindow();
    } catch (err) {
      console.error("Falha ao abrir janela de apresentação:", err);
    }
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 shrink-0">
        <h1 className="text-base font-semibold">Trinity Lyrics</h1>
        <button
          onClick={handleOpenPresentation}
          className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors"
        >
          Open Presentation Window
        </button>
      </header>

      {/* Main content — state-based router */}
      <main className="flex-1 min-h-0">
        {currentView === "library" && (
          <SongList
            onSongClick={handleSongClick}
            onImportHolyrics={() => setView("import-holyrics")}
            onCreateSong={() => openEditor(undefined)}
          />
        )}

        {currentView === "editor" && <SongEditor />}

        {currentView === "import-text" && (
          <PlainTextImport
            onImported={(songId) => {
              refresh();
              openEditor(songId);
            }}
            onCancel={() => setView("library")}
          />
        )}

        {currentView === "import-holyrics" && (
          <HolyricsImport
            onDone={() => {
              refresh();
              setView("library");
            }}
            onCancel={() => setView("library")}
          />
        )}
      </main>
    </div>
  );
};
