import { describe, it, expect } from "vitest";
import i18next from "./index";
import { formatCommandError } from "./commandError";

const t = i18next.t.bind(i18next);

describe("formatCommandError", () => {
  it("renders a mapped code with its params interpolated", () => {
    const msg = formatCommandError(
      { code: "backup.restore_failed", params: { detail: "disk full" } },
      t,
    );
    expect(msg).toContain("disk full");
    expect(msg).not.toContain("backup.restore_failed");
  });

  it("falls back to a readable sentence carrying an unmapped code", () => {
    const msg = formatCommandError({ code: "backup.some_new_code", params: {} }, t);
    expect(msg).toContain("backup.some_new_code");
    expect(msg).not.toBe("backup.some_new_code");
  });

  it("keeps the message of a rejection that is not an ErrorPayload", () => {
    expect(formatCommandError(new Error("boom"), t)).toContain("boom");
    expect(formatCommandError("plain string failure", t)).toContain("plain string failure");
  });

  it("never renders [object Object]", () => {
    for (const err of [
      { code: "backup.restore_failed", params: { detail: "x" } },
      { code: "unmapped.code", params: {} },
      new Error("boom"),
      { not: "a payload" },
    ]) {
      expect(formatCommandError(err, t)).not.toContain("[object Object]");
    }
  });
});
