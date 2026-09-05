import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SetItemList } from "./SetItemList";

vi.mock("../../stores/presentation", () => ({
  usePresentationStore: vi.fn(),
}));

vi.mock("../../stores/library", () => ({
  useLibraryStore: vi.fn(),
}));

vi.mock("../../stores/media", () => ({
  useMediaStore: vi.fn(),
}));

vi.mock("../../api/commands", () => ({
  goToItem: vi.fn().mockResolvedValue({}),
}));

import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import type { ServiceSet } from "../../types";

const selectSlide = vi.fn().mockResolvedValue(undefined);

const mockSet: ServiceSet = {
  id: "set-1",
  name: "Culto",
  createdAt: 0,
  updatedAt: 0,
  items: [
    { id: "item-1", setId: "set-1", itemType: "song", songId: "song-1", sortOrder: 0 },
    { id: "item-2", setId: "set-1", itemType: "media", mediaId: "media-1", mediaKind: "image", sortOrder: 1 },
    { id: "item-3", setId: "set-1", itemType: "countdown", sortOrder: 2,
      countdownConfig: { target: { kind: "duration", durationMs: 300000 }, endBehavior: "holdZero" } },
  ],
};

const mockSongs = [
  { id: "song-1", title: "Aleluia", artist: "", sections: [], language: "pt", scrimOpacity: 0, createdAt: 0, updatedAt: 0 },
];

const mockMedia = [
  { id: "media-1", fileName: "bg.jpg", displayName: "Fundo Azul", kind: "image" as const, mimeType: "image/jpeg", byteSize: 0, createdAt: 0, updatedAt: 0 },
];

describe("SetItemList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Provide a default getState so tests that don't override it don't crash on click
    Object.assign(vi.mocked(usePresentationStore), {
      getState: vi.fn().mockReturnValue({ state: { set: mockSet, currentItemIndex: 0 } }),
    });
    vi.mocked(useLibraryStore).mockImplementation((selector: any) =>
      selector ? selector({ songs: mockSongs }) : { songs: mockSongs }
    );
    vi.mocked(useMediaStore).mockImplementation((selector: any) =>
      selector ? selector({ media: mockMedia }) : { media: mockMedia }
    );
  });

  it("renders a button for each item in the set", () => {
    vi.mocked(usePresentationStore).mockImplementation((selector: (s: any) => any) =>
      selector({ state: { set: mockSet, currentItemIndex: 0 } })
    );

    render(<SetItemList />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
  });

  it("marks the active item row with aria-current='true'", () => {
    vi.mocked(usePresentationStore).mockImplementation((selector: (s: any) => any) =>
      selector({ state: { set: mockSet, currentItemIndex: 1 } })
    );

    render(<SetItemList />);

    const active = document.querySelector('[aria-current="true"]');
    expect(active).not.toBeNull();
    // Only one row is active
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
    // It's the second button (index 1)
    const buttons = screen.getAllByRole("button");
    expect(buttons[1].getAttribute("aria-current")).toBe("true");
  });

  it("calls selectSlide(idx, 0) when a non-active row is clicked", () => {
    vi.mocked(usePresentationStore).mockImplementation((selector: (s: any) => any) =>
      selector({ state: { set: mockSet, currentItemIndex: 0 }, selectSlide })
    );
    Object.assign(vi.mocked(usePresentationStore), {
      getState: vi.fn().mockReturnValue({ state: { set: mockSet, currentItemIndex: 0 } }),
    });

    render(<SetItemList />);

    const buttons = screen.getAllByRole("button");
    // Click the second item (idx 1), which is not active
    fireEvent.click(buttons[1]);
    expect(selectSlide).toHaveBeenCalledWith(1, 0);
  });

  it("does NOT call selectSlide when the active row is clicked", () => {
    vi.mocked(usePresentationStore).mockImplementation((selector: (s: any) => any) =>
      selector({ state: { set: mockSet, currentItemIndex: 0 }, selectSlide })
    );
    Object.assign(vi.mocked(usePresentationStore), {
      getState: vi.fn().mockReturnValue({ state: { set: mockSet, currentItemIndex: 0 } }),
    });

    render(<SetItemList />);

    const buttons = screen.getAllByRole("button");
    // Click the first item (idx 0), which is active
    fireEvent.click(buttons[0]);
    expect(selectSlide).not.toHaveBeenCalled();
  });

  // ── Closure-staleness: getState() read at click time ─────────────────────

  it("reads currentItemIndex from getState() at click time, not from the render closure", () => {
    // Render with currentItemIndex=1 (item-2 active)
    vi.mocked(usePresentationStore).mockImplementation((selector: (s: any) => any) =>
      selector({ state: { set: mockSet, currentItemIndex: 1 }, selectSlide })
    );
    // Store updates to currentItemIndex=2 before the click fires
    Object.assign(vi.mocked(usePresentationStore), {
      getState: vi.fn().mockReturnValue({ state: { set: mockSet, currentItemIndex: 2 } }),
    });

    render(<SetItemList />);

    const buttons = screen.getAllByRole("button");
    // Click item-1 (idx 0) — live active is idx 2, so this should fire
    fireEvent.click(buttons[0]);
    expect(selectSlide).toHaveBeenCalledWith(0, 0);
  });

  // ── P11-03: optimistic selection ─────────────────────────────────────────

  it("P11-03: highlights the pendingSelection item optimistically before authoritative state catches up", () => {
    // Authoritative state still on item 0, but a pending selection targets item 2.
    vi.mocked(usePresentationStore).mockImplementation((selector: (s: any) => any) =>
      selector({
        state: { set: mockSet, currentItemIndex: 0 },
        pendingSelection: { itemIndex: 2, slideIndex: 0 },
        selectSlide,
      })
    );

    render(<SetItemList />);

    // Exactly one optimistic active row, and it is the pending target (idx 2).
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
    const buttons = screen.getAllByRole("button");
    expect(buttons[2].getAttribute("aria-current")).toBe("true");
    // The authoritative index (0) is NOT highlighted while pending stands.
    expect(buttons[0].getAttribute("aria-current")).toBeNull();
  });

  it("P11-03: clicking a non-active item calls selectSlide(idx, 0)", () => {
    vi.mocked(usePresentationStore).mockImplementation((selector: (s: any) => any) =>
      selector({ state: { set: mockSet, currentItemIndex: 0 }, selectSlide })
    );
    // Live currentItemIndex differs from the clicked idx so the guard passes.
    Object.assign(vi.mocked(usePresentationStore), {
      getState: vi.fn().mockReturnValue({ state: { set: mockSet, currentItemIndex: 0 } }),
    });

    render(<SetItemList />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[2]);
    expect(selectSlide).toHaveBeenCalledWith(2, 0);
  });

  it("displays the item label (text only) for each row", () => {
    vi.mocked(usePresentationStore).mockImplementation((selector: (s: any) => any) =>
      selector({ state: { set: mockSet, currentItemIndex: 0 } })
    );

    render(<SetItemList />);

    // itemLabel now returns plain text; the type icon is a separate lucide SVG.
    expect(screen.getByText("Aleluia")).toBeInTheDocument();
    expect(screen.getByText("Fundo Azul")).toBeInTheDocument();
    // Unnamed countdown falls back to the localized default name — no duration.
    expect(screen.getByText("Cronômetro")).toBeInTheDocument();
  });
});
