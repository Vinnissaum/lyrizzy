// Pure string -> string transforms for the four files that carry the app
// version. No filesystem access here — callers (bump-version.mjs,
// check-version.mjs) own reading/writing so this module stays unit-testable
// without touching disk.

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** Strict MAJOR.MINOR.PATCH, no "v" prefix, no pre-release/build suffix. */
export function parseVersion(input) {
  if (typeof input !== "string") return null;
  return SEMVER_RE.test(input) ? input : null;
}

/** "v1.2.0" -> "1.2.0"; "1.2.0" -> "1.2.0" (no-op if no prefix). */
export function stripTagPrefix(tag) {
  return typeof tag === "string" && tag.startsWith("v") ? tag.slice(1) : tag;
}

/**
 * Rewrite the top-level "version" field in tauri.conf.json's raw text.
 * Scoped to a 2-space-indented key (the file's top-level indent) so a
 * differently-indented "version" nested under bundle/plugins is untouched.
 */
export function setTauriConfVersion(text, version) {
  const re = /^(\s{2}"version":\s*")[^"]*(")/m;
  if (!re.test(text)) {
    throw new Error("setTauriConfVersion: no top-level \"version\" field found");
  }
  return text.replace(re, `$1${version}$2`);
}

export function readVersionFromTauriConf(text) {
  const m = text.match(/^\s{2}"version":\s*"([^"]*)"/m);
  return m ? m[1] : null;
}

/**
 * Rewrite `version = "..."` inside Cargo.toml's [package] section only.
 * Stops scanning at the next `[section]` header so dependency version
 * strings (e.g. `tauri = { version = "2" }`) are never touched.
 */
export function setCargoTomlVersion(text, version) {
  const lines = text.split("\n");
  let inPackage = false;
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sectionMatch = line.match(/^\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      inPackage = sectionMatch[1] === "package";
      continue;
    }
    if (inPackage && !replaced) {
      const m = line.match(/^version\s*=\s*"[^"]*"/);
      if (m) {
        lines[i] = line.replace(/^version\s*=\s*"[^"]*"/, `version = "${version}"`);
        replaced = true;
      }
    }
  }
  if (!replaced) {
    throw new Error("setCargoTomlVersion: no version field found in [package] section");
  }
  return lines.join("\n");
}

export function readVersionFromCargoToml(text) {
  const lines = text.split("\n");
  let inPackage = false;
  for (const line of lines) {
    const sectionMatch = line.match(/^\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      inPackage = sectionMatch[1] === "package";
      continue;
    }
    if (inPackage) {
      const m = line.match(/^version\s*=\s*"([^"]*)"/);
      if (m) return m[1];
    }
  }
  return null;
}

/**
 * Rewrite `version = "..."` inside the [[package]] block whose
 * `name = "<pkgName>"` in a Cargo.lock file. Other packages that happen to
 * share the same version string are left untouched.
 */
export function setCargoLockVersion(text, version, pkgName) {
  const lines = text.split("\n");
  let inTargetBlock = false;
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\[\[package\]\]\s*$/.test(line)) {
      inTargetBlock = false;
      continue;
    }
    if (!inTargetBlock) {
      const nameMatch = line.match(/^name\s*=\s*"([^"]*)"/);
      if (nameMatch && nameMatch[1] === pkgName) {
        inTargetBlock = true;
      }
      continue;
    }
    if (inTargetBlock && !replaced) {
      const m = line.match(/^version\s*=\s*"[^"]*"/);
      if (m) {
        lines[i] = line.replace(/^version\s*=\s*"[^"]*"/, `version = "${version}"`);
        replaced = true;
        inTargetBlock = false;
      }
    }
  }
  if (!replaced) {
    throw new Error(`setCargoLockVersion: package "${pkgName}" not found`);
  }
  return lines.join("\n");
}

export function readVersionFromCargoLock(text, pkgName) {
  const lines = text.split("\n");
  let inTargetBlock = false;
  for (const line of lines) {
    if (/^\[\[package\]\]\s*$/.test(line)) {
      inTargetBlock = false;
      continue;
    }
    if (!inTargetBlock) {
      const nameMatch = line.match(/^name\s*=\s*"([^"]*)"/);
      if (nameMatch && nameMatch[1] === pkgName) {
        inTargetBlock = true;
      }
      continue;
    }
    const m = line.match(/^version\s*=\s*"([^"]*)"/);
    if (m) return m[1];
  }
  return null;
}

export function readVersionFromPackageJson(text) {
  const parsed = JSON.parse(text);
  return typeof parsed.version === "string" ? parsed.version : null;
}

/**
 * Compare a set of {source, value} readings against an expected version.
 * Returns { ok, rows } where rows carries every source's value and whether
 * it matched, for a printable table.
 */
export function compareVersions(sources, expected) {
  const rows = sources.map(({ source, value }) => ({
    source,
    value,
    ok: value === expected,
  }));
  return { ok: rows.every((r) => r.ok), rows };
}
