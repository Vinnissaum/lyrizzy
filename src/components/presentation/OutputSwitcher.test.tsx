import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OutputSwitcher } from "./OutputSwitcher";

vi.mock("../../stores/presentation", () => ({
  usePresentationStore: vi.fn(),
}));
vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));

import { usePresentationStore } from "../../stores/presentation";
import { useSettingsStore } from "../../stores/settings";

const setFocusedOutput = vi.fn();

function mockStores(opts: { enabled: boolean; focused?: "one" | "two" }) {
  vi.mocked(useSettingsStore).mockImplementation((sel: any) =>
    sel({ multiScreenEnabled: opts.enabled }),
  );
  vi.mocked(usePresentationStore).mockImplementation((sel: any) =>
    sel({ focusedOutput: opts.focused ?? "one", setFocusedOutput }),
  );
}

describe("OutputSwitcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing when multi-screen is disabled", () => {
    mockStores({ enabled: false });
    render(<OutputSwitcher />);
    expect(screen.queryByTestId("output-switcher")).toBeNull();
  });

  it("renders both screen tabs when enabled and marks the focused one", () => {
    mockStores({ enabled: true, focused: "two" });
    render(<OutputSwitcher />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(screen.getByText("Tela 1")).toBeInTheDocument();
    expect(screen.getByText("Tela 2")).toBeInTheDocument();
    // Tela 2 is focused → aria-current true; Tela 1 not.
    expect(buttons[1].getAttribute("aria-current")).toBe("true");
    expect(buttons[0].getAttribute("aria-current")).toBe("false");
  });

  it("switches focus to the clicked output", () => {
    mockStores({ enabled: true, focused: "one" });
    render(<OutputSwitcher />);
    fireEvent.click(screen.getByText("Tela 2"));
    expect(setFocusedOutput).toHaveBeenCalledWith("two");
  });
});
