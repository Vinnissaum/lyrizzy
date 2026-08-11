import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../api/commands", () => ({
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { LaunchPolicySetting } from "./LaunchPolicySetting";
import { useSettingsStore } from "../../stores/settings";

describe("LaunchPolicySetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      multiScreenEnabled: true,
      launchPolicy: "ask",
    });
  });

  it("renders exactly three options with the current value checked", () => {
    render(<LaunchPolicySetting />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
  });

  it("calls setLaunchPolicy with the selected value", () => {
    const setLaunchPolicy = vi.fn();
    useSettingsStore.setState({ setLaunchPolicy });
    render(<LaunchPolicySetting />);
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]);
    expect(setLaunchPolicy).toHaveBeenCalledWith("mirror_all");
  });

  it("is disabled with an explanatory note when multi-screen is off", () => {
    useSettingsStore.setState({ multiScreenEnabled: false });
    render(<LaunchPolicySetting />);
    const radios = screen.getAllByRole("radio");
    radios.forEach((r) => expect(r).toBeDisabled());
    expect(screen.getByText("settings.launchPolicy.disabledHint")).toBeInTheDocument();
  });
});
