import { describe, it, expect } from "vitest";
import ptBR from "../../i18n/locales/pt-BR.json";
import enUS from "../../i18n/locales/en-US.json";

// The error codes the live countdown controls and the live set list can raise
// (P21). Each must read as a sentence in both locales, not fall back to the
// generic "Something went wrong (<code>)".
const CODES = [
  "set.item_on_screen",
  "countdown.not_active",
  "countdown.not_paused",
  "countdown.below_minimum",
];

function lookup(locale: Record<string, unknown>, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], locale);
}

describe("live presentation error codes", () => {
  for (const [name, locale] of [
    ["pt-BR", ptBR],
    ["en-US", enUS],
  ] as const) {
    for (const code of CODES) {
      it(`${name} has a message for error.${code}`, () => {
        const message = lookup(locale as Record<string, unknown>, `error.${code}`);
        expect(typeof message).toBe("string");
        expect((message as string).trim().length).toBeGreaterThan(0);
      });
    }
  }
});

describe("countdown restart error (AC 28)", () => {
  it("target passed message exists in pt-BR and en-US", () => {
    for (const locale of [ptBR, enUS]) {
      const message = lookup(locale as Record<string, unknown>, "error.countdown.target_passed");
      expect(typeof message).toBe("string");
      expect((message as string).trim().length).toBeGreaterThan(0);
    }
  });
});
