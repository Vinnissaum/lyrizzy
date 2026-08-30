#!/usr/bin/env node
// CI gate: asserts package.json, package-lock.json, tauri.conf.json,
// Cargo.toml, and Cargo.lock all carry the exact version encoded in a git
// tag. Zero npm dependencies — runs on plain `node`, no `npm ci` required,
// so it can be the very first step of a release workflow.
//
//   node scripts/check-version.mjs v1.2.0

import { readFileSync } from "node:fs";
import path from "node:path";
import { isMainModule } from "./is-main-module.mjs";
import {
  stripTagPrefix,
  readVersionFromPackageJson,
  readVersionFromTauriConf,
  readVersionFromCargoToml,
  readVersionFromCargoLock,
  compareVersions,
} from "./version-files.mjs";

const CARGO_PKG_NAME = "tauri-app";

export function run(tag, root = process.cwd()) {
  const expected = stripTagPrefix(tag);

  const packageJson = readFileSync(path.join(root, "package.json"), "utf8");
  const packageLockJson = readFileSync(path.join(root, "package-lock.json"), "utf8");
  const tauriConf = readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8");
  const cargoToml = readFileSync(path.join(root, "src-tauri", "Cargo.toml"), "utf8");
  const cargoLock = readFileSync(path.join(root, "src-tauri", "Cargo.lock"), "utf8");

  const sources = [
    { source: "git tag", value: expected },
    { source: "package.json", value: readVersionFromPackageJson(packageJson) },
    { source: "package-lock.json", value: readVersionFromPackageJson(packageLockJson) },
    { source: "src-tauri/tauri.conf.json", value: readVersionFromTauriConf(tauriConf) },
    { source: "src-tauri/Cargo.toml", value: readVersionFromCargoToml(cargoToml) },
    { source: "src-tauri/Cargo.lock", value: readVersionFromCargoLock(cargoLock, CARGO_PKG_NAME) },
  ];

  return compareVersions(sources, expected);
}

function printReport({ ok, rows }) {
  for (const row of rows) {
    const mark = row.ok ? "OK  " : "MISMATCH";
    console.log(`${mark}  ${row.source.padEnd(28)} ${row.value}`);
  }
  console.log(ok ? "\nAll version sources agree." : "\nVersion sources disagree — see MISMATCH rows above.");
}

if (isMainModule(import.meta.url)) {
  const [, , tag] = process.argv;
  if (!tag) {
    console.error("usage: node scripts/check-version.mjs <git-tag>");
    process.exit(1);
  }
  const result = run(tag);
  printReport(result);
  if (!result.ok) process.exit(1);
}
