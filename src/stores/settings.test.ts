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
}));

import { getSetting } from "../api/commands";
import i18next from "../i18n";
import {
  useSettingsStore,
  ANNOUNCEMENT_MARGIN_KEY,
  BLACKOUT_AFTER_SONG_KEY,
  DEFAULT_ANNOUNCEMENT_MARGIN,
  PRESENTATION_SETTING_KEYS,
} from "./settings";

const mockGetSetting = vi.mocked(getSetting);
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
