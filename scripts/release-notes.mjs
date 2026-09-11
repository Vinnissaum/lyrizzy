#!/usr/bin/env node
// Pure release-notes composition: install line + either the auto-generated
// GitHub body (when it has real change entries) or a fallback list built
// from raw commit subjects (when the generated body is empty or has only a
// heading and compare link — e.g. a release with no merged PRs).
//
// No network, no `git`, no `fs` in the composition path itself — the CLI
// below owns reading the generated-body/commits files and writing stdout.

import { readFileSync } from "node:fs";
import { isMainModule } from "./is-main-module.mjs";

/** Commit subjects that never belong in a "What's Changed" list. */
export const NOISE_SUBJECT_PATTERNS = [/^chore\(release\):/];

const CHANGE_ENTRY_RE = /^\s*[*-]\s+\S/m;
const COMPARE_LINK_RE = /^\*\*Full Changelog\*\*:.*$/m;

/** True when `generatedBody` already carries at least one bullet entry. */
export function hasChangeEntries(generatedBody) {
  return CHANGE_ENTRY_RE.test(generatedBody ?? "");
}

/** Returns the "**Full Changelog**: ..." line from `generatedBody`, or null. */
export function extractCompareLink(generatedBody) {
  const match = COMPARE_LINK_RE.exec(generatedBody ?? "");
  return match ? match[0] : null;
}

/**
 * Composes final release notes.
 *
 * - Always starts with `installLine` + a blank line.
 * - If `generatedBody` has real change entries, it is appended verbatim.
 * - Otherwise a "## What's Changed" list is built from `commitSubjects`
 *   (dropping any matching `NOISE_SUBJECT_PATTERNS`), followed by a compare
 *   link — preferring one already in `generatedBody`, else built from
 *   `compareUrl`. The heading is omitted entirely when there are no
 *   surviving subjects and no compare link to show.
 */
export function composeReleaseNotes({ generatedBody, commitSubjects, installLine, compareUrl }) {
  const header = `${installLine}\n`;

  if (hasChangeEntries(generatedBody)) {
    return `${header}\n${generatedBody}`;
  }

  const survivingSubjects = (commitSubjects ?? []).filter(
    (subject) => !NOISE_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject)),
  );

  const compareLine = extractCompareLink(generatedBody) ?? (compareUrl ? `**Full Changelog**: ${compareUrl}` : null);

  if (survivingSubjects.length === 0 && !compareLine) {
    return header;
  }

  const lines = [];
  if (survivingSubjects.length > 0) {
    lines.push("## What's Changed", ...survivingSubjects.map((subject) => `* ${subject}`));
    if (compareLine) lines.push("", compareLine);
  } else if (compareLine) {
    lines.push(compareLine);
  }

  return `${header}\n${lines.join("\n")}`;
}

if (isMainModule(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const idx = args.indexOf(name);
    return idx === -1 ? undefined : args[idx + 1];
  };

  const generatedPath = flag("--generated");
  const commitsPath = flag("--commits");
  const installLine = flag("--install-line");
  const compareUrl = flag("--compare-url");

  if (!generatedPath || !commitsPath || !installLine) {
    console.error(
      "usage: node scripts/release-notes.mjs --generated <file> --commits <file> --install-line <str> [--compare-url <str>]",
    );
    process.exit(1);
  }

  const generatedBody = readFileSync(generatedPath, "utf8");
  const commitSubjects = readFileSync(commitsPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  process.stdout.write(
    composeReleaseNotes({ generatedBody, commitSubjects, installLine, compareUrl }),
  );
}
