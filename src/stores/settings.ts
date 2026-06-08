import { create } from "zustand";
import { getSetting, setSetting } from "../api/commands";
import i18next from "../i18n";
import type {
  BackgroundPreset,
  BoldLevel,
  FontFamily,
  FontSize,
  LineSpacing,
  Margin,
  RepeatMode,
  ScreenPosition,
} from "../types";

export const PRESENTATION_FONT_SIZE_KEY = "presentation.font_size";
export const PRESENTATION_FONT_FAMILY_KEY = "presentation.font_family";
export const PRESENTATION_PRESET_KEY = "presentation.preset";
export const PRESENTATION_POSITION_KEY = "presentation.position";
export const PRESENTATION_MARGIN_KEY = "presentation.margin";
export const PRESENTATION_LINE_SPACING_KEY = "presentation.line_spacing";
export const PRESENTATION_BOLD_LEVEL_KEY = "presentation.bold_level";
export const SHOW_TITLE_SLIDE_KEY = "presentation.show_title_slide";
export const AUTHOR_IN_PARENS_KEY = "presentation.author_in_parens";
export const PRESENTATION_REPEAT_MODE_KEY = "presentation.repeat_mode";
export const ANNOUNCEMENT_FONT_FAMILY_KEY = "announcement.font_family";
export const ANNOUNCEMENT_FONT_SIZE_KEY = "announcement.font_size";
export const ANNOUNCEMENT_PRESET_KEY = "announcement.preset";
export const ANNOUNCEMENT_POSITION_KEY = "announcement.position";
export const ANNOUNCEMENT_MARGIN_KEY = "announcement.margin";
export const ANNOUNCEMENT_LINE_SPACING_KEY = "announcement.line_spacing";
export const ANNOUNCEMENT_BOLD_LEVEL_KEY = "announcement.bold_level";
export const BLACKOUT_AFTER_SONG_KEY = "presentation.blackout_after_song";
export const UI_THEME_KEY = "ui.theme";

// Every settings key the presentation window must reload when it changes live.
export const PRESENTATION_SETTING_KEYS = [
  PRESENTATION_FONT_SIZE_KEY,
  PRESENTATION_FONT_FAMILY_KEY,
  PRESENTATION_PRESET_KEY,
  PRESENTATION_POSITION_KEY,
  PRESENTATION_MARGIN_KEY,
  PRESENTATION_LINE_SPACING_KEY,
  PRESENTATION_BOLD_LEVEL_KEY,
  ANNOUNCEMENT_FONT_FAMILY_KEY,
  ANNOUNCEMENT_FONT_SIZE_KEY,
  ANNOUNCEMENT_PRESET_KEY,
  ANNOUNCEMENT_POSITION_KEY,
  ANNOUNCEMENT_MARGIN_KEY,
  ANNOUNCEMENT_LINE_SPACING_KEY,
  ANNOUNCEMENT_BOLD_LEVEL_KEY,
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
const REPEAT_MODE_VALUES: RepeatMode[] = ["duplicate", "annotate"];
type Theme = "light" | "dark" | "black";
const THEME_VALUES: Theme[] = ["light", "dark", "black"];
const DEFAULT_THEME: Theme = "dark";

/** Applies the operator theme to the document root. No-op for unknown values. */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}
const LINE_SPACING_VALUES: LineSpacing[] = ["tight", "normal", "relaxed", "loose"];
const BOLD_LEVEL_VALUES: BoldLevel[] = ["normal", "medium", "semibold", "bold"];

const DEFAULT_FONT_SIZE: FontSize = "lg";
const DEFAULT_FONT_FAMILY: FontFamily = "sans";
const DEFAULT_PRESET: BackgroundPreset = "preto-branco";
const DEFAULT_POSITION: ScreenPosition = "center";
const DEFAULT_MARGIN: Margin = "lg";
const DEFAULT_REPEAT_MODE: RepeatMode = "duplicate";
const DEFAULT_LINE_SPACING: LineSpacing = "normal";
const DEFAULT_BOLD_LEVEL: BoldLevel = "medium";
const DEFAULT_ANNOUNCEMENT_FONT_SIZE: FontSize = "lg";
export const DEFAULT_ANNOUNCEMENT_MARGIN: Margin = "lg";

function parseEnum<T extends string>(value: string | null | undefined, valid: T[], fallback: T): T {
  return valid.includes(value as T) ? (value as T) : fallback;
}

