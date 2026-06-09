import React from "react";
import { useTranslation } from "react-i18next";
import { usePresentationStore } from "../../stores/presentation";
import { useSettingsStore } from "../../stores/settings";
import type { OutputId } from "../../types";

const OUTPUTS: OutputId[] = ["one", "two"];

/**
 * Tabs that pick which output (Tela 1 / Tela 2) the operator's 3-pane drives.
 * Renders nothing unless multi-screen mode is enabled in settings, so the
 * single-screen workflow is visually unchanged.
 */
export const OutputSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const multiScreenEnabled = useSettingsStore((s) => s.multiScreenEnabled);
  const focusedOutput = usePresentationStore((s) => s.focusedOutput);
  const setFocusedOutput = usePresentationStore((s) => s.setFocusedOutput);

  if (!multiScreenEnabled) return null;

  return (
    <div
      data-testid="output-switcher"
      className="flex items-center gap-1 px-2 py-1 border-b border-border"
    >
      {OUTPUTS.map((o, i) => (
        <button
          key={o}
          type="button"
          onClick={() => setFocusedOutput(o)}
          aria-current={focusedOutput === o}
          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
            focusedOutput === o
              ? "bg-primary text-fg-on-primary font-medium"
              : "bg-surface-2 text-muted hover:bg-border"
          }`}
        >
          {t("presentation.output.tela", { n: i + 1 })}
        </button>
      ))}
    </div>
  );
};
