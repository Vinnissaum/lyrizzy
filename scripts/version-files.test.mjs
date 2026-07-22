import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  parseVersion,
  stripTagPrefix,
  setTauriConfVersion,
  readVersionFromTauriConf,
  setCargoTomlVersion,
  readVersionFromCargoToml,
  setCargoLockVersion,
  readVersionFromCargoLock,
  readVersionFromPackageJson,
  compareVersions,
} from "./version-files.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

describe("parseVersion", () => {
  it("accepts strict MAJOR.MINOR.PATCH", () => {
    expect(parseVersion("1.2.0")).toBe("1.2.0");
    expect(parseVersion("0.1.0")).toBe("0.1.0");
    expect(parseVersion("10.20.300")).toBe("10.20.300");
  });

  it("rejects a leading v prefix", () => {
    expect(parseVersion("v1.2.0")).toBeNull();
  });

  it("rejects a two-part version", () => {
    expect(parseVersion("1.2")).toBeNull();
  });

  it("rejects a pre-release suffix", () => {
    expect(parseVersion("1.2.0-beta")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseVersion("abc")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parseVersion("")).toBeNull();
  });
});

describe("stripTagPrefix", () => {
  it("strips a leading v", () => {
    expect(stripTagPrefix("v1.2.0")).toBe("1.2.0");
  });

  it("is a no-op when there is no v prefix", () => {
    expect(stripTagPrefix("1.2.0")).toBe("1.2.0");
  });
});

describe("setTauriConfVersion / readVersionFromTauriConf", () => {
  it("rewrites the top-level version field", () => {
    const text = readFileSync(path.join(repoRoot, "src-tauri/tauri.conf.json"), "utf8");
    const updated = setTauriConfVersion(text, "9.9.9");
    expect(readVersionFromTauriConf(updated)).toBe("9.9.9");
  });

  it("leaves a differently-indented nested version key untouched", () => {
    const synthetic = [
      "{",
      '  "version": "0.1.0",',
      '  "plugins": {',
      '    "updater": {',
      '      "version": "should-not-change"',
      "    }",
      "  }",
      "}",
    ].join("\n");
    const updated = setTauriConfVersion(synthetic, "2.0.0");
    expect(readVersionFromTauriConf(updated)).toBe("2.0.0");
    expect(updated).toContain('"version": "should-not-change"');
  });
});

describe("setCargoTomlVersion / readVersionFromCargoToml", () => {
  it("rewrites only the [package] version, leaving every dependency pin byte-identical", () => {
    const original = readFileSync(path.join(repoRoot, "src-tauri/Cargo.toml"), "utf8");
    const updated = setCargoTomlVersion(original, "9.9.9");

    expect(readVersionFromCargoToml(updated)).toBe("9.9.9");

    // Every dependency line must survive unchanged.
    const dependencyLines = [
      'tauri = { version = "2", features = [] }',
      'tauri-plugin-updater = "2"',
      'sqlx = { version = "0.8", features = ["runtime-tokio-native-tls", "sqlite", "migrate", "macros"] }',
      'zip = "2"',
      'pdfium-render = "0.8"',
      'gtk = "0.18"',
      'webview2-com = "0.38"',
      'windows = { version = "0.61", features = ["Win32_Foundation"] }',
    ];
    for (const line of dependencyLines) {
      expect(original).toContain(line);
      expect(updated).toContain(line);
    }

    // Only the [package] version line differs between original and updated.
    const originalLines = original.split("\n");
    const updatedLines = updated.split("\n");
    expect(updatedLines.length).toBe(originalLines.length);
    const diffIndices = originalLines
      .map((l, i) => (l !== updatedLines[i] ? i : -1))
      .filter((i) => i !== -1);
    expect(diffIndices).toHaveLength(1);
    expect(originalLines[diffIndices[0]]).toBe('version = "0.1.0"');
    expect(updatedLines[diffIndices[0]]).toBe('version = "9.9.9"');
  });
});

describe("setCargoLockVersion / readVersionFromCargoLock", () => {
  const fragment = [
    "[[package]]",
    'name = "some-dep"',
    'version = "0.1.0"',
    "",
    "[[package]]",
    'name = "tauri-app"',
    'version = "0.1.0"',
    "dependencies = [",
    ' "chrono",',
    ' "tauri",',
    "]",
    "",
    "[[package]]",
    'name = "another-dep"',
    'version = "0.1.0"',
  ].join("\n");

  it("rewrites only the tauri-app block's version", () => {
    const updated = setCargoLockVersion(fragment, "9.9.9", "tauri-app");
    expect(readVersionFromCargoLock(updated, "tauri-app")).toBe("9.9.9");
    // The other two packages, which share the exact same original version
    // string, must be untouched.
    expect(readVersionFromCargoLock(updated, "some-dep")).toBe("0.1.0");
    expect(readVersionFromCargoLock(updated, "another-dep")).toBe("0.1.0");
  });

  it("throws when the named package is not present", () => {
    expect(() => setCargoLockVersion(fragment, "9.9.9", "does-not-exist")).toThrow();
  });

  it("reads the real Cargo.lock tauri-app version", () => {
    const original = readFileSync(path.join(repoRoot, "src-tauri/Cargo.lock"), "utf8");
    expect(readVersionFromCargoLock(original, "tauri-app")).toBe("0.1.0");
  });
});

describe("readVersionFromPackageJson", () => {
  it("reads the version field", () => {
    const text = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(readVersionFromPackageJson(text)).toBe("0.1.0");
  });
});

describe("compareVersions", () => {
  it("reports ok:true when every source matches", () => {
    const result = compareVersions(
      [
        { source: "package.json", value: "1.2.0" },
        { source: "tauri.conf.json", value: "1.2.0" },
      ],
      "1.2.0",
    );
    expect(result.ok).toBe(true);
    expect(result.rows.every((r) => r.ok)).toBe(true);
  });

  it("reports ok:false and names the disagreeing source", () => {
    const result = compareVersions(
      [
        { source: "package.json", value: "1.2.0" },
        { source: "Cargo.toml", value: "1.1.0" },
      ],
      "1.2.0",
    );
    expect(result.ok).toBe(false);
    const cargoRow = result.rows.find((r) => r.source === "Cargo.toml");
    expect(cargoRow).toEqual({ source: "Cargo.toml", value: "1.1.0", ok: false });
    const pkgRow = result.rows.find((r) => r.source === "package.json");
    expect(pkgRow.ok).toBe(true);
  });
});
