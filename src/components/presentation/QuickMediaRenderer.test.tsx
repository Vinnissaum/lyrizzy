import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { QuickMediaRenderer } from "./QuickMediaRenderer";

vi.mock("../../stores/media", () => ({
  useMediaStore: vi.fn(),
}));

import { useMediaStore } from "../../stores/media";

const mockImage = {
  id: "m1",
  fileName: "offer.jpg",
  displayName: "Oferta",
  kind: "image" as const,
  mimeType: "image/jpeg",
  byteSize: 1000,
  createdAt: 0,
  updatedAt: 0,
};

describe("QuickMediaRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an img when media is found", () => {
    vi.mocked(useMediaStore).mockReturnValue({
      media: [mockImage],
      refresh: vi.fn(),
    } as ReturnType<typeof useMediaStore>);

    const { container } = render(<QuickMediaRenderer mediaId="m1" />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.src).toContain("offer.jpg");
  });

  it("renders a black fallback when media id is not found", () => {
    vi.mocked(useMediaStore).mockReturnValue({
      media: [],
      refresh: vi.fn(),
    } as ReturnType<typeof useMediaStore>);

    const { container } = render(<QuickMediaRenderer mediaId="missing" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("bg-black");
    expect(container.querySelector("img")).toBeNull();
  });

  it("an overlay for media the wall has not loaded reloads the library", () => {
    // The wall's list predates the upload: m1 is not in it.
    const refresh = vi.fn();
    vi.mocked(useMediaStore).mockReturnValue({
      media: [],
      refresh,
    } as unknown as ReturnType<typeof useMediaStore>);
    const { container, rerender } = render(<QuickMediaRenderer mediaId="m1" />);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(container.querySelector("img")).toBeNull();

    // The reload lands: the image renders, and nothing reloads again.
    vi.mocked(useMediaStore).mockReturnValue({
      media: [mockImage],
      refresh,
    } as unknown as ReturnType<typeof useMediaStore>);
    rerender(<QuickMediaRenderer mediaId="m1" />);
    expect(container.querySelector("img")?.src).toContain("offer.jpg");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("media the wall already holds does not reload the library", () => {
    const refresh = vi.fn();
    vi.mocked(useMediaStore).mockReturnValue({
      media: [mockImage],
      refresh,
    } as unknown as ReturnType<typeof useMediaStore>);
    render(<QuickMediaRenderer mediaId="m1" />);
    expect(refresh).not.toHaveBeenCalled();
  });
});
