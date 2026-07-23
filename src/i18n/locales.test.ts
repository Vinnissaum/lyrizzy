import { describe, it, expect } from "vitest";
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

/** Recursively collect all dot-notation keys from a nested object. */
function flattenKeys(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const sub of flattenKeys(v as Record<string, unknown>, full)) {
        keys.add(sub);
      }
    } else {
      keys.add(full);
    }
  }
  return keys;
}

describe("locale key parity", () => {
  it("en-US and pt-BR have identical key sets in both directions", () => {
    const enKeys = flattenKeys(enUS as unknown as Record<string, unknown>);
    const ptKeys = flattenKeys(ptBR as unknown as Record<string, unknown>);

    const missingFromPt = [...enKeys].filter((k) => !ptKeys.has(k));
    const missingFromEn = [...ptKeys].filter((k) => !enKeys.has(k));

    const problems: string[] = [];
    for (const k of missingFromPt) problems.push(`missing from pt-BR: ${k}`);
    for (const k of missingFromEn) problems.push(`missing from en-US: ${k}`);

    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("both locales define the new Phase 13 update/about keys", () => {
    const required = [
      "updates.checking",
      "updates.checkErrorWithCode",
      "updates.downloading",
      "updates.downloadingUnknown",
      "updates.alreadyInProgress",
      "about.version",
    ];
    const enKeys = flattenKeys(enUS as unknown as Record<string, unknown>);
    const ptKeys = flattenKeys(ptBR as unknown as Record<string, unknown>);
    const missing = required.filter((k) => !enKeys.has(k) || !ptKeys.has(k));
    expect(missing, missing.join("\n")).toEqual([]);
  });
});
