import React from "react";
import { useTranslation } from "react-i18next";
import type { PresentationMode } from "../../types";

interface Props {
  mode: PresentationMode;
}

export const StageBlankIndicator: React.FC<Props> = ({ mode }) => {
  const { t } = useTranslation();
  if (mode !== "blank" && mode !== "frozen") return null;

  const label = mode === "blank" ? t("stage.screenBlanked") : t("stage.screenFrozen");
  const color = mode === "blank" ? "bg-gray-800 text-gray-300" : "bg-blue-800 text-blue-200";

  return (
    <div
      className={`absolute top-3 right-3 z-30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${color}`}
    >
      {label}
    </div>
  );
};
