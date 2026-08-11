import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StreamProfileSwitcher } from "./StreamProfileSwitcher";

vi.mock("../../stores/presentation", () => ({ usePresentationStore: vi.fn() }));
vi.mock("../../api/commands", () => ({
  updateSetItem: vi.fn(),
}));

import { usePresentationStore } from "../../stores/presentation";
import { updateSetItem } from "../../api/commands";
import type { SetItem, WebViewConfig } from "../../types";

function mockItem(webviewConfig?: WebViewConfig): SetItem {
  return {
    id: "item-1",
    setId: "set-1",
    itemType: "web_view",
    sortOrder: 0,
    webviewConfig,
  };
}

function mockStore(item: SetItem) {
  vi.mocked(usePresentationStore).mockImplementation((sel: any) =>
    sel({
      state: {
        set: { id: "set-1", name: "Culto", items: [item] },
        currentItemIndex: 0,
      },
    }),
  );
}

const baseConfig: WebViewConfig = {
  mode: "rtsp",
  url: "rtsp://fallback",
  profiles: [
    { id: "p1", label: "Wide", url: "rtsp://wide" },
    { id: "p2", label: "Tight", url: "rtsp://tight" },
  ],
};

describe("StreamProfileSwitcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing when the item has 0 profiles", () => {
    mockStore(mockItem({ mode: "rtsp", url: "rtsp://x", profiles: [] }));
    render(<StreamProfileSwitcher />);
    expect(screen.queryByTestId("stream-profile-switcher")).toBeNull();
  });

  it("renders nothing when the item has only 1 profile", () => {
    mockStore(
      mockItem({
        mode: "rtsp",
        url: "rtsp://x",
        profiles: [{ id: "p1", label: "Wide", url: "rtsp://wide" }],
      }),
    );
    render(<StreamProfileSwitcher />);
    expect(screen.queryByTestId("stream-profile-switcher")).toBeNull();
  });

  it("renders when the item has 2+ profiles", () => {
    mockStore(mockItem(baseConfig));
    render(<StreamProfileSwitcher />);
    expect(screen.getByTestId("stream-profile-switcher")).toBeInTheDocument();
    expect(screen.getByText("Wide")).toBeInTheDocument();
    expect(screen.getByText("Tight")).toBeInTheDocument();
  });

  it("clicking a profile calls updateSetItem with the new activeProfileId and the untouched profiles array", async () => {
    vi.mocked(updateSetItem).mockResolvedValue({} as SetItem);
    mockStore(mockItem(baseConfig));
    render(<StreamProfileSwitcher />);

    fireEvent.click(screen.getByText("Tight"));

    await waitFor(() => expect(updateSetItem).toHaveBeenCalled());
    expect(updateSetItem).toHaveBeenCalledWith({
      id: "item-1",
      webviewConfig: {
        ...baseConfig,
        activeProfileId: "p2",
      },
    });
    const call = vi.mocked(updateSetItem).mock.calls[0][0];
    expect(call.webviewConfig?.profiles).toEqual(baseConfig.profiles);
  });

  it("reverts to the previous profile when updateSetItem rejects", async () => {
    vi.mocked(updateSetItem).mockRejectedValue(new Error("boom"));
    mockStore(mockItem({ ...baseConfig, activeProfileId: "p1" }));
    render(<StreamProfileSwitcher />);

    const tightButton = screen.getByText("Tight");
    fireEvent.click(tightButton);

    // Optimistically selected right away.
    await waitFor(() =>
      expect(tightButton.getAttribute("aria-pressed")).toBe("true"),
    );

    // Reverts once the update rejects.
    await waitFor(() =>
      expect(tightButton.getAttribute("aria-pressed")).toBe("false"),
    );
    expect(screen.getByText("Wide").getAttribute("aria-pressed")).toBe("true");
  });

  it("reads the persisted activeProfileId back on mount", () => {
    mockStore(mockItem({ ...baseConfig, activeProfileId: "p2" }));
    render(<StreamProfileSwitcher />);
    expect(screen.getByText("Tight").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Wide").getAttribute("aria-pressed")).toBe("false");
  });
});
