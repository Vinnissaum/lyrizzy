import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { brandFiles } from "./build-brand.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("committed brand files", () => {
  it.each(Object.entries(brandFiles()))(
    "%s matches src/brand/shield.ts (run `npm run brand:build` after changing it)",
    (path, expected) => {
      const actual = readFileSync(join(root, path), "utf8");
      // Not toBe: a mismatch would print a 20 KB embedded font twice.
      expect(actual === expected, `${path} is stale`).toBe(true);
    },
  );
});
