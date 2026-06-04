import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CountdownLaunchPrompt } from "./CountdownLaunchPrompt";

describe("CountdownLaunchPrompt", () => {
  const baseProps = {
    scheduledHHMM: "19:30",
    // 2h 14m 00s
    remainingMs: (2 * 3600 + 14 * 60) * 1000,
    onKeep: vi.fn(),
    onDisable: vi.fn(),
  };

  it("renders the scheduled time and formatted remaining (hh:mm:ss)", () => {
    render(<CountdownLaunchPrompt {...baseProps} onKeep={vi.fn()} onDisable={vi.fn()} />);
    const dialog = screen.getByTestId("countdown-launch-prompt");
    expect(dialog).toHaveTextContent("19:30");
    expect(dialog).toHaveTextContent("02:14:00");
  });

  it("drops the hour segment when under one hour", () => {
    render(
      <CountdownLaunchPrompt
        {...baseProps}
        remainingMs={(5 * 60 + 9) * 1000}
        onKeep={vi.fn()}
        onDisable={vi.fn()}
      />,
    );
    expect(screen.getByTestId("countdown-launch-prompt")).toHaveTextContent("05:09");
  });

  it("fires onKeep / onDisable on the matching buttons", () => {
    const onKeep = vi.fn();
    const onDisable = vi.fn();
    render(<CountdownLaunchPrompt {...baseProps} onKeep={onKeep} onDisable={onDisable} />);

    fireEvent.click(screen.getByTestId("countdown-launch-keep"));
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onDisable).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("countdown-launch-disable"));
    expect(onDisable).toHaveBeenCalledTimes(1);
  });
});
