import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Tauri IPC is not available in jsdom — stub it.
vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));

// SongBackground uses <video> / <img> with asset:// URLs; stub it for unit tests.
vi.mock("./SongBackground", () => ({
  SongBackground: () => <div data-testid="song-background-stub" />,
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useSettingsStore } from "../../stores/settings";
import { SongSlideBody, WarningBody } from "./bodies";
import { PREVIEW_SIZE_PX, stepSize } from "./layout";
import type { ChipAppearance } from "./SlideChip";

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultAppearance: ChipAppearance = {
  fontFamily: "sans",
  fontSize: "lg",
  preset: "preto-branco",
  position: "center",
  margin: "lg",
  lineSpacing: "normal",
  boldLevel: "medium",
};

function setupSettingsStore(overrides: Partial<ReturnType<typeof useSettingsStore>> = {}) {
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

// ── SongSlideBody tests ───────────────────────────────────────────────────────

describe("SongSlideBody — title slide", () => {
  it("author font-size px is less than title font-size px", () => {
    const { container } = render(
      <SongSlideBody
        slideLines={["Amazing Grace", "John Newton"]}
        sectionLabel="__title__"
        appearance={defaultAppearance}
      />,
    );

    // Title is the first <p>, author is the second <p>.
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);

    const titleEl = paragraphs[0] as HTMLElement;
    const authorEl = paragraphs[1] as HTMLElement;

    const titlePx = parseFloat(titleEl.style.fontSize);
    const authorPx = parseFloat(authorEl.style.fontSize);

    expect(authorPx).toBeLessThan(titlePx);

    // Title matches the configured lyric size; author stays one notch below.
    expect(titlePx).toBe(PREVIEW_SIZE_PX["lg"]); // lg → 48
    expect(authorPx).toBe(PREVIEW_SIZE_PX[stepSize("lg", -1)]); // md → 40
  });

  it("author color equals title color", () => {
    const { container } = render(
      <SongSlideBody
        slideLines={["Amazing Grace", "John Newton"]}
        sectionLabel="__title__"
        appearance={defaultAppearance}
      />,
    );

    const paragraphs = container.querySelectorAll("p");
    const titleEl = paragraphs[0] as HTMLElement;
    const authorEl = paragraphs[1] as HTMLElement;

    expect(authorEl.style.color).toBe(titleEl.style.color);
  });

  it("does not render author paragraph when slideLines[1] is absent", () => {
    const { container } = render(
      <SongSlideBody
        slideLines={["Only a Title"]}
        sectionLabel="__title__"
        appearance={defaultAppearance}
      />,
    );

    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(1);
  });
});

describe("SongSlideBody — blackout", () => {
  it("renders a solid black fill and no text content", () => {
    const { container } = render(
      <SongSlideBody
        slideLines={["Hidden text"]}
        sectionLabel="__blackout__"
        appearance={defaultAppearance}
      />,
    );

    // The root element should be an absolute inset-0 black div.
    const root = container.firstChild as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root.style.backgroundColor).toBe("rgb(0, 0, 0)");

    // No paragraph elements — no text rendered.
    expect(container.querySelectorAll("p").length).toBe(0);
  });

  it("shows no text even if slideLines are non-empty", () => {
    render(
      <SongSlideBody
        slideLines={["Should not appear"]}
        sectionLabel="__blackout__"
        appearance={defaultAppearance}
      />,
    );
    expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
  });
});

describe("SongSlideBody — lyric variant", () => {
  it("renders each lyric line", () => {
    render(
      <SongSlideBody
        slideLines={["Santo, Santo, Santo", "É o Senhor Deus"]}
        sectionLabel="Chorus"
        appearance={defaultAppearance}
      />,
    );

    expect(screen.getByText("Santo, Santo, Santo")).toBeInTheDocument();
    expect(screen.getByText("É o Senhor Deus")).toBeInTheDocument();
  });

  it("renders nothing (no paragraphs) when slideLines is empty", () => {
    const { container } = render(
      <SongSlideBody
        slideLines={[]}
        sectionLabel="Verse"
        appearance={defaultAppearance}
      />,
    );

    expect(container.querySelectorAll("p").length).toBe(0);
  });

  it("uses the configured fontSize for lyric lines", () => {
    const { container } = render(
      <SongSlideBody
        slideLines={["Glória"]}
        sectionLabel="Verse"
        appearance={defaultAppearance}
      />,
    );

    const p = container.querySelector("p") as HTMLElement;
    expect(parseFloat(p.style.fontSize)).toBe(PREVIEW_SIZE_PX["lg"]);
  });
});

// ── WarningBody tests ─────────────────────────────────────────────────────────

describe("WarningBody", () => {
  beforeEach(() => {
    setupSettingsStore();
  });

  it("renders the given text", () => {
    render(<WarningBody text="Pais, levem as crianças ao berçário" />);
    expect(
      screen.getByText("Pais, levem as crianças ao berçário"),
    ).toBeInTheDocument();
  });

  it("outer fill element carries the preset background color (preto-branco → black)", () => {
    const { container } = render(<WarningBody text="Aviso" />);
    const outer = container.firstChild as HTMLElement;
    // Default preset is preto-branco → bg = #000000.
    expect(outer.style.backgroundColor).toBe("rgb(0, 0, 0)");
  });

  it("outer fill element carries the preset background color for branco-preto", () => {
    setupSettingsStore({ announcementPreset: "branco-preto" });
    const { container } = render(<WarningBody text="Aviso" />);
    const outer = container.firstChild as HTMLElement;
    // branco-preto → bg = #FFFFFF.
    expect(outer.style.backgroundColor).toBe("rgb(255, 255, 255)");
  });

  it("text paragraph uses the preset foreground color", () => {
    render(<WarningBody text="Teste" />);
    const p = screen.getByText("Teste");
    // preto-branco fg = #FFFFFF → white.
    expect(p.style.color).toBe("rgb(255, 255, 255)");
  });
});
