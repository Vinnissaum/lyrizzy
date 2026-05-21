import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("../../stores/presentation", () => ({
  usePresentationStore: () => ({
    state: {
      mode: "live",
      set: {
        items: [{ id: "item-1", itemType: "song", songId: "s1" }],
      },
      currentItemIndex: 0,
      currentSlideIndex: 0,
      currentSlide: {
        lines: ["Blessed be your name"],
        sectionLabel: "Verso 1",
        sectionId: "sec-1",
      },
      background: null,
      itemSlideCounts: [1],
    },
    subscribe: vi.fn(() => Promise.resolve(() => {})),
    next: vi.fn(),
  }),
}));

vi.mock("../../stores/countdown", () => ({
  useCountdownStore: () => ({
    state: { mode: "idle", durationMs: 0, remainingMs: 0, endBehavior: "holdZero" },
    subscribe: vi.fn(() => Promise.resolve(() => {})),
    start: vi.fn(),
  }),
}));

vi.mock("../../stores/media", () => ({
  useMediaStore: () => ({
    media: [],
    refresh: vi.fn(),
  }),
}));

vi.mock("../../stores/settings", () => ({
  useSettingsStore: () => ({
    transitionMs: 0,
    reduceMotion: true,
    setLocale: vi.fn(),
  }),
}));

vi.mock("../../api/commands", () => ({
  onLocaleChanged: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("../../runtime/keyboard", () => ({
  forwardKeydown: vi.fn(),
}));

import { PresentationApp } from "./PresentationApp";

describe("PresentationApp — SongSlide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
