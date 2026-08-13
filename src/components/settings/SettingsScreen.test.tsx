import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
  MAX_CAMERA_JITTER_BUFFER_MS: 1000,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock("./LanguagePicker", () => ({
  LanguagePicker: () => <div data-testid="language-picker" />,
}));

vi.mock("./KeyBindingsScreen", () => ({
  KeyBindingsScreen: () => <div data-testid="key-bindings-screen" />,
}));

vi.mock("./MonitorPicker", () => ({
  MonitorPicker: () => <div data-testid="monitor-picker" />,
}));

vi.mock("./MonitorDetection", () => ({
  MonitorDetection: () => <div data-testid="monitor-detection" />,
}));

vi.mock("../reports/CCLIReportScreen", () => ({
  CCLIReportScreen: () => <div data-testid="ccli-report-screen" />,
}));

vi.mock("./AboutPanel", () => ({
  AboutPanel: () => <div data-testid="about-panel" />,
}));

import { SettingsScreen } from "./SettingsScreen";
import { useSettingsStore } from "../../stores/settings";

const makeStore = (overrides: Partial<ReturnType<typeof useSettingsStore>> = {}): ReturnType<typeof useSettingsStore> =>
  ({
    monitors: [],
    monitorNames: {},
    outputMonitorIndex: { one: null, two: null },
    cameraUrl: "",
    setCameraUrl: vi.fn(),
    presentationFontSize: "lg" as const,
    setPresentationFontSize: vi.fn(),
    presentationFontFamily: "sans" as const,
    setPresentationFontFamily: vi.fn(),
    presentationPreset: "preto-branco" as const,
    setPresentationPreset: vi.fn(),
    presentationPosition: "center" as const,
    setPresentationPosition: vi.fn(),
    presentationMargin: "lg" as const,
    setPresentationMargin: vi.fn(),
    presentationRepeatMode: "duplicate" as const,
    setPresentationRepeatMode: vi.fn(),
    showTitleSlide: true,
    setShowTitleSlide: vi.fn(),
    authorInParens: true,
    setAuthorInParens: vi.fn(),
    blackoutAfterSong: true,
    setBlackoutAfterSong: vi.fn(),
    cameraJitterBufferMs: 0,
    setCameraJitterBufferMs: vi.fn(),
    announcementFontFamily: "sans" as const,
    setAnnouncementFontFamily: vi.fn(),
    announcementFontSize: "lg" as const,
    setAnnouncementFontSize: vi.fn(),
    announcementPreset: "preto-branco" as const,
    setAnnouncementPreset: vi.fn(),
    announcementPosition: "center" as const,
    setAnnouncementPosition: vi.fn(),
    announcementMargin: "lg" as const,
    setAnnouncementMargin: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useSettingsStore>);

// Controls are split across tabs; activate the tab that hosts the control first.
function gotoTab(tab: "general" | "projection" | "announcement") {
  fireEvent.click(screen.getByRole("tab", { name: `settings.tabs.${tab}` }));
}

// useSettingsStore is called both with a selector (e.g. MonitorPicker/MonitorNameSettings
// `useSettingsStore((s) => s.monitors)`) and without one (SettingsScreen itself), so the
// mock must apply the selector when one is passed rather than always returning the whole store.
function setStore(overrides: Partial<ReturnType<typeof useSettingsStore>> = {}) {
  const store = makeStore(overrides);
  vi.mocked(useSettingsStore).mockImplementation((selector?: any) =>
    selector ? selector(store) : store,
  );
}

describe("SettingsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStore();
  });

  it("renders without crashing", () => {
    render(<SettingsScreen />);
    expect(screen.getByText("settings.title")).toBeInTheDocument();
  });

  it("switches tabs to reveal each section", () => {
    render(<SettingsScreen />);
    // General tab is active by default; projection controls are hidden.
    expect(screen.queryByText("settings.blackoutAfterSong")).toBeNull();
    gotoTab("projection");
    expect(screen.getByText("settings.blackoutAfterSong")).toBeInTheDocument();
  });

  describe("blackoutAfterSong toggle", () => {
    it("renders the blackoutAfterSong label", () => {
      render(<SettingsScreen />);
      gotoTab("projection");
      expect(screen.getByText("settings.blackoutAfterSong")).toBeInTheDocument();
    });

    it("shows On button as pressed when blackoutAfterSong is true", () => {
      setStore({ blackoutAfterSong: true });
      render(<SettingsScreen />);
      gotoTab("projection");

      // The label for this toggle
      const label = screen.getByText("settings.blackoutAfterSong");
      // Find the On button in the same toggle row
      const row = label.closest("div.flex");
      expect(row).not.toBeNull();
      const onButton = row!.querySelector("[aria-pressed='true']");
      expect(onButton).not.toBeNull();
      expect(onButton!.textContent).toBe("common.on");
    });

    it("shows Off button as pressed when blackoutAfterSong is false", () => {
      setStore({ blackoutAfterSong: false });
      render(<SettingsScreen />);
      gotoTab("projection");

      const label = screen.getByText("settings.blackoutAfterSong");
      const row = label.closest("div.flex");
      expect(row).not.toBeNull();
      const offButton = row!.querySelector("[aria-pressed='true']");
      expect(offButton).not.toBeNull();
      expect(offButton!.textContent).toBe("common.off");
    });

    it("calls setBlackoutAfterSong(false) when Off is clicked", () => {
      const setBlackoutAfterSong = vi.fn();
      setStore({ blackoutAfterSong: true, setBlackoutAfterSong });
      render(<SettingsScreen />);
      gotoTab("projection");

      const label = screen.getByText("settings.blackoutAfterSong");
      const row = label.closest("div.flex");
      expect(row).not.toBeNull();
      const offButton = Array.from(row!.querySelectorAll("button")).find(
        (b) => b.textContent === "common.off"
      );
      expect(offButton).toBeDefined();
      fireEvent.click(offButton!);
      expect(setBlackoutAfterSong).toHaveBeenCalledWith(false);
    });

    it("calls setBlackoutAfterSong(true) when On is clicked", () => {
      const setBlackoutAfterSong = vi.fn();
      setStore({ blackoutAfterSong: false, setBlackoutAfterSong });
      render(<SettingsScreen />);
      gotoTab("projection");

      const label = screen.getByText("settings.blackoutAfterSong");
      const row = label.closest("div.flex");
      expect(row).not.toBeNull();
      const onButton = Array.from(row!.querySelectorAll("button")).find(
        (b) => b.textContent === "common.on"
      );
      expect(onButton).toBeDefined();
      fireEvent.click(onButton!);
      expect(setBlackoutAfterSong).toHaveBeenCalledWith(true);
    });
  });

  describe("announcementMargin ButtonGroup", () => {
    it("renders the announcementMargin label", () => {
      render(<SettingsScreen />);
      gotoTab("announcement");
      expect(screen.getByText("settings.announcementMargin")).toBeInTheDocument();
    });

    it("shows the current announcementMargin value as pressed", () => {
      setStore({ announcementMargin: "sm" });
      render(<SettingsScreen />);
      gotoTab("announcement");

      const label = screen.getByText("settings.announcementMargin");
      const group = label.closest("div.space-y-1");
      expect(group).not.toBeNull();
      const pressedBtn = group!.querySelector("[aria-pressed='true']");
      expect(pressedBtn).not.toBeNull();
      expect(pressedBtn!.textContent).toBe("settings.appearance.margins.sm");
    });

    it("calls setAnnouncementMargin when a margin option is clicked", () => {
      const setAnnouncementMargin = vi.fn();
      setStore({ announcementMargin: "lg", setAnnouncementMargin });
      render(<SettingsScreen />);
      gotoTab("announcement");

      const label = screen.getByText("settings.announcementMargin");
      const group = label.closest("div.space-y-1");
      expect(group).not.toBeNull();
      const noneButton = Array.from(group!.querySelectorAll("button")).find(
        (b) => b.textContent === "settings.appearance.margins.none"
      );
      expect(noneButton).toBeDefined();
      fireEvent.click(noneButton!);
      expect(setAnnouncementMargin).toHaveBeenCalledWith("none");
    });

    it("renders all 5 margin options in the announcement margin group", () => {
      render(<SettingsScreen />);
      gotoTab("announcement");
      const label = screen.getByText("settings.announcementMargin");
      const group = label.closest("div.space-y-1");
      expect(group).not.toBeNull();
      const buttons = group!.querySelectorAll("button");
      expect(buttons).toHaveLength(5);
    });
  });

  describe("font size labels", () => {
    it("renders the announcement-scoped font size label on the Aviso tab", () => {
      render(<SettingsScreen />);
      gotoTab("announcement");
      expect(screen.getByText("settings.announcement.fontSize")).toBeInTheDocument();
      expect(screen.queryByText("settings.windows.fontSize")).toBeNull();
    });

    it("renders the song font size label on the Projeção tab", () => {
      render(<SettingsScreen />);
      gotoTab("projection");
      expect(screen.getByText("settings.windows.fontSize")).toBeInTheDocument();
      expect(screen.queryByText("settings.announcement.fontSize")).toBeNull();
    });
  });

  describe("repeat mode control removal", () => {
    it("does not render a repeatMode control on the Projeção tab", () => {
      render(<SettingsScreen />);
      gotoTab("projection");
      expect(screen.queryByText("settings.appearance.repeatMode")).toBeNull();
    });
  });
});
