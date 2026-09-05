import React from "react";
import {
  Music,
  Film,
  Image as ImageIcon,
  Timer,
  Globe,
  Video,
  FileText,
  Square,
  type LucideProps,
} from "lucide-react";
import type { TFunction } from "i18next";
import type { SetItem, Song, Media } from "../../types";

/** rtsp/mjpeg webviews are camera feeds; iframe (and legacy modes) are web pages. */
function isCameraWebViewMode(mode: string | undefined): boolean {
  return mode === "rtsp" || mode === "mjpeg";
}

/** Host (+ port, if any) from a stream/page URL, for use in camera/webpage labels. */
function urlHost(url: string): string {
  return url.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "").split(/[/?#]/)[0] || url;
}

/**
 * Icon for a set-item type. Uses lucide (SVG) instead of emoji/Unicode glyphs,
 * which fail to render on Linux installs without a colour-emoji font.
 */
export const ItemTypeIcon: React.FC<{ item: SetItem } & LucideProps> = ({
  item,
  ...props
}) => {
  switch (item.itemType) {
    case "song":
      return <Music {...props} />;
    case "media":
      return item.mediaKind === "video" ? <Film {...props} /> : <ImageIcon {...props} />;
    case "countdown":
      return <Timer {...props} />;
    case "web_view":
      return isCameraWebViewMode(item.webviewConfig?.mode) ? (
        <Video {...props} />
      ) : (
        <Globe {...props} />
      );
    case "slide_show":
      return <FileText {...props} />;
    default:
      return <Square {...props} />;
  }
};

/**
 * Returns a human-readable label for a set item (text only — render
 * {@link ItemTypeIcon} alongside it for the icon). Pure function — no hooks.
 */
export function itemLabel(
  item: SetItem,
  songs: Song[],
  media: Media[],
  t: TFunction,
  fallback = "—",
): string {
  const songById = (id?: string) => songs.find((s) => s.id === id);
  const mediaById = (id?: string) => media.find((m) => m.id === id);

  switch (item.itemType) {
    case "song": {
      const song = songById(item.songId);
      return song?.title ?? fallback;
    }
    case "media": {
      const m = mediaById(item.mediaId);
      return m?.displayName ?? "Mídia";
    }
    case "countdown": {
      const cfg = item.countdownConfig;
      return cfg?.name?.trim() || t("countdown.defaultName");
    }
    case "web_view": {
      const cfg = item.webviewConfig;
      const url = cfg?.url ?? "";
      const host = urlHost(url);
      if (isCameraWebViewMode(cfg?.mode)) {
        return t("itemMeta.camera", { host });
      }
      if (cfg?.mode === "iframe") {
        return t("itemMeta.webPage", { host });
      }
      // Legacy modes (rtmp/srt/multicast): unchanged fallback behaviour.
      const short = url.replace(/^https?:\/\//, "").slice(0, 30);
      return short || "WebView";
    }
    case "slide_show": {
      const m = mediaById(item.mediaId);
      return m?.displayName ?? "Apresentação";
    }
    default:
      // The `blank` item projects a black screen (P16-05..P16-08).
      return "Tela preta";
  }
}

/**
 * Author/artist credit for a song set item, for showing alongside the title.
 * Returns undefined for non-song items or songs without a credit. Pure function.
 */
export function songArtist(item: SetItem, songs: Song[]): string | undefined {
  if (item.itemType !== "song") return undefined;
  return songs.find((s) => s.id === item.songId)?.artist || undefined;
}
