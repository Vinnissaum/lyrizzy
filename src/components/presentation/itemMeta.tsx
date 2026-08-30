import React from "react";
import {
  Music,
  Film,
  Image as ImageIcon,
  Timer,
  Globe,
  FileText,
  Square,
  type LucideProps,
} from "lucide-react";
import type { SetItem, Song, Media } from "../../types";

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
      return <Globe {...props} />;
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
      if (cfg?.target?.kind === "fixedTime") {
        const h = String(cfg.target.hour).padStart(2, "0");
        const min = String(cfg.target.minute).padStart(2, "0");
        return `Cronômetro — ${h}:${min}`;
      }
      const durMs = cfg?.target?.kind === "duration" ? cfg.target.durationMs : 0;
      const mins = Math.floor(durMs / 60000);
      const secs = Math.floor((durMs % 60000) / 1000);
      return `Cronômetro — ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    case "web_view": {
      const url = item.webviewConfig?.url ?? "";
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
