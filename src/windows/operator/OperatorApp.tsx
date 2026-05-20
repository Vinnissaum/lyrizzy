import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  checkRestoreInProgress,
  getSetting,
  onLocaleChanged,
  onSetChanged,
  onSongsChanged,
  openPresentationWindow,
  openStageWindow,
} from "../../api/commands";
import { SongList } from "../../components/library/SongList";
import { SongEditor } from "../../components/library/SongEditor";
import { PlainTextImport } from "../../components/import/PlainTextImport";
import { HolyricsImport } from "../../components/import/HolyricsImport";
import { SetList } from "../../components/set/SetList";
import { SetBuilder } from "../../components/set/SetBuilder";
import { SlideController } from "../../components/presentation/SlideController";
import { OperatorNotesPanel } from "../../components/presentation/OperatorNotesPanel";
import { CountdownPanel } from "../../components/countdown/CountdownPanel";
import { MediaLibrary } from "../../components/media/MediaLibrary";
import { BackupScreen } from "../../components/backup/BackupScreen";
import { SettingsScreen } from "../../components/settings/SettingsScreen";
import { RestoreInProgressDialog } from "../../components/backup/RestoreInProgressDialog";
import { useLibraryStore } from "../../stores/library";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import { useSetsStore } from "../../stores/sets";
import { useSettingsStore } from "../../stores/settings";
import { useKeyBindingsStore } from "../../stores/keyBindings";
import { useThemeStore } from "../../stores/theme";
import { installKeyboardDispatcher } from "../../runtime/keyboard";
import type { Song } from "../../types";

async function loadPersistedMonitor(key: string): Promise<number | undefined> {
  try {
    const val = await getSetting(key);
    const idx = parseInt(val, 10);
    return isNaN(idx) ? undefined : idx;
  } catch {
    return undefined;
  }
}

export const OperatorApp: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    currentView,
    editingSetId,
    openEditor,
    setView,
    refresh,
  } = useLibraryStore();
  const { state: presState, subscribe: subscribePresentation } = usePresentationStore();
  const { subscribe: subscribeCountdown } = useCountdownStore();
  const { setLocale } = useSettingsStore();
  const { load: loadBindings, subscribe: subscribeBindings } = useKeyBindingsStore();
  const { load: loadTheme } = useThemeStore();

  const [presentationMonitorIdx, setPresentationMonitorIdx] = useState<number | undefined>(undefined);
  const [stageMonitorIdx, setStageMonitorIdx] = useState<number | undefined>(undefined);
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
    const unlistenLocale = onLocaleChanged((locale) => {
      i18n.changeLanguage(locale);
      setLocale(locale);
    });
    loadBindings();
    const unsubBindings = subscribeBindings();
    loadTheme();

    checkRestoreInProgress().then((v) => setRestoreInProgress(v)).catch(() => {});

    loadPersistedMonitor("window.presentation.monitor").then(setPresentationMonitorIdx);
    loadPersistedMonitor("window.stage.monitor").then(setStageMonitorIdx);

    return () => {
      unlistenSongs.then((u) => u());
      unlistenSet.then((u) => u());
      unsubPresentation.then((u) => u());
      unsubCountdown.then((u) => u());
      unlistenLocale.then((u) => u());
      unsubBindings.then((u) => u());
    };
  }, []);

  useEffect(() => {
    const pres = usePresentationStore.getState;
    const cd = useCountdownStore.getState;

    const uninstall = installKeyboardDispatcher(
      () => useKeyBindingsStore.getState().bindings,
      {
        advanceSlide: () => pres().next(),
        previousSlide: () => pres().prev(),
        blank: () => {
          const mode = pres().state?.mode;
          pres().setMode(mode === "blank" ? "live" : "blank");
        },
        freeze: () => {
          const mode = pres().state?.mode;
          pres().setMode(mode === "frozen" ? "live" : "frozen");
        },
        exitPresentation: () => pres().setMode("idle"),
        jumpToItem1: () => pres().jumpToItem(0),
        jumpToItem2: () => pres().jumpToItem(1),
        jumpToItem3: () => pres().jumpToItem(2),
        jumpToItem4: () => pres().jumpToItem(3),
        jumpToItem5: () => pres().jumpToItem(4),
        jumpToItem6: () => pres().jumpToItem(5),
        jumpToItem7: () => pres().jumpToItem(6),
        jumpToItem8: () => pres().jumpToItem(7),
        jumpToItem9: () => pres().jumpToItem(8),
        countdownPause: () => {
          const { state: cdState } = cd();
          if (cdState.mode === "running") {
            cd().pause();
          } else if (cdState.mode === "paused") {
            cd().start();
          }
        },
        openPresentationWindow: () => handleOpenPresentation(),
        focusSearch: () =>
          window.dispatchEvent(new CustomEvent("app:focus-search")),
      }
    );
    return uninstall;
  }, []);

  const handleSongClick = (song: Song) => {
    openEditor(song.id);
  };

  const handleOpenPresentation = async () => {
    try {
      await openPresentationWindow(presentationMonitorIdx);
    } catch (err) {
      console.error("open presentation window failed:", err);
    }
  };

  const handleOpenStage = async () => {
    try {
      await openStageWindow(stageMonitorIdx);
    } catch (err) {
      console.error("open stage window failed:", err);
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
  const isSettingsSection = currentView === "settings";

  const serviceSet = presState?.set;

  return (
    <div className="h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col">
      {restoreInProgress && (
        <RestoreInProgressDialog onDismissed={() => setRestoreInProgress(false)} />
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView("library")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isLibrarySection
                ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
            }`}
          >
            {t("nav.library")}
          </button>
          <button
            onClick={() => setView("sets")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isSetSection
                ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
            }`}
          >
            {t("nav.sets")}
          </button>
          <button
            onClick={() => setView("countdown")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isCountdownSection
                ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
            }`}
          >
            {t("nav.countdown")}
          </button>
          <button
            onClick={() => setView("media")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isMediaSection
                ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
            }`}
          >
            {t("nav.media")}
          </button>
          <button
            onClick={() => setView("backup")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isBackupSection
                ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
            }`}
          >
            {t("nav.backup")}
          </button>
          <button
            onClick={() => setView("settings")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isSettingsSection
                ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
            }`}
          >
            {t("nav.settings")}
          </button>
        </div>

        {/* Window buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenPresentation}
            className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors"
          >
            {t("nav.presentationWindow")}
          </button>
          <button
            onClick={handleOpenStage}
            className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-lg font-medium transition-colors"
          >
            {t("nav.stageWindow")}
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
          <div className="flex h-full overflow-hidden">
            <div className="flex-1 min-w-0 overflow-hidden">
              <SlideController serviceSet={serviceSet} />
            </div>
            <OperatorNotesPanel />
          </div>
        ) : currentView === "set-player" ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            {t("presentation.noSetLoaded")}
          </div>
        ) : null}

        {currentView === "countdown" && <CountdownPanel />}

        {currentView === "media" && <MediaLibrary />}

        {currentView === "backup" && <BackupScreen />}

        {currentView === "settings" && <SettingsScreen />}
      </main>
    </div>
  );
};
