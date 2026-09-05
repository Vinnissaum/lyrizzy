import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SetItem } from "../../types";

// ── Mock store ────────────────────────────────────────────────────────────────

const arm = vi.fn().mockResolvedValue(undefined);
const reset = vi.fn().mockResolvedValue(undefined);
const storeMock = { arm, reset };

vi.mock("../../stores/countdown", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hook = (selector?: (s: any) => unknown) =>
    typeof selector === "function" ? selector(storeMock) : storeMock;
  hook.getState = () => storeMock;
  return { useCountdownStore: hook };
});

vi.mock("../../api/commands", () => ({
  updateSetItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../common/MediaPicker", () => ({ MediaPicker: () => null }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { updateSetItem } from "../../api/commands";
import { CountdownScheduleModal } from "./CountdownScheduleModal";

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

/** A wall-clock HH:MM guaranteed to be later today. */
function futureHHMM(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 90);
  // Keep it within today (test envs won't run across midnight reliably; clamp).
  if (d.getDate() !== new Date().getDate()) {
    d.setHours(23, 59, 0, 0);
  }
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

describe("CountdownScheduleModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the modal with config controls", () => {
    render(
      <CountdownScheduleModal item={durationItem} setId="set-1" itemIndex={0} onClose={vi.fn()} />
    );
    expect(screen.getByTestId("countdown-schedule-modal")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("10:00")).toBeInTheDocument();
  });

  it("Save with schedule ON calls updateSetItem AND arm with durationMs + scheduledStart", async () => {
    const onClose = vi.fn();
    render(
      <CountdownScheduleModal item={durationItem} setId="set-1" itemIndex={3} onClose={onClose} />
    );

    // Enable schedule.
    fireEvent.click(screen.getByRole("checkbox"));
    // Set a future trigger time.
    const time = futureHHMM();
    const timeInput = screen.getByDisplayValue("09:00");
    fireEvent.change(timeInput, { target: { value: time } });

    fireEvent.click(screen.getByText("countdown.modal.save"));

    await waitFor(() =>
      expect(vi.mocked(updateSetItem)).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "item-1",
          countdownConfig: expect.objectContaining({
            target: { kind: "duration", durationMs: 600_000 },
            scheduledStart: expect.objectContaining({}),
          }),
        })
      )
    );

    const [h, m] = time.split(":").map(Number);
    expect(arm).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 600_000,
        scheduledStart: { hour: h, minute: m },
        setId: "set-1",
        itemIndex: 3,
      })
    );
    // No takeover passed.
    expect(arm.mock.calls[0][0]).not.toHaveProperty("takeover");
    expect(reset).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("Save with schedule OFF calls updateSetItem and reset (no arm)", async () => {
    const onClose = vi.fn();
    render(
      <CountdownScheduleModal item={durationItem} setId="set-1" itemIndex={0} onClose={onClose} />
    );

    fireEvent.click(screen.getByText("countdown.modal.save"));

    await waitFor(() => expect(vi.mocked(updateSetItem)).toHaveBeenCalled());
    expect(reset).toHaveBeenCalled();
    expect(arm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("disables the schedule toggle in fixedTime mode", () => {
    render(
      <CountdownScheduleModal item={fixedTimeItem} setId="set-1" itemIndex={0} onClose={vi.fn()} />
    );
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("Cancelar closes without saving", () => {
    const onClose = vi.fn();
    render(
      <CountdownScheduleModal item={durationItem} setId="set-1" itemIndex={0} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("countdown.modal.cancel"));
    expect(onClose).toHaveBeenCalled();
    expect(vi.mocked(updateSetItem)).not.toHaveBeenCalled();
  });

  it("typing a name and saving calls updateSetItem with it", async () => {
    render(
      <CountdownScheduleModal item={durationItem} setId="set-1" itemIndex={0} onClose={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText("countdown.editor.name"), {
      target: { value: "Countdown to worship" },
    });
    fireEvent.click(screen.getByText("countdown.modal.save"));

    await waitFor(() =>
      expect(vi.mocked(updateSetItem)).toHaveBeenCalledWith(
        expect.objectContaining({
          countdownConfig: expect.objectContaining({ name: "Countdown to worship" }),
        })
      )
    );
  });

  it("saves a whitespace-only name as undefined", async () => {
    render(
      <CountdownScheduleModal item={durationItem} setId="set-1" itemIndex={0} onClose={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText("countdown.editor.name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByText("countdown.modal.save"));

    await waitFor(() =>
      expect(vi.mocked(updateSetItem)).toHaveBeenCalledWith(
        expect.objectContaining({
          countdownConfig: expect.objectContaining({ name: undefined }),
        })
      )
    );
  });

  it("moving a slider and saving persists the value", async () => {
    render(
      <CountdownScheduleModal item={durationItem} setId="set-1" itemIndex={0} onClose={vi.fn()} />
    );

    const [messageSlider, digitsSlider] = screen.getAllByRole("slider");
    fireEvent.change(messageSlider, { target: { value: "150" } });
    fireEvent.change(digitsSlider, { target: { value: "200" } });
    fireEvent.click(screen.getByText("countdown.modal.save"));

    await waitFor(() =>
      expect(vi.mocked(updateSetItem)).toHaveBeenCalledWith(
        expect.objectContaining({
          countdownConfig: expect.objectContaining({ messageScale: 150, digitsScale: 200 }),
        })
      )
    );
  });

  it("reset returns a slider to 100", () => {
    render(
      <CountdownScheduleModal item={durationItem} setId="set-1" itemIndex={0} onClose={vi.fn()} />
    );

    const [messageSlider] = screen.getAllByRole("slider");
    fireEvent.change(messageSlider, { target: { value: "250" } });
    expect(screen.getByText("250%")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("countdown.editor.scaleReset")[0]);
    const [resetSlider] = screen.getAllByRole("slider");
    expect(resetSlider).toHaveValue("100");
  });

  it("arming forwards both scales", async () => {
    render(
      <CountdownScheduleModal item={durationItem} setId="set-1" itemIndex={3} onClose={vi.fn()} />
    );

    const [messageSlider, digitsSlider] = screen.getAllByRole("slider");
    fireEvent.change(messageSlider, { target: { value: "150" } });
    fireEvent.change(digitsSlider, { target: { value: "200" } });

    fireEvent.click(screen.getByRole("checkbox"));
    const time = futureHHMM();
    const timeInput = screen.getByDisplayValue("09:00");
    fireEvent.change(timeInput, { target: { value: time } });

    fireEvent.click(screen.getByText("countdown.modal.save"));

    await waitFor(() =>
      expect(arm).toHaveBeenCalledWith(
        expect.objectContaining({ messageScale: 150, digitsScale: 200 })
      )
    );
  });
});
