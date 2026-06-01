import React from "react";
import { useSettingsStore } from "../../stores/settings";
import {
  BOLD_WEIGHT,
  FONT_CLASS,
  LINE_SPACING,
  SIZE_STYLE,
  POSITION_CLASS,
  PRESET_COLORS,
} from "./layout";

interface Props {
  text: string;
}

export const AnnouncementRenderer: React.FC<Props> = ({ text }) => {
  // Appearance is configured globally in Settings; the overlay only carries text.
  const fontFamily = useSettingsStore((s) => s.announcementFontFamily);
  const fontSize = useSettingsStore((s) => s.announcementFontSize);
  const preset = useSettingsStore((s) => s.announcementPreset);
  const position = useSettingsStore((s) => s.announcementPosition);
  const lineSpacing = useSettingsStore((s) => s.announcementLineSpacing);
  const boldLevel = useSettingsStore((s) => s.announcementBoldLevel);

  const { bg, fg } = PRESET_COLORS[preset];
  const { lineHeight } = LINE_SPACING[lineSpacing];

  return (
    <div
      className="h-full select-none"
      style={{ backgroundColor: bg }}
    >
      <div className={`h-full flex flex-col p-16 ${POSITION_CLASS[position]}`}>
        <p
          className={`whitespace-pre-wrap ${FONT_CLASS[fontFamily]}`}
          style={{ color: fg, ...SIZE_STYLE[fontSize], fontWeight: BOLD_WEIGHT[boldLevel], lineHeight }}
        >
          {text}
        </p>
      </div>
    </div>
  );
};
