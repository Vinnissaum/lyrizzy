import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { CountdownRenderer } from "./CountdownRenderer";
import type { CountdownConfig } from "../../types";

vi.mock("../../runtime/useCountdownDigits", () => ({
  useCountdownDigits: () => ({
    formattedTime: "05:00",
    isFinished: false,
    isLow: false,
    isScheduled: false,
    remainingMs: 300_000,
    mode: "running",
  }),
}));

const baseConfig: CountdownConfig = {
  target: { kind: "duration", durationMs: 300_000 },
  message: "Service starts soon",
  endBehavior: "holdZero",
};

// jsdom's CSSOM rejects `clamp()`/`calc()` values for font-size outright (the
// property is silently dropped, so reading it back via `element.style` or
// `getComputedStyle` always yields ""). To assert on the *actual* string the
// component hands to the DOM we intercept the raw setter on the style
// prototype before it gets a chance to reject the value, then evaluate the
// clamp/calc arithmetic ourselves to get comparable numeric magnitudes.
let fontSizeSets: string[] = [];
let setterSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fontSizeSets = [];
  const probe = document.createElement("div");
  const stylePrototype = Object.getPrototypeOf(probe.style);
  setterSpy = vi
    .spyOn(stylePrototype, "fontSize", "set")
    .mockImplementation(function (this: CSSStyleDeclaration, value: string) {
      fontSizeSets.push(value);
    });
});

afterEach(() => {
  setterSpy.mockRestore();
});

interface ClampTerm {
  value: number;
  unit: string;
}

interface ParsedClamp {
  min: ClampTerm;
  mid: ClampTerm;
  max: ClampTerm;
}

/** Parses a bare `"<number><unit>"` or a `calc(<number><unit> * <factor>)` term. */
function parseTerm(term: string): ClampTerm {
  const calcMatch = term.match(/^calc\((.+?)\s*\*\s*([\d.]+)\)$/);
  if (calcMatch) {
    const [, base, factor] = calcMatch;
    const parsedBase = parseTerm(base.trim());
    return { value: parsedBase.value * parseFloat(factor), unit: parsedBase.unit };
  }
  const bareMatch = term.match(/^(-?[\d.]+)([a-z%]+)$/);
  if (!bareMatch) {
    throw new Error(`unable to parse clamp term: ${term}`);
  }
  const [, value, unit] = bareMatch;
  return { value: parseFloat(value), unit };
}

/** Parses `clamp(min, mid, max)` into its three numeric/unit terms. */
function parseClamp(fontSize: string): ParsedClamp {
  const outer = fontSize.match(/^clamp\((.+)\)$/);
  if (!outer) {
    throw new Error(`expected a clamp() value, got: ${fontSize}`);
  }
  const terms = outer[1].split(/,(?![^(]*\))/).map((t) => t.trim());
  expect(terms).toHaveLength(3);
  return {
    min: parseTerm(terms[0]),
    mid: parseTerm(terms[1]),
    max: parseTerm(terms[2]),
  };
}

function renderAndCapture(config: CountdownConfig) {
  fontSizeSets = [];
  render(<CountdownRenderer config={config} />);
  expect(fontSizeSets).toHaveLength(2);
  return {
    message: parseClamp(fontSizeSets[0]),
    digits: parseClamp(fontSizeSets[1]),
  };
}

describe("CountdownRenderer scaling", () => {
  it("(a) at 100/100 the computed fontSize matches the unscaled control", () => {
    const scaledResult = renderAndCapture({ ...baseConfig, messageScale: 100, digitsScale: 100 });

    // The "unscaled control": what the clamp bounds were before scaling was
    // introduced (see design context: 0.75rem/3cqmin/2rem and 2rem/30cqmin/18rem).
    const control = {
      message: { min: { value: 0.75, unit: "rem" }, mid: { value: 3, unit: "cqmin" }, max: { value: 2, unit: "rem" } },
      digits: { min: { value: 2, unit: "rem" }, mid: { value: 30, unit: "cqmin" }, max: { value: 18, unit: "rem" } },
    };

    expect(scaledResult.message).toEqual(control.message);
    expect(scaledResult.digits).toEqual(control.digits);
  });

  it("(b) 150% message / 80% digits produce proportionally larger/smaller values", () => {
    const result = renderAndCapture({ ...baseConfig, messageScale: 150, digitsScale: 80 });

    expect(result.message).toEqual({
      min: { value: 0.75 * 1.5, unit: "rem" },
      mid: { value: 3 * 1.5, unit: "cqmin" },
      max: { value: 2 * 1.5, unit: "rem" },
    });
    expect(result.digits).toEqual({
      min: { value: 2 * 0.8, unit: "rem" },
      mid: { value: 30 * 0.8, unit: "cqmin" },
      max: { value: 18 * 0.8, unit: "rem" },
    });
  });

  it("(c) an absent scale renders as 100%", () => {
    const result = renderAndCapture({ ...baseConfig });

    expect(result.message).toEqual({
      min: { value: 0.75, unit: "rem" },
      mid: { value: 3, unit: "cqmin" },
      max: { value: 2, unit: "rem" },
    });
    expect(result.digits).toEqual({
      min: { value: 2, unit: "rem" },
      mid: { value: 30, unit: "cqmin" },
      max: { value: 18, unit: "rem" },
    });
  });
});
