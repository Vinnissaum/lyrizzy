import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  checkForUpdates,
  checkRestoreInProgress,
  clearOverlay,
  enterPresentation,
  exitPresentation,
  getOrCreateDefaultSet,
  loadSetForPresentation,
  onCountdownTriggered,
  onLocaleChanged,
  onPresentationLifecycle,
  onSettingChanged,
  onSetChanged,
  onSongsChanged,
  openPresentationWindow,
  updateSetItem,
} from "../../api/commands";
import { SongList } from "../../components/library/SongList";
import { SongEditor } from "../../components/library/SongEditor";
import { PlainTextImport } from "../../components/import/PlainTextImport";
import { HolyricsImport } from "../../components/import/HolyricsImport";
import { HomeSetBuilder } from "../../components/setbuilder/HomeSetBuilder";
import { SetBuilder } from "../../components/set/SetBuilder";
import { SetList } from "../../components/set/SetList";
import { OperatorPresentationLayout } from "../../components/presentation/OperatorPresentationLayout";
import { MediaLibrary } from "../../components/media/MediaLibrary";
import { BackupScreen } from "../../components/backup/BackupScreen";
import { SettingsScreen } from "../../components/settings/SettingsScreen";
import { RestoreInProgressDialog } from "../../components/backup/RestoreInProgressDialog";
import { UpdateBanner } from "../../components/system/UpdateBanner";
import { UpdateDialog } from "../../components/system/UpdateDialog";
import { SplashScreen } from "../../components/system/SplashScreen";
import {
  ScheduledCountdownWidget,
  type ArmedItemRef,
} from "../../components/system/ScheduledCountdownWidget";
import { CountdownScheduleModal } from "../../components/set/CountdownScheduleModal";
import { useLibraryStore } from "../../stores/library";
import { usePresentationStore } from "../../stores/presentation";
import { fanOutToMirror, reducePresentingOutputs } from "../../utils/outputDispatch";
import { useCountdownStore } from "../../stores/countdown";
import { useSetsStore } from "../../stores/sets";
import { useSettingsStore } from "../../stores/settings";
import { useKeyBindingsStore } from "../../stores/keyBindings";
import { installKeyboardDispatcher, isPresentationActive } from "../../runtime/keyboard";
import { findUpcomingScheduledCountdown } from "../../runtime/scheduledCountdown";
import type { OutputId, SetItem, Song, UpdateInfo } from "../../types";

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
  const focusedOutput = usePresentationStore((s) => s.focusedOutput);
  const { subscribe: subscribeCountdown } = useCountdownStore();
  const countdownState = useCountdownStore((s) => s.state);
  const { setLocale, loadLocale, loadPresentationSettings, loadTheme } = useSettingsStore();
  const { load: loadBindings, subscribe: subscribeBindings } = useKeyBindingsStore();

  const [showSplash, setShowSplash] = useState(true);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [editingScheduleItem, setEditingScheduleItem] = useState<{
    item: SetItem;
    setId: string;
    itemIndex: number;
  } | null>(null);

  // Which outputs currently have a presentation window open. Tracked from the
  // per-output `presentation_lifecycle` events so the operator stays in the
  // presentation layout while ANY screen presents — switching focus to an idle
  // Tela 2 must NOT unmount the operator (presState is only the focused output).
  const [presentingOutputs, setPresentingOutputs] = useState<Set<OutputId>>(
    new Set(),
  );
  const presentingOutputsRef = useRef<Set<OutputId>>(new Set());

  useEffect(() => {
    const unlistenSongs = onSongsChanged(() => {
      useLibraryStore.getState().refresh();
    });
    const unlistenSet = onSetChanged(() => {
      useSetsStore.getState().refresh();
    });
    const unlistenLocale = onLocaleChanged((locale) => {
      i18n.changeLanguage(locale);
      setLocale(locale);
    });
    const unlistenLifecycle = onPresentationLifecycle((phase, output) => {
      const next = reducePresentingOutputs(
        presentingOutputsRef.current,
        phase,
        output,
      );
      presentingOutputsRef.current = next;
      setPresentingOutputs(next);
      // Return to home only once EVERY output has exited — otherwise stopping
      // one screen while the other still presents would kick the operator out.
      if (phase === "exited" && next.size === 0) {
        useLibraryStore.getState().setView("home");
      }
    });
    // When a scheduled countdown reaches its start time, make sure the
    // presentation window is open and the configured item is in focus.
    const unlistenCdTrigger = onCountdownTriggered(async (payload) => {
      try {
        const presenting = isPresentationActive(
          usePresentationStore.getState().state,
        );
        if (presenting) {
          // Already presenting: the takeover overlay (takeover=true) now covers
          // the whole projector — including a live song — so there is nothing to
          // open and no need to move the underlying set position. The overlay
          // auto-clears at 00:00, restoring whatever was on the wall.
          return;
        }
        // Not presenting: replicate the "Present" button. Load the armed set
        // into the navigator first (otherwise jumpToItem fails with no slides),
        // open the projector, then jump to the countdown item so it underlies
        // the takeover overlay and shows once the overlay clears.
        const armed = useCountdownStore.getState().armedItem;
        const setId = armed?.setId ?? payload.setId;
        if (typeof setId === "string") {
          await loadSetForPresentation(setId);
        }
        await enterPresentation();
        const itemIndex = armed?.itemIndex ?? payload.itemIndex;
        if (typeof itemIndex === "number") {
          await usePresentationStore.getState().jumpToItem(itemIndex);
        }
      } catch (err) {
        console.error("countdown_triggered handler failed:", err);
      }
    });
    // Keep the operator's live preview in sync with global appearance changes.
    const unlistenSetting = onSettingChanged((key) => {
      if (key.startsWith("presentation.") || key.startsWith("announcement.")) {
        loadPresentationSettings();
      }
    });
    loadBindings();
    loadPresentationSettings();
    loadLocale();
    loadTheme();
    const unsubBindings = subscribeBindings();

    checkRestoreInProgress().then((v) => setRestoreInProgress(v)).catch(() => {});

    checkForUpdates(false)
      .then((info) => { if (info) setPendingUpdate(info); })
      .catch(() => {});

    loadFixedSet();

    // Silent re-arm at launch: if the fixed set has a countdown scheduled for
    // later today, arm it directly (no prompt). Arming makes the floating widget
    // appear; it doesn't take over until the wall-clock fire time.
    getOrCreateDefaultSet()
      .then((set) => {
        const hit = findUpcomingScheduledCountdown(set.items ?? [], Date.now());
        if (!hit) return;
        useCountdownStore.getState().arm({
          scheduledStart: hit.scheduledStart,
          durationMs: hit.durationMs,
          message: hit.message,
          endBehavior: hit.endBehavior,
          setId: set.id,
          itemIndex: hit.itemIndex,
        });
      })
      .catch(() => {});

    return () => {
      unlistenSongs.then((u) => u());
      unlistenSet.then((u) => u());
      unlistenLocale.then((u) => u());
      unlistenLifecycle.then((u) => u());
      unlistenCdTrigger.then((u) => u());
      unlistenSetting.then((u) => u());
      unsubBindings.then((u) => u());
    };
  }, []);

  // Presentation + countdown subscriptions follow the focused output, so the
  // operator's panes switch to whichever screen (Tela 1/2) is selected in
  // multi-screen mode. In single-screen mode focusedOutput stays "one", so this
  // runs once exactly like before.
  useEffect(() => {
    const unsubPresentation = subscribePresentation(focusedOutput);
    const unsubCountdown = subscribeCountdown(focusedOutput);
    return () => {
      unsubPresentation.then((u) => u());
      unsubCountdown.then((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedOutput]);

  useEffect(() => {
    const pres = usePresentationStore.getState;
    const cd = useCountdownStore.getState;

    // Unified exit handler (P10-02): clear the overlay if one is active,
    // otherwise run the `exitPresentation()` command (which closes the
    // presentation window and resets state to idle). Both the hardcoded Esc
    // and the user-rebindable `exitPresentation` action go through this, so
    // they behave identically — no more "rebindable exit leaves window open".
    const handleExit = () => {
      // Act on the focused output (read live to avoid a stale closure).
      const output = usePresentationStore.getState().focusedOutput;
      if (usePresentationStore.getState().state?.overlay) {
        clearOverlay(output).catch(console.error);
        fanOutToMirror(output, (o) => clearOverlay(o));
      } else {
        exitPresentation(output).catch(console.error);
        // Mirror (Simultânea): Esc/Stop exits BOTH screens.
        fanOutToMirror(output, (o) => exitPresentation(o));
      }
    };

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
        exitPresentation: () => handleExit(),
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
      },
      {
        getIsPresenting: () =>
          isPresentationActive(usePresentationStore.getState().state),
        onEscape: () => handleExit(),
        onF10: () => {
          const s = usePresentationStore.getState();
          s.setMode(s.state?.mode === "blank" ? "live" : "blank");
        },
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

  // Widget "Editar": resolve the SetItem from the fixed set and host the modal.
  const handleEditSchedule = async (armed: ArmedItemRef) => {
    try {
      const set = await getOrCreateDefaultSet();
      const item = (set.items ?? [])[armed.itemIndex];
      if (!item) return;
      setEditingScheduleItem({ item, setId: set.id, itemIndex: armed.itemIndex });
    } catch (err) {
      console.error("open schedule editor failed:", err);
    }
  };

  // Widget "Cancelar": the widget already calls reset(); here we only clear the
  // persisted schedule so a relaunch won't silently re-arm it.
  const handleCancelSchedule = async (armed: ArmedItemRef) => {
    try {
      const set = await getOrCreateDefaultSet();
      const item = (set.items ?? [])[armed.itemIndex];
      if (!item || !item.countdownConfig) return;
      await updateSetItem({
        id: item.id,
        countdownConfig: { ...item.countdownConfig, scheduledStart: undefined },
      });
    } catch (err) {
      console.error("clear persisted schedule failed:", err);
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
    currentView === "set-builder";

  const isMediaSection = currentView === "media";
  const isBackupSection = currentView === "backup";
  const isSettingsSection = currentView === "settings";

  // A counter-driven takeover seizes the projector without moving the
  // presentation `mode` off idle, so gate on it too — otherwise the operator
  // stays on its current view with no Stop button while the countdown is live.
  const countdownActive =
    !!countdownState.takeover && countdownState.mode !== "idle";

  const isPresenting =
    presState?.mode === "live" ||
    presState?.mode === "blank" ||
    presState?.mode === "frozen" ||
    countdownActive ||
    // Stay in the presentation layout while any screen presents, so focusing an
    // idle Tela 2 (whose state is Idle) doesn't unmount the operator UI.
    presentingOutputs.size > 0;

  return (
    <div className="h-screen bg-bg text-inherit flex flex-col">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

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

      {/* Global floating widget — shows in every view AND over the presentation
          layout while a countdown is armed (scheduled / running-takeover). */}
      <ScheduledCountdownWidget
        onEdit={handleEditSchedule}
        onCancel={handleCancelSchedule}
      />

      {editingScheduleItem && (
        <CountdownScheduleModal
          item={editingScheduleItem.item}
          setId={editingScheduleItem.setId}
          itemIndex={editingScheduleItem.itemIndex}
          onClose={() => setEditingScheduleItem(null)}
        />
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView("home")}
            disabled={isPresenting}
            title={isPresenting ? t("nav.lockedWhilePresenting") : undefined}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
              isHomeSection
                ? "bg-surface-2"
                : "text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {t("nav.home")}
          </button>
          <button
            onClick={() => setView("library")}
            disabled={isPresenting}
            title={isPresenting ? t("nav.lockedWhilePresenting") : undefined}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
              isLibrarySection
                ? "bg-surface-2"
                : "text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {t("nav.library")}
          </button>
          <button
            onClick={() => setView("media")}
            disabled={isPresenting}
            title={isPresenting ? t("nav.lockedWhilePresenting") : undefined}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
              isMediaSection
                ? "bg-surface-2"
                : "text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {t("nav.media")}
          </button>
          <button
            onClick={() => setView("backup")}
            disabled={isPresenting}
            title={isPresenting ? t("nav.lockedWhilePresenting") : undefined}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
              isBackupSection
                ? "bg-surface-2"
                : "text-muted hover:text-inherit hover:bg-surface-2"
            }`}
          >
            {t("nav.backup")}
          </button>
          <button
            onClick={() => setView("settings")}
            disabled={isPresenting}
            title={isPresenting ? t("nav.lockedWhilePresenting") : undefined}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
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
          <OperatorPresentationLayout />
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

            {currentView === "media" && <MediaLibrary />}

            {currentView === "backup" && <BackupScreen />}

            {currentView === "settings" && <SettingsScreen />}
          </>
        )}
      </main>
    </div>
  );
};
