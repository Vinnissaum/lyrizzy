import { describe, it, expect } from "vitest";
import { onScreenItemIds } from "./onScreen";
import type { PresentationMode, PresentationState, ServiceSet } from "../types";

const set: ServiceSet = {
  id: "set-1",
  name: "Culto",
  createdAt: 0,
  updatedAt: 0,
  items: ["A", "B", "C"].map((id, i) => ({
    id,
    setId: "set-1",
    itemType: "song" as const,
    songId: `song-${id}`,
    sortOrder: i,
  })),
};

function output(
  mode: PresentationMode,
  currentItemIndex: number,
  extra: Partial<PresentationState> = {},
): PresentationState {
  return { set, mode, currentItemIndex, currentSlideIndex: 0, itemSlideCounts: [4, 4, 4], ...extra };
}

describe("onScreenItemIds", () => {
  it("on screen item ids: current items and frozen items of presenting outputs on that set", () => {
    expect([...onScreenItemIds([output("live", 1)], "set-1")]).toEqual(["B"]);
    expect([...onScreenItemIds([output("blank", 1)], "set-1")]).toEqual(["B"]);
    expect(
      [...onScreenItemIds([output("frozen", 0, { frozenAt: [2, 1] })], "set-1")].sort(),
    ).toEqual(["A", "C"]);
    // Tela 1 on A, Tela 2 on B → both.
    expect(
      [...onScreenItemIds([output("live", 0), output("live", 1)], "set-1")].sort(),
    ).toEqual(["A", "B"]);
  });

  it("on screen item ids: an idle output, another set or no state contributes none", () => {
    expect(onScreenItemIds([output("idle", 1)], "set-1").size).toBe(0);
    expect(onScreenItemIds([output("live", 1)], "set-2").size).toBe(0);
    expect(onScreenItemIds([null, undefined], "set-1").size).toBe(0);
    expect(onScreenItemIds([output("live", 1)], undefined).size).toBe(0);
  });
});
