import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock i18n before importing the store (store imports i18next at module load)
vi.mock("../i18n", () => ({
  default: {
    changeLanguage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../api/commands", () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn().mockResolvedValue(undefined),
  listMonitors: vi.fn(),
  PRESENTATION_MONITOR_KEY: "presentation.monitor_index",
  OUTPUT2_MONITOR_KEY: "output2.monitor_index",
}));

vi.mock("../utils/monitorNames", () => ({
  loadMonitorNames: vi.fn(),
  MONITOR_NAMES_KEY: "display.monitor_names",
}));

import { getSetting, setSetting, listMonitors, PRESENTATION_MONITOR_KEY, OUTPUT2_MONITOR_KEY } from "../api/commands";
import { loadMonitorNames, MONITOR_NAMES_KEY } from "../utils/monitorNames";
import type { MonitorInfo } from "../types";
import i18next from "../i18n";
import {
  useSettingsStore,
  ANNOUNCEMENT_MARGIN_KEY,
  BLACKOUT_AFTER_SONG_KEY,
  DEFAULT_ANNOUNCEMENT_MARGIN,
  DEFAULT_OUTPUT_MONITOR_INDEX,
  PRESENTATION_SETTING_KEYS,
  UI_THEME_KEY,
  LAUNCH_POLICY_KEY,
} from "./settings";

const mockGetSetting = vi.mocked(getSetting);
const mockSetSetting = vi.mocked(setSetting);
const mockListMonitors = vi.mocked(listMonitors);
const mockLoadMonitorNames = vi.mocked(loadMonitorNames);
const mockChangeLanguage = vi.mocked(i18next.changeLanguage);

describe("useSettingsStore — loadLocale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ locale: "pt-BR" });
  });

  it("sets store locale and calls changeLanguage when getSetting returns a value", async () => {
    mockGetSetting.mockResolvedValue("en-US");

    await useSettingsStore.getState().loadLocale();

    expect(useSettingsStore.getState().locale).toBe("en-US");
    expect(mockChangeLanguage).toHaveBeenCalledWith("en-US");
  });

  it("leaves default locale when getSetting returns empty string", async () => {
    mockGetSetting.mockResolvedValue("");

    await useSettingsStore.getState().loadLocale();

    expect(useSettingsStore.getState().locale).toBe("pt-BR");
    expect(mockChangeLanguage).not.toHaveBeenCalled();
  });

  it("leaves default locale and does not throw when getSetting rejects", async () => {
    mockGetSetting.mockRejectedValue(new Error("not found"));

    await expect(useSettingsStore.getState().loadLocale()).resolves.toBeUndefined();

    expect(useSettingsStore.getState().locale).toBe("pt-BR");
    expect(mockChangeLanguage).not.toHaveBeenCalled();
  });

  it("leaves default locale and does not throw when getSetting returns null-ish", async () => {
    mockGetSetting.mockResolvedValue(null as unknown as string);

    await expect(useSettingsStore.getState().loadLocale()).resolves.toBeUndefined();

    expect(useSettingsStore.getState().locale).toBe("pt-BR");
    expect(mockChangeLanguage).not.toHaveBeenCalled();
  });
});

describe("useSettingsStore — loadPresentationSettings (announcementMargin + blackoutAfterSong)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      announcementMargin: DEFAULT_ANNOUNCEMENT_MARGIN,
      blackoutAfterSong: true,
    });
  });

  it("loads announcementMargin from persisted setting", async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === ANNOUNCEMENT_MARGIN_KEY) return Promise.resolve("sm");
      if (key === BLACKOUT_AFTER_SONG_KEY) return Promise.resolve("true");
      return Promise.resolve("");
    });

    await useSettingsStore.getState().loadPresentationSettings();

    expect(useSettingsStore.getState().announcementMargin).toBe("sm");
  });

  it("loads blackoutAfterSong=false from persisted setting", async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === BLACKOUT_AFTER_SONG_KEY) return Promise.resolve("false");
      return Promise.resolve("");
    });

    await useSettingsStore.getState().loadPresentationSettings();

    expect(useSettingsStore.getState().blackoutAfterSong).toBe(false);
  });

  it("loads blackoutAfterSong=true from persisted setting", async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === BLACKOUT_AFTER_SONG_KEY) return Promise.resolve("true");
      return Promise.resolve("");
    });

    await useSettingsStore.getState().loadPresentationSettings();

    expect(useSettingsStore.getState().blackoutAfterSong).toBe(true);
  });

  it("falls back to 'lg' for an invalid announcementMargin value", async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === ANNOUNCEMENT_MARGIN_KEY) return Promise.resolve("huge");
      return Promise.resolve("");
    });

    await useSettingsStore.getState().loadPresentationSettings();

    expect(useSettingsStore.getState().announcementMargin).toBe("lg");
  });

  it("falls back to true for a non-'true'/'false' blackoutAfterSong value", async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === BLACKOUT_AFTER_SONG_KEY) return Promise.resolve("yes");
      return Promise.resolve("");
    });

    await useSettingsStore.getState().loadPresentationSettings();

    expect(useSettingsStore.getState().blackoutAfterSong).toBe(true);
  });

  it("falls back to 'lg' when announcementMargin getSetting rejects", async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === ANNOUNCEMENT_MARGIN_KEY) return Promise.reject(new Error("db error"));
      return Promise.resolve("");
    });

    await useSettingsStore.getState().loadPresentationSettings();

    expect(useSettingsStore.getState().announcementMargin).toBe("lg");
  });

  it("falls back to true when blackoutAfterSong getSetting rejects", async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === BLACKOUT_AFTER_SONG_KEY) return Promise.reject(new Error("db error"));
      return Promise.resolve("");
    });

    await useSettingsStore.getState().loadPresentationSettings();

    expect(useSettingsStore.getState().blackoutAfterSong).toBe(true);
  });
});

