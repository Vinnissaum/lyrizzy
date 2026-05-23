import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SlideshowRenderer } from "./SlideshowRenderer";

describe("SlideshowRenderer", () => {
  it("renders img with the correct padded slide URL", () => {
    const { getByTestId } = render(
      <SlideshowRenderer mediaId="abc-123" slideIndex={2} />
    );
    const img = getByTestId("slideshow-image") as HTMLImageElement;
    expect(img.src).toContain("abc-123/slide_002.png");
  });

  it("renders placeholder when mediaId is empty", () => {
    const { getByTestId, queryByTestId } = render(
      <SlideshowRenderer mediaId="" slideIndex={0} />
    );
    expect(getByTestId("slideshow-placeholder")).toBeTruthy();
    expect(queryByTestId("slideshow-image")).toBeNull();
  });

  it("pads slide index to three digits", () => {
    const { getByTestId } = render(
      <SlideshowRenderer mediaId="xyz" slideIndex={10} />
    );
    const img = getByTestId("slideshow-image") as HTMLImageElement;
    expect(img.src).toContain("slide_010.png");
  });
});
