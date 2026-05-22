import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  checkForUpdates,
  checkRestoreInProgress,
  clearOverlay,
  onLocaleChanged,
  onPresentationLifecycle,
  onSetChanged,
  onSongsChanged,
  openPresentationWindow,
} from "../../api/commands";
import { SongList } from "../../components/library/SongList";
import { SongEditor } from "../../components/library/SongEditor";
import { PlainTextImport } from "../../components/import/PlainTextImport";
import { HolyricsImport } from "../../components/import/HolyricsImport";
import { HomeSetBuilder } from "../../components/setbuilder/HomeSetBuilder";
import { SetBuilder } from "../../components/set/SetBuilder";
import { SetList } from "../../components/set/SetList";
import { SlideController } from "../../components/presentation/SlideController";
import { OperatorNotesPanel } from "../../components/presentation/OperatorNotesPanel";
import { PresentationNavigator } from "../../components/presentation/PresentationNavigator";
import { CountdownPanel } from "../../components/countdown/CountdownPanel";
import { MediaLibrary } from "../../components/media/MediaLibrary";
import { BackupScreen } from "../../components/backup/BackupScreen";
import { SettingsScreen } from "../../components/settings/SettingsScreen";
import { RestoreInProgressDialog } from "../../components/backup/RestoreInProgressDialog";
import { UpdateBanner } from "../../components/system/UpdateBanner";
import { UpdateDialog } from "../../components/system/UpdateDialog";
import { useLibraryStore } from "../../stores/library";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import { useSetsStore } from "../../stores/sets";
import { useSettingsStore } from "../../stores/settings";
import { useKeyBindingsStore } from "../../stores/keyBindings";
import { useThemeStore } from "../../stores/theme";
import { installKeyboardDispatcher } from "../../runtime/keyboard";
import type { Song, UpdateInfo } from "../../types";

export const OperatorApp: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    currentView,
    editingSetId,
    openEditor,
    setView,
    refresh,
    loadFixedSet,
  } = useLibraryStore();
  const { state: presState, subscribe: subscribePresentation } = usePresentationStore();
  const { subscribe: subscribeCountdown } = useCountdownStore();
  const { setLocale } = useSettingsStore();
  const { load: loadBindings, subscribe: subscribeBindings } = useKeyBindingsStore();
  const { load: loadTheme } = useThemeStore();

  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

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
    const unlistenLifecycle = onPresentationLifecycle((phase) => {
      if (phase === "exited") {
        useLibraryStore.getState().setView("home");
      }
    });
    loadBindings();
    const unsubBindings = subscribeBindings();
    loadTheme();

    checkRestoreInProgress().then((v) => setRestoreInProgress(v)).catch(() => {});

    checkForUpdates(false)
      .then((info) => { if (info) setPendingUpdate(info); })
      .catch(() => {});

    loadFixedSet();

    return () => {
      unlistenSongs.then((u) => u());
      unlistenSet.then((u) => u());
      unsubPresentation.then((u) => u());
      unsubCountdown.then((u) => u());
      unlistenLocale.then((u) => u());
      unlistenLifecycle.then((u) => u());
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
        exitPresentation: () => {
          if (usePresentationStore.getState().state?.overlay) {
            clearOverlay().catch(console.error);
          } else {
            pres().setMode("idle");
          }
        },
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
      await openPresentationWindow();
    } catch (err) {
      console.error("open presentation window failed:", err);
    }
  };

  const isLibrarySection =
    currentView === "library" ||
    currentView === "editor" ||
    currentView === "import-text" ||
    currentView === "import-holyrics";

  const isHomeSection =
    currentView === "home" ||
    currentView === "sets" ||
    currentView === "set-builder" ||
    currentView === "set-player";

  const isCountdownSection = currentView === "countdown";
  const isMediaSection = currentView === "media";
  const isBackupSection = currentView === "backup";
  const isSettingsSection = currentView === "settings";

  const serviceSet = presState?.set;
  const isPresenting =
    presState?.mode === "live" ||
    presState?.mode === "blank" ||
    presState?.mode === "frozen";

  return (
    <div className="h-screen bg-bg text-inherit flex flex-col">
      {restoreInProgress && (
        <RestoreInProgressDialog onDismissed={() => setRestoreInProgress(false)} />
      )}

      {pendingUpdate && !updateDismissed && (
        <UpdateBanner
          update={pendingUpdate}
          onDismiss={() => setUpdateDismissed(true)}
          onUpdate={() => setShowUpdateDialog(true)}
        />
      )}

      {showUpdateDialog && pendingUpdate && (
        <UpdateDialog
          update={pendingUpdate}
          onClose={() => setShowUpdateDialog(false)}
        />
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView("home")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isHomeSection
                ? "bg-surface-2"
                : "text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {t("nav.home")}
          </button>
          <button
            onClick={() => setView("library")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isLibrarySection
                ? "bg-surface-2"
                : "text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {t("nav.library")}
          </button>
          <button
            onClick={() => setView("countdown")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isCountdownSection
                ? "bg-surface-2"
                : "text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {t("nav.countdown")}
          </button>
          <button
            onClick={() => setView("media")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isMediaSection
                ? "bg-surface-2"
                : "text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {t("nav.media")}
          </button>
          <button
            onClick={() => setView("backup")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isBackupSection
                ? "bg-surface-2"
                : "text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {t("nav.backup")}
          </button>
          <button
            onClick={() => setView("settings")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isSettingsSection
                ? "bg-surface-2"
                : "text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {t("nav.settings")}
          </button>
        </div>

      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0">
        {isPresenting ? (
          <PresentationNavigator />
        ) : (
          <>
            {currentView === "home" && <HomeSetBuilder />}

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
              <div className="h-full flex items-center justify-center text-muted text-sm">
                {t("presentation.noSetLoaded")}
              </div>
            ) : null}

            {currentView === "countdown" && <CountdownPanel />}

            {currentView === "media" && <MediaLibrary />}

            {currentView === "backup" && <BackupScreen />}

            {currentView === "settings" && <SettingsScreen />}
          </>
        )}
      </main>
    </div>
  );
};
