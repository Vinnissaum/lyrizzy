// Preview-only TypeScript port of the Rust slide splitter + casing transform.
//
// IMPORTANT: Rust (`src-tauri/src/services/slide_splitter.rs` and
// `TextCasing::apply` in `src-tauri/src/domain/song.rs`) remains the single
// source of truth for the live presentation path. This port exists solely so
// the song editor can show a faithful per-section preview without round-tripping
// to the backend. The unit tests in `slidePreview.test.ts` mirror the Rust test
// cases so the two implementations stay in sync.

import type { RepeatMode, TextCasing } from "../types";

/** Default lines-per-slide, mirroring `SlideConfig::default().max_lines`. */
export const DEFAULT_MAX_LINES = 4;

/**
 * Capitalize the first character of each whitespace-separated word and
 * lowercase the rest, preserving whitespace runs. Mirrors Rust `title_case`,
 * which splits inclusively on each whitespace char.
 */
function titleCase(line: string): string {
  const segments = line.match(/[\s\S]*?\s|[\s\S]+$/g);
  if (!segments) return "";
  return segments
    .map((word) => {
      const first = word.charAt(0);
      return first.toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
}

/** Apply a casing transform to one display line. Mirrors `TextCasing::apply`. */
export function applyCasing(line: string, casing: TextCasing): string {
  switch (casing) {
    case "upper":
      return line.toUpperCase();
    case "lower":
      return line.toLowerCase();
    case "title":
      return titleCase(line);
    case "normal":
    default:
      return line;
  }
}

export interface SplitOptions {
  maxLines?: number;
  casing?: TextCasing;
  repeatCount?: number;
  repeatMode?: RepeatMode;
}

/**
 * Split a section body into slides (each an array of display lines), mirroring
 * `slide_splitter::split_with_casing`:
 *   - one written line = one display line (kept verbatim),
 *   - a blank line forces a slide boundary,
 *   - a slide breaks when it reaches `maxLines`,
 *   - `duplicate` repeats the slide list `repeatCount` times, while `annotate`
 *     appends an `(Nx)` marker to the section's last slide instead.
 */
export function splitSectionBody(body: string, opts: SplitOptions = {}): string[][] {
  const maxLines = opts.maxLines ?? DEFAULT_MAX_LINES;
  const casing = opts.casing ?? "normal";
  const repeatCount = opts.repeatCount ?? 1;
  const repeatMode = opts.repeatMode ?? "duplicate";

  if (body.trim() === "") return [];

  const slides: string[][] = [];
  let current: string[] = [];

  for (const rawLine of body.split("\n")) {
    if (rawLine.trim() === "") {
      // Blank line = forced slide boundary.
      if (current.length > 0) {
        slides.push(current);
        current = [];
      }
    } else {
      if (current.length >= maxLines) {
        slides.push(current);
        current = [];
      }
      current.push(applyCasing(rawLine, casing));
    }
  }
  if (current.length > 0) slides.push(current);

  const repeat = Math.max(repeatCount, 1);
  if (repeat > 1 && slides.length > 0) {
    if (repeatMode === "annotate") {
      const last = slides[slides.length - 1];
      last.push(`(${repeat}x)`);
    } else {
      const base = slides.map((lines) => [...lines]);
      for (let i = 1; i < repeat; i++) {
        for (const lines of base) slides.push([...lines]);
      }
    }
  }

  return slides;
}
