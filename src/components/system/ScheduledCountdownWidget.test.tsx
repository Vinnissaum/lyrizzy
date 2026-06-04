import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mutable mock store state ──────────────────────────────────────────────────

const reset = vi.fn().mockResolvedValue(undefined);

const storeMock = {
  state: {
    mode: "idle",
    durationMs: 0,
    remainingMs: 0,
    endBehavior: "holdZero",
  } as Record<string, unknown>,
  armedItem: null as { setId: string; itemIndex: number } | null,
  reset,
};

vi.mock("../../stores/countdown", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hook = (selector?: (s: any) => unknown) => {
    if (typeof selector === "function") return selector(storeMock);
    return storeMock;
  };
  hook.getState = () => storeMock;
  return { useCountdownStore: hook };
});

vi.mock("../../api/commands", () => ({
  updateSetItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && "remaining" in opts ? `${key}:${opts.remaining}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { ScheduledCountdownWidget } from "./ScheduledCountdownWidget";

describe("ScheduledCountdownWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.state = {
      mode: "idle",
      durationMs: 0,
      remainingMs: 0,
      endBehavior: "holdZero",
    };
    storeMock.armedItem = null;
  });

  it("renders nothing when mode is idle", () => {
    const { container } = render(<ScheduledCountdownWidget onEdit={vi.fn()} />);
    expect(container.firstChild).toBeNull();
    expect(
      screen.queryByTestId("scheduled-countdown-widget"),
    ).not.toBeInTheDocument();
  });

  it("renders and shows a remaining label when mode is scheduled", () => {
    storeMock.state = {
      mode: "scheduled",
      durationMs: 600_000,
      remainingMs: 3_661_000, // 1h 01m 01s
      endBehavior: "holdZero",
    };
    render(<ScheduledCountdownWidget onEdit={vi.fn()} />);

    expect(
      screen.getByTestId("scheduled-countdown-widget"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("widget-remaining")).toHaveTextContent(
      "countdown.widget.remaining:01:01:01",
    );
  });

  it("renders when running and takeover is true", () => {
    storeMock.state = {
      mode: "running",
      durationMs: 600_000,
      remainingMs: 30_000,
      endBehavior: "holdZero",
      takeover: true,
    };
    render(<ScheduledCountdownWidget onEdit={vi.fn()} />);
    expect(
      screen.getByTestId("scheduled-countdown-widget"),
    ).toBeInTheDocument();
    // < 1h drops the hour segment
    expect(screen.getByTestId("widget-remaining")).toHaveTextContent(
      "countdown.widget.remaining:00:30",
    );
  });

  it("does not render when running without takeover", () => {
    storeMock.state = {
      mode: "running",
      durationMs: 600_000,
      remainingMs: 30_000,
      endBehavior: "holdZero",
      takeover: false,
    };
    const { container } = render(
      <ScheduledCountdownWidget onEdit={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("Editar calls onEdit with the armed item", () => {
    storeMock.state = {
      mode: "scheduled",
      durationMs: 600_000,
      remainingMs: 600_000,
      endBehavior: "holdZero",
    };
    storeMock.armedItem = { setId: "set-1", itemIndex: 2 };
    const onEdit = vi.fn();
    render(<ScheduledCountdownWidget onEdit={onEdit} />);

    fireEvent.click(screen.getByText("countdown.widget.edit"));
    expect(onEdit).toHaveBeenCalledWith({ setId: "set-1", itemIndex: 2 });
  });

  it("Editar is disabled when there is no armed item", () => {
    storeMock.state = {
      mode: "scheduled",
      durationMs: 600_000,
      remainingMs: 600_000,
      endBehavior: "holdZero",
    };
    storeMock.armedItem = null;
    render(<ScheduledCountdownWidget onEdit={vi.fn()} />);
    expect(
      screen.getByText("countdown.widget.edit").closest("button"),
    ).toBeDisabled();
  });

  it("Cancelar calls reset and onCancel when provided", () => {
    storeMock.state = {
      mode: "scheduled",
      durationMs: 600_000,
      remainingMs: 600_000,
      endBehavior: "holdZero",
    };
    storeMock.armedItem = { setId: "set-1", itemIndex: 0 };
    const onCancel = vi.fn();
    render(<ScheduledCountdownWidget onEdit={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByText("countdown.widget.cancel"));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith({ setId: "set-1", itemIndex: 0 });
  });

  it("Cancelar calls reset without onCancel when not provided", () => {
    storeMock.state = {
      mode: "scheduled",
      durationMs: 600_000,
      remainingMs: 600_000,
      endBehavior: "holdZero",
    };
    storeMock.armedItem = { setId: "set-1", itemIndex: 0 };
    render(<ScheduledCountdownWidget onEdit={vi.fn()} />);

    fireEvent.click(screen.getByText("countdown.widget.cancel"));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("shows the HH:MM trigger time when scheduledStartEpochMs is set", () => {
    const d = new Date();
    d.setHours(19, 30, 0, 0);
    storeMock.state = {
      mode: "scheduled",
      durationMs: 600_000,
      remainingMs: 600_000,
      endBehavior: "holdZero",
      scheduledStartEpochMs: d.getTime(),
    };
    render(<ScheduledCountdownWidget onEdit={vi.fn()} />);
    expect(screen.getByTestId("widget-trigger-time")).toHaveTextContent(
      "19:30",
    );
  });
});
