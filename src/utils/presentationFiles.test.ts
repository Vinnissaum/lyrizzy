import { describe, it, expect } from "vitest";
import { PRESENTATION_EXTENSIONS } from "./presentationFiles";

describe("PRESENTATION_EXTENSIONS", () => {
  it("offers the PowerPoint slide-show formats alongside the editable ones", () => {
    expect(PRESENTATION_EXTENSIONS).toEqual(["pptx", "ppsx", "ppt", "pps", "odp", "pdf"]);
  });

  it("lists bare lowercase extensions, as the dialog filter expects", () => {
    for (const ext of PRESENTATION_EXTENSIONS) {
      expect(ext).toMatch(/^[a-z]+$/);
    }
  });
});
