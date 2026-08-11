import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Pencil } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  clearOverlay,
  enterPresentation,
  exitPresentation,
  getPresentationState,
  getSetting,
  importPresentation,
  loadSetForPresentation,
  OUTPUT2_LAST_SET_KEY,
  setAnnouncementOverlay,
  setMediaOverlay,
  setSetting,
  addSetItem,
} from "../../api/commands";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { useSettingsStore } from "../../stores/settings";
import { useSetsStore } from "../../stores/sets";
import { fanOutToMirror } from "../../utils/outputDispatch";
import { OutputSwitcher } from "./OutputSwitcher";
import { OutputLaunchModal } from "./OutputLaunchModal";
import { MicSwitch } from "./MicSwitch";
import { StreamProfileSwitcher } from "./StreamProfileSwitcher";
import { mediaUrl } from "../../api/assets";
import { OverlayActionBar } from "./OverlayActionBar";
import { itemLabel, songArtist } from "./itemMeta";
import { SetItemList } from "./SetItemList";
import { StrophesGrid } from "./StrophesGrid";
import { LivePreview } from "./LivePreview";
import { LiveSongEditModal } from "./LiveSongEditModal";
import type { OutputId } from "../../types";

export const OperatorPresentationLayout: React.FC<{
  /** Outputs that currently have a live presentation window (from OperatorApp).
   *  Drives whether clicking a screen tab opens the launch modal. */
  presentingOutputs?: ReadonlySet<OutputId>;
}> = ({ presentingOutputs }) => {
  const { t } = useTranslation();
  const state = usePresentationStore((s) => s.state);
  const focusedOutput = usePresentationStore((s) => s.focusedOutput);
  const setFocusedOutput = usePresentationStore((s) => s.setFocusedOutput);
  const multiScreenEnabled = useSettingsStore((s) => s.multiScreenEnabled);
  const mirrorEnabled = useSettingsStore((s) => s.mirrorEnabled);
  const sets = useSetsStore((s) => s.sets);
  const refreshSets = useSetsStore((s) => s.refresh);
  const { songs, refresh: refreshSongs } = useLibraryStore();
  const { media, refresh: refreshMedia } = useMediaStore();
  const { fixedSetId } = useLibraryStore();

  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");

  const [showMediaPicker, setShowMediaPicker] = useState(false);
  // Force the set picker open even when a set is already loaded (the "change
  // set" button), so Tela 2 can be pointed at a different service if needed.
  const [showSetPicker, setShowSetPicker] = useState(false);

  const [isImportingPresentation, setIsImportingPresentation] = useState(false);

  // Song id currently open in the live editor overlay, if any. Local to the
  // operator layout — the presentation window is never involved (read-only
  // invariant).
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  // Which output the launch modal is confirming, if any. Opened from an
  // OutputSwitcher tab whose screen is not presenting yet.
  const [launchOutput, setLaunchOutput] = useState<OutputId | null>(null);

  // Close the launch modal. On cancel (no presentation started) return focus to
  // Tela 1, since opening the modal had switched focus to the target screen. On
  // a successful launch keep focus on that screen so the operator can drive it.
  const closeLaunchModal = (launched?: boolean) => {
    setLaunchOutput(null);
    if (!launched) setFocusedOutput("one");
  };

  const announcementRef = useRef<HTMLTextAreaElement>(null);
  const autoLoadedTwoRef = useRef(false);

  useEffect(() => {
    refreshMedia();
    // The library store stays empty on the home→present path (the home screen
    // keeps its own local song list), so song items would label as "—". Pull
    // them once when entering the operator presentation view.
    if (songs.length === 0) refreshSongs();
    // Multi-screen: the per-output set picker needs the list of sets.
    if (multiScreenEnabled) refreshSets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load a chosen set onto the focused output and open its window (multi-screen).
  const handlePickSet = async (setId: string) => {
    setShowSetPicker(false);
    try {
      await loadSetForPresentation(setId, focusedOutput);
      if (focusedOutput === "two") {
        setSetting(OUTPUT2_LAST_SET_KEY, setId).catch(() => {});
      }
      // Direct enterPresentation (not useRequestPresentation): this switches an
      // already-open output to a chosen set, it does not launch a fresh
      // presentation, so the multi-screen launch policy does not apply here.
      await enterPresentation(focusedOutput);
    } catch (err) {
      console.error("load set for output failed:", err);
    }
    // Mirror (Simultânea): the chosen set also drives the other screen — again a
    // mirror of an existing session, not a fresh launch, so no launch policy.
    fanOutToMirror(focusedOutput, (o) =>
      loadSetForPresentation(setId, o).then(() => enterPresentation(o)),
    );
  };

  // When the operator focuses Tela 2 and it has no set yet, default it to the
  // SAME service set as Tela 1 so its item list (sub-sections) is immediately
  // there to choose from — the operator can still load a different set via the
  // "change set" button. Falls back to Tela 2's last-presented set if Tela 1 has
  // none. Loads into the operator view only (no window open until Present).
  useEffect(() => {
    if (!multiScreenEnabled || focusedOutput !== "two") {
      autoLoadedTwoRef.current = false;
      return;
    }
    if (state?.set || autoLoadedTwoRef.current) return;
    autoLoadedTwoRef.current = true;
    getPresentationState("one")
      .then((one) => {
        if (one?.set) return loadSetForPresentation(one.set.id, "two");
        return getSetting(OUTPUT2_LAST_SET_KEY).then((setId) => {
          if (setId) return loadSetForPresentation(setId, "two");
        });
      })
      .catch(() => {});
  }, [multiScreenEnabled, focusedOutput, state?.set]);

  const items = state?.set?.items ?? [];
  const currentItemIndex = state?.currentItemIndex ?? 0;
  const activeItem = items[currentItemIndex];
  const activeItemLabel = activeItem
    ? itemLabel(activeItem, songs, media)
    : "—";
  const activeItemArtist = activeItem ? songArtist(activeItem, songs) : undefined;

  const ensurePresentation = async () => {
    try {
      // Direct enterPresentation here too: just makes sure the already-running
      // output's window is open for an overlay, not a fresh launch — no policy.
      await enterPresentation(focusedOutput);
    } catch (err) {
      console.error("open presentation window failed:", err);
    }
  };

  const handleOferta = () => {
    refreshMedia();
    setShowMediaPicker(true);
  };

  const handleSelectMediaOverlay = async (mediaId: string) => {
    setShowMediaPicker(false);
    await ensurePresentation();
    try {
      await setMediaOverlay(mediaId, focusedOutput);
    } catch (err) {
      console.error("set media overlay failed:", err);
    }
    fanOutToMirror(focusedOutput, (o) => setMediaOverlay(mediaId, o));
  };

  const handleAvisoClick = () => {
    setAnnouncementText("");
    setShowAnnouncementDialog(true);
    setTimeout(() => announcementRef.current?.focus(), 50);
  };

  const handleConfirmAnnouncement = async () => {
    const text = announcementText.trim();
    if (!text) return;
    setShowAnnouncementDialog(false);
    setAnnouncementText("");
    await ensurePresentation();
    try {
      await setAnnouncementOverlay(text, focusedOutput);
    } catch (err) {
      console.error("set announcement overlay failed:", err);
    }
    fanOutToMirror(focusedOutput, (o) => setAnnouncementOverlay(text, o));
  };

  const handleClearOverlay = async () => {
    try {
      await clearOverlay(focusedOutput);
    } catch (err) {
      console.error("clear overlay failed:", err);
    }
    fanOutToMirror(focusedOutput, (o) => clearOverlay(o));
  };

  // Toggle blackout (blank mode) — same behavior as the F10 shortcut.
  const handleBlackout = () => {
    const pres = usePresentationStore.getState();
    pres.setMode(pres.state?.mode === "blank" ? "live" : "blank");
  };

  // Stop presentation — same behavior as pressing Esc in operator mode.
  const handleStop = () => {
    exitPresentation(focusedOutput).catch((err) =>
      console.error("exit presentation failed:", err),
    );
    // Mirror (Simultânea): Stop exits BOTH screens.
    fanOutToMirror(focusedOutput, (o) => exitPresentation(o));
    // Clear any open live editor so it doesn't survive as an orphaned overlay.
    setEditingSongId(null);
  };

  const handleImportPresentation = async () => {
    if (!fixedSetId) return;
    const selected = await open({
      title: t("media.slideshow.import"),
      filters: [{ name: "Presentation", extensions: ["pptx", "ppt", "pdf"] }],
      multiple: false,
    });
    if (!selected) return;
    setIsImportingPresentation(true);
    try {
      const imported = await importPresentation(selected as string);
      await addSetItem({
        setId: fixedSetId,
        itemType: "slide_show",
        mediaId: imported.id,
      });
    } catch (err) {
      console.error("import presentation failed:", err);
    } finally {
      setIsImportingPresentation(false);
    }
  };

  if (!state?.set || state.set.items.length === 0) {
    return (
      <div data-testid="operator-presentation-layout" className="flex flex-col h-full">
        <OutputSwitcher
          presentingOutputs={presentingOutputs}
          onRequestLaunch={setLaunchOutput}
        />
        <MicSwitch />
        <StreamProfileSwitcher />
        {multiScreenEnabled ? (
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-xs text-muted mb-2">
              {mirrorEnabled
                ? t("presentation.output.choosePromptBoth")
                : t("presentation.output.choosePrompt", {
                    n: focusedOutput === "one" ? 1 : 2,
                  })}
            </p>
            {sets.length === 0 ? (
              <p className="text-center text-muted py-8 text-sm">
                {t("presentation.empty")}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {sets.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => handlePickSet(st.id)}
                    className="px-3 py-2 text-sm text-left rounded-lg bg-surface-2 hover:bg-border transition-colors truncate"
                  >
                    {st.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted text-sm">
            {t("presentation.empty")}
          </div>
        )}
        {launchOutput && (
          <OutputLaunchModal output={launchOutput} onClose={closeLaunchModal} />
        )}
      </div>
    );
  }

  const imageMedia = media.filter((m) => m.kind === "image");

  return (
    <div data-testid="operator-presentation-layout" className="flex flex-col h-full">
      <OutputSwitcher
        presentingOutputs={presentingOutputs}
        onRequestLaunch={setLaunchOutput}
      />
      <MicSwitch />
      <OverlayActionBar
        showApresentarButton={false}
        onOferta={handleOferta}
        onAviso={handleAvisoClick}
        onPdf={handleImportPresentation}
        onClearOverlay={handleClearOverlay}
        onBlackout={handleBlackout}
        onStop={handleStop}
        isBlackoutActive={state?.mode === "blank"}
        isOverlayActive={!!state?.overlay}
        isImportingPresentation={isImportingPresentation}
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr] md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_320px] gap-2 flex-1 overflow-hidden">
        {/* Set pane */}
        <div className="flex flex-col overflow-hidden">
          <header className="flex items-center justify-between text-xs text-muted px-2 py-1">
            <span>{t("presentation.pane.set")}</span>
            {multiScreenEnabled && (
              <button
                type="button"
                onClick={() => {
                  refreshSets();
                  setShowSetPicker(true);
                }}
                className="text-xs text-primary hover:underline"
              >
                {t("presentation.output.changeSet")}
              </button>
            )}
          </header>
          <div className="flex-1 overflow-hidden">
            <SetItemList />
          </div>
        </div>

        {/* Strophes pane */}
        <div className="flex flex-col overflow-hidden">
          <header className="flex items-center justify-between text-xs text-muted px-2 py-1">
            <span>
              {t("presentation.pane.strophes")} — {activeItemLabel}
              {activeItemArtist ? ` — ${activeItemArtist}` : ""}
            </span>
            <button
              type="button"
              data-testid="live-edit-button"
              disabled={activeItem?.itemType !== "song"}
              onClick={() => {
                if (activeItem?.itemType === "song") {
                  setEditingSongId(activeItem.songId);
                }
              }}
              aria-label={t("presentation.liveEdit.button")}
              title={t("presentation.liveEdit.button")}
              className="text-muted hover:text-inherit disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Pencil size={14} />
            </button>
          </header>
          <div className="flex-1 overflow-hidden">
            <StrophesGrid />
          </div>
        </div>

        {/* Live preview pane (hidden on small screens) */}
        <div className="hidden lg:flex flex-col overflow-hidden">
          <header className="text-xs text-muted px-2 py-1">
            {t("presentation.pane.live")}
          </header>
          <div data-testid="live-pane" className="flex-1 p-2">
            <LivePreview />
          </div>
        </div>
      </div>

      {/* Announcement dialog */}
      {showAnnouncementDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface rounded-xl shadow-2xl w-96 flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">{t("home.overlay.announcementTitle")}</h3>
            </div>
            <div className="p-4">
              <textarea
                ref={announcementRef}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    handleConfirmAnnouncement();
                  }
                  if (e.key === "Escape") {
                    setShowAnnouncementDialog(false);
                  }
                }}
                placeholder={t("home.overlay.announcementPlaceholder")}
                className="w-full h-28 px-3 py-2 bg-surface-2 border border-border rounded text-sm resize-none focus:outline-none focus:border-primary placeholder-muted"
              />
            </div>
            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setShowAnnouncementDialog(false)}
                className="px-4 py-2 text-sm rounded-lg bg-surface-2 hover:bg-border transition-colors"
              >
                {t("home.overlay.cancel")}
              </button>
              <button
                onClick={handleConfirmAnnouncement}
                disabled={!announcementText.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-fg-on-primary font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("home.overlay.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set picker (change which set the focused screen presents) */}
      {showSetPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-surface rounded-xl shadow-2xl w-[520px] max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">
                {t("presentation.output.choosePrompt", {
                  n: focusedOutput === "one" ? 1 : 2,
                })}
              </h3>
              <button
                onClick={() => setShowSetPicker(false)}
                className="text-muted hover:text-inherit"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {sets.length === 0 ? (
                <p className="col-span-2 text-center text-muted py-8 text-sm">
                  {t("presentation.empty")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {sets.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => handlePickSet(st.id)}
                      className="px-3 py-2 text-sm text-left rounded-lg bg-surface-2 hover:bg-border transition-colors truncate"
                    >
                      {st.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Media picker (image overlay) */}
      {showMediaPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-surface rounded-xl shadow-2xl w-[520px] max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">{t("home.overlay.selectMedia")}</h3>
              <button
                onClick={() => setShowMediaPicker(false)}
                className="text-muted hover:text-inherit"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2">
              {imageMedia.length === 0 ? (
                <p className="col-span-3 text-center text-muted py-8 text-sm">
                  {t("media.picker.noMedia")}
                </p>
              ) : (
                imageMedia.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMediaOverlay(m.id)}
                    className="flex flex-col rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                  >
                    <div className="aspect-video bg-surface-2 relative">
                      <img
                        src={mediaUrl(m.thumbnailFile ?? m.fileName)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted truncate px-1 py-0.5">
                      {m.displayName}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {launchOutput && (
        <OutputLaunchModal output={launchOutput} onClose={closeLaunchModal} />
      )}

      <LiveSongEditModal
        songId={editingSongId}
        onClose={() => setEditingSongId(null)}
      />
    </div>
  );
};
