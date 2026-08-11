import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Store mocks ──────────────────────────────────────────────────────────────
vi.mock("../../stores/presentation", () => ({
  usePresentationStore: vi.fn(),
}));

vi.mock("../../stores/library", () => ({
  useLibraryStore: vi.fn(),
}));

vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useSettingsStore } from "../../stores/settings";
import { OperatorNotesPanel } from "./OperatorNotesPanel";
import type { PresentationState, ServiceSet, Song } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: "song-1",
    title: "Aleluia",
    language: "pt",
    scrimOpacity: 0.5,
    createdAt: 0,
    updatedAt: 0,
    sections: [],
    ...overrides,
  };
}

function baseState(overrides: Partial<PresentationState> = {}): PresentationState {
  return {
    mode: "live",
    currentItemIndex: 0,
    currentSlideIndex: 0,
    itemSlideCounts: [2],
    set: mockSet,
    currentSlide: { lines: ["Aleluia"], sectionLabel: "Verse", sectionId: "s1" },
    ...overrides,
  };
}

function mockStores(
  state: PresentationState | null,
  songs: Song[] = [],
  settingsOverrides: Partial<{
    notesPanelCollapsed: boolean;
    setNotesPanelCollapsed: (collapsed: boolean) => void;
    loadNotesPanelCollapsed: () => Promise<void>;
  }> = {}
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(usePresentationStore).mockImplementation((selector?: (s: any) => unknown) => {
    const store = { state };
    if (typeof selector === "function") return selector(store) as ReturnType<typeof usePresentationStore>;
    return store as ReturnType<typeof usePresentationStore>;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useLibraryStore).mockImplementation((selector?: (s: any) => unknown) => {
    const store = { songs };
    if (typeof selector === "function") return selector(store) as ReturnType<typeof useLibraryStore>;
    return store as ReturnType<typeof useLibraryStore>;
  });

  const settings = {
    notesPanelCollapsed: false,
    setNotesPanelCollapsed: vi.fn(),
    loadNotesPanelCollapsed: vi.fn().mockResolvedValue(undefined),
    ...settingsOverrides,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useSettingsStore).mockImplementation((selector?: (s: any) => unknown) => {
    if (typeof selector === "function") return selector(settings) as ReturnType<typeof useSettingsStore>;
    return settings as ReturnType<typeof useSettingsStore>;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OperatorNotesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the song's own notes on every strophe of that song", () => {
    const song = makeSong({ notes: "Watch tempo change here" });

    mockStores(
      baseState({ currentSlide: { lines: ["Verse 1"], sectionLabel: "Verse", sectionId: "s1" } }),
      [song]
    );
    const { rerender } = render(<OperatorNotesPanel />);
    expect(screen.getByText("Watch tempo change here")).toBeInTheDocument();

    // Advance to a different strophe/section of the same song — notes persist.
    mockStores(
      baseState({ currentSlide: { lines: ["Chorus 1"], sectionLabel: "Chorus", sectionId: "s2" } }),
      [song]
    );
    rerender(<OperatorNotesPanel />);
    expect(screen.getByText("Watch tempo change here")).toBeInTheDocument();
  });

  it("hides the panel when the song has no notes", () => {
    const song = makeSong({ notes: undefined });
    mockStores(baseState(), [song]);
    const { container } = render(<OperatorNotesPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("leaves non-song item notes unchanged", () => {
    const state = baseState({
      set: {
        ...mockSet,
        items: [
          {
            id: "item-1",
            setId: "set-1",
            itemType: "media",
            notes: "Read slowly",
            sortOrder: 0,
          },
        ],
      },
    });
    mockStores(state, []);
    render(<OperatorNotesPanel />);
    expect(screen.getByText("Read slowly")).toBeInTheDocument();
  });

  it("shows nothing for a legacy song carrying section notes but no song-level notes", () => {
    const song = makeSong({
      notes: undefined,
      sections: [
        {
          id: "s1",
          songId: "song-1",
          label: "Verse 1",
          type: "verse",
          body: "Aleluia",
          sortOrder: 0,
          repeatCount: 1,
          notes: "Old per-section note",
        },
      ],
    });
    mockStores(
      baseState({ currentSlide: { lines: ["Aleluia"], sectionLabel: "Verse", sectionId: "s1" } }),
      [song]
    );
    const { container } = render(<OperatorNotesPanel />);
    expect(screen.queryByText("Old per-section note")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });
});
