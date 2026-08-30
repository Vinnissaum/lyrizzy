import { describe, it, expect } from "vitest";
import ptBR from "../../i18n/locales/pt-BR.json";
import enUS from "../../i18n/locales/en-US.json";

/** Recursively collect all dot-notation keys from a nested object. */
function collectKeys(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const sub of collectKeys(v as Record<string, unknown>, full)) {
        keys.add(sub);
      }
    } else {
      keys.add(full);
    }
  }
  return keys;
}

describe("i18n key completeness", () => {
  const ptKeys = collectKeys(ptBR as unknown as Record<string, unknown>);
  const enKeys = collectKeys(enUS as unknown as Record<string, unknown>);

  it("pt-BR has no keys missing from en-US", () => {
    const missing: string[] = [];
    for (const key of ptKeys) {
      if (!enKeys.has(key)) missing.push(key);
    }
    if (missing.length > 0) {
      throw new Error(
        `Keys in pt-BR missing from en-US:\n${missing.map((k) => `  - ${k}`).join("\n")}`
      );
    }
  });

  it("en-US has no keys missing from pt-BR", () => {
    const missing: string[] = [];
    for (const key of enKeys) {
      if (!ptKeys.has(key)) missing.push(key);
    }
    if (missing.length > 0) {
      throw new Error(
        `Keys in en-US missing from pt-BR:\n${missing.map((k) => `  - ${k}`).join("\n")}`
      );
    }
  });

  it("both locales have the required Phase 3 error keys", () => {
    const required = [
      "errors.keyBindings.conflict",
      "errors.keyBindings.missingAction",
      "errors.keyBindings.invalidShortcut",
      "errors.keyBindings.dbError",
      "keyBindings.addShortcut",
      "keyBindings.removeShortcut",
      "keyBindings.modifierOnly",
    ];
    const missing = required.filter((k) => !ptKeys.has(k) || !enKeys.has(k));
    if (missing.length > 0) {
      throw new Error(
        `Required Phase 3 keys missing from one or both locales:\n${missing.map((k) => `  - ${k}`).join("\n")}`
      );
    }
  });

  it("the blank set item is named 'Tela preta', never 'em branco' (P16-08)", () => {
    // The `blank` item projects a BLACK slide. Three labels used to call it
    // white; this guards the rename against a regression. The lyrics-editor
    // placeholders ("linha em branco entre as estrofes") are a different sense
    // of the phrase and are deliberately excluded.
    const itemLabelKeys = [
      "builder.blank",
      "builder.add.blank",
      "presentation.blankSlide",
    ];
    const read = (obj: any, key: string) =>
      key.split(".").reduce((o, k) => o?.[k], obj) as string;

    for (const key of itemLabelKeys) {
      expect(read(ptBR, key)).toBe("Tela preta");
      expect(read(enUS, key)).toBe("Black screen");
    }
  });
});
