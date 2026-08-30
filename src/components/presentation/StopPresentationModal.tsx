import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { outputScreenName } from "../../utils/monitorNames";
import type { OutputId } from "../../types";

/**
 * Asks the operator which screen to stop when several are presenting under
 * individual control (P16-19..P16-23).
 *
 * Stopping is unrecoverable — `exit_presentation` resets the output to Idle and
 * destroys its window — so the modal says so plainly before offering a choice.
 *
 * Purely a question: it never touches presentation state and never invokes a
 * command. The caller (`OperatorApp`) decides what to do with the answer, the
 * same contract `MultiScreenLaunchModal` follows.
 */
export const StopPresentationModal: React.FC<{
  /** Outputs that currently have a presentation window open. One button each. */
  presentingOutputs: ReadonlySet<OutputId>;
  onStopOne: (output: OutputId) => void;
  onStopAll: () => void;
  onCancel: () => void;
}> = ({ presentingOutputs, onStopOne, onStopAll, onCancel }) => {
  const { t } = useTranslation();
  const monitors = useSettingsStore((s) => s.monitors);
  const monitorNames = useSettingsStore((s) => s.monitorNames);
  const outputMonitorIndex = useSettingsStore((s) => s.outputMonitorIndex);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Iterate the live set (not a static OUTPUTS list) so only screens that are
  // actually presenting get a button, in a stable order.
  const ALL: OutputId[] = ["one", "two"];
  const outputs = ALL.filter((o) => presentingOutputs.has(o));

  // Same naming path as OutputSwitcher, so a screen renamed in Settings is
  // named the same way here. The numbered fallback is keyed on the output's own
  // position, not its index among the presenting ones — otherwise "Tela 2"
  // alone would be labelled "Tela 1".
  const labelFor = (o: OutputId): string =>
    outputScreenName(
      monitors,
      monitorNames,
      outputMonitorIndex[o],
      t("presentation.output.tela", { n: ALL.indexOf(o) + 1 }),
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      data-testid="stop-presentation-modal"
    >
      <div className="bg-surface rounded-xl shadow-2xl w-[460px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">
            {t("presentation.stopChoice.title")}
          </h3>
          <button
            onClick={onCancel}
            className="text-muted hover:text-inherit"
            aria-label={t("presentation.stopChoice.cancel")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <p className="text-sm text-fg">
            {t("presentation.stopChoice.situation", {
              screens: presentingOutputs.size,
            })}
          </p>

          <div className="flex items-start gap-2 bg-warning-bg border border-warning rounded-lg px-3 py-2">
            <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-fg">
              {t("presentation.stopChoice.warning")}
            </p>
          </div>

          <p className="text-sm text-fg">
            {t("presentation.stopChoice.question")}
          </p>
        </div>

        <div className="px-4 pb-4 space-y-2">
          <div className="flex gap-2">
            {outputs.map((o) => (
              <button
                key={o}
                type="button"
                data-testid={`stop-output-${o}`}
                onClick={() => onStopOne(o)}
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-surface-2 hover:bg-border transition-colors"
              >
                {t("presentation.stopChoice.stopOne", { screen: labelFor(o) })}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              data-testid="stop-all"
              onClick={onStopAll}
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-danger text-fg-on-primary font-medium transition-colors"
            >
              {t("presentation.stopChoice.stopAll")}
            </button>
            <button
              type="button"
              data-testid="stop-cancel"
              onClick={onCancel}
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-surface-2 hover:bg-border transition-colors"
            >
              {t("presentation.stopChoice.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
