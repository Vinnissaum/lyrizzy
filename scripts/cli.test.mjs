import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run as bumpVersion } from "./bump-version.mjs";
import { run as checkVersion } from "./check-version.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIXTURE = {
  "package.json": JSON.stringify({ name: "test-app", version: "0.1.0", private: true }, null, 2) + "\n",
  "package-lock.json": JSON.stringify(
    {
      name: "test-app",
      version: "0.1.0",
      lockfileVersion: 3,
      requires: true,
      packages: { "": { name: "test-app", version: "0.1.0" } },
    },
    null,
    2,
  ) + "\n",
  "src-tauri/tauri.conf.json": [
    "{",
    '  "productName": "TestApp",',
    '  "version": "0.1.0",',
    '  "identifier": "com.test.app"',
    "}",
    "",
  ].join("\n"),
  "src-tauri/Cargo.toml": [
    "[package]",
    'name = "tauri-app"',
    'version = "0.1.0"',
    "",
    "[dependencies]",
    'tauri = { version = "2" }',
    "",
  ].join("\n"),
  "src-tauri/Cargo.lock": [
    "[[package]]",
    'name = "decoy-dep"',
    'version = "0.1.0"',
    "",
    "[[package]]",
    'name = "tauri-app"',
    'version = "0.1.0"',
    "dependencies = [",
    ' "tauri",',
    "]",
    "",
  ].join("\n"),
};

function makeFixtureDir() {
  const root = mkdtempSync(path.join(tmpdir(), "bump-version-test-"));
  mkdirSync(path.join(root, "src-tauri"), { recursive: true });
  for (const [rel, content] of Object.entries(FIXTURE)) {
    writeFileSync(path.join(root, rel), content);
  }
  return root;
}

let root;

beforeEach(() => {
  root = makeFixtureDir();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("bump-version run()", () => {
  it("writes the new version to all five locations", () => {
    bumpVersion("1.2.0", root);

    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    expect(pkg.version).toBe("1.2.0");

    const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
    expect(lock.version).toBe("1.2.0");
    expect(lock.packages[""].version).toBe("1.2.0");

    const tauriConf = readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8");
    expect(tauriConf).toContain('"version": "1.2.0"');

    const cargoToml = readFileSync(path.join(root, "src-tauri/Cargo.toml"), "utf8");
    expect(cargoToml).toContain('version = "1.2.0"');
    // The dependency pin must survive untouched.
    expect(cargoToml).toContain('tauri = { version = "2" }');

    const cargoLock = readFileSync(path.join(root, "src-tauri/Cargo.lock"), "utf8");
    const tauriAppBlock = cargoLock.split("[[package]]")[2]; // decoy-dep, tauri-app
    expect(tauriAppBlock).toContain('name = "tauri-app"');
    expect(tauriAppBlock).toContain('version = "1.2.0"');
    // The decoy package, which started at the identical version string, is untouched.
    const decoyBlock = cargoLock.split("[[package]]")[1];
    expect(decoyBlock).toContain('name = "decoy-dep"');
    expect(decoyBlock).toContain('version = "0.1.0"');
  });

  it("rejects a malformed version and writes no file", () => {
    const before = {};
    for (const rel of Object.keys(FIXTURE)) {
      before[rel] = readFileSync(path.join(root, rel), "utf8");
    }

    expect(() => bumpVersion("v1.2.0", root)).toThrow(/invalid version/);

    for (const rel of Object.keys(FIXTURE)) {
      const after = readFileSync(path.join(root, rel), "utf8");
      expect(after).toBe(before[rel]);
    }
  });

  it("CLI entry point exits non-zero and writes no file for invalid input", () => {
    const scriptPath = path.join(__dirname, "bump-version.mjs");
    const before = readFileSync(path.join(root, "package.json"), "utf8");

    expect(() =>
      execFileSync("node", [scriptPath, "not-a-version"], { cwd: root, stdio: "pipe" }),
    ).toThrow();

    const after = readFileSync(path.join(root, "package.json"), "utf8");
    expect(after).toBe(before);
  });
});

describe("check-version run()", () => {
  it("reports ok:true when the tag matches every source", () => {
    const result = checkVersion("v0.1.0", root);
    expect(result.ok).toBe(true);
  });

  it("reports ok:false and names the disagreeing source when one file was left behind", () => {
    // Simulate a maintainer bumping every file except Cargo.toml, then
    // tagging — the exact failure mode verify-version exists to catch.
    bumpVersion("9.9.9", root);
    const cargoTomlPath = path.join(root, "src-tauri/Cargo.toml");
    writeFileSync(
      cargoTomlPath,
      readFileSync(cargoTomlPath, "utf8").replace('version = "9.9.9"', 'version = "0.1.0"'),
    );

    const result = checkVersion("v9.9.9", root);
    expect(result.ok).toBe(false);
    const cargoRow = result.rows.find((r) => r.source === "src-tauri/Cargo.toml");
    expect(cargoRow).toEqual({ source: "src-tauri/Cargo.toml", value: "0.1.0", ok: false });
    // Every other source did bump correctly.
    for (const row of result.rows.filter((r) => r.source !== "src-tauri/Cargo.toml")) {
      expect(row.ok).toBe(true);
    }
  });

  it("CLI entry point exits 0 when versions agree, non-zero when they disagree", () => {
    const scriptPath = path.join(__dirname, "check-version.mjs");

    expect(() =>
      execFileSync("node", [scriptPath, "v0.1.0"], { cwd: root, stdio: "pipe" }),
    ).not.toThrow();

    expect(() =>
      execFileSync("node", [scriptPath, "v9.9.9"], { cwd: root, stdio: "pipe" }),
    ).toThrow();
  });

  it("has no imports outside node: builtins and ./version-files.mjs — runs on plain node", () => {
    const source = readFileSync(path.join(__dirname, "check-version.mjs"), "utf8");
    const imports = [...source.matchAll(/^import .* from "([^"]+)";?$/gm)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const spec of imports) {
      expect(spec.startsWith("node:") || spec.startsWith("./")).toBe(true);
    }
  });
});