interface SettingsStore {
  transitionMs: number;
  reduceMotion: boolean;
  locale: string;
  notesPanelCollapsed: boolean;
  theme: Theme;
  // Global presentation appearance
  presentationFontSize: FontSize;
  presentationFontFamily: FontFamily;
  presentationPreset: BackgroundPreset;
  presentationPosition: ScreenPosition;
  presentationMargin: Margin;
  presentationLineSpacing: LineSpacing;
  presentationBoldLevel: BoldLevel;
  presentationRepeatMode: RepeatMode;
  showTitleSlide: boolean;
  authorInParens: boolean;
  // Global announcement (Aviso) appearance
  announcementFontFamily: FontFamily;
  announcementFontSize: FontSize;
  announcementPreset: BackgroundPreset;
  announcementPosition: ScreenPosition;
  announcementMargin: Margin;
  announcementLineSpacing: LineSpacing;
  announcementBoldLevel: BoldLevel;
  blackoutAfterSong: boolean;

  setLocale: (locale: string) => void;
  loadLocale: () => Promise<void>;
  setNotesPanelCollapsed: (collapsed: boolean) => void;
  loadNotesPanelCollapsed: () => Promise<void>;
  setTheme: (theme: Theme) => void;
  loadTheme: () => Promise<void>;

  setPresentationFontSize: (size: FontSize) => void;
  setPresentationFontFamily: (family: FontFamily) => void;
  setPresentationPreset: (preset: BackgroundPreset) => void;
  setPresentationPosition: (position: ScreenPosition) => void;
  setPresentationMargin: (margin: Margin) => void;
  setPresentationLineSpacing: (spacing: LineSpacing) => void;
  setPresentationBoldLevel: (level: BoldLevel) => void;
  setPresentationRepeatMode: (mode: RepeatMode) => void;
  setShowTitleSlide: (value: boolean) => void;
  setAuthorInParens: (value: boolean) => void;
  setAnnouncementFontFamily: (family: FontFamily) => void;
  setAnnouncementFontSize: (size: FontSize) => void;
  setAnnouncementPreset: (preset: BackgroundPreset) => void;
  setAnnouncementPosition: (position: ScreenPosition) => void;
  setAnnouncementMargin: (margin: Margin) => void;
  setAnnouncementLineSpacing: (spacing: LineSpacing) => void;
  setAnnouncementBoldLevel: (level: BoldLevel) => void;
  setBlackoutAfterSong: (value: boolean) => void;

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
  theme: DEFAULT_THEME,
  presentationFontSize: DEFAULT_FONT_SIZE,
  presentationFontFamily: DEFAULT_FONT_FAMILY,
  presentationPreset: DEFAULT_PRESET,
  presentationPosition: DEFAULT_POSITION,
  presentationMargin: DEFAULT_MARGIN,
  presentationLineSpacing: DEFAULT_LINE_SPACING,
  presentationBoldLevel: DEFAULT_BOLD_LEVEL,
  presentationRepeatMode: DEFAULT_REPEAT_MODE,
  showTitleSlide: true,
  authorInParens: true,
  announcementFontFamily: DEFAULT_FONT_FAMILY,
  announcementFontSize: DEFAULT_ANNOUNCEMENT_FONT_SIZE,
  announcementPreset: DEFAULT_PRESET,
  announcementPosition: DEFAULT_POSITION,
  announcementMargin: DEFAULT_ANNOUNCEMENT_MARGIN,
  announcementLineSpacing: DEFAULT_LINE_SPACING,
  announcementBoldLevel: DEFAULT_BOLD_LEVEL,
  blackoutAfterSong: true,

