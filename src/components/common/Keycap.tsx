import React from "react";
import { ArrowRight, ArrowLeft, ArrowUp, ArrowDown } from "lucide-react";
import type { Shortcut } from "../../types";

interface Props {
  shortcut: Shortcut;
}

// Arrow keys render as lucide icons (SVG) — Unicode arrow glyphs don't render
// reliably on Linux installs without the right fonts.
const ARROW_ICONS: Record<string, React.ReactNode> = {
  "ArrowRight": <ArrowRight size={12} />,
  "ArrowLeft": <ArrowLeft size={12} />,
  "ArrowUp": <ArrowUp size={12} />,
  "ArrowDown": <ArrowDown size={12} />,
};

const SPECIAL_LABELS: Record<string, string> = {
  "Escape": "ESC",
  " ": "Space",
};

export const Keycap: React.FC<Props> = ({ shortcut }) => {
  const modifiers: string[] = [];
  if (shortcut.ctrl) modifiers.push("Ctrl");
  if (shortcut.shift) modifiers.push("Shift");
  if (shortcut.alt) modifiers.push("Alt");

  const arrowIcon = ARROW_ICONS[shortcut.key];
  const keyLabel =
    SPECIAL_LABELS[shortcut.key] ??
    (shortcut.key.length === 1
      ? shortcut.key.toUpperCase()
      : shortcut.key.charAt(0).toUpperCase() + shortcut.key.slice(1));

  const kbdClass =
    "px-1.5 py-0.5 text-xs font-mono bg-surface-2 border border-border rounded text-fg leading-none inline-flex items-center";

  return (
    <span className="inline-flex items-center gap-0.5">
      {modifiers.map((p, i) => (
        <kbd key={i} className={kbdClass}>
          {p}
        </kbd>
      ))}
      <kbd className={kbdClass} aria-label={shortcut.key}>
        {arrowIcon ?? keyLabel}
      </kbd>
    </span>
  );
};
