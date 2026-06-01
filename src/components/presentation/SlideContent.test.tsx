import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that trigger them.
// ---------------------------------------------------------------------------

// Tauri IPC not available in jsdom.
vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));

// SongBackground uses asset:// URLs — stub it.
vi.mock("./SongBackground", () => ({
  SongBackground: () => <div data-testid="song-background-stub" />,
}));

// CountdownRenderer reads the countdown store — stub it entirely.
vi.mock("./CountdownRenderer", () => ({
  CountdownRenderer: ({ config }: { config: { message?: string } }) => (
    <div data-testid="countdown-renderer-stub">
      {config.message ?? "countdown"}
    </div>
  ),
}));

// SlideshowRenderer may fetch slide images — stub it.
vi.mock("./SlideshowRenderer", () => ({
  SlideshowRenderer: ({
    mediaId,
    slideIndex,
  }: {
    mediaId: string;
    slideIndex: number;
  }) => (
    <div
      data-testid="slideshow-renderer-stub"
      data-media-id={mediaId}
      data-slide-index={slideIndex}
    />
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useSettingsStore } from "../../stores/settings";
import { SlideContent } from "./SlideContent";
import type { SlideContentProps } from "./SlideContent";
import type { CountdownConfig } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultAppearance: SlideContentProps["appearance"] = {
  fontFamily: "sans",
  fontSize: "lg",
  preset: "preto-branco",
  position: "center",
  margin: "lg",
  lineSpacing: "normal",
  boldLevel: "medium",
};

function setupSettingsStore(
  overrides: Partial<{
    announcementFontFamily: "sans" | "serif" | "mono";
    announcementFontSize: "sm" | "md" | "lg" | "xl" | "xxl";
    announcementPreset: "preto-branco" | "branco-preto";
    announcementPosition:
      | "top-left"
      | "top-center"
      | "top-right"
      | "center-left"
      | "center"
      | "center-right"
      | "bottom-left"
      | "bottom-center"
      | "bottom-right";
    announcementMargin: "none" | "sm" | "md" | "lg" | "xl";
    announcementLineSpacing: "tight" | "normal" | "relaxed" | "loose";
    announcementBoldLevel: "normal" | "medium" | "semibold" | "bold";
  }> = {}
) {
  vi.mocked(useSettingsStore).mockImplementation((selector: unknown) => {
    const state = {
      announcementFontFamily: "sans" as const,
      announcementFontSize: "lg" as const,
      announcementPreset: "preto-branco" as const,
      announcementPosition: "center" as const,
      announcementMargin: "lg" as const,
      announcementLineSpacing: "normal" as const,
      announcementBoldLevel: "medium" as const,
      ...overrides,
    };
    if (typeof selector === "function") {
      return (selector as (s: typeof state) => unknown)(state);
    }
    return state;
  });
}

const countdownConfig: CountdownConfig = {
  target: { kind: "duration", durationMs: 600000 },
  endBehavior: "holdZero",
  message: "Começando em breve",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SlideContent — warningText branch", () => {
  beforeEach(() => {
    setupSettingsStore();
  });

  it("renders WarningBody with the given text, overriding itemType", () => {
    render(
      <SlideContent
        itemType="song"
        appearance={defaultAppearance}
        warningText="Pais, levem as crianças ao berçário"
      />
    );
    expect(
      screen.getByText("Pais, levem as crianças ao berçário")
    ).toBeInTheDocument();
  });

  it("renders WarningBody even for media itemType", () => {
    render(
      <SlideContent
        itemType="media"
        appearance={defaultAppearance}
        warningText="Aviso importante"
      />
    );
    expect(screen.getByText("Aviso importante")).toBeInTheDocument();
  });
});

describe("SlideContent — song / blank branch", () => {
  it("renders lyric lines for song", () => {
    render(
      <SlideContent
        itemType="song"
        appearance={defaultAppearance}
        slideLines={["Santo, Santo, Santo", "É o Senhor Deus"]}
        sectionLabel="Chorus"
      />
    );
    expect(screen.getByText("Santo, Santo, Santo")).toBeInTheDocument();
    expect(screen.getByText("É o Senhor Deus")).toBeInTheDocument();
  });

  it("renders lyric lines for blank itemType", () => {
    render(
      <SlideContent
        itemType="blank"
        appearance={defaultAppearance}
        slideLines={["Blank line"]}
      />
    );
    expect(screen.getByText("Blank line")).toBeInTheDocument();
  });

  it("__blackout__ sectionLabel renders solid black with no text", () => {
    const { container } = render(
      <SlideContent
        itemType="song"
        appearance={defaultAppearance}
        slideLines={["Hidden"]}
        sectionLabel="__blackout__"
      />
    );

    // No paragraphs rendered.
    expect(container.querySelectorAll("p").length).toBe(0);

    // Root element should be a black div.
    const root = container.firstChild as HTMLElement;
    expect(root.style.backgroundColor).toBe("rgb(0, 0, 0)");
  });

  it("shows no text for __blackout__ even with non-empty slideLines", () => {
    render(
      <SlideContent
        itemType="song"
        appearance={defaultAppearance}
        slideLines={["Should not appear"]}
        sectionLabel="__blackout__"
      />
    );
    expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
  });

  it("falls back to empty array when slideLines is omitted", () => {
    const { container } = render(
      <SlideContent
        itemType="song"
        appearance={defaultAppearance}
        sectionLabel="Verse"
      />
    );
    // No paragraphs rendered since default slideLines is [].
    expect(container.querySelectorAll("p").length).toBe(0);
  });
});

describe("SlideContent — countdown branch", () => {
  it("renders CountdownRenderer stub when countdownConfig is provided", () => {
    render(
      <SlideContent
        itemType="countdown"
        appearance={defaultAppearance}
        countdownConfig={countdownConfig}
      />
    );
    expect(screen.getByTestId("countdown-renderer-stub")).toBeInTheDocument();
    expect(screen.getByText("Começando em breve")).toBeInTheDocument();
  });

  it("renders Timer placeholder when countdownConfig is absent", () => {
    const { container } = render(
      <SlideContent
        itemType="countdown"
        appearance={defaultAppearance}
      />
    );
    // No CountdownRenderer stub.
    expect(
      container.querySelector('[data-testid="countdown-renderer-stub"]')
    ).toBeNull();
    // Placeholder label is shown.
    expect(
      screen.getByText("Contagem Regressiva")
    ).toBeInTheDocument();
  });
});

describe("SlideContent — media branch", () => {
  it("renders <img> with the asset url for image media", () => {
    const { container } = render(
      <SlideContent
        itemType="media"
        appearance={defaultAppearance}
        mediaKind="image"
        mediaAssetUrl="asset://media/offer.jpg"
      />
    );
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.src).toContain("offer.jpg");
  });

  it("does NOT render a <video> element for video media (placeholder only)", () => {
    const { container } = render(
      <SlideContent
        itemType="media"
        appearance={defaultAppearance}
        mediaKind="video"
        mediaLabel="Promo Video"
      />
    );
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByText("Promo Video")).toBeInTheDocument();
  });

  it("renders a generic image placeholder when no mediaKind is given", () => {
    const { container } = render(
      <SlideContent
        itemType="media"
        appearance={defaultAppearance}
      />
    );
    // No img, no video.
    expect(container.querySelector("video")).toBeNull();
    // The placeholder card renders (w-full h-full container present).
    const placeholder = container.querySelector(
      ".flex.flex-col.items-center.justify-center"
    );
    expect(placeholder).toBeTruthy();
  });

  it("renders a generic image placeholder when mediaKind is image but no url", () => {
    const { container } = render(
      <SlideContent
        itemType="media"
        appearance={defaultAppearance}
        mediaKind="image"
      />
    );
    // No <img> because assetUrl is absent.
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("SlideContent — slide_show branch", () => {
  it("renders SlideshowRenderer stub with correct props", () => {
    render(
      <SlideContent
        itemType="slide_show"
        appearance={defaultAppearance}
        slideshowMediaId="media-abc"
        slideshowIndex={3}
      />
    );
    const stub = screen.getByTestId("slideshow-renderer-stub");
    expect(stub).toBeInTheDocument();
    expect(stub.getAttribute("data-media-id")).toBe("media-abc");
    expect(stub.getAttribute("data-slide-index")).toBe("3");
  });

  it("defaults slideshowMediaId and slideshowIndex when omitted", () => {
    render(
      <SlideContent
        itemType="slide_show"
        appearance={defaultAppearance}
      />
    );
    const stub = screen.getByTestId("slideshow-renderer-stub");
    expect(stub.getAttribute("data-media-id")).toBe("");
    expect(stub.getAttribute("data-slide-index")).toBe("0");
  });
});

describe("SlideContent — web_view branch", () => {
  it("does NOT render an <iframe> (placeholder only)", () => {
    const { container } = render(
      <SlideContent
        itemType="web_view"
        appearance={defaultAppearance}
        webviewUrl="http://example.com"
      />
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText("http://example.com")).toBeInTheDocument();
  });

  it("renders an empty Globe placeholder when webviewUrl is absent", () => {
    const { container } = render(
      <SlideContent
        itemType="web_view"
        appearance={defaultAppearance}
      />
    );
    expect(container.querySelector("iframe")).toBeNull();
    const placeholder = container.querySelector(
      ".flex.flex-col.items-center.justify-center"
    );
    expect(placeholder).toBeTruthy();
  });
});
