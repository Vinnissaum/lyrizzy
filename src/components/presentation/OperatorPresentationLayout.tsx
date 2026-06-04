import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  clearOverlay,
  enterPresentation,
  exitPresentation,
  importPresentation,
  setAnnouncementOverlay,
  setMediaOverlay,
  setWebviewOverlay,
  addSetItem,
} from "../../api/commands";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { mediaUrl } from "../../api/assets";
import { useSettingsStore } from "../../stores/settings";
import { OverlayActionBar } from "./OverlayActionBar";
import { itemLabel } from "./itemMeta";
import { SetItemList } from "./SetItemList";
import { StrophesGrid } from "./StrophesGrid";
import { LivePreview } from "./LivePreview";

function msToClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const OperatorPresentationLayout: React.FC = () => {
  const { t } = useTranslation();
  const state = usePresentationStore((s) => s.state);
  const countdown = useCountdownStore((s) => s.state);
  const { songs } = useLibraryStore();
  const { media, refresh: refreshMedia } = useMediaStore();
  const { cameraUrl, loadCameraUrl } = useSettingsStore();
  const { fixedSetId, setView } = useLibraryStore();

  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");

  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const [showCameraPrompt, setShowCameraPrompt] = useState(false);
  const [tempCameraUrl, setTempCameraUrl] = useState("");

  const [isImportingPresentation, setIsImportingPresentation] = useState(false);

  const announcementRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadCameraUrl();
    refreshMedia();
  }, []);

  const items = state?.set?.items ?? [];
  const currentItemIndex = state?.currentItemIndex ?? 0;
  const activeItem = items[currentItemIndex];
  const activeItemLabel = activeItem
    ? itemLabel(activeItem, songs, media)
    : "—";

  const ensurePresentation = async () => {
    try {
      await enterPresentation();
    } catch (err) {
      console.error("open presentation window failed:", err);
    }
  };

  // ── Scheduled-countdown header badge ───────────────────────────────────────
  // While a countdown is pending (Scheduled) the badge shows the time remaining
  // until it fires; the projector is untouched until then (takeover engages at
  // fire — see commands/countdown.rs). Once running as a takeover, the badge keeps
  // showing the live remaining. Clicking it cancels the schedule.
  const isCountdownPending = countdown.mode === "scheduled";
  const isCountdownLiveTakeover =
    countdown.mode === "running" && !!countdown.takeover;
  const armedCountdownLabel =
    isCountdownPending || isCountdownLiveTakeover
      ? t("countdown.schedule.badge", { remaining: msToClock(countdown.remainingMs) })
      : null;

  const handleCancelArmedCountdown = () => {
    useCountdownStore.getState().reset().catch(console.error);
  };

  const handleOferta = () => {
    refreshMedia();
    setShowMediaPicker(true);
  };

  const handleSelectMediaOverlay = async (mediaId: string) => {
    setShowMediaPicker(false);
    await ensurePresentation();
    try {
      await setMediaOverlay(mediaId);
    } catch (err) {
      console.error("set media overlay failed:", err);
    }
  };

  const handleCamera = async () => {
    if (cameraUrl) {
      await ensurePresentation();
      try {
        await setWebviewOverlay(cameraUrl);
      } catch (err) {
        console.error("set webview overlay failed:", err);
      }
    } else {
      setTempCameraUrl("");
      setShowCameraPrompt(true);
    }
  };

  const handleConfirmCameraUrl = async () => {
    const url = tempCameraUrl.trim();
    if (!url) return;
    setShowCameraPrompt(false);
    await ensurePresentation();
    try {
      await setWebviewOverlay(url);
    } catch (err) {
      console.error("set webview overlay failed:", err);
    }
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
      await setAnnouncementOverlay(text);
    } catch (err) {
      console.error("set announcement overlay failed:", err);
    }
  };

  const handleClearOverlay = async () => {
    try {
      await clearOverlay();
    } catch (err) {
      console.error("clear overlay failed:", err);
    }
  };

  // Toggle blackout (blank mode) — same behavior as the F10 shortcut.
  const handleBlackout = () => {
    const pres = usePresentationStore.getState();
    pres.setMode(pres.state?.mode === "blank" ? "live" : "blank");
  };

  // Stop presentation — same behavior as pressing Esc in operator mode.
  const handleStop = () => {
    exitPresentation().catch((err) =>
      console.error("exit presentation failed:", err),
    );
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
      <div
        data-testid="operator-presentation-layout"
        className="h-full flex items-center justify-center text-muted text-sm"
      >
        {t("presentation.empty")}
      </div>
    );
  }

  const imageMedia = media.filter((m) => m.kind === "image");

  return (
    <div data-testid="operator-presentation-layout" className="flex flex-col h-full">
      <OverlayActionBar
        showApresentarButton={false}
        onOferta={handleOferta}
        onCamera={handleCamera}
        onAviso={handleAvisoClick}
        onPdf={handleImportPresentation}
        onClearOverlay={handleClearOverlay}
        onBlackout={handleBlackout}
        onStop={handleStop}
        isBlackoutActive={state?.mode === "blank"}
        isOverlayActive={!!state?.overlay}
        isImportingPresentation={isImportingPresentation}
        armedCountdownLabel={armedCountdownLabel}
        onCancelArmedCountdown={handleCancelArmedCountdown}
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr] md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_320px] gap-2 flex-1 overflow-hidden">
        {/* Set pane */}
        <div className="flex flex-col overflow-hidden">
          <header className="text-xs text-muted px-2 py-1">
            {t("presentation.pane.set")}
          </header>
          <div className="flex-1 overflow-hidden">
            <SetItemList />
          </div>
        </div>

        {/* Strophes pane */}
        <div className="flex flex-col overflow-hidden">
          <header className="text-xs text-muted px-2 py-1">
            {t("presentation.pane.strophes")} — {activeItemLabel}
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

      {/* Camera URL prompt */}
      {showCameraPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface rounded-xl shadow-2xl w-96 flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">{t("home.overlay.camera")}</h3>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs text-muted">{t("home.overlay.cameraNoUrl")}</p>
              <input
                autoFocus
                type="url"
                value={tempCameraUrl}
                onChange={(e) => setTempCameraUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmCameraUrl();
                  if (e.key === "Escape") setShowCameraPrompt(false);
                }}
                placeholder="http://192.168.1.x/cam"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <button
                onClick={() => {
                  setShowCameraPrompt(false);
                  setView("settings");
                }}
                className="text-xs text-primary hover:underline"
              >
                {t("home.overlay.goToSettings")}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCameraPrompt(false)}
                  className="px-4 py-2 text-sm rounded-lg bg-surface-2 hover:bg-border transition-colors"
                >
                  {t("home.overlay.cancel")}
                </button>
                <button
                  onClick={handleConfirmCameraUrl}
                  disabled={!tempCameraUrl.trim()}
                  className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-fg-on-primary font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("home.overlay.cameraUse")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Media picker (Oferta) */}
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
    </div>
  );
};
