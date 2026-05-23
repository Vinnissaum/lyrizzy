import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { SlideshowSetItemEditor } from "./SlideshowSetItemEditor";
import type { SetItem } from "../../types";

vi.mock("../../stores/media", () => ({
  useMediaStore: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "media.slideshow.slides") return `${opts?.count} slides`;
      if (key === "media.slideshow.slide") return "1 slide";
      return key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { useMediaStore } from "../../stores/media";

const mockMedia = {
  id: "pres-1",
  fileName: "pres-1.pptx",
  displayName: "My Slides",
  kind: "presentation" as const,
  mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  byteSize: 50000,
  slideCount: 5,
  createdAt: 0,
  updatedAt: 0,
};

const mockItem: SetItem = {
  id: "item-1",
  setId: "set-1",
  itemType: "slide_show",
  mediaId: "pres-1",
  sortOrder: 0,
};

describe("SlideshowSetItemEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders thumbnail with first-slide URL", () => {
    vi.mocked(useMediaStore).mockReturnValue({
      media: [mockMedia],
    } as ReturnType<typeof useMediaStore>);

    const { container } = render(<SlideshowSetItemEditor item={mockItem} />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain("pres-1/slide_000.png");
  });

  it("shows slide count", () => {
    vi.mocked(useMediaStore).mockReturnValue({
      media: [mockMedia],
    } as ReturnType<typeof useMediaStore>);

    const { getByText } = render(<SlideshowSetItemEditor item={mockItem} />);
    expect(getByText("5 slides")).toBeTruthy();
  });

  it("shows invalid ref when media is not found", () => {
    vi.mocked(useMediaStore).mockReturnValue({
      media: [],
    } as ReturnType<typeof useMediaStore>);

    const { getByText } = render(<SlideshowSetItemEditor item={mockItem} />);
    expect(getByText("builder.invalidRef")).toBeTruthy();
  });
});
