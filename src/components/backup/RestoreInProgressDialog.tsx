import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { abortRestore } from "../../api/commands";
import { formatCommandError } from "../../i18n/commandError";

interface Props {
  onDismissed: () => void;
}

export const RestoreInProgressDialog: React.FC<Props> = ({ onDismissed }) => {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAbort = async () => {
    setWorking(true);
    setError(null);
    try {
      await abortRestore();
      onDismissed();
    } catch (err: unknown) {
      setError(formatCommandError(err, t));
      setWorking(false);
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-warning-bg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-fg">{t("backup.restore.title")}</h2>
            <p className="text-xs text-muted">{t("backup.restore.subtitle")}</p>
          </div>
        </div>

        <p className="text-sm text-fg mb-4">
          {t("backup.restore.body1")}
        </p>

        <p className="text-sm text-fg mb-6">
          {t("backup.restore.body2")}
        </p>

        {error && (
          <p className="text-xs text-danger bg-danger-bg border border-danger rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full px-4 py-2 text-sm bg-warning hover:bg-warning rounded-lg font-medium transition-colors"
          >
            {t("backup.restore.cancelButton")}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-danger">
              {t("backup.restore.irreversibleWarning")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAbort}
                disabled={working}
                className="flex-1 px-4 py-2 text-sm bg-danger hover:bg-danger disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {working ? t("backup.restore.cleaningButton") : t("backup.restore.confirmButton")}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={working}
                className="px-4 py-2 text-sm text-muted hover:text-inherit transition-colors"
              >
                {t("backup.restore.backButton")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
