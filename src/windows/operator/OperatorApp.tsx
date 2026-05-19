import React, { useEffect, useState } from "react";
import {
  checkRestoreInProgress,
  listMonitors,
  onSetChanged,
  onSongsChanged,
  openPresentationWindow,
} from "../../api/commands";
import { SongList } from "../../components/library/SongList";
import { SongEditor } from "../../components/library/SongEditor";
import { PlainTextImport } from "../../components/import/PlainTextImport";
import { HolyricsImport } from "../../components/import/HolyricsImport";
import { SetList } from "../../components/set/SetList";
import { SetBuilder } from "../../components/set/SetBuilder";
import { SlideController } from "../../components/presentation/SlideController";
import { CountdownPanel } from "../../components/countdown/CountdownPanel";
import { MediaLibrary } from "../../components/media/MediaLibrary";
import { BackupScreen } from "../../components/backup/BackupScreen";
import { RestoreInProgressDialog } from "../../components/backup/RestoreInProgressDialog";
import { useLibraryStore } from "../../stores/library";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import { useSetsStore } from "../../stores/sets";
import type { MonitorInfo, Song } from "../../types";

export const OperatorApp: React.FC = () => {
  const {
    currentView,
    editingSetId,
    openEditor,
    setView,
    refresh,
  } = useLibraryStore();
  const { state: presState, subscribe: subscribePresentation } = usePresentationStore();
  const { subscribe: subscribeCountdown } = useCountdownStore();

  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<number | undefined>(undefined);
  const [restoreInProgress, setRestoreInProgress] = useState(false);

  useEffect(() => {
    const unlistenSongs = onSongsChanged(() => {
      useLibraryStore.getState().refresh();
    });
    const unlistenSet = onSetChanged(() => {
      useSetsStore.getState().refresh();
    });
    const unsubPresentation = subscribePresentation();
    const unsubCountdown = subscribeCountdown();

    checkRestoreInProgress().then((v) => setRestoreInProgress(v)).catch(() => {});

    listMonitors()
      .then((ms) => {
        setMonitors(ms);
        // Pre-select the first non-primary monitor if available
        if (ms.length > 1) {
          setSelectedMonitor(1);
        }
      })
      .catch(() => {});

    return () => {
      unlistenSongs.then((u) => u());
      unlistenSet.then((u) => u());
      unsubPresentation.then((u) => u());
      unsubCountdown.then((u) => u());
    };
  }, []);

  const handleSongClick = (song: Song) => {
    openEditor(song.id);
  };

  const handleOpenPresentation = async () => {
    try {
      await openPresentationWindow(selectedMonitor);
    } catch (err) {
      console.error("Falha ao abrir janela de apresentação:", err);
    }
  };

  const isLibrarySection =
    currentView === "library" ||
    currentView === "editor" ||
    currentView === "import-text" ||
    currentView === "import-holyrics";

  const isSetSection =
    currentView === "sets" ||
    currentView === "set-builder" ||
    currentView === "set-player";

  const isCountdownSection = currentView === "countdown";
  const isMediaSection = currentView === "media";
  const isBackupSection = currentView === "backup";

  const serviceSet = presState?.set;

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {restoreInProgress && (
        <RestoreInProgressDialog onDismissed={() => setRestoreInProgress(false)} />
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView("library")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isLibrarySection
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            Biblioteca
          </button>
          <button
            onClick={() => setView("sets")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isSetSection
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            Conjuntos
          </button>
          <button
            onClick={() => setView("countdown")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isCountdownSection
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            Cronômetro
          </button>
          <button
            onClick={() => setView("media")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isMediaSection
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            Mídia
          </button>
          <button
            onClick={() => setView("backup")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isBackupSection
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            Backup
          </button>
        </div>

        {/* Monitor selector + open window button */}
        <div className="flex items-center gap-2">
          {monitors.length > 1 && (
            <select
              value={selectedMonitor ?? ""}
              onChange={(e) =>
                setSelectedMonitor(
                  e.target.value === "" ? undefined : Number(e.target.value)
                )
              }
              className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
            >
              {monitors.map((m, i) => (
                <option key={i} value={i}>
                  {m.name ?? `Monitor ${i + 1}`} ({m.width}×{m.height})
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleOpenPresentation}
            className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors"
          >
            Janela de Apresentação
          </button>
        </div>
      </header>

      {/* Main content */}
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

        {currentView === "sets" && <SetList />}

        {currentView === "set-builder" && (
          <SetBuilder setId={editingSetId} />
        )}

        {currentView === "set-player" && serviceSet ? (
          <SlideController serviceSet={serviceSet} />
        ) : currentView === "set-player" ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            Nenhum conjunto carregado.
          </div>
        ) : null}

        {currentView === "countdown" && <CountdownPanel />}

        {currentView === "media" && <MediaLibrary />}

        {currentView === "backup" && <BackupScreen />}
      </main>
    </div>
  );
};
