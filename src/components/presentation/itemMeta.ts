import type { SetItem, Song, Media } from "../../types";

/** Returns an icon character for a given set item type. */
export function itemIcon(item: SetItem): string {
  switch (item.itemType) {
    case "song": return "♪";
    case "media": return item.mediaKind === "video" ? "▶" : "🖼";
    case "countdown": return "⏱";
    case "web_view": return "🌐";
    case "slide_show": return "📄";
    default: return "▪";
  }
}

/**
 * Returns a human-readable label for a set item.
 * Pure function — no React hooks.
 */
export function itemLabel(
  item: SetItem,
  songs: Song[],
  media: Media[],
  fallback = "—",
): string {
  const icon = itemIcon(item);
  const songById = (id?: string) => songs.find((s) => s.id === id);
  const mediaById = (id?: string) => media.find((m) => m.id === id);

  switch (item.itemType) {
    case "song": {
      const song = songById(item.songId);
      return `${icon} ${song?.title ?? fallback}`;
    }
    case "media": {
      const m = mediaById(item.mediaId);
      return `${icon} ${m?.displayName ?? "Mídia"}`;
    }
    case "countdown": {
      const cfg = item.countdownConfig;
      if (cfg?.target?.kind === "fixedTime") {
        const h = String(cfg.target.hour).padStart(2, "0");
        const min = String(cfg.target.minute).padStart(2, "0");
        return `${icon} Cronômetro — ${h}:${min}`;
      }
      const durMs = cfg?.target?.kind === "duration" ? cfg.target.durationMs : 0;
      const mins = Math.floor(durMs / 60000);
      const secs = Math.floor((durMs % 60000) / 1000);
      return `${icon} Cronômetro — ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    case "web_view": {
      const url = item.webviewConfig?.url ?? "";
      const short = url.replace(/^https?:\/\//, "").slice(0, 30);
      return `${icon} ${short || "WebView"}`;
    }
    case "slide_show": {
      const m = mediaById(item.mediaId);
      return `${icon} ${m?.displayName ?? "Apresentação"}`;
    }
    default:
      return `${icon} Branco`;
  }
}
