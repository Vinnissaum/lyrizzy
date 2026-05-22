import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { applyUpdateAndRestart } from "../../api/commands";
import type { UpdateInfo } from "../../types";

interface Props {
  update: UpdateInfo;
  onClose: () => void;
}

export const UpdateDialog: React.FC<Props> = ({ update, onClose }) => {
  const { t } = useTranslation();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      await applyUpdateAndRestart();
    } catch (err: unknown) {
      const code =
        err !== null &&
        typeof err === "object" &&
        "code" in err
          ? String((err as { code: unknown }).code)
          : String(err);
      if (code === "update.signature_invalid") {
        setError(t("updates.signatureInvalid"));
      } else {
        setError(t("updates.applyFailed", { detail: code }));
      }
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-xl w-[480px] max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-fg">
            {t("updates.dialogTitle", { version: update.version })}
          </h2>
          <button
            onClick={onClose}
            disabled={applying}
            className="text-muted hover:text-inherit text-xl leading-none disabled:opacity-50"
            aria-label={t("updates.cancelButton")}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-muted mb-3">
            {t("updates.currentVersion", { version: update.currentVersion })}
          </p>
          {update.notes ? (
            <pre className="text-sm text-fg whitespace-pre-wrap font-sans leading-relaxed">
              {update.notes}
            </pre>
          ) : (
            <p className="text-sm text-muted italic">
              {t("updates.noNotes")}
            </p>
          )}
        </div>

        {error && (
          <div className="px-5 pb-2">
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2 text-sm text-muted hover:text-inherit disabled:opacity-50"
          >
            {t("updates.cancelButton")}
          </button>
          <button
            onClick={handleApply}
            disabled={applying}
            className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-fg-on-primary rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {applying ? t("updates.applying") : t("updates.applyButton")}
          </button>
        </div>
      </div>
    </div>
  );
};
