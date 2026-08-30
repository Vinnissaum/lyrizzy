// Whether an ES module is being run directly as a CLI, as opposed to imported
// by a test or another script.
//
// The obvious form of this check is broken on Windows:
//
//   import.meta.url === `file://${process.argv[1]}`
//
// `import.meta.url` is a proper file URL — `file:///C:/repo/scripts/x.mjs` —
// while `process.argv[1]` is a native path — `C:\repo\scripts\x.mjs`. They
// never match, so every CLI guarded that way silently does nothing and exits 0
// on Windows. On POSIX the two happen to line up, which is why CI (ubuntu)
// never caught it.
//
// `pathToFileURL` produces exactly the URL form Node uses for `import.meta.url`
// on both platforms: it normalises separators, adds the third slash and the
// drive letter, and percent-encodes characters (spaces, `#`) that a raw
// concatenation would leave to differ.

import { pathToFileURL } from "node:url";

/**
 * @param {string} moduleUrl - the module's own `import.meta.url`
 * @param {string} [argv1]   - defaults to `process.argv[1]`
 * @returns {boolean} true when this module is the process entrypoint
 */
export function isMainModule(moduleUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  return moduleUrl === pathToFileURL(argv1).href;
}
