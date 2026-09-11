import { describe, it, expect } from "vitest";
import { composeReleaseNotes } from "./release-notes.mjs";

const INSTALL_LINE = "Baixe o instalador para a sua plataforma abaixo.";
const COMPARE_URL = "https://github.com/Vinnissaum/lyrizzy/compare/v1.4.0...v1.5.0";

describe("composeReleaseNotes", () => {
  it("passes generated body with * entries through verbatim under the install line", () => {
    const generatedBody = [
      "## What's Changed",
      "* fix(countdown): launch re-arm keeps position by @Vinnissaum",
      "* feat(sets): Home edits and presents the selected set by @Vinnissaum",
      "",
      `**Full Changelog**: ${COMPARE_URL}`,
    ].join("\n");

    const result = composeReleaseNotes({
      generatedBody,
      commitSubjects: [],
      installLine: INSTALL_LINE,
      compareUrl: COMPARE_URL,
    });

    expect(result).toBe(`${INSTALL_LINE}\n\n${generatedBody}`);
  });

  it("falls back to the commit list when generated body has only heading + compare link", () => {
    const generatedBody = ["## What's Changed", "", `**Full Changelog**: ${COMPARE_URL}`].join(
      "\n",
    );

    const result = composeReleaseNotes({
      generatedBody,
      commitSubjects: ["feat(sets): Home edits and presents the selected set"],
      installLine: INSTALL_LINE,
      compareUrl: COMPARE_URL,
    });

    expect(result).toContain("## What's Changed");
    expect(result).toContain("* feat(sets): Home edits and presents the selected set");
  });

  it("preserves the compare link from the generated body in the fallback", () => {
    const generatedBody = ["## What's Changed", "", `**Full Changelog**: ${COMPARE_URL}`].join(
      "\n",
    );

    const result = composeReleaseNotes({
      generatedBody,
      commitSubjects: ["feat(sets): Home edits and presents the selected set"],
      installLine: INSTALL_LINE,
      compareUrl: undefined,
    });

    expect(result).toContain(`**Full Changelog**: ${COMPARE_URL}`);
  });

  it("uses compareUrl when the generated body carries no link", () => {
    const result = composeReleaseNotes({
      generatedBody: "",
      commitSubjects: ["feat(sets): Home edits and presents the selected set"],
      installLine: INSTALL_LINE,
      compareUrl: COMPARE_URL,
    });

    expect(result).toContain(`**Full Changelog**: ${COMPARE_URL}`);
  });

  it("drops a chore(release): bump version subject", () => {
    const result = composeReleaseNotes({
      generatedBody: "",
      commitSubjects: [
        "feat(sets): Home edits and presents the selected set",
        "chore(release): bump version to 1.5.0",
      ],
      installLine: INSTALL_LINE,
      compareUrl: COMPARE_URL,
    });

    expect(result).not.toContain("chore(release)");
    expect(result).toContain("* feat(sets): Home edits and presents the selected set");
  });

  it("omits an empty What's Changed heading when there are no surviving subjects or entries", () => {
    const resultWithLink = composeReleaseNotes({
      generatedBody: "",
      commitSubjects: ["chore(release): bump version to 1.5.0"],
      installLine: INSTALL_LINE,
      compareUrl: COMPARE_URL,
    });
    expect(resultWithLink).not.toContain("## What's Changed");
    expect(resultWithLink).toBe(`${INSTALL_LINE}\n\n**Full Changelog**: ${COMPARE_URL}`);

    const resultWithoutLink = composeReleaseNotes({
      generatedBody: "",
      commitSubjects: [],
      installLine: INSTALL_LINE,
      compareUrl: undefined,
    });
    expect(resultWithoutLink).not.toContain("## What's Changed");
    expect(resultWithoutLink).toBe(`${INSTALL_LINE}\n`);
  });

  it("always emits the install line first", () => {
    const result = composeReleaseNotes({
      generatedBody: "* some entry",
      commitSubjects: [],
      installLine: INSTALL_LINE,
      compareUrl: COMPARE_URL,
    });

    expect(result.split("\n")[0]).toBe(INSTALL_LINE);
  });
});
