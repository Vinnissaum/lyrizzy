#!/usr/bin/env node
// Writes a new version into every file that carries it: package.json +
// package-lock.json (via `npm version`), src-tauri/tauri.conf.json,
// src-tauri/Cargo.toml, and src-tauri/Cargo.lock. Run from the repo root:
//
//   node scripts/bump-version.mjs 1.2.0

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { isMainModule } from "./is-main-module.mjs";
import {
  parseVersion,
  setTauriConfVersion,
  setCargoTomlVersion,
  setCargoLockVersion,
} from "./version-files.mjs";

const CARGO_PKG_NAME = "tauri-app";

const IS_WINDOWS = process.platform === "win32";

/**
 * Run `npm version <version>` in `cwd`, letting npm own package.json and both
 * package-lock.json version fields.
 *
 * Windows needs its own path here. npm ships as `npm.cmd`, and `execFileSync`
 * applies neither PATHEXT (so bare "npm" is ENOENT) nor — since the fix for
 * CVE-2024-27980 in Node 18.20.2 / 20.12.0 — will it spawn a `.cmd` at all
 * without a shell (EINVAL). So Windows goes through cmd.exe as a single command
 * string; passing an args array alongside `shell: true` is what Node deprecated
 * in DEP0190, because those args get concatenated rather than escaped.
 *
 * Interpolating into that string is safe only because `version` has already
 * been through `parseVersion`, which accepts strict MAJOR.MINOR.PATCH digits
 * and nothing else — no spaces, quotes or shell metacharacters can reach here.
 * POSIX keeps the argument-array form, which needs no such reasoning.
 */
function npmSetVersion(version, cwd) {
  const args = ["version", "--no-git-tag-version", "--allow-same-version", version];
  if (IS_WINDOWS) {
    execFileSync(`npm ${args.join(" ")}`, { cwd, stdio: "pipe", shell: true });
  } else {
    execFileSync("npm", args, { cwd, stdio: "pipe" });
  }
}

export function run(rawVersion, root = process.cwd()) {
  const version = parseVersion(rawVersion);
  if (!version) {
    throw new Error(`invalid version "${rawVersion}" — expected MAJOR.MINOR.PATCH, e.g. 1.2.0`);
  }

  // npm owns package.json + both package-lock.json version fields.
  npmSetVersion(version, root);

  const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");
  const cargoTomlPath = path.join(root, "src-tauri", "Cargo.toml");
  const cargoLockPath = path.join(root, "src-tauri", "Cargo.lock");

  writeFileSync(tauriConfPath, setTauriConfVersion(readFileSync(tauriConfPath, "utf8"), version));
  writeFileSync(cargoTomlPath, setCargoTomlVersion(readFileSync(cargoTomlPath, "utf8"), version));
  writeFileSync(
    cargoLockPath,
    setCargoLockVersion(readFileSync(cargoLockPath, "utf8"), version, CARGO_PKG_NAME),
  );

  return version;
}

// Only run as a CLI when invoked directly (not when imported by tests).
if (isMainModule(import.meta.url)) {
  const [, , rawVersion] = process.argv;
  try {
    const version = run(rawVersion);
    console.log(`Bumped version to ${version} in package.json, package-lock.json, tauri.conf.json, Cargo.toml, Cargo.lock.`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
