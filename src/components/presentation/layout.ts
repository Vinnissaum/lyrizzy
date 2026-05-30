// Shared presentation layout maps. Single source of truth for typography,
// 9-point screen anchors, margins, and preset colors — consumed by
// PresentationApp, LivePreview, CountdownRenderer, and AnnouncementRenderer.
import type React from "react";
import type {
  BackgroundPreset,
  FontFamily,
  FontSize,
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
