import { describe, it, expect } from "vitest";
import { formatCounter } from "./counter";

describe("formatCounter", () => {
  it("formats zero correctly", () => {
    expect(formatCounter(0)).toBe("Counter: 0");
  });

  it("formats positive numbers correctly", () => {
    expect(formatCounter(5)).toBe("Counter: 5");
  });

  it("formats large numbers correctly", () => {
    expect(formatCounter(1000)).toBe("Counter: 1000");
  });
});
