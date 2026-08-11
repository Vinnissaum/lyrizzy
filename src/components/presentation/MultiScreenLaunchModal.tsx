import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

/**
 * Asks the operator, once, whether a presentation launch should mirror to
 * both screens or stay on the main one. Purely a question: it never touches
 * any store — the caller (`PresentationLaunchProvider`, T15) decides what to
 * do with the answer.
 *
 * Modeled on `OutputLaunchModal.tsx`'s shell and Esc handling (reference
 * only — that component is not modified or extended here).
 */
export const MultiScreenLaunchModal: React.FC<{
  onAnswer: (mirrorAll: boolean) => void;
  onCancel: () => void;
  /** Names of [screen 1, screen 2] shown in the prompt. Defaults to the
   *  numbered "Tela N" labels used elsewhere in the presentation UI. */
  screenNames?: [string, string];
}> = ({ onAnswer, onCancel, screenNames }) => {
  const { t } = useTranslation();
  const [screen1, screen2] = screenNames ?? [
    t("presentation.output.tela", { n: 1 }),
    t("presentation.output.tela", { n: 2 }),
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      data-testid="multi-screen-launch-modal"
    >
      <div className="bg-surface rounded-xl shadow-2xl w-[420px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">
            {t("presentation.multiScreenLaunch.title")}
          </h3>
          <button
            onClick={onCancel}
            className="text-muted hover:text-inherit"
            aria-label={t("home.overlay.cancel")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-4">
          <p className="text-sm text-fg">
            {t("presentation.multiScreenLaunch.prompt", { screen1, screen2 })}
          </p>
        </div>

        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button
            onClick={() => onAnswer(false)}
            className="px-4 py-2 text-sm rounded-lg bg-surface-2 hover:bg-border transition-colors"
          >
            {t("presentation.multiScreenLaunch.mainOnly", { screen1 })}
          </button>
          <button
            onClick={() => onAnswer(true)}
            className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-fg-on-primary font-medium transition-colors"
          >
            {t("presentation.multiScreenLaunch.mirrorAll")}
          </button>
        </div>
      </div>
    </div>
  );
};
