import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PresentationState, Media } from "../../types";

// jsdom does not implement ResizeObserver — provide a minimal stub so SlideStage
// can mount without throwing in the test environment.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeEach(() => {
  if (typeof window.ResizeObserver === "undefined") {
    (window as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
      ResizeObserverStub;
  }
});
afterEach(() => {
  delete (window as unknown as { ResizeObserver?: typeof ResizeObserverStub }).ResizeObserver;
});

// Mutable mock backing state so individual tests can drive the render branch
// under test (live, idle, overlay, blank). Reset in beforeEach.
const liveState: PresentationState = {
  mode: "live",
  set: {
    id: "set-1",
    name: "Set",
    createdAt: 0,
    updatedAt: 0,
    items: [{ id: "item-1", itemType: "song", songId: "s1" } as never],
  },
  currentItemIndex: 0,
  currentSlideIndex: 0,
  currentSlide: {
    lines: ["Blessed be your name"],
    sectionLabel: "Verso 1",
    sectionId: "sec-1",
  },
  itemSlideCounts: [1],
};

let presStateMock: PresentationState | null = liveState;
let mediaMock: Media[] = [];

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const closeMock = vi.fn(() => Promise.resolve());
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ label: "presentation", close: closeMock }),
}));

vi.mock("../../stores/presentation", () => ({
  usePresentationStore: Object.assign(
    () => ({
      state: presStateMock,
      subscribe: vi.fn(() => Promise.resolve(() => {})),
      next: vi.fn(),
    }),
    { getState: () => ({ state: presStateMock, setMode: vi.fn() }) }
  ),
}));

vi.mock("../../stores/countdown", () => ({
  useCountdownStore: () => ({
    state: { mode: "idle", durationMs: 0, remainingMs: 0, endBehavior: "holdZero" },
    subscribe: vi.fn(() => Promise.resolve(() => {})),
    start: vi.fn(),
    arm: vi.fn(),
  }),
}));

vi.mock("../../stores/media", () => ({
  useMediaStore: Object.assign(
    () => ({
      media: mediaMock,
      refresh: vi.fn(),
    }),
    { getState: () => ({ media: mediaMock, refresh: vi.fn() }) }
  ),
}));

vi.mock("../../stores/settings", () => ({
  PRESENTATION_FONT_SIZE_KEY: "presentation.font_size",
  useSettingsStore: Object.assign(
    () => ({
      transitionMs: 0,
      reduceMotion: true,
      setLocale: vi.fn(),
      loadLocale: vi.fn(),
      presentationFontSize: "lg",
      presentationFontFamily: "sans",
      presentationPreset: "preto-branco",
      presentationPosition: "center",
      presentationMargin: "lg",
      presentationLineSpacing: "normal",
      presentationBoldLevel: "medium",
      loadPresentationSettings: vi.fn(),
    }),
    { getState: () => ({ announcementPreset: "preto-branco" }) }
  ),
}));

vi.mock("../../api/commands", () => ({
  onLocaleChanged: vi.fn(() => Promise.resolve(() => {})),
  onSettingChanged: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("../../runtime/keyboard", () => ({
  forwardKeydown: vi.fn(),
}));

import { PresentationApp } from "./PresentationApp";
import { forwardKeydown } from "../../runtime/keyboard";

const mediaItem = (id: string): Media =>
  ({
    id,
    fileName: `${id}.png`,
    kind: "image",
  } as Media);

describe("PresentationApp — SongSlide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presStateMock = liveState;
    mediaMock = [];
  });

  it("does not render the section label (strophe header) in song slide", () => {
    render(<PresentationApp />);
    expect(screen.queryByText("Verso 1")).toBeNull();
  });

  it("renders song slide lines", () => {
    render(<PresentationApp />);
    expect(screen.getByText("Blessed be your name")).toBeInTheDocument();
  });
});

describe("PresentationApp — overlay render precedence (P10-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presStateMock = liveState;
    mediaMock = [];
  });

  it("renders a media overlay over the idle waiting screen", () => {
    mediaMock = [mediaItem("m1")];
    presStateMock = {
      mode: "idle",
      currentItemIndex: 0,
      currentSlideIndex: 0,
      itemSlideCounts: [],
      overlay: { type: "media", mediaId: "m1" },
    };

    const { container } = render(<PresentationApp />);

    // The waiting text must NOT appear — the overlay wins over idle.
    expect(screen.queryByText("Aguardando apresentação…")).toBeNull();
    // The media overlay's <img> is rendered.
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("blank beats overlay — stays solid black even with an overlay set", () => {
    mediaMock = [mediaItem("m1")];
    presStateMock = {
      mode: "blank",
      currentItemIndex: 0,
      currentSlideIndex: 0,
      itemSlideCounts: [],
      overlay: { type: "media", mediaId: "m1" },
    };

    const { container } = render(<PresentationApp />);

    // Blackout: no overlay media element rendered.
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText("Aguardando apresentação…")).toBeNull();
    // Solid-black blank div.
    const black = container.querySelector("div.h-screen.bg-black");
    expect(black).not.toBeNull();
  });
});

describe("PresentationApp — Esc always escapes + local fallback (P10-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presStateMock = liveState;
    mediaMock = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function pressEscape() {
    const e = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(e);
    return e;
  }

  it("forwards Esc and fires the local close fallback after the timeout (idle, no overlay)", () => {
    vi.useFakeTimers();
    presStateMock = {
      mode: "idle",
      currentItemIndex: 0,
      currentSlideIndex: 0,
      itemSlideCounts: [],
    };

    render(<PresentationApp />);

    pressEscape();

    // Operator round-trip path always fires.
    expect(vi.mocked(forwardKeydown)).toHaveBeenCalledTimes(1);
    // Fallback has NOT fired yet (armed for ~400ms).
    expect(closeMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);

    // Local fallback closes the window when the round-trip stalls.
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("forwards Esc even with an overlay set while idle (operator clears overlay)", () => {
    vi.useFakeTimers();
    mediaMock = [mediaItem("m1")];
    presStateMock = {
      mode: "idle",
      currentItemIndex: 0,
      currentSlideIndex: 0,
      itemSlideCounts: [],
      overlay: { type: "media", mediaId: "m1" },
    };

    render(<PresentationApp />);

    const e = pressEscape();

    expect(e.defaultPrevented).toBe(true);
    expect(vi.mocked(forwardKeydown)).toHaveBeenCalledTimes(1);
  });

  it("double-Esc is idempotent — only one local close fires", () => {
    vi.useFakeTimers();
    presStateMock = {
      mode: "live",
      currentItemIndex: 0,
      currentSlideIndex: 0,
      itemSlideCounts: [],
    };

    render(<PresentationApp />);

    pressEscape();
    pressEscape();

    // Both presses forward to the operator…
    expect(vi.mocked(forwardKeydown)).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(400);

    // …but the fallback close is armed once (no double-close throw).
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
