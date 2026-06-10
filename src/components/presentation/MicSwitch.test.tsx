import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MicSwitch } from "./MicSwitch";

vi.mock("../../stores/presentation", () => ({ usePresentationStore: vi.fn() }));
vi.mock("../../stores/settings", () => ({ useSettingsStore: vi.fn() }));

import { usePresentationStore } from "../../stores/presentation";
import { useSettingsStore } from "../../stores/settings";

const setOutputAudio = vi.fn();

function mockStores(opts: {
  enabled: boolean;
  micEnabled?: boolean;
  delay?: number;
  focused?: "one" | "two";
}) {
  vi.mocked(usePresentationStore).mockImplementation((sel: any) =>
    sel({ focusedOutput: opts.focused ?? "one" }),
  );
  vi.mocked(useSettingsStore).mockImplementation((sel: any) =>
    sel({
      multiScreenEnabled: opts.enabled,
      setOutputAudio,
      audio: {
        one: {
          micEnabled: opts.micEnabled ?? false,
          micDelayMs: opts.delay ?? 0,
          cameraUnmuted: false,
          micDevice: null,
          outputDevice: null,
        },
        two: {
          micEnabled: false,
          micDelayMs: 0,
          cameraUnmuted: false,
          micDevice: null,
          outputDevice: null,
        },
      },
    }),
  );
}

describe("MicSwitch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing when multi-screen is off", () => {
    mockStores({ enabled: false, micEnabled: true });
    render(<MicSwitch />);
    expect(screen.queryByTestId("mic-switch")).toBeNull();
  });

  it("renders nothing when the mic is not active in the config", () => {
    mockStores({ enabled: true, micEnabled: false });
    render(<MicSwitch />);
    expect(screen.queryByTestId("mic-switch")).toBeNull();
  });

  it("shows the live controls when the mic is active in the config", () => {
    mockStores({ enabled: true, micEnabled: true });
    render(<MicSwitch />);
    expect(screen.getByTestId("mic-switch")).toBeInTheDocument();
    expect(screen.getByText("Microfone ativo")).toBeInTheDocument();
  });

  it("updates the delay (live tuning)", () => {
    mockStores({ enabled: true, micEnabled: true, delay: 0 });
    render(<MicSwitch />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });
    expect(setOutputAudio).toHaveBeenCalledWith("one", { micDelayMs: 500 });
  });
});