  setLocale: (locale) => set({ locale }),
  loadLocale: async () => {
    try {
      const value = await getSetting("app.locale");
      if (value) {
        set({ locale: value });
        await i18next.changeLanguage(value);
      }
    } catch {
      // setting not found — use default "pt-BR"
    }
  },
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
  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    setSetting(UI_THEME_KEY, theme).catch(() => {});
  },
  loadTheme: async () => {
    const theme = await readSetting(UI_THEME_KEY, THEME_VALUES, DEFAULT_THEME);
    set({ theme });
    applyTheme(theme);
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
  setPresentationLineSpacing: (spacing) => {
    set({ presentationLineSpacing: spacing });
    setSetting(PRESENTATION_LINE_SPACING_KEY, spacing).catch(() => {});
  },
  setPresentationBoldLevel: (level) => {
    set({ presentationBoldLevel: level });
    setSetting(PRESENTATION_BOLD_LEVEL_KEY, level).catch(() => {});
  },
  setPresentationRepeatMode: (mode) => {
    set({ presentationRepeatMode: mode });
    setSetting(PRESENTATION_REPEAT_MODE_KEY, mode).catch(() => {});
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
  setAnnouncementMargin: (margin) => {
    set({ announcementMargin: margin });
    setSetting(ANNOUNCEMENT_MARGIN_KEY, margin).catch(() => {});
  },
  setAnnouncementLineSpacing: (spacing) => {
    set({ announcementLineSpacing: spacing });
    setSetting(ANNOUNCEMENT_LINE_SPACING_KEY, spacing).catch(() => {});
  },
  setAnnouncementBoldLevel: (level) => {
    set({ announcementBoldLevel: level });
    setSetting(ANNOUNCEMENT_BOLD_LEVEL_KEY, level).catch(() => {});
  },
  setBlackoutAfterSong: (value) => {
    set({ blackoutAfterSong: value });
    setSetting(BLACKOUT_AFTER_SONG_KEY, String(value)).catch(() => {});
  },

  loadPresentationSettings: async () => {
    const [
      fontSize, fontFamily, preset, position, margin, lineSpacing, boldLevel, repeatMode,
      showTitle, authorParens,
      annFamily, annSize, annPreset, annPosition, annMargin, annLineSpacing, annBoldLevel,
      blackoutAfterSong,
    ] = await Promise.all([
      readSetting(PRESENTATION_FONT_SIZE_KEY, FONT_SIZE_VALUES, DEFAULT_FONT_SIZE),
      readSetting(PRESENTATION_FONT_FAMILY_KEY, FONT_FAMILY_VALUES, DEFAULT_FONT_FAMILY),
      readSetting(PRESENTATION_PRESET_KEY, PRESET_VALUES, DEFAULT_PRESET),
      readSetting(PRESENTATION_POSITION_KEY, POSITION_VALUES, DEFAULT_POSITION),
      readSetting(PRESENTATION_MARGIN_KEY, MARGIN_VALUES, DEFAULT_MARGIN),
      readSetting(PRESENTATION_LINE_SPACING_KEY, LINE_SPACING_VALUES, DEFAULT_LINE_SPACING),
      readSetting(PRESENTATION_BOLD_LEVEL_KEY, BOLD_LEVEL_VALUES, DEFAULT_BOLD_LEVEL),
      readSetting(PRESENTATION_REPEAT_MODE_KEY, REPEAT_MODE_VALUES, DEFAULT_REPEAT_MODE),
      readBool(SHOW_TITLE_SLIDE_KEY, true),
      readBool(AUTHOR_IN_PARENS_KEY, true),
      readSetting(ANNOUNCEMENT_FONT_FAMILY_KEY, FONT_FAMILY_VALUES, DEFAULT_FONT_FAMILY),
      readSetting(ANNOUNCEMENT_FONT_SIZE_KEY, FONT_SIZE_VALUES, DEFAULT_ANNOUNCEMENT_FONT_SIZE),
      readSetting(ANNOUNCEMENT_PRESET_KEY, PRESET_VALUES, DEFAULT_PRESET),
      readSetting(ANNOUNCEMENT_POSITION_KEY, POSITION_VALUES, DEFAULT_POSITION),
      readSetting(ANNOUNCEMENT_MARGIN_KEY, MARGIN_VALUES, DEFAULT_ANNOUNCEMENT_MARGIN),
      readSetting(ANNOUNCEMENT_LINE_SPACING_KEY, LINE_SPACING_VALUES, DEFAULT_LINE_SPACING),
      readSetting(ANNOUNCEMENT_BOLD_LEVEL_KEY, BOLD_LEVEL_VALUES, DEFAULT_BOLD_LEVEL),
      readBool(BLACKOUT_AFTER_SONG_KEY, true),
    ]);
    set({
      presentationFontSize: fontSize,
      presentationFontFamily: fontFamily,
      presentationPreset: preset,
      presentationPosition: position,
      presentationMargin: margin,
      presentationLineSpacing: lineSpacing,
      presentationBoldLevel: boldLevel,
      presentationRepeatMode: repeatMode,
      showTitleSlide: showTitle,
      authorInParens: authorParens,
      announcementFontFamily: annFamily,
      announcementFontSize: annSize,
      announcementPreset: annPreset,
      announcementPosition: annPosition,
      announcementMargin: annMargin,
      announcementLineSpacing: annLineSpacing,
      announcementBoldLevel: annBoldLevel,
      blackoutAfterSong,
    });
  },
}));
