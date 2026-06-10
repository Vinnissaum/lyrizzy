import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../stores/settings", () => ({
  useSettingsStore: { getState: vi.fn() },
}));
vi.mock("../api/commands", () => ({
  enterPresentation: vi.fn().mockResolvedValue(undefined),
  getPresentationState: vi.fn(),
  goToItem: vi.fn().mockResolvedValue(undefined),
  loadSetForPresentation: vi.fn().mockResolvedValue(undefined),
}));

import {
  targetsForFocused,
  mirrorTargets,
  fanOutToMirror,
  engageMirror,
  reducePresentingOutputs,
} from "./outputDispatch";
import { useSettingsStore } from "../stores/settings";
import {
  enterPresentation,
  getPresentationState,
  goToItem,
  loadSetForPresentation,
} from "../api/commands";

function setMirror(value: boolean) {
  vi.mocked(useSettingsStore.getState).mockReturnValue({
    mirrorEnabled: value,
  } as any);
}

describe("targetsForFocused / mirrorTargets", () => {
  it("targets only the focused output when not mirroring", () => {
    expect(targetsForFocused("one", false)).toEqual(["one"]);
    expect(targetsForFocused("two", false)).toEqual(["two"]);
    expect(mirrorTargets("one", false)).toEqual([]);
    expect(mirrorTargets("two", false)).toEqual([]);
  });

  it("targets both outputs when mirroring; extras exclude the focused one", () => {
    expect(targetsForFocused("one", true)).toEqual(["one", "two"]);
    expect(targetsForFocused("two", true)).toEqual(["one", "two"]);
    expect(mirrorTargets("one", true)).toEqual(["two"]);
    expect(mirrorTargets("two", true)).toEqual(["one"]);
  });
});

describe("fanOutToMirror", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not call when mirror is off", () => {
    setMirror(false);
    const call = vi.fn().mockResolvedValue(undefined);
    fanOutToMirror("one", call);
    expect(call).not.toHaveBeenCalled();
  });

  it("calls only the other output when mirror is on", () => {
    setMirror(true);
    const call = vi.fn().mockResolvedValue(undefined);
    fanOutToMirror("one", call);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith("two");
  });

  it("swallows rejections (best-effort)", () => {
    setMirror(true);
    const call = vi.fn().mockRejectedValue(new Error("boom"));
    expect(() => fanOutToMirror("two", call)).not.toThrow();
    expect(call).toHaveBeenCalledWith("one");
  });
});

describe("reducePresentingOutputs", () => {
  it("adds an output on 'entered' and removes it on 'exited'", () => {
    let s = new Set<"one" | "two">();
    s = reducePresentingOutputs(s, "entered", "one");
    expect([...s]).toEqual(["one"]);
    s = reducePresentingOutputs(s, "entered", "two");
    expect(s.size).toBe(2);
    s = reducePresentingOutputs(s, "exited", "one");
    expect([...s]).toEqual(["two"]);
  });

  it("keeps the other screen tracked when one exits (operator stays presenting)", () => {
    const both = new Set<"one" | "two">(["one", "two"]);
    const afterOneExits = reducePresentingOutputs(both, "exited", "one");
    expect(afterOneExits.size).toBe(1); // > 0 → operator stays in the layout
  });

  it("does not mutate the input set", () => {
    const prev = new Set<"one" | "two">(["one"]);
    reducePresentingOutputs(prev, "entered", "two");
    expect([...prev]).toEqual(["one"]);
  });
});

describe("engageMirror", () => {
  beforeEach(() => vi.clearAllMocks());

  it("copies output One's set + position onto Two and opens it", async () => {
    vi.mocked(getPresentationState).mockResolvedValue({
      set: { id: "set-9" },
      currentItemIndex: 2,
      currentSlideIndex: 3,
    } as any);

    await engageMirror();

    expect(loadSetForPresentation).toHaveBeenCalledWith("set-9", "two");
    expect(goToItem).toHaveBeenCalledWith(2, 3, "two");
    expect(enterPresentation).toHaveBeenCalledWith("two");
  });

  it("is a no-op when output One has no set", async () => {
    vi.mocked(getPresentationState).mockResolvedValue({ set: null } as any);
    await engageMirror();
    expect(loadSetForPresentation).not.toHaveBeenCalled();
    expect(enterPresentation).not.toHaveBeenCalled();
  });
});
