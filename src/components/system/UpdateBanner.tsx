import React from "react";
import { useTranslation } from "react-i18next";
import type { UpdateInfo } from "../../types";

interface Props {
  update: UpdateInfo;
  onDismiss: () => void;
  onUpdate: () => void;
}

export const UpdateBanner: React.FC<Props> = ({ update, onDismiss, onUpdate }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-emerald-600 text-white text-sm shrink-0">
      <span>
        {t("updates.bannerMessage", { version: update.version })}
      </span>
      <div className="flex items-center gap-3 ml-4">
        <button
          onClick={onUpdate}
          className="font-medium underline hover:no-underline"
        >
          {t("updates.updateButton")}
        </button>
        <button
          onClick={onDismiss}
          className="text-emerald-100 hover:text-white"
          aria-label={t("updates.dismissButton")}
        >
          ×
        </button>
      </div>
    </div>
  );
};
