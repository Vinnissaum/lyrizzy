import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CountdownSetItemEditor } from "./CountdownSetItemEditor";
import type { SetItem } from "../../types";

vi.mock("../../api/commands", () => ({
  updateSetItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../common/MediaPicker", () => ({
  MediaPicker: () => null,
}));

vi.mock("../common/NotesField", () => ({
  NotesField: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { updateSetItem } from "../../api/commands";

const durationItem: SetItem = {
  id: "item-1",
  setId: "set-1",
  itemType: "countdown",
  sortOrder: 0,
  countdownConfig: {
    target: { kind: "duration", durationMs: 600_000 },
    endBehavior: "holdZero",
  },
};

const fixedTimeItem: SetItem = {
  id: "item-2",
  setId: "set-1",
  itemType: "countdown",
  sortOrder: 1,
  countdownConfig: {
    target: { kind: "fixedTime", hour: 9, minute: 30 },
    endBehavior: "holdZero",
  },
};

describe("CountdownSetItemEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders in duration mode for a duration item", () => {
    render(<CountdownSetItemEditor item={durationItem} />);
    expect(screen.getByRole("button", { name: "countdown.mode.duration" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "countdown.mode.fixedTime" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("10:00")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("09:30")).toBeNull();
  });

  it("renders in fixedTime mode for a fixedTime item", () => {
    render(<CountdownSetItemEditor item={fixedTimeItem} />);
    expect(screen.getByDisplayValue("09:30")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("10:00")).toBeNull();
  });

  it("toggling modes preserves the other input value", () => {
    render(<CountdownSetItemEditor item={durationItem} />);
    const durationInput = screen.getByPlaceholderText("10:00");
    fireEvent.change(durationInput, { target: { value: "05:00" } });
    fireEvent.click(screen.getByRole("button", { name: "countdown.mode.fixedTime" }));
    expect(screen.queryByPlaceholderText("10:00")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "countdown.mode.duration" }));
    expect(screen.getByPlaceholderText("10:00")).toHaveValue("05:00");
  });

  it("save in fixedTime mode dispatches fixedTime target", async () => {
    render(<CountdownSetItemEditor item={fixedTimeItem} />);
    const timeInput = screen.getByDisplayValue("09:30");
    fireEvent.blur(timeInput);
    await waitFor(() => {
      expect(vi.mocked(updateSetItem)).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "item-2",
          countdownConfig: expect.objectContaining({
            target: { kind: "fixedTime", hour: 9, minute: 30 },
          }),
        })
      );
    });
  });

  it("save in duration mode dispatches duration target", async () => {
    render(<CountdownSetItemEditor item={durationItem} />);
    const durationInput = screen.getByPlaceholderText("10:00");
    fireEvent.blur(durationInput);
    await waitFor(() => {
      expect(vi.mocked(updateSetItem)).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "item-1",
          countdownConfig: expect.objectContaining({
            target: { kind: "duration", durationMs: 600_000 },
          }),
        })
      );
    });
  });
});