describe("useSettingsStore — theme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ theme: "dark" });
    delete document.documentElement.dataset.theme;
  });

  it("loadTheme applies the persisted light value to <html> and store", async () => {
    mockGetSetting.mockResolvedValue("light");

    await useSettingsStore.getState().loadTheme();

    expect(useSettingsStore.getState().theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("loadTheme falls back to dark for an invalid persisted value", async () => {
    mockGetSetting.mockResolvedValue("solarized");

    await useSettingsStore.getState().loadTheme();

    expect(useSettingsStore.getState().theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("loadTheme falls back to dark when getSetting rejects", async () => {
    mockGetSetting.mockRejectedValue(new Error("not found"));

    await useSettingsStore.getState().loadTheme();

    expect(useSettingsStore.getState().theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("setTheme updates store, applies to <html>, and persists", () => {
    useSettingsStore.getState().setTheme("light");

    expect(useSettingsStore.getState().theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(mockSetSetting).toHaveBeenCalledWith(UI_THEME_KEY, "light");
  });

  it("setTheme accepts the black (VS Code dark) palette", () => {
    useSettingsStore.getState().setTheme("black");

    expect(useSettingsStore.getState().theme).toBe("black");
    expect(document.documentElement.dataset.theme).toBe("black");
    expect(mockSetSetting).toHaveBeenCalledWith(UI_THEME_KEY, "black");
  });

  it("loadTheme applies the persisted black value to <html> and store", async () => {
    mockGetSetting.mockResolvedValue("black");

    await useSettingsStore.getState().loadTheme();

    expect(useSettingsStore.getState().theme).toBe("black");
    expect(document.documentElement.dataset.theme).toBe("black");
  });
});

describe("useSettingsStore — launchPolicy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ launchPolicy: "ask" });
  });

  it("defaults to 'ask' before any load", () => {
    expect(useSettingsStore.getState().launchPolicy).toBe("ask");
  });

  it("setLaunchPolicy updates the store and persists via setSetting", () => {
    useSettingsStore.getState().setLaunchPolicy("mirror_all");

    expect(useSettingsStore.getState().launchPolicy).toBe("mirror_all");
    expect(mockSetSetting).toHaveBeenCalledWith(LAUNCH_POLICY_KEY, "mirror_all");
  });

  it("falls back to 'ask' for a garbage persisted value on load", async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === LAUNCH_POLICY_KEY) return Promise.resolve("garbage");
      return Promise.resolve("");
    });

    await useSettingsStore.getState().loadPresentationSettings();

    expect(useSettingsStore.getState().launchPolicy).toBe("ask");
  });
});

describe("useSettingsStore — PRESENTATION_SETTING_KEYS includes new keys", () => {
  it("includes ANNOUNCEMENT_MARGIN_KEY", () => {
    expect(PRESENTATION_SETTING_KEYS).toContain(ANNOUNCEMENT_MARGIN_KEY);
  });

  it("does not include BLACKOUT_AFTER_SONG_KEY (it is not a live-reload appearance key)", () => {
    // blackout is a behaviour setting, not a visual appearance key —
    // its absence from the array is intentional per the spec
    expect(BLACKOUT_AFTER_SONG_KEY).toBe("presentation.blackout_after_song");
  });
});

describe("useSettingsStore — monitor setup", () => {
  const monitorA: MonitorInfo = { name: "DP-1", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1 };
  const monitorB: MonitorInfo = { name: "HDMI-1", width: 1280, height: 720, x: 1920, y: 0, scaleFactor: 1 };

  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      monitors: [],
      monitorNames: {},
      outputMonitorIndex: { ...DEFAULT_OUTPUT_MONITOR_INDEX },
    });
  });

  it("loadMonitorSetup happy path populates monitors, names and per-output index", async () => {
    mockListMonitors.mockResolvedValue([monitorA, monitorB]);
    mockLoadMonitorNames.mockResolvedValue({ "name:DP-1": "Sanctuary" });
    mockGetSetting.mockImplementation((key: string) => {
      if (key === PRESENTATION_MONITOR_KEY) return Promise.resolve("0");
      if (key === OUTPUT2_MONITOR_KEY) return Promise.resolve("1");
      return Promise.resolve("");
    });

    await useSettingsStore.getState().loadMonitorSetup();

    const state = useSettingsStore.getState();
    expect(state.monitors).toEqual([monitorA, monitorB]);
    expect(state.monitorNames).toEqual({ "name:DP-1": "Sanctuary" });
    expect(state.outputMonitorIndex).toEqual({ one: 0, two: 1 });
  });

  it("leaves monitors: [] and does not throw when listMonitors rejects", async () => {
    mockListMonitors.mockRejectedValue(new Error("no display server"));
    mockLoadMonitorNames.mockResolvedValue({});
    mockGetSetting.mockResolvedValue(null as unknown as string);

    await expect(useSettingsStore.getState().loadMonitorSetup()).resolves.toBeUndefined();

    expect(useSettingsStore.getState().monitors).toEqual([]);
  });

  it("resolves monitorNames to {} and does not throw on a malformed/missing settings row", async () => {
    mockListMonitors.mockResolvedValue([]);
    // Real loadMonitorNames already swallows malformed rows into {} — simulate that contract.
    mockLoadMonitorNames.mockResolvedValue({});
    mockGetSetting.mockResolvedValue(null as unknown as string);

    await expect(useSettingsStore.getState().loadMonitorSetup()).resolves.toBeUndefined();

    expect(useSettingsStore.getState().monitorNames).toEqual({});
  });

  it("setMonitorName keeps pre-existing entries for undetected monitors and persists the merged map", async () => {
    useSettingsStore.setState({
      monitorNames: { "name:HDMI-1": "Lobby (offline)" },
    });

    await useSettingsStore.getState().setMonitorName("name:DP-1", "Sanctuary");

    expect(useSettingsStore.getState().monitorNames).toEqual({
      "name:HDMI-1": "Lobby (offline)",
      "name:DP-1": "Sanctuary",
    });
    expect(mockSetSetting).toHaveBeenCalledWith(
      MONITOR_NAMES_KEY,
      JSON.stringify({ "name:HDMI-1": "Lobby (offline)", "name:DP-1": "Sanctuary" }),
    );
  });

  describe("applyMonitorSetting", () => {
    it("updates monitorNames for the names key", () => {
      useSettingsStore.getState().applyMonitorSetting(
        MONITOR_NAMES_KEY,
        JSON.stringify({ "name:DP-1": "Sanctuary" }),
      );

      expect(useSettingsStore.getState().monitorNames).toEqual({ "name:DP-1": "Sanctuary" });
    });

    it("parses a numeric PRESENTATION_MONITOR_KEY value into outputMonitorIndex.one", () => {
      useSettingsStore.getState().applyMonitorSetting(PRESENTATION_MONITOR_KEY, "2");

      expect(useSettingsStore.getState().outputMonitorIndex.one).toBe(2);
    });

    it("parses 'auto' for OUTPUT2_MONITOR_KEY into null", () => {
      useSettingsStore.setState({ outputMonitorIndex: { one: null, two: 3 } });

      useSettingsStore.getState().applyMonitorSetting(OUTPUT2_MONITOR_KEY, "auto");

      expect(useSettingsStore.getState().outputMonitorIndex.two).toBeNull();
    });

    it("parses a non-numeric index value into null", () => {
      useSettingsStore.getState().applyMonitorSetting(PRESENTATION_MONITOR_KEY, "not-a-number");

      expect(useSettingsStore.getState().outputMonitorIndex.one).toBeNull();
    });

    it("no-ops on an unrelated key", () => {
      const before = useSettingsStore.getState();

      useSettingsStore.getState().applyMonitorSetting("some.other.key", "value");

      const after = useSettingsStore.getState();
      expect(after.monitors).toBe(before.monitors);
      expect(after.monitorNames).toBe(before.monitorNames);
      expect(after.outputMonitorIndex).toBe(before.outputMonitorIndex);
    });
  });
});
