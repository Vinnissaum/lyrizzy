import React from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { usePresentationStore } from "../../stores/presentation";
import { useSettingsStore } from "../../stores/settings";
import { engageMirror } from "../../utils/outputDispatch";
import { outputScreenName } from "../../utils/monitorNames";
import type { OutputId } from "../../types";

const OUTPUTS: OutputId[] = ["one", "two"];

/**
 * Tabs that pick which output (Tela 1 / Tela 2) the operator's 3-pane drives,
 * plus a Simultânea (mirror) toggle. Renders nothing unless multi-screen mode is
 * enabled in settings, so the single-screen workflow is visually unchanged.
 *
 * The tabs render in BOTH states (P16-09). While mirror is ON the operator
 * drives one set and every screen renders it identically (see `fanOutToMirror`),
 * so neither tab is "current" — both are marked `data-mirrored` instead, which
 * is what ties them visually to the amber toggle sitting beside them. Clicking a
 * tab while mirroring re-points the mirror master without disengaging it.
 *
 * The toggle is the tabs' immediate sibling in both states (P16-10) so engaging
 * Simultânea never makes the control group jump, and its ON style uses the
 * `warning` accent (P16-11) rather than `bg-primary` — otherwise "Simultânea is
 * engaged" and "Tela 2 is focused" would render identically.
 *
 * Clicking a tab whose output is not yet presenting (`onRequestLaunch` provided
 * and the output is absent from `presentingOutputs`) asks the host to open the
 * launch modal, so picking that screen actually starts a presentation on it
 * instead of only switching the operator's focus.
 */
export const OutputSwitcher: React.FC<{
  presentingOutputs?: ReadonlySet<OutputId>;
  onRequestLaunch?: (output: OutputId) => void;
}> = ({ presentingOutputs, onRequestLaunch }) => {
  const { t } = useTranslation();
  const multiScreenEnabled = useSettingsStore((s) => s.multiScreenEnabled);
  const mirrorEnabled = useSettingsStore((s) => s.mirrorEnabled);
  const setMirrorEnabled = useSettingsStore((s) => s.setMirrorEnabled);
  const focusedOutput = usePresentationStore((s) => s.focusedOutput);
  const setFocusedOutput = usePresentationStore((s) => s.setFocusedOutput);
  const monitors = useSettingsStore((s) => s.monitors);
  const monitorNames = useSettingsStore((s) => s.monitorNames);
  const outputMonitorIndex = useSettingsStore((s) => s.outputMonitorIndex);

  const labelFor = (o: OutputId, i: number): string =>
    outputScreenName(
      monitors,
      monitorNames,
      outputMonitorIndex[o],
      t("presentation.output.tela", { n: i + 1 }),
    );

  if (!multiScreenEnabled) return null;

  const onTabClick = (o: OutputId) => {
    setFocusedOutput(o);
    if (onRequestLaunch && !presentingOutputs?.has(o)) {
      onRequestLaunch(o);
    }
  };

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
      {OUTPUTS.map((o, i) => (
        <button
          key={o}
          type="button"
          onClick={() => onTabClick(o)}
          aria-current={!mirrorEnabled && focusedOutput === o}
          data-mirrored={mirrorEnabled ? "true" : undefined}
          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
            mirrorEnabled
              ? "bg-surface-2 text-muted border border-warning"
              : focusedOutput === o
                ? "bg-primary text-fg-on-primary font-medium"
                : "bg-surface-2 text-muted hover:bg-border"
          }`}
        >
          {labelFor(o, i)}
        </button>
      ))}

      <button
        type="button"
        data-testid="mirror-toggle"
        onClick={onToggleMirror}
        aria-pressed={mirrorEnabled}
        title={t("presentation.output.simultaneousHint")}
        className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg transition-colors ${
          mirrorEnabled
            ? "bg-warning text-fg-on-warning font-semibold"
            : "bg-surface-2 text-muted hover:bg-border"
        }`}
      >
        <Copy size={13} />
        {t("presentation.output.simultaneous")}
      </button>
    </div>
  );
};
