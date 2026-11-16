import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SetItem } from "../../types";

// ── Mock store ────────────────────────────────────────────────────────────────

const arm = vi.fn().mockResolvedValue(undefined);
const reset = vi.fn().mockResolvedValue(undefined);
// `state` and `armedItem` are what the dialog reads in the presenter (P23).
const storeMock: {
  arm: typeof arm;
  reset: typeof reset;
  state: { mode: string };
  armedItem: { setId: string; itemIndex: number } | null;
} = { arm, reset, state: { mode: "idle" }, armedItem: null };

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
    storeMock.state = { mode: "idle" };
    storeMock.armedItem = null;
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

// ── P23: opened from the presenter's set pane ───────────────────────────────

describe("CountdownScheduleModal in the presenter (live)", () => {
  const scheduledItem: SetItem = {
    ...durationItem,
    countdownConfig: {
      ...durationItem.countdownConfig!,
      // Stored earlier; may well be in the past by the time the test runs.
      scheduledStart: { hour: 0, minute: 1 },
    },
  };

  const savedConfig = () => vi.mocked(updateSetItem).mock.calls[0][0].countdownConfig!;

  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.state = { mode: "idle" };
    storeMock.armedItem = null;
  });

  it.each(["running", "paused"])(
    "live: schedule fields are disabled while a countdown is counting (%s)",
    (mode) => {
      storeMock.state = { mode };
      render(
        <CountdownScheduleModal live item={scheduledItem} setId="set-1" itemIndex={0} onClose={vi.fn()} />,
      );

      const toggle = screen.getByRole("checkbox");
      expect(toggle).toBeDisabled();
      // The stored schedule is shown, not hidden.
      expect(toggle).toBeChecked();
      expect(screen.getByDisplayValue("00:01")).toBeDisabled();
      expect(screen.getByText("countdown.schedule.unavailableWhileCounting")).toBeInTheDocument();
    },
  );

  it("live: the schedule fields are usable when nothing is counting, and on Home", () => {
    const { unmount } = render(
      <CountdownScheduleModal live item={scheduledItem} setId="set-1" itemIndex={0} onClose={vi.fn()} />,
    );
    expect(screen.getByRole("checkbox")).toBeEnabled();
    expect(screen.queryByText("countdown.schedule.unavailableWhileCounting")).not.toBeInTheDocument();
    unmount();

    // On Home a running countdown locks nothing.
    storeMock.state = { mode: "running" };
    render(<CountdownScheduleModal item={scheduledItem} setId="set-1" itemIndex={0} onClose={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeEnabled();
    expect(screen.queryByText("countdown.schedule.unavailableWhileCounting")).not.toBeInTheDocument();
  });

  it("live: a save while counting keeps the stored schedule and neither arms nor resets", async () => {
    storeMock.state = { mode: "running" };
    const onClose = vi.fn();
    render(
      <CountdownScheduleModal live item={scheduledItem} setId="set-1" itemIndex={0} onClose={onClose} />,
    );

    fireEvent.change(screen.getByPlaceholderText("10:00"), { target: { value: "07:30" } });
    fireEvent.click(screen.getByText("countdown.modal.save"));

    await waitFor(() => expect(vi.mocked(updateSetItem)).toHaveBeenCalledTimes(1));
    expect(savedConfig().scheduledStart).toEqual({ hour: 0, minute: 1 });
    expect(savedConfig().target).toEqual({ kind: "duration", durationMs: 450_000 });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(arm).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it("live: a save while counting with no stored schedule stores none", async () => {
    storeMock.state = { mode: "paused" };
    const onClose = vi.fn();
    render(
      <CountdownScheduleModal live item={durationItem} setId="set-1" itemIndex={0} onClose={onClose} />,
    );

    fireEvent.click(screen.getByText("countdown.modal.save"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(savedConfig().scheduledStart).toBeUndefined();
    expect(arm).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it("live: a schedule arms when nothing is counting", async () => {
    const onClose = vi.fn();
    render(
      <CountdownScheduleModal live item={durationItem} setId="set-1" itemIndex={2} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("checkbox"));
    const time = futureHHMM();
    fireEvent.change(screen.getByDisplayValue("09:00"), { target: { value: time } });
    fireEvent.click(screen.getByText("countdown.modal.save"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [h, m] = time.split(":").map(Number);
    expect(savedConfig().scheduledStart).toEqual({ hour: h, minute: m });
    expect(arm).toHaveBeenCalledTimes(1);
    expect(arm).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledStart: { hour: h, minute: m },
        durationMs: 600_000,
        setId: "set-1",
        itemIndex: 2,
      }),
    );
    expect(reset).not.toHaveBeenCalled();
  });

  it("live: turning off this item's armed schedule disarms it", async () => {
    storeMock.state = { mode: "scheduled" };
    storeMock.armedItem = { setId: "set-1", itemIndex: 2 };
    const onClose = vi.fn();
    render(
      <CountdownScheduleModal live item={scheduledItem} setId="set-1" itemIndex={2} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("countdown.modal.save"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(savedConfig().scheduledStart).toBeUndefined();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(arm).not.toHaveBeenCalled();
  });

  it("live: another item's armed schedule is left alone", async () => {
    storeMock.state = { mode: "scheduled" };
    // Armed for item 3 of this set; item 0 is the one being edited.
    storeMock.armedItem = { setId: "set-1", itemIndex: 3 };
    const onClose = vi.fn();
    const { unmount } = render(
      <CountdownScheduleModal live item={durationItem} setId="set-1" itemIndex={0} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText("countdown.modal.save"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(reset).not.toHaveBeenCalled();
    expect(arm).not.toHaveBeenCalled();
    unmount();

    // The same index in another set is not this item either.
    storeMock.armedItem = { setId: "set-9", itemIndex: 0 };
    render(<CountdownScheduleModal live item={durationItem} setId="set-1" itemIndex={0} onClose={onClose} />);
    fireEvent.click(screen.getByText("countdown.modal.save"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
    expect(reset).not.toHaveBeenCalled();
  });

  it("live: a finished countdown is not reset by a save", async () => {
    // Holding 00:00 on the wall from this item: the backend restarts or
    // restyles it; the dialog must not wipe it.
    storeMock.state = { mode: "finished" };
    const onClose = vi.fn();
    render(
      <CountdownScheduleModal live item={durationItem} setId="set-1" itemIndex={0} onClose={onClose} />,
    );

    fireEvent.click(screen.getByText("countdown.modal.save"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(reset).not.toHaveBeenCalled();
    expect(arm).not.toHaveBeenCalled();
  });
});
