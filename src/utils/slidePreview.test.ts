import { describe, it, expect } from "vitest";
import { applyCasing, splitSectionBody } from "./slidePreview";

// These mirror the Rust slide_splitter + TextCasing tests so the preview-only
// TS port stays in sync with the source-of-truth backend logic.

describe("splitSectionBody", () => {
  it("keeps a single slide when lines fit", () => {
    const slides = splitSectionBody(
      "Amazing grace\nHow sweet the sound\nThat saved a wretch"
    );
    expect(slides).toHaveLength(1);
    expect(slides[0]).toHaveLength(3);
  });

  it("splits by max line count (default 4)", () => {
    const body = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8";
    const slides = splitSectionBody(body);
    expect(slides).toHaveLength(2);
    expect(slides[0]).toHaveLength(4);
    expect(slides[1]).toHaveLength(4);
  });

  it("keeps a long line verbatim as one display line", () => {
    const long = "uma frase bem comprida que antes seria quebrada em sessenta caracteres";
    const slides = splitSectionBody(long, { maxLines: 10 });
    expect(slides).toHaveLength(1);
    expect(slides[0]).toEqual([long]);
  });

  it("returns empty for empty or whitespace-only body", () => {
    expect(splitSectionBody("")).toEqual([]);
    expect(splitSectionBody("   \n  \n  ")).toEqual([]);
  });

  it("duplicates slides for repeat count", () => {
    const slides = splitSectionBody("Line A\nLine B", { repeatCount: 3 });
    expect(slides).toHaveLength(3);
    expect(slides[0]).toEqual(slides[1]);
    expect(slides[1]).toEqual(slides[2]);
  });

  it("annotate mode marks the last slide instead of duplicating", () => {
    const slides = splitSectionBody("Line A\nLine B", {
      repeatCount: 2,
      repeatMode: "annotate",
    });
    expect(slides).toHaveLength(1);
    expect(slides[0]).toEqual(["Line A", "Line B", "(2x)"]);
  });

  it("annotate mode marks only the section's last slide", () => {
    const body = "L1\nL2\nL3\nL4\nL5\nL6";
    const slides = splitSectionBody(body, { repeatCount: 3, repeatMode: "annotate" });
    expect(slides).toHaveLength(2);
    expect(slides[0]).not.toContain("(3x)");
    expect(slides[1][slides[1].length - 1]).toBe("(3x)");
  });

  it("does not annotate when repeat is one", () => {
    const slides = splitSectionBody("Line A\nLine B", {
      repeatCount: 1,
      repeatMode: "annotate",
    });
    expect(slides).toEqual([["Line A", "Line B"]]);
  });

  it("forces a slide boundary on blank lines", () => {
    const body = "Verse line one\nVerse line two\n\nChorus line one\nChorus line two";
    const slides = splitSectionBody(body);
    expect(slides).toHaveLength(2);
    expect(slides[0]).toEqual(["Verse line one", "Verse line two"]);
    expect(slides[1]).toEqual(["Chorus line one", "Chorus line two"]);
  });

  it("applies casing to every display line", () => {
    const slides = splitSectionBody("graça divina\nque me salvou", { casing: "upper" });
    expect(slides[0]).toEqual(["GRAÇA DIVINA", "QUE ME SALVOU"]);
  });
});

describe("applyCasing", () => {
  it("matches the Rust TextCasing cases", () => {
    expect(applyCasing("Graça Divina", "normal")).toBe("Graça Divina");
    expect(applyCasing("Graça divina", "upper")).toBe("GRAÇA DIVINA");
    expect(applyCasing("Graça DIVINA", "lower")).toBe("graça divina");
    expect(applyCasing("graça DIVINA é", "title")).toBe("Graça Divina É");
  });

  it("preserves whitespace runs in title case", () => {
    expect(applyCasing("a  b", "title")).toBe("A  B");
  });
});
