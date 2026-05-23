import { describe, it, expect } from "vitest";
import { mediaUrl } from "./assets";

describe("mediaUrl", () => {
  it("returns http://asset.localhost scheme for a plain file name", () => {
    expect(mediaUrl("foo.png")).toBe("http://asset.localhost/media/foo.png");
  });

  it("preserves subdirectory paths (e.g. slideshow frames)", () => {
    expect(mediaUrl("abc123/slide_000.png")).toBe(
      "http://asset.localhost/media/abc123/slide_000.png",
    );
  });
});
