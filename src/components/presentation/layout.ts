// Shared presentation layout maps. Single source of truth for typography,
// 9-point screen anchors, margins, and preset colors — consumed by
// PresentationApp, LivePreview, CountdownRenderer, and AnnouncementRenderer.
import type React from "react";
import type {
  BackgroundPreset,
  BoldLevel,
  FontFamily,
  FontSize,
  LineSpacing,
  Margin,
  ScreenPosition,
} from "../../types";

export const FONT_CLASS: Record<FontFamily, string> = {
  sans: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
};

export const SIZE_STYLE: Record<FontSize, React.CSSProperties> = {
  sm: { fontSize: "clamp(1rem, 2.5vw, 1.875rem)" },
  md: { fontSize: "clamp(1.25rem, 3.5vw, 2.5rem)" },
  lg: { fontSize: "clamp(1.5rem, 4vw, 3rem)" },
  xl: { fontSize: "clamp(2rem, 5vw, 4rem)" },
  xxl: { fontSize: "clamp(2.5rem, 6.5vw, 5.5rem)" },
};

// Fixed pixel sizes for the scaled-down editor/operator slide chips. These are
// the upper bound of each `SIZE_STYLE` clamp (in px) — the size a full-screen
// projector saturates to — so a chip rendered on a fixed virtual stage and then
// transform-scaled stays proportional to the live slide without depending on
// the operator window's viewport width.
export const PREVIEW_SIZE_PX: Record<FontSize, number> = {
  sm: 30, // 1.875rem
  md: 40, // 2.5rem
  lg: 48, // 3rem
  xl: 64, // 4rem
  xxl: 88, // 5.5rem
};

// Vertical line spacing presets. `gapEm` is the gap between separate lines
// (em-relative so it scales with font size); `lineHeight` is the line-height
// within a wrapped line. `normal` is tuned to approximate the historical
// `leading-relaxed` + `space-y-2` look so existing slides barely shift.
export const LINE_SPACING: Record<LineSpacing, { lineHeight: number; gapEm: number }> = {
  tight: { lineHeight: 1.15, gapEm: 0.2 },
  normal: { lineHeight: 1.4, gapEm: 0.45 },
  relaxed: { lineHeight: 1.6, gapEm: 0.75 },
  loose: { lineHeight: 1.85, gapEm: 1.1 },
};

// Lyric/announcement font weight presets. `medium` (500) matches the historical
// `font-medium` default.
export const BOLD_WEIGHT: Record<BoldLevel, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

// The title slide is always rendered one step bolder than the configured lyric
// bold level, so it reads as "slightly bolder" regardless of that setting.
export const titleWeight = (b: BoldLevel): number => Math.min(BOLD_WEIGHT[b] + 100, 800);

// Ordered smallest→largest so callers can step a size up or down a notch
// (e.g. the title/author intro slide renders the author one notch below the
// configured size; the title now matches the configured lyric size).
export const FONT_SIZE_ORDER: FontSize[] = ["sm", "md", "lg", "xl", "xxl"];

export const stepSize = (s: FontSize, by: number): FontSize => {
  const i = FONT_SIZE_ORDER.indexOf(s);
  const clamped = Math.min(FONT_SIZE_ORDER.length - 1, Math.max(0, i + by));
  return FONT_SIZE_ORDER[clamped];
};

// Map a 9-point anchor to flex alignment classes. `justify-*` controls the
// vertical axis (flex-col), `items-*` the horizontal axis, and `text-*` keeps
// inline content aligned with the anchor.
export const POSITION_CLASS: Record<ScreenPosition, string> = {
  "top-left": "justify-start items-start text-left",
  "top-center": "justify-start items-center text-center",
  "top-right": "justify-start items-end text-right",
  "center-left": "justify-center items-start text-left",
  center: "justify-center items-center text-center",
  "center-right": "justify-center items-end text-right",
  "bottom-left": "justify-end items-start text-left",
  "bottom-center": "justify-end items-center text-center",
  "bottom-right": "justify-end items-end text-right",
};

export const MARGIN_CLASS: Record<Margin, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-8",
  lg: "p-16",
  xl: "p-24",
};

// Solid-color presets: background + foreground (text) colors.
export const PRESET_COLORS: Record<BackgroundPreset, { bg: string; fg: string }> = {
  "preto-branco": { bg: "#000000", fg: "#FFFFFF" },
  "branco-preto": { bg: "#FFFFFF", fg: "#000000" },
};
