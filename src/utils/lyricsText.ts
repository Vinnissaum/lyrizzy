// Pure, deliberately independent transforms between free-text lyrics and the
// section payload shape used to save a song. This module does NOT parse
// `[Label]` bracket markers and does NOT reuse parse_plain_text or
// splitSectionBody — see design.md for rationale.

import type { SectionPayload } from "../api/commands";

export type SectionDraftPayload = Pick<
  SectionPayload,
  "label" | "type" | "body" | "sortOrder" | "repeatCount"
>;

/**
 * Splits free text into blocks on runs of one or more blank (whitespace-only)
 * lines. Each block is trimmed; empty blocks are dropped.
 */
export function lyricsToBlocks(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length > 0) {
      const block = current.join("\n").trim();
      if (block.length > 0) blocks.push(block);
      current = [];
    }
  };

  for (const line of lines) {
    if (line.trim().length === 0) {
      flush();
    } else {
      current.push(line);
    }
  }
  flush();

  return blocks;
}

/**
 * Maps blocks of lyric text into section draft payloads, one verse-typed
 * section per block, in order.
 */
export function blocksToSectionPayloads(
  blocks: string[],
): SectionDraftPayload[] {
  return blocks.map((body, i) => ({
    label: "",
    type: "verse",
    body,
    sortOrder: i,
    repeatCount: 1,
  }));
}

/**
 * Joins section bodies (trimmed) back into free text, separated by a blank
 * line, for display/editing as plain lyrics text.
 */
export function sectionsToLyrics(sections: { body: string }[]): string {
  return sections.map((s) => s.body.trim()).join("\n\n");
}
