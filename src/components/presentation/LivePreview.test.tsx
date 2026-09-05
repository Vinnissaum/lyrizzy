import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";

// jsdom does not implement ResizeObserver — provide a minimal stub so
// SlideStage (used inside LivePreview) can mount without throwing.
class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ResizeObserver = ResizeObserverStub;
  }
});

afterAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ResizeObserver;
});

// ── Store mocks ──────────────────────────────────────────────────────────────
vi.mock("../../stores/presentation", () => ({
  usePresentationStore: vi.fn(),
}));

vi.mock("../../stores/media", () => ({
  useMediaStore: vi.fn(),
}));

vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));

// Countdown store — mocked so individual tests can drive the takeover branch.
let cdStateMock = {
  mode: "idle",
  durationMs: 0,
  remainingMs: 0,
  endBehavior: "holdZero",
  takeover: false,
} as Record<string, unknown>;

vi.mock("../../stores/countdown", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useCountdownStore: (selector?: (s: any) => unknown) => {
    const store = { state: cdStateMock };
    if (typeof selector === "function") return selector(store);
    return store;
  },
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// Stub useCountdownDigits so CountdownRenderer renders without runtime hooks
vi.mock("../../runtime/useCountdownDigits", () => ({
  useCountdownDigits: () => ({
    formattedTime: "10:00",
    isFinished: false,
    isLow: false,
  }),
}));

// SongBackground uses asset:// URLs; stub it for unit tests.
vi.mock("./SongBackground", () => ({
  SongBackground: () => <div data-testid="song-background-stub" />,
}));

// Wrap the real CountdownRenderer to also expose the config it received as
// data attributes — jsdom's CSS engine silently drops the clamp()/calc()
// font-size values CountdownRenderer computes from messageScale/digitsScale,
// so asserting on rendered style.fontSize is unreliable here. Reading the
// forwarded config directly verifies T19's "scales are mirrored" requirement
// without depending on that CSS serialization.
vi.mock("./CountdownRenderer", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./CountdownRenderer")>();
  return {
    ...actual,
    CountdownRenderer: (props: Parameters<typeof actual.CountdownRenderer>[0]) => (
      <div
        data-testid="countdown-renderer-config"
        data-position={props.config.position}
        data-message-scale={props.config.messageScale}
        data-digits-scale={props.config.digitsScale}
      >
        <actual.CountdownRenderer {...props} />
      </div>
    ),
  };
});

import { usePresentationStore } from "../../stores/presentation";
import { useMediaStore } from "../../stores/media";
import { useSettingsStore } from "../../stores/settings";
import { LivePreview } from "./LivePreview";
import type { PresentationState, ServiceSet, Media } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultSettings = {
  presentationFontFamily: "sans" as const,
  presentationFontSize: "lg" as const,
  presentationPreset: "preto-branco" as const,
  presentationPosition: "center" as const,
  presentationMargin: "lg" as const,
  presentationLineSpacing: "normal" as const,
  presentationBoldLevel: "medium" as const,
  announcementPreset: "preto-branco" as const,
  announcementLineSpacing: "normal" as const,
  announcementBoldLevel: "medium" as const,
};

function setupSettingsStore() {
  vi.mocked(useSettingsStore).mockImplementation((selector: unknown) => {
    if (typeof selector === "function") {
      return (selector as (s: typeof defaultSettings) => unknown)(defaultSettings);
    }
    return defaultSettings;
  });
}

const mockSet: ServiceSet = {
  id: "set-1",
  name: "Culto",
  createdAt: 0,
  updatedAt: 0,
  items: [
    {
      id: "item-1",
      setId: "set-1",
      itemType: "song",
      songId: "song-1",
      sortOrder: 0,
    },
  ],
};

const baseState = (): PresentationState => ({
  mode: "live",
  currentItemIndex: 0,
  currentSlideIndex: 0,
  itemSlideCounts: [2],
  set: mockSet,
  currentSlide: { lines: ["Aleluia"], sectionLabel: "Verse", sectionId: "s1" },
});

