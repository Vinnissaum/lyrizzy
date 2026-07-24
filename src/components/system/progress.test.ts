import { describe, it, expect } from "vitest";
import { formatProgress } from "./progress";

describe("formatProgress", () => {
  it("null input is indeterminate", () => {
    expect(formatProgress(null)).toEqual({ percent: null, determinate: false });
  });

  it("total: null is indeterminate", () => {
    expect(formatProgress({ downloaded: 5, total: null })).toEqual({
      percent: null,
      determinate: false,
    });
  });

  it("total: 0 is indeterminate, never NaN or Infinity", () => {
    const result = formatProgress({ downloaded: 5, total: 0 });
    expect(result).toEqual({ percent: null, determinate: false });
    expect(result.percent).not.toBeNaN();
    expect(result.percent).not.toBe(Infinity);
  });

  it("total: -1 is indeterminate", () => {
    expect(formatProgress({ downloaded: 5, total: -1 })).toEqual({
      percent: null,
      determinate: false,
    });
  });

  it("5/10 is 50 percent, determinate", () => {
    expect(formatProgress({ downloaded: 5, total: 10 })).toEqual({
      percent: 50,
      determinate: true,
    });
  });

  it("10/10 is 100 percent, determinate", () => {
    expect(formatProgress({ downloaded: 10, total: 10 })).toEqual({
      percent: 100,
      determinate: true,
    });
  });

  it("11/10 (over-download) clamps to 100", () => {
    expect(formatProgress({ downloaded: 11, total: 10 })).toEqual({
      percent: 100,
      determinate: true,
    });
  });

  it("fractional percent floors down", () => {
    // 1/3 = 33.33...% -> floors to 33, not rounds to 33 or ceils to 34
    expect(formatProgress({ downloaded: 1, total: 3 })).toEqual({
      percent: 33,
      determinate: true,
    });
  });
});
