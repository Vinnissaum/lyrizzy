import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { applyUpdateAndRestart, onUpdateProgress } from "../../api/commands";
import { formatProgress } from "./progress";
import type { UpdateInfo, UpdateProgress } from "../../types";

interface Props {
  update: UpdateInfo;
  onClose: () => void;
}

type Phase = "idle" | "downloading" | "installing" | "error";

export const UpdateDialog: React.FC<Props> = ({ update, onClose }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const applying = phase === "downloading" || phase === "installing";

  // Subscribe only for the lifetime of an apply — never while idle/error — and
  // always unsubscribe, so a dialog left open (or closed mid-apply) never
  // leaks a listener.
  useEffect(() => {
    if (!applying) return;
    const unlistenPromise = onUpdateProgress((p) => {
      setProgress(p);
      if (p.total !== null && p.downloaded >= p.total) {
        setPhase("installing");
      }
    });
    return () => {
      unlistenPromise.then((u) => u());
    };
  }, [applying]);

  const handleApply = async () => {
    setPhase("downloading");
    setProgress(null);
    setErrorMsg(null);
    try {
      await applyUpdateAndRestart();
      // On success the app restarts before this ever resolves; nothing to do.
    } catch (err: unknown) {
      const code =
        err !== null &&
        typeof err === "object" &&
        "code" in err
          ? String((err as { code: unknown }).code)
          : String(err);
      if (code === "update.signature_invalid") {
        setErrorMsg(t("updates.signatureInvalid"));
      } else if (code === "update.already_in_progress") {
        setErrorMsg(t("updates.alreadyInProgress"));
      } else {
        setErrorMsg(t("updates.applyFailed", { detail: code }));
      }
      setPhase("error");
    }
  };

  const { percent, determinate } = formatProgress(progress);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-xl w-[480px] max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-fg">
            {t("updates.dialogTitle", { version: update.version })}
          </h2>
          <button
            data-testid="dialog-close"
            onClick={onClose}
            disabled={applying}
            className="text-muted hover:text-inherit leading-none disabled:opacity-50"
            aria-label={t("updates.cancelButton")}
          >
            <X size={20} />
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

          {phase === "downloading" && (
            <div className="mt-4 space-y-1">
              <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                {determinate ? (
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${percent}%` }}
                  />
                ) : (
                  <div className="h-full bg-primary animate-pulse w-1/3" />
                )}
              </div>
              <p className="text-xs text-muted">
                {determinate
                  ? t("updates.downloading", { percent: String(percent) })
                  : t("updates.downloadingUnknown")}
              </p>
            </div>
          )}

          {phase === "installing" && (
            <p data-testid="installing-status" className="mt-4 text-sm text-muted">
              {t("updates.applying")}
            </p>
          )}
        </div>

        {phase === "error" && errorMsg && (
          <div className="px-5 pb-2">
            <p className="text-sm text-danger">{errorMsg}</p>
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
