import { describe, it, expect } from "vitest";
import { creditLine, isBalancedWrapped } from "./credit";

describe("creditLine", () => {
  // The 4 flag x wrap combinations.
  it("ON + not wrapped -> wraps", () => {
    expect(creditLine("John Newton", true)).toBe("(John Newton)");
  });

  it("ON + already wrapped -> no double wrap", () => {
    expect(creditLine("(John Newton)", true)).toBe("(John Newton)");
  });

  it("OFF + wrapped -> stripped", () => {
    expect(creditLine("(John Newton)", false)).toBe("John Newton");
  });

  it("OFF + not wrapped -> unchanged", () => {
    expect(creditLine("John Newton", false)).toBe("John Newton");
  });

  // Empty-after-strip / blank cases -> null (omit).
  it("'()' -> null", () => {
    expect(creditLine("()", true)).toBeNull();
    expect(creditLine("()", false)).toBeNull();
  });

  it("empty / blank -> null", () => {
    expect(creditLine("", true)).toBeNull();
    expect(creditLine("   ", true)).toBeNull();
    expect(creditLine("", false)).toBeNull();
  });

  // Not balanced-wrapped: trailing/inner parens must not be treated as a wrap.
  it("'John (PD)' is not wrapped", () => {
    expect(creditLine("John (PD)", true)).toBe("(John (PD))");
    expect(creditLine("John (PD)", false)).toBe("John (PD)");
  });

  it("'(A) and (B)' is not wrapped (closes early)", () => {
    expect(creditLine("(A) and (B)", true)).toBe("((A) and (B))");
    expect(creditLine("(A) and (B)", false)).toBe("(A) and (B)");
  });
});

describe("isBalancedWrapped", () => {
  it("recognizes a single outer pair", () => {
    expect(isBalancedWrapped("(John Newton)")).toBe(true);
    expect(isBalancedWrapped("((nested))")).toBe(true);
  });

  it("rejects unwrapped / early-closing strings", () => {
    expect(isBalancedWrapped("John Newton")).toBe(false);
    expect(isBalancedWrapped("John (PD)")).toBe(false);
    expect(isBalancedWrapped("(A) and (B)")).toBe(false);
    expect(isBalancedWrapped("(name")).toBe(false);
  });
});
