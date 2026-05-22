import React from "react";
import { useTranslation } from "react-i18next";

interface Props {
  title: string;
  step: number;
  totalSteps: number;
  onNext?: () => void;
  onBack?: () => void;
  onCancel: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  children: React.ReactNode;
}

export const ImportWizardFrame: React.FC<Props> = ({
  title,
  step,
  totalSteps,
  onNext,
  onBack,
  onCancel,
  nextLabel,
  nextDisabled = false,
  children,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onCancel}
            className="text-sm text-muted hover:text-inherit transition-colors"
          >
            {t("import.wizard.cancel")}
          </button>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-muted mt-1">
          {t("import.wizard.step", { step, total: totalSteps })}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">{children}</div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex justify-between shrink-0">
        <button
          onClick={onBack}
          disabled={!onBack}
          className="px-4 py-2 text-sm text-muted hover:text-inherit disabled:invisible transition-colors"
        >
          {t("import.wizard.back")}
        </button>
        {onNext && (
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover disabled:bg-surface-2 disabled:text-muted disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-fg-on-primary"
          >
            {nextLabel ?? t("import.wizard.back")}
          </button>
        )}
      </div>
    </div>
  );
};
