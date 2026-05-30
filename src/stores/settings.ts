import { create } from "zustand";
import { getSetting, setSetting } from "../api/commands";
import type {
  BackgroundPreset,
  FontFamily,
  FontSize,
  Margin,
  ScreenPosition,
} from "../types";

export const PRESENTATION_FONT_SIZE_KEY = "presentation.font_size";
export const PRESENTATION_FONT_FAMILY_KEY = "presentation.font_family";
export const PRESENTATION_PRESET_KEY = "presentation.preset";
export const PRESENTATION_POSITION_KEY = "presentation.position";
export const PRESENTATION_MARGIN_KEY = "presentation.margin";
export const SHOW_TITLE_SLIDE_KEY = "presentation.show_title_slide";
export const AUTHOR_IN_PARENS_KEY = "presentation.author_in_parens";
export const ANNOUNCEMENT_FONT_FAMILY_KEY = "announcement.font_family";
export const ANNOUNCEMENT_FONT_SIZE_KEY = "announcement.font_size";
export const ANNOUNCEMENT_PRESET_KEY = "announcement.preset";
export const ANNOUNCEMENT_POSITION_KEY = "announcement.position";

// Every settings key the presentation window must reload when it changes live.
export const PRESENTATION_SETTING_KEYS = [
  PRESENTATION_FONT_SIZE_KEY,
  PRESENTATION_FONT_FAMILY_KEY,
  PRESENTATION_PRESET_KEY,
  PRESENTATION_POSITION_KEY,
  PRESENTATION_MARGIN_KEY,
  ANNOUNCEMENT_FONT_FAMILY_KEY,
  ANNOUNCEMENT_FONT_SIZE_KEY,
  ANNOUNCEMENT_PRESET_KEY,
  ANNOUNCEMENT_POSITION_KEY,
];

const FONT_SIZE_VALUES: FontSize[] = ["sm", "md", "lg", "xl", "xxl"];
const FONT_FAMILY_VALUES: FontFamily[] = ["sans", "serif", "mono"];
const PRESET_VALUES: BackgroundPreset[] = ["preto-branco", "branco-preto"];
const POSITION_VALUES: ScreenPosition[] = [
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
];
const MARGIN_VALUES: Margin[] = ["none", "sm", "md", "lg", "xl"];

const DEFAULT_FONT_SIZE: FontSize = "lg";
const DEFAULT_FONT_FAMILY: FontFamily = "sans";
const DEFAULT_PRESET: BackgroundPreset = "preto-branco";
const DEFAULT_POSITION: ScreenPosition = "center";
const DEFAULT_MARGIN: Margin = "lg";
const DEFAULT_ANNOUNCEMENT_FONT_SIZE: FontSize = "lg";

function parseEnum<T extends string>(value: string | null | undefined, valid: T[], fallback: T): T {
  return valid.includes(value as T) ? (value as T) : fallback;
}

interface SettingsStore {
  transitionMs: number;
  reduceMotion: boolean;
  locale: string;
  notesPanelCollapsed: boolean;
  cameraUrl: string;
  // Global presentation appearance
  presentationFontSize: FontSize;
  presentationFontFamily: FontFamily;
  presentationPreset: BackgroundPreset;
  presentationPosition: ScreenPosition;
  presentationMargin: Margin;
  showTitleSlide: boolean;
  authorInParens: boolean;
  // Global announcement (Aviso) appearance
  announcementFontFamily: FontFamily;
  announcementFontSize: FontSize;
  announcementPreset: BackgroundPreset;
  announcementPosition: ScreenPosition;

  setLocale: (locale: string) => void;
  setNotesPanelCollapsed: (collapsed: boolean) => void;
  loadNotesPanelCollapsed: () => Promise<void>;
  setCameraUrl: (url: string) => void;
  loadCameraUrl: () => Promise<void>;

  setPresentationFontSize: (size: FontSize) => void;
  setPresentationFontFamily: (family: FontFamily) => void;
  setPresentationPreset: (preset: BackgroundPreset) => void;
  setPresentationPosition: (position: ScreenPosition) => void;
  setPresentationMargin: (margin: Margin) => void;
  setShowTitleSlide: (value: boolean) => void;
  setAuthorInParens: (value: boolean) => void;
  setAnnouncementFontFamily: (family: FontFamily) => void;
  setAnnouncementFontSize: (size: FontSize) => void;
  setAnnouncementPreset: (preset: BackgroundPreset) => void;
  setAnnouncementPosition: (position: ScreenPosition) => void;

  /** Loads every persisted presentation/announcement appearance setting. */
  loadPresentationSettings: () => Promise<void>;
}

async function readSetting<T extends string>(key: string, valid: T[], fallback: T): Promise<T> {
  try {
    return parseEnum(await getSetting(key), valid, fallback);
  } catch {
    return fallback;
  }
}

