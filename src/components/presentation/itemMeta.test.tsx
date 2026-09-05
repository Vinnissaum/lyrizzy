import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import i18n from "../../i18n";
import { itemLabel, ItemTypeIcon, songArtist } from "./itemMeta";
import type { SetItem, Song, Media } from "../../types";

const t = i18n.t.bind(i18n);

const songs: Song[] = [
  {
    id: "song-1",
    title: "Aleluia",
    artist: "Fulano",
    sections: [],
    language: "pt",
    scrimOpacity: 0,
    createdAt: 0,
    updatedAt: 0,
  },
];

const media: Media[] = [];

function makeItem(overrides: Partial<SetItem>): SetItem {
  return {
    id: "item-1",
    setId: "set-1",
    itemType: "countdown",
    sortOrder: 0,
    ...overrides,
  };
}

describe("itemLabel", () => {
  it("song: returns the song title", () => {
    const item = makeItem({ itemType: "song", songId: "song-1" });
    expect(itemLabel(item, songs, media, t)).toBe("Aleluia");
  });

  it("song: falls back to the given fallback text when the song can't be found", () => {
    const item = makeItem({ itemType: "song", songId: "missing" });
    expect(itemLabel(item, songs, media, t, "???")).toBe("???");
  });

  // (a) named countdown returns the name
  it("countdown: a named countdown returns its name", () => {
    const item = makeItem({
      itemType: "countdown",
      countdownConfig: {
        target: { kind: "duration", durationMs: 300000 },
        endBehavior: "holdZero",
        name: "Abertura",
      },
    });
    expect(itemLabel(item, songs, media, t)).toBe("Abertura");
  });

  // (b) unnamed returns the localized default and contains neither ":" nor "min"
  it("countdown: an unnamed countdown returns the localized default name, with no duration/time", () => {
    const item = makeItem({
      itemType: "countdown",
      countdownConfig: {
        target: { kind: "duration", durationMs: 300000 },
        endBehavior: "holdZero",
      },
    });
    const label = itemLabel(item, songs, media, t);
    expect(label).toBe(t("countdown.defaultName"));
    expect(label).not.toContain(":");
    expect(label.toLowerCase()).not.toContain("min");
  });

  it("countdown: a countdown with only whitespace for a name also falls back to the default", () => {
    const item = makeItem({
      itemType: "countdown",
      countdownConfig: {
        target: { kind: "fixedTime", hour: 9, minute: 30 },
        endBehavior: "holdZero",
        name: "   ",
      },
    });
    const label = itemLabel(item, songs, media, t);
    expect(label).toBe(t("countdown.defaultName"));
    expect(label).not.toContain(":");
  });

  // (c) iframe vs rtsp camera labels differ
  it("web_view: iframe and rtsp modes produce different labels for the same host", () => {
    const iframeItem = makeItem({
      itemType: "web_view",
      webviewConfig: { mode: "iframe", url: "https://example.church/live" },
    });
    const rtspItem = makeItem({
      itemType: "web_view",
      webviewConfig: { mode: "rtsp", url: "rtsp://192.168.1.10:554/stream" },
    });

    const iframeLabel = itemLabel(iframeItem, songs, media, t);
    const rtspLabel = itemLabel(rtspItem, songs, media, t);

    expect(iframeLabel).not.toBe(rtspLabel);
    expect(iframeLabel).toBe(t("itemMeta.webPage", { host: "example.church" }));
    expect(rtspLabel).toBe(t("itemMeta.camera", { host: "192.168.1.10:554" }));
  });

  it("web_view: mjpeg is treated the same as rtsp (a camera label)", () => {
    const mjpegItem = makeItem({
      itemType: "web_view",
      webviewConfig: { mode: "mjpeg", url: "http://10.0.0.5:8080/video" },
    });
    expect(itemLabel(mjpegItem, songs, media, t)).toBe(
      t("itemMeta.camera", { host: "10.0.0.5:8080" }),
    );
  });

  it("web_view: legacy modes fall back to the existing short-url behavior", () => {
    const legacyItem = makeItem({
      itemType: "web_view",
      webviewConfig: { mode: "rtmp", url: "https://legacy.example.com/feed" },
    });
    expect(itemLabel(legacyItem, songs, media, t)).toBe(
      "legacy.example.com/feed",
    );
  });

  it("media: returns the media display name", () => {
    const item = makeItem({
      itemType: "media",
      mediaId: "media-1",
    });
    const withMedia: Media[] = [
      {
        id: "media-1",
        fileName: "bg.jpg",
        displayName: "Fundo Azul",
        kind: "image",
        mimeType: "image/jpeg",
        byteSize: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    ];
    expect(itemLabel(item, songs, withMedia, t)).toBe("Fundo Azul");
  });

  it("blank: returns the black-screen label", () => {
    const item = makeItem({ itemType: "blank" as SetItem["itemType"] });
    expect(itemLabel(item, songs, media, t)).toBe("Tela preta");
  });
});

describe("songArtist", () => {
  it("returns the artist for a song item", () => {
    const item = makeItem({ itemType: "song", songId: "song-1" });
    expect(songArtist(item, songs)).toBe("Fulano");
  });

  it("returns undefined for non-song items", () => {
    const item = makeItem({ itemType: "countdown" });
    expect(songArtist(item, songs)).toBeUndefined();
  });
});

describe("ItemTypeIcon", () => {
  it("renders the Video icon for a camera web_view (rtsp)", () => {
    const item = makeItem({
      itemType: "web_view",
      webviewConfig: { mode: "rtsp", url: "rtsp://192.168.1.10:554/stream" },
    });
    const { container } = render(<ItemTypeIcon item={item} data-testid="icon" />);
    expect(container.querySelector(".lucide-video")).not.toBeNull();
    expect(container.querySelector(".lucide-globe")).toBeNull();
  });

  it("renders the Globe icon for a page web_view (iframe)", () => {
    const item = makeItem({
      itemType: "web_view",
      webviewConfig: { mode: "iframe", url: "https://example.church/live" },
    });
    const { container } = render(<ItemTypeIcon item={item} />);
    expect(container.querySelector(".lucide-globe")).not.toBeNull();
    expect(container.querySelector(".lucide-video")).toBeNull();
  });
});
