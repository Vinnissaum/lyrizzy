import React from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { usePresentationStore } from "../../stores/presentation";
import { useSettingsStore } from "../../stores/settings";
import { engageMirror } from "../../utils/outputDispatch";
import type { OutputId } from "../../types";

const OUTPUTS: OutputId[] = ["one", "two"];

/**
 * Tabs that pick which output (Tela 1 / Tela 2) the operator's 3-pane drives,
 * plus a Simultânea (mirror) toggle. Renders nothing unless multi-screen mode is
 * enabled in settings, so the single-screen workflow is visually unchanged.
 *
 * While mirror is ON the operator drives a single set and both screens render it
 * identically (see `fanOutToMirror`), so the per-screen focus tabs are hidden.
 */
export const OutputSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const multiScreenEnabled = useSettingsStore((s) => s.multiScreenEnabled);
  const mirrorEnabled = useSettingsStore((s) => s.mirrorEnabled);
  const setMirrorEnabled = useSettingsStore((s) => s.setMirrorEnabled);
  const focusedOutput = usePresentationStore((s) => s.focusedOutput);
  const setFocusedOutput = usePresentationStore((s) => s.setFocusedOutput);

  if (!multiScreenEnabled) return null;

  const onToggleMirror = () => {
    const next = !mirrorEnabled;
    setMirrorEnabled(next);
    // Engaging mirror copies the focused screen's content onto the others and
    // presents on ALL screens.
    if (next) {
      engageMirror(focusedOutput).catch((err) =>
        console.error("engage mirror failed:", err),
      );
    }
  };

  return (
    <div
      data-testid="output-switcher"
      className="flex items-center gap-2 px-2 py-1 border-b border-border"
    >
      {!mirrorEnabled &&
        OUTPUTS.map((o, i) => (
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

      <button
        type="button"
        data-testid="mirror-toggle"
        onClick={onToggleMirror}
        aria-pressed={mirrorEnabled}
        title={t("presentation.output.simultaneousHint")}
        className={`ml-auto flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg transition-colors ${
          mirrorEnabled
            ? "bg-primary text-fg-on-primary font-medium"
            : "bg-surface-2 text-muted hover:bg-border"
        }`}
      >
        <Copy size={13} />
        {t("presentation.output.simultaneous")}
      </button>
    </div>
  );
};
