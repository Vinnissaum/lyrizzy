import React from "react";
import { useTranslation } from "react-i18next";
import { Tv } from "lucide-react";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import { useMediaStore } from "../../stores/media";
import { useSettingsStore } from "../../stores/settings";
import { mediaUrl } from "../../api/assets";
import { PRESET_COLORS } from "./layout";
import { SlideStage } from "./SlideStage";
import { SlideContent } from "./SlideContent";
import { CountdownRenderer } from "./CountdownRenderer";
import type { ChipAppearance } from "./bodies";
import type { CountdownConfig, SetItem } from "../../types";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const PlaceholderCard: React.FC<{ icon: React.ReactNode; label: string }> = ({
  icon,
  label,
}) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white">
    <span className="text-xl">{icon}</span>
    <span className="text-xs">{label}</span>
  </div>
);

const FrameTag: React.FC<{ label: string }> = ({ label }) => (
  <span className="absolute top-1 right-1 text-[9px] text-white bg-black/70 px-1 rounded z-10">
    {label}
  </span>
);

// ---------------------------------------------------------------------------
// LivePreview (exported)
// ---------------------------------------------------------------------------

export const LivePreview: React.FC = () => {
  const { t } = useTranslation();
  const state = usePresentationStore((s) => s.state);
  const pendingSelection = usePresentationStore((s) => s.pendingSelection);
  const countdown = useCountdownStore((s) => s.state);
  const { media } = useMediaStore();

  // Build ChipAppearance from global presentation settings.
  const presentationFontFamily = useSettingsStore((s) => s.presentationFontFamily);
  const presentationFontSize = useSettingsStore((s) => s.presentationFontSize);
  const presentationPreset = useSettingsStore((s) => s.presentationPreset);
  const presentationPosition = useSettingsStore((s) => s.presentationPosition);
  const presentationMargin = useSettingsStore((s) => s.presentationMargin);
  const presentationLineSpacing = useSettingsStore((s) => s.presentationLineSpacing);
  const presentationBoldLevel = useSettingsStore((s) => s.presentationBoldLevel);
  const announcementPreset = useSettingsStore((s) => s.announcementPreset);

  const appearance: ChipAppearance = {
    fontFamily: presentationFontFamily,
    fontSize: presentationFontSize,
    preset: presentationPreset,
    position: presentationPosition,
    margin: presentationMargin,
    lineSpacing: presentationLineSpacing,
    boldLevel: presentationBoldLevel,
  };

  // ── Countdown takeover (highest precedence, mirrors PresentationApp) ────────
  if (countdown.takeover && countdown.mode !== "idle") {
    const cfg: CountdownConfig = {
      target: { kind: "duration", durationMs: countdown.durationMs },
      message: countdown.message,
      endBehavior: countdown.endBehavior,
      position: "center",
    };
    return (
      <div
        data-testid="live-preview"
        className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative"
      >
        <CountdownRenderer config={cfg} />
      </div>
    );
  }

  if (!state?.set) {
    return (
      <div
        data-testid="live-preview"
        className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative flex items-center justify-center"
      >
        <PlaceholderCard icon={<Tv size={28} />} label={t("presentation.empty")} />
      </div>
    );
  }

  const mode = state.mode;

  // ── Optimistic preview ─────────────────────────────────────────────────────
  // Mirror StrophesGrid's optimistic highlight: when the operator clicks a
  // slide, show it here immediately instead of waiting for the goToItem
  // round-trip (which re-serializes the whole PresentationState). This is the
  // operator's preview only — the projector renders from the authoritative
  // `state.currentSlide` on its own window, so it stays truthful.
  //
  // Guarded to the cases goToItem makes faithful on resolve: song/slideshow
  // slides that actually exist, and never while an overlay is active (overlays
  // survive navigation and keep owning the projector). goToItem also wakes a
  // blanked screen to live, so we deliberately bypass the blank branch below.
  if (pendingSelection && !state.overlay) {
    const pItem = state.set.items[pendingSelection.itemIndex];
    const pSlide =
      state.allSlidesPerItem?.[pendingSelection.itemIndex]?.[
        pendingSelection.slideIndex
      ];
    if (pItem && pSlide && pItem.itemType === "slide_show") {
      return (
        <div
          data-testid="live-preview"
          className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative"
        >
          <SlideStage>
            <SlideContent
              itemType="slide_show"
              appearance={appearance}
              previewMode
              slideshowMediaId={pItem.mediaId ?? ""}
              slideshowIndex={pendingSelection.slideIndex}
            />
          </SlideStage>
        </div>
      );
    }
    if (pItem && pSlide && pItem.itemType === "song") {
      // Background belongs to the current item; only trust it when the pending
      // selection stays within that item (the common strophe→strophe case).
      // A cross-item jump falls back to the preset until the round-trip lands.
      const sameItem = pendingSelection.itemIndex === state.currentItemIndex;
      const pBackground = sameItem ? state.background : undefined;
      const pPresetBg = pBackground?.assetUrl
        ? "#000000"
        : PRESET_COLORS[appearance.preset].bg;
      return (
        <div
          data-testid="live-preview"
          className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative"
        >
          <SlideStage backgroundColor={pPresetBg}>
            <SlideContent
              itemType="song"
              appearance={appearance}
              previewMode
              slideLines={pSlide.lines}
              sectionLabel={pSlide.sectionLabel}
              background={pBackground}
            />
          </SlideStage>
        </div>
      );
    }
  }

  // ── Announcement overlay (takes precedence over blackout) ──────────────────
  if (state.overlay?.type === "announcement") {
    return (
      <div
        data-testid="live-preview"
        className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative"
      >
        <SlideStage backgroundColor={PRESET_COLORS[announcementPreset].bg}>
          <SlideContent
            itemType="blank"
            appearance={appearance}
            warningText={state.overlay.text}
          />
        </SlideStage>
      </div>
    );
  }

  // ── Blackout ──────────────────────────────────────────────────────────────
  if (mode === "blank") {
    return (
      <div
        data-testid="live-preview"
        className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative"
      >
        <FrameTag label="BLACKOUT" />
      </div>
    );
  }

  // ── Overlay ───────────────────────────────────────────────────────────────
  if (state.overlay) {
    const overlay = state.overlay;

    if (overlay.type === "media") {
      const mediaRecord = media.find((m) => m.id === overlay.mediaId);
      if (mediaRecord?.kind === "image") {
        const assetUrl = mediaUrl(mediaRecord.fileName);
        return (
          <div
            data-testid="live-preview"
            className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative"
          >
            <SlideStage>
              <SlideContent
                itemType="media"
                appearance={appearance}
                mediaKind="image"
                mediaAssetUrl={assetUrl}
                previewMode
              />
            </SlideStage>
          </div>
        );
      }
      if (mediaRecord?.kind === "video") {
        return (
          <div
            data-testid="live-preview"
            className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative"
          >
            <SlideStage>
              <SlideContent
                itemType="media"
                appearance={appearance}
                mediaKind="video"
                mediaLabel={mediaRecord.displayName}
                previewMode
              />
            </SlideStage>
          </div>
        );
      }
      // No matching media record.
      return (
        <div
          data-testid="live-preview"
          className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative"
        >
          <SlideStage>
            <SlideContent
              itemType="media"
              appearance={appearance}
              previewMode
            />
          </SlideStage>
        </div>
      );
    }

    if (overlay.type === "webView") {
      return (
        <div
          data-testid="live-preview"
          className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative"
        >
          <SlideStage>
            <SlideContent
              itemType="web_view"
              appearance={appearance}
              webviewUrl={overlay.url}
              previewMode
            />
          </SlideStage>
        </div>
      );
    }

    // Unknown overlay type — fall through to active item.
  }

  // ── Active item ───────────────────────────────────────────────────────────
  const items = state.set?.items ?? [];
  const currentItem: SetItem | undefined = items[state.currentItemIndex];
  const itemType = currentItem?.itemType ?? "blank";

  // Resolve the media record for media items once (avoids repeated find calls).
  const activeMediaRecord =
    itemType === "media" && currentItem?.mediaId
      ? media.find((m) => m.id === currentItem.mediaId)
      : undefined;

  // Narrow MediaKind → "image" | "video" for SlideContent (which doesn't handle "presentation").
  const activeMediaKind: "image" | "video" | undefined =
    activeMediaRecord?.kind === "image" || activeMediaRecord?.kind === "video"
      ? activeMediaRecord.kind
      : undefined;

  // Countdown background resolution.
  let cdBackground = undefined;
  if (itemType === "countdown" && currentItem?.countdownConfig?.backgroundMediaId) {
    const bgMedia = media.find((m) => m.id === currentItem.countdownConfig!.backgroundMediaId);
    if (bgMedia) {
      cdBackground = {
        mediaKind: bgMedia.kind,
        assetUrl: mediaUrl(bgMedia.fileName),
        scrimOpacity: 35,
        restartOnSectionBoundary: false,
      };
    }
  }

  const presetBg = state.background?.assetUrl
    ? "#000000"
    : PRESET_COLORS[appearance.preset].bg;

  // Slideshow index from sectionId.
  const rawSlideIndex = state.currentSlide?.sectionId
    ? parseInt(state.currentSlide.sectionId, 10)
    : 0;
  const slideshowIndex = isNaN(rawSlideIndex) ? 0 : rawSlideIndex;

  return (
    <div
      data-testid="live-preview"
      className="aspect-video w-full bg-black rounded border border-border overflow-hidden relative"
    >
      <SlideStage backgroundColor={presetBg}>
        <SlideContent
          itemType={itemType}
          appearance={appearance}
          previewMode
          frozen={mode === "frozen"}
          slideLines={state.currentSlide?.lines}
          sectionLabel={state.currentSlide?.sectionLabel}
          background={state.background}
          mediaAssetUrl={
            activeMediaRecord ? mediaUrl(activeMediaRecord.fileName) : undefined
          }
          mediaKind={activeMediaKind}
          mediaLabel={activeMediaRecord?.displayName}
          countdownConfig={
            itemType === "countdown" ? currentItem?.countdownConfig : undefined
          }
          countdownBackground={
            itemType === "countdown" ? cdBackground : undefined
          }
          slideshowMediaId={
            itemType === "slide_show" ? (currentItem?.mediaId ?? "") : undefined
          }
          slideshowIndex={itemType === "slide_show" ? slideshowIndex : undefined}
          webviewUrl={
            itemType === "web_view"
              ? (currentItem?.webviewConfig?.url ?? "")
              : undefined
          }
        />
      </SlideStage>
      {mode === "frozen" && <FrameTag label="CONGELADO" />}
    </div>
  );
};
