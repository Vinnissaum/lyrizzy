import { describe, it, expect } from "vitest";
import { pathToFileURL } from "node:url";
import { isMainModule } from "./is-main-module.mjs";

const IS_WINDOWS = process.platform === "win32";

describe("isMainModule", () => {
  it("is true when argv[1] is the module's own path", () => {
    const p = "/repo/scripts/bump-version.mjs";
    expect(isMainModule(pathToFileURL(p).href, p)).toBe(true);
  });

  it("rejects the naive `file://` + path concatenation this module replaces", () => {
    // The regression, expressed portably. `pathToFileURL` percent-encodes and
    // re-roots the path, so its output is not the string concatenation — on
    // POSIX because of the space, on Windows because of the separators and the
    // drive letter too. A guard built by concatenation therefore never matches
    // `import.meta.url`, which is how three CLIs here became silent no-ops.
    const p = "/repo/my scripts/bump-version.mjs";
    const real = pathToFileURL(p).href;

    expect(real).not.toBe(`file://${p}`);
    expect(real).toContain("%20");
    expect(isMainModule(real, p)).toBe(true);
  });

  // The concrete Windows shape that regressed. `pathToFileURL` only treats
  // "C:\..." as an absolute path when it is actually running on Windows — on
  // Linux the backslashes are ordinary filename characters and the whole thing
  // resolves against the cwd — so this assertion is only meaningful there.
  it.skipIf(!IS_WINDOWS)("maps a Windows drive path to its file:/// form", () => {
    const winPath = "C:\\repo\\scripts\\bump-version.mjs";
    const moduleUrl = "file:///C:/repo/scripts/bump-version.mjs";

    expect(pathToFileURL(winPath).href).toBe(moduleUrl);
    expect(isMainModule(moduleUrl, winPath)).toBe(true);
    expect(moduleUrl === `file://${winPath}`).toBe(false);
  });

  it("is false when a different module is the entrypoint", () => {
    const entry = "/repo/scripts/check-version.mjs";
    const other = pathToFileURL("/repo/scripts/bump-version.mjs").href;
    expect(isMainModule(other, entry)).toBe(false);
  });

  it("is false when there is no argv[1] (imported, e.g. by a test runner)", () => {
    const url = pathToFileURL("/repo/scripts/bump-version.mjs").href;
    expect(isMainModule(url, undefined)).toBe(false);
    expect(isMainModule(url, "")).toBe(false);
  });
});