const mockVideoMedia: Media = {
  id: "vid-1",
  fileName: "promo.mp4",
  displayName: "Promo Video",
  kind: "video",
  mimeType: "video/mp4",
  byteSize: 9999,
  createdAt: 0,
  updatedAt: 0,
};

const mockImageMedia: Media = {
  id: "img-1",
  fileName: "offer.jpg",
  displayName: "Oferta",
  kind: "image",
  mimeType: "image/jpeg",
  byteSize: 1000,
  createdAt: 0,
  updatedAt: 0,
};

function mockStores(
  state: PresentationState | null,
  mediaList: Media[] = []
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(usePresentationStore).mockImplementation((selector?: (s: any) => unknown) => {
    const store = { state };
    if (typeof selector === "function") return selector(store) as ReturnType<typeof usePresentationStore>;
    return store as ReturnType<typeof usePresentationStore>;
  });
  vi.mocked(useMediaStore).mockReturnValue({
    media: mediaList,
    refresh: vi.fn(),
  } as ReturnType<typeof useMediaStore>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LivePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSettingsStore();
    cdStateMock = {
      mode: "idle",
      durationMs: 0,
      remainingMs: 0,
      endBehavior: "holdZero",
      takeover: false,
    };
  });

  it("renders the 16:9 container (aspect-video) when state is provided", () => {
    mockStores(baseState());
    const { container } = render(<LivePreview />);
    const wrapper = container.querySelector('[data-testid="live-preview"]');
    expect(wrapper).toBeTruthy();
    expect(wrapper!.className).toContain("aspect-video");
  });

  it("shows BLACKOUT tag when state.mode === 'blank'", () => {
    mockStores({ ...baseState(), mode: "blank" });
    render(<LivePreview />);
    expect(screen.getByText("BLACKOUT")).toBeInTheDocument();
  });

  it("shows CONGELADO tag when state.mode === 'frozen'", () => {
    mockStores({ ...baseState(), mode: "frozen" });
    render(<LivePreview />);
    expect(screen.getByText("CONGELADO")).toBeInTheDocument();
  });

  it("renders announcement overlay when state.overlay.type === 'announcement'", () => {
    mockStores({
      ...baseState(),
      overlay: { type: "announcement", text: "Bem-vindos ao culto!" },
    });
    render(<LivePreview />);
    expect(screen.getByText("Bem-vindos ao culto!")).toBeInTheDocument();
  });

  it("shows announcement overlay over blackout when mode === 'blank'", () => {
    mockStores({
      ...baseState(),
      mode: "blank",
      overlay: { type: "announcement", text: "Anúncio importante" },
    });
    render(<LivePreview />);
    expect(screen.getByText("Anúncio importante")).toBeInTheDocument();
  });

  it("shows BLACKOUT (not media) when mode === 'blank' with a media overlay", () => {
    mockStores(
      {
        ...baseState(),
        mode: "blank",
        overlay: { type: "media", mediaId: "img-1" },
      },
      [mockImageMedia]
    );
    const { container } = render(<LivePreview />);
    expect(screen.getByText("BLACKOUT")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders song lines through the stage for active song item", () => {
    mockStores({
      ...baseState(),
      currentSlide: { lines: ["Aleluia", "Glória"], sectionLabel: "Verse", sectionId: "s1" },
    });
    render(<LivePreview />);
    expect(screen.getByText("Aleluia")).toBeInTheDocument();
    expect(screen.getByText("Glória")).toBeInTheDocument();
  });

  // ── Optimistic preview (P11-04) ────────────────────────────────────────────
  // A standing pendingSelection should drive the preview instantly, before the
  // goToItem round-trip updates the authoritative currentSlide.
  function mockStoresWithPending(
    state: PresentationState,
    pendingSelection: { itemIndex: number; slideIndex: number } | null,
    mediaList: Media[] = []
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(usePresentationStore).mockImplementation((selector?: (s: any) => unknown) => {
      const store = { state, pendingSelection };
      if (typeof selector === "function") return selector(store) as ReturnType<typeof usePresentationStore>;
      return store as ReturnType<typeof usePresentationStore>;
    });
    vi.mocked(useMediaStore).mockReturnValue({
      media: mediaList,
      refresh: vi.fn(),
    } as ReturnType<typeof useMediaStore>);
  }

  it("optimistically renders the pending slide before the authoritative state catches up", () => {
    const state: PresentationState = {
      ...baseState(),
      // Authoritative state still sits on the first slide…
      currentSlideIndex: 0,
      currentSlide: { lines: ["Old slide"], sectionLabel: "Verse", sectionId: "s1" },
      allSlidesPerItem: [
        [
          { lines: ["Old slide"], sectionLabel: "Verse", sectionId: "s1" },
          { lines: ["Pending slide"], sectionLabel: "Chorus", sectionId: "s2" },
        ],
      ],
    };
    // …but the operator just clicked slide 1.
    mockStoresWithPending(state, { itemIndex: 0, slideIndex: 1 });
    render(<LivePreview />);
    expect(screen.getByText("Pending slide")).toBeInTheDocument();
    expect(screen.queryByText("Old slide")).not.toBeInTheDocument();
  });

  it("ignores the optimistic slide while an overlay is active (overlay keeps the projector)", () => {
    const state: PresentationState = {
      ...baseState(),
      overlay: { type: "announcement", text: "Anúncio" },
      allSlidesPerItem: [
        [{ lines: ["Pending slide"], sectionLabel: "Verse", sectionId: "s1" }],
      ],
    };
    mockStoresWithPending(state, { itemIndex: 0, slideIndex: 0 });
    render(<LivePreview />);
    expect(screen.getByText("Anúncio")).toBeInTheDocument();
    expect(screen.queryByText("Pending slide")).not.toBeInTheDocument();
  });

  it("renders a placeholder card (no <video> element) when active item is a video media", () => {
    const state: PresentationState = {
      ...baseState(),
      set: {
        ...mockSet,
        items: [
          {
            id: "item-1",
            setId: "set-1",
            itemType: "media",
            mediaId: "vid-1",
            mediaKind: "video",
            sortOrder: 0,
          },
        ],
      },
    };
    mockStores(state, [mockVideoMedia]);
    const { container } = render(<LivePreview />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByText("Promo Video")).toBeInTheDocument();
  });

  it("renders a placeholder card (no <iframe> element) when active item is webview", () => {
    const state: PresentationState = {
      ...baseState(),
      set: {
        ...mockSet,
        items: [
          {
            id: "item-1",
            setId: "set-1",
            itemType: "web_view",
            webviewConfig: { mode: "iframe", url: "http://example.com" },
            sortOrder: 0,
          },
        ],
      },
    };
    mockStores(state);
    const { container } = render(<LivePreview />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText("http://example.com")).toBeInTheDocument();
  });

  it("renders placeholder when state.set is undefined", () => {
    mockStores({ ...baseState(), set: undefined });
    render(<LivePreview />);
    const wrapper = screen.getByTestId("live-preview");
    expect(wrapper).toBeTruthy();
    // The aspect-video container is still rendered
    expect(wrapper.className).toContain("aspect-video");
  });

  it("renders placeholder when state is null", () => {
    mockStores(null);
    render(<LivePreview />);
    const wrapper = screen.getByTestId("live-preview");
    expect(wrapper).toBeTruthy();
    expect(wrapper.className).toContain("aspect-video");
  });

  it("renders an img for image media overlay", () => {
    const state: PresentationState = {
      ...baseState(),
      overlay: { type: "media", mediaId: "img-1" },
    };
    mockStores(state, [mockImageMedia]);
    const { container } = render(<LivePreview />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.src).toContain("offer.jpg");
  });

  // ── Hard takeover precedence ────────────────────────────────────────────────
  describe("countdown hard takeover", () => {
    const runningTakeover = {
      mode: "running",
      durationMs: 600000,
      remainingMs: 300000,
      endBehavior: "holdZero",
      takeover: true,
    };

    it("OVERLAYS a clean live song — takeover covers lyrics", () => {
      cdStateMock = runningTakeover;
      mockStores({
        ...baseState(),
        currentSlide: { lines: ["Aleluia"], sectionLabel: "Verse", sectionId: "s1" },
      });
      render(<LivePreview />);
      expect(screen.getByText("10:00")).toBeInTheDocument();
      expect(screen.queryByText("Aleluia")).toBeNull();
    });

    it("OVERLAYS a clean frozen song too (mode frozen, no overlay)", () => {
      cdStateMock = runningTakeover;
      mockStores({ ...baseState(), mode: "frozen" });
      render(<LivePreview />);
      expect(screen.getByText("10:00")).toBeInTheDocument();
      expect(screen.queryByText("Aleluia")).toBeNull();
    });

    it("overlays the countdown over a blackout (mode blank)", () => {
      cdStateMock = runningTakeover;
      mockStores({ ...baseState(), mode: "blank" });
      render(<LivePreview />);
      expect(screen.getByText("10:00")).toBeInTheDocument();
      expect(screen.queryByText("BLACKOUT")).toBeNull();
    });

    it("overlays the countdown over an announcement overlay", () => {
      cdStateMock = runningTakeover;
      mockStores({
        ...baseState(),
        overlay: { type: "announcement", text: "Culto às 19h" },
      });
      render(<LivePreview />);
      expect(screen.getByText("10:00")).toBeInTheDocument();
      expect(screen.queryByText("Culto às 19h")).toBeNull();
    });

    it("overlays the countdown over a media overlay", () => {
      cdStateMock = runningTakeover;
      mockStores(
        { ...baseState(), overlay: { type: "media", mediaId: "img-1" } },
        [mockImageMedia]
      );
      const { container } = render(<LivePreview />);
      expect(screen.getByText("10:00")).toBeInTheDocument();
      expect(container.querySelector("img")).toBeNull();
    });

    it("does not overlay when takeover is false (normal precedence)", () => {
      cdStateMock = { ...runningTakeover, takeover: false };
      mockStores(baseState());
      render(<LivePreview />);
      expect(screen.getByText("Aleluia")).toBeInTheDocument();
      expect(screen.queryByText("10:00")).toBeNull();
    });

    // ── T19: mirrored appearance for the synthetic takeover config ─────────────
    it("renders the takeover preview bottom-right when countdown.position is bottom-right", () => {
      cdStateMock = { ...runningTakeover, position: "bottom-right" };
      mockStores(baseState());
      const { container } = render(<LivePreview />);
      const positioned = container.querySelector(".justify-end.items-end.text-right");
      expect(positioned).toBeTruthy();
      expect(container.querySelector(".justify-center.items-center.text-center")).toBeNull();
    });

    it("renders the takeover preview with the mirrored message/digits scales", () => {
      cdStateMock = {
        ...runningTakeover,
        message: "Volta já já",
        messageScale: 150,
        digitsScale: 60,
      };
      mockStores(baseState());
      render(<LivePreview />);
      const wrapper = screen.getByTestId("countdown-renderer-config");
      expect(wrapper.getAttribute("data-message-scale")).toBe("150");
      expect(wrapper.getAttribute("data-digits-scale")).toBe("60");
      // The underlying renderer still shows the mirrored message/digits.
      expect(screen.getByText("Volta já já")).toBeInTheDocument();
      expect(screen.getByText("10:00")).toBeInTheDocument();
    });
  });
});
