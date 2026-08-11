import { describe, it, expect } from "vitest";
import {
  lyricsToBlocks,
  blocksToSectionPayloads,
  sectionsToLyrics,
} from "./lyricsText";

describe("lyricsToBlocks", () => {
  it("keeps a single newline as a line break inside one block", () => {
    expect(lyricsToBlocks("line one\nline two")).toEqual([
      "line one\nline two",
    ]);
  });

  it("starts a new block on a blank line", () => {
    expect(lyricsToBlocks("verse one\n\nverse two")).toEqual([
      "verse one",
      "verse two",
    ]);
  });

  it("collapses two or more consecutive blank lines into one boundary with no empty sections", () => {
    expect(lyricsToBlocks("verse one\n\n\n\n\nverse two")).toEqual([
      "verse one",
      "verse two",
    ]);
  });

  it("trims leading and trailing blank lines without producing empty sections", () => {
    expect(lyricsToBlocks("\n\n\nverse one\n\nverse two\n\n\n")).toEqual([
      "verse one",
      "verse two",
    ]);
  });

  it("treats whitespace-only lines as blank for boundary purposes", () => {
    expect(lyricsToBlocks("verse one\n   \t \nverse two")).toEqual([
      "verse one",
      "verse two",
    ]);
  });

  it("returns [] for empty input", () => {
    expect(lyricsToBlocks("")).toEqual([]);
  });

  it("returns [] for whitespace-only input", () => {
    expect(lyricsToBlocks("   \n\t\n   \n")).toEqual([]);
  });
});

describe("blocksToSectionPayloads", () => {
  it("maps each block to a verse-typed section draft in order", () => {
    const payloads = blocksToSectionPayloads(["first block", "second block"]);
    expect(payloads).toEqual([
      { label: "", type: "verse", body: "first block", sortOrder: 0, repeatCount: 1 },
      { label: "", type: "verse", body: "second block", sortOrder: 1, repeatCount: 1 },
    ]);
  });

  it("returns [] for [] input", () => {
    expect(blocksToSectionPayloads([])).toEqual([]);
  });
});

describe("sectionsToLyrics", () => {
  it("joins trimmed bodies with a blank line", () => {
    expect(
      sectionsToLyrics([{ body: "  first  " }, { body: "second\n" }]),
    ).toBe("first\n\nsecond");
  });
});

describe("round-trip contract", () => {
  const cases = [
    "verse one\n\nverse two",
    "line a\nline b\n\n\n\nline c",
    "\n\nverse one\n\nverse two\n\n",
    "just one block, no blank lines here",
  ];

  it.each(cases)("is stable through blocks -> payloads -> lyrics for %s", (t) => {
    const blocks = lyricsToBlocks(t);
    const payloads = blocksToSectionPayloads(blocks);
    const roundTripped = sectionsToLyrics(payloads);
    expect(roundTripped).toBe(blocks.join("\n\n"));

    // feeding the round-tripped text back through must be a no-op (stable)
    const secondBlocks = lyricsToBlocks(roundTripped);
    const secondPayloads = blocksToSectionPayloads(secondBlocks);
    expect(sectionsToLyrics(secondPayloads)).toBe(roundTripped);
  });

  it("normalises a legacy section body containing its own blank line into two blocks on next save", () => {
    // Simulates a pre-existing section whose stored body has an internal
    // blank line (legacy data), fed through lyricsToBlocks as if the user
    // opened it as plain text and saved again.
    const legacySection = { body: "verse line one\n\nverse line two" };
    const lyrics = sectionsToLyrics([legacySection]);
    const blocks = lyricsToBlocks(lyrics);

    expect(blocks).toEqual(["verse line one", "verse line two"]);
    expect(blocks.every((b) => b.length > 0)).toBe(true);

    const payloads = blocksToSectionPayloads(blocks);
    expect(payloads).toHaveLength(2);
  });
});
