#!/usr/bin/env node
// Writes a new version into every file that carries it: package.json +
// package-lock.json (via `npm version`), src-tauri/tauri.conf.json,
// src-tauri/Cargo.toml, and src-tauri/Cargo.lock. Run from the repo root:
//
//   node scripts/bump-version.mjs 1.2.0

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  parseVersion,
  setTauriConfVersion,
  setCargoTomlVersion,
  setCargoLockVersion,
} from "./version-files.mjs";

const CARGO_PKG_NAME = "tauri-app";

export function run(rawVersion, root = process.cwd()) {
  const version = parseVersion(rawVersion);
  if (!version) {
    throw new Error(`invalid version "${rawVersion}" — expected MAJOR.MINOR.PATCH, e.g. 1.2.0`);
  }

  // npm owns package.json + both package-lock.json version fields.
  execFileSync(
    "npm",
    ["version", "--no-git-tag-version", "--allow-same-version", version],
    { cwd: root, stdio: "pipe" },
  );

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
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , rawVersion] = process.argv;
  try {
    const version = run(rawVersion);
    console.log(`Bumped version to ${version} in package.json, package-lock.json, tauri.conf.json, Cargo.toml, Cargo.lock.`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
