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
});
