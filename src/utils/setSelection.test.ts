import { describe, it, expect } from "vitest";

import { nextActiveSetId } from "./setSelection";
import type { ServiceSet } from "../types";

function makeSet(id: string): ServiceSet {
  return {
    id,
    name: id,
    createdAt: 0,
    updatedAt: 0,
    items: [],
  };
}

describe("nextActiveSetId", () => {
  it("returns the next set when a middle set is deleted", () => {
    const sets = [makeSet("a"), makeSet("b"), makeSet("c")];
    expect(nextActiveSetId(sets, "b")).toBe("c");
  });

  it("returns the previous set when the last set is deleted", () => {
    const sets = [makeSet("a"), makeSet("b"), makeSet("c")];
    expect(nextActiveSetId(sets, "c")).toBe("b");
  });

  it("returns null when the only set is deleted", () => {
    const sets = [makeSet("a")];
    expect(nextActiveSetId(sets, "a")).toBeNull();
  });

  it("returns null when the deleted id is not in the list", () => {
    const sets = [makeSet("a"), makeSet("b")];
    expect(nextActiveSetId(sets, "z")).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(nextActiveSetId([], "a")).toBeNull();
  });
});
