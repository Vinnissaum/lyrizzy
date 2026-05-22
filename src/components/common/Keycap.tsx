import React from "react";
import type { Shortcut } from "../../types";

interface Props {
  shortcut: Shortcut;
}

export const Keycap: React.FC<Props> = ({ shortcut }) => {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.alt) parts.push("Alt");
  const keyLabel =
    shortcut.key.length === 1
      ? shortcut.key.toUpperCase()
      : shortcut.key.charAt(0).toUpperCase() + shortcut.key.slice(1);
  parts.push(keyLabel);

  return (
    <span className="inline-flex items-center gap-0.5">
      {parts.map((p, i) => (
        <kbd
          key={i}
          className="px-1.5 py-0.5 text-xs font-mono bg-surface-2 border border-border rounded text-fg leading-none"
        >
          {p}
        </kbd>
      ))}
    </span>
  );
};