async function readBool(key: string, fallback: boolean): Promise<boolean> {
  try {
    const v = await getSetting(key);
    return v === "true" ? true : v === "false" ? false : fallback;
  } catch {
    return fallback;
  }
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  transitionMs: 200,
  reduceMotion: false,
  locale: "pt-BR",
  notesPanelCollapsed: false,
  cameraUrl: "",
  presentationFontSize: DEFAULT_FONT_SIZE,
  presentationFontFamily: DEFAULT_FONT_FAMILY,
  presentationPreset: DEFAULT_PRESET,
  presentationPosition: DEFAULT_POSITION,
  presentationMargin: DEFAULT_MARGIN,
  showTitleSlide: true,
  authorInParens: true,
  announcementFontFamily: DEFAULT_FONT_FAMILY,
  announcementFontSize: DEFAULT_ANNOUNCEMENT_FONT_SIZE,
  announcementPreset: DEFAULT_PRESET,
  announcementPosition: DEFAULT_POSITION,

  setLocale: (locale) => set({ locale }),
  setNotesPanelCollapsed: (collapsed) => {
    set({ notesPanelCollapsed: collapsed });
    setSetting("ui.notes_panel_collapsed", String(collapsed)).catch(() => {});
  },
  loadNotesPanelCollapsed: async () => {
    try {
      const val = await getSetting("ui.notes_panel_collapsed");
      set({ notesPanelCollapsed: val === "true" });
    } catch {
      // setting not found — use default false
    }
  },
  setCameraUrl: (url) => {
    set({ cameraUrl: url });
    setSetting("camera.url", url).catch(() => {});
  },
  loadCameraUrl: async () => {
    try {
      const url = await getSetting("camera.url");
      set({ cameraUrl: url });
    } catch {
      // setting not found — use default ""
    }
  },

  setPresentationFontSize: (size) => {
    set({ presentationFontSize: size });
    setSetting(PRESENTATION_FONT_SIZE_KEY, size).catch(() => {});
  },
  setPresentationFontFamily: (family) => {
    set({ presentationFontFamily: family });
    setSetting(PRESENTATION_FONT_FAMILY_KEY, family).catch(() => {});
  },
  setPresentationPreset: (preset) => {
    set({ presentationPreset: preset });
    setSetting(PRESENTATION_PRESET_KEY, preset).catch(() => {});
  },
  setPresentationPosition: (position) => {
    set({ presentationPosition: position });
    setSetting(PRESENTATION_POSITION_KEY, position).catch(() => {});
  },
  setPresentationMargin: (margin) => {
    set({ presentationMargin: margin });
    setSetting(PRESENTATION_MARGIN_KEY, margin).catch(() => {});
  },
  setShowTitleSlide: (value) => {
    set({ showTitleSlide: value });
    setSetting(SHOW_TITLE_SLIDE_KEY, String(value)).catch(() => {});
  },
  setAuthorInParens: (value) => {
    set({ authorInParens: value });
    setSetting(AUTHOR_IN_PARENS_KEY, String(value)).catch(() => {});
  },
  setAnnouncementFontFamily: (family) => {
    set({ announcementFontFamily: family });
    setSetting(ANNOUNCEMENT_FONT_FAMILY_KEY, family).catch(() => {});
  },
  setAnnouncementFontSize: (size) => {
    set({ announcementFontSize: size });
    setSetting(ANNOUNCEMENT_FONT_SIZE_KEY, size).catch(() => {});
  },
  setAnnouncementPreset: (preset) => {
    set({ announcementPreset: preset });
    setSetting(ANNOUNCEMENT_PRESET_KEY, preset).catch(() => {});
  },
  setAnnouncementPosition: (position) => {
    set({ announcementPosition: position });
    setSetting(ANNOUNCEMENT_POSITION_KEY, position).catch(() => {});
  },

  loadPresentationSettings: async () => {
    const [
      fontSize, fontFamily, preset, position, margin,
      showTitle, authorParens,
      annFamily, annSize, annPreset, annPosition,
    ] = await Promise.all([
      readSetting(PRESENTATION_FONT_SIZE_KEY, FONT_SIZE_VALUES, DEFAULT_FONT_SIZE),
      readSetting(PRESENTATION_FONT_FAMILY_KEY, FONT_FAMILY_VALUES, DEFAULT_FONT_FAMILY),
      readSetting(PRESENTATION_PRESET_KEY, PRESET_VALUES, DEFAULT_PRESET),
      readSetting(PRESENTATION_POSITION_KEY, POSITION_VALUES, DEFAULT_POSITION),
      readSetting(PRESENTATION_MARGIN_KEY, MARGIN_VALUES, DEFAULT_MARGIN),
      readBool(SHOW_TITLE_SLIDE_KEY, true),
      readBool(AUTHOR_IN_PARENS_KEY, true),
      readSetting(ANNOUNCEMENT_FONT_FAMILY_KEY, FONT_FAMILY_VALUES, DEFAULT_FONT_FAMILY),
      readSetting(ANNOUNCEMENT_FONT_SIZE_KEY, FONT_SIZE_VALUES, DEFAULT_ANNOUNCEMENT_FONT_SIZE),
      readSetting(ANNOUNCEMENT_PRESET_KEY, PRESET_VALUES, DEFAULT_PRESET),
      readSetting(ANNOUNCEMENT_POSITION_KEY, POSITION_VALUES, DEFAULT_POSITION),
    ]);
    set({
      presentationFontSize: fontSize,
      presentationFontFamily: fontFamily,
      presentationPreset: preset,
      presentationPosition: position,
      presentationMargin: margin,
      showTitleSlide: showTitle,
      authorInParens: authorParens,
      announcementFontFamily: annFamily,
      announcementFontSize: annSize,
      announcementPreset: annPreset,
      announcementPosition: annPosition,
    });
  },
}));
