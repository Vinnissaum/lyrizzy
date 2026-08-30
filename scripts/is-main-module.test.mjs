import { describe, it, expect } from "vitest";
import { pathToFileURL } from "node:url";
import { isMainModule } from "./is-main-module.mjs";

describe("isMainModule", () => {
  it("is true when argv[1] is the module's own path", () => {
    const posixPath = "/repo/scripts/bump-version.mjs";
    expect(isMainModule(pathToFileURL(posixPath).href, posixPath)).toBe(true);
  });

  it("is true for a Windows path whose URL form differs textually", () => {
    // The regression this module exists for: `file://` + a native Windows path
    // produces `file://C:\repo\scripts\x.mjs`, which never equals the real
    // `import.meta.url` of `file:///C:/repo/scripts/x.mjs`. Every CLI guarded
    // by that concatenation silently no-ops on Windows.
    const winPath = "C:\\repo\\scripts\\bump-version.mjs";
    const moduleUrl = "file:///C:/repo/scripts/bump-version.mjs";

    expect(pathToFileURL(winPath).href).toBe(moduleUrl);
    expect(isMainModule(moduleUrl, winPath)).toBe(true);
    // The old, broken comparison, kept as an explicit contrast.
    expect(moduleUrl === `file://${winPath}`).toBe(false);
  });

  it("is false when a different module is the entrypoint", () => {
    const entry = "/repo/scripts/check-version.mjs";
    const other = pathToFileURL("/repo/scripts/bump-version.mjs").href;
    expect(isMainModule(other, entry)).toBe(false);
  });

  it("is false when there is no argv[1] (imported, e.g. by a test runner)", () => {
    expect(isMainModule("file:///repo/scripts/bump-version.mjs", undefined)).toBe(false);
    expect(isMainModule("file:///repo/scripts/bump-version.mjs", "")).toBe(false);
  });

  it("matches paths that need percent-encoding", () => {
    // A repo checked out under "C:\My Repos\..." — a raw concatenation leaves
    // the space unencoded and stops matching.
    const spaced = "/repo/my scripts/bump-version.mjs";
    const url = pathToFileURL(spaced).href;
    expect(url).toContain("%20");
    expect(isMainModule(url, spaced)).toBe(true);
  });
});
