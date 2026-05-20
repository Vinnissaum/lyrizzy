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
      const info = await checkForUpdates(true);
      if (info) {
        setUpdate(info);
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
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-gray-700 dark:bg-gray-600 text-white text-sm rounded-lg shadow-lg">
          {toast}
        </div>
      )}
      {update && (
        <UpdateDialog update={update} onClose={() => setUpdate(null)} />
      )}
      <button
        onClick={handleCheck}
        disabled={checking}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 transition-colors"
      >
        {checking ? t("loading") : t("updates.checkManual")}
      </button>
    </>
  );
};
