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
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl w-[480px] max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("updates.dialogTitle", { version: update.version })}
          </h2>
          <button
            onClick={onClose}
            disabled={applying}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl leading-none disabled:opacity-50"
            aria-label={t("updates.cancelButton")}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {t("updates.currentVersion", { version: update.currentVersion })}
          </p>
          {update.notes ? (
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
              {update.notes}
            </pre>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              {t("updates.noNotes")}
            </p>
          )}
        </div>

        {error && (
          <div className="px-5 pb-2">
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
          >
            {t("updates.cancelButton")}
          </button>
          <button
            onClick={handleApply}
            disabled={applying}
            className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {applying ? t("updates.applying") : t("updates.applyButton")}
          </button>
        </div>
      </div>
    </div>
  );
};
