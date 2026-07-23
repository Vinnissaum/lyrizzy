import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { checkForUpdates } from "../../api/commands";
import { UpdateDialog } from "./UpdateDialog";
import type { UpdateInfo } from "../../types";

export const UpdateCheckButton: React.FC = () => {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const result = await checkForUpdates(true);
      if (result.status === "updateAvailable") {
        setUpdate(result.info);
      } else {
        showToast(t("updates.upToDate"));
      }
    } catch {
      showToast(t("updates.checkFailed"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-surface-2 text-fg text-sm rounded-lg shadow-lg border border-border">
          {toast}
        </div>
      )}
      {update && (
        <UpdateDialog update={update} onClose={() => setUpdate(null)} />
      )}
      <button
        onClick={handleCheck}
        disabled={checking}
        className="w-full text-left px-3 py-2 text-sm text-muted hover:text-inherit disabled:opacity-50 transition-colors"
      >
        {checking ? t("loading") : t("updates.checkManual")}
      </button>
    </>
  );
};
