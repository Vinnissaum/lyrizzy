import React from "react";
import { useTranslation } from "react-i18next";

interface Props {
  onImportHolyrics: () => void;
  onCreateSong: () => void;
}

export const EmptyState: React.FC<Props> = ({
  onImportHolyrics,
  onCreateSong,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center py-16">
      <div className="space-y-2">
        <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300">{t("library.empty.title")}</p>
        <p className="text-gray-500">{t("library.empty.subtitle")}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          data-testid="cta-import-holyrics"
          onClick={onImportHolyrics}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors"
        >
          {t("library.empty.importHolyrics")}
        </button>
        <button
          data-testid="cta-create-song"
          onClick={onCreateSong}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
        >
          {t("library.empty.createSong")}
        </button>
      </div>
    </div>
  );
};
