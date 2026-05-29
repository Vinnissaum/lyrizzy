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
        <p className="text-2xl font-semibold text-fg">{t("library.empty.title")}</p>
        <p className="text-muted">{t("library.empty.subtitle")}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          data-testid="cta-import-holyrics"
          onClick={onImportHolyrics}
          className="px-5 py-2.5 bg-success hover:bg-success rounded-lg font-medium transition-colors"
        >
          {t("library.empty.importHolyrics")}
        </button>
        <button
          data-testid="cta-create-song"
          onClick={onCreateSong}
          className="px-5 py-2.5 bg-primary hover:bg-primary-hover rounded-lg font-medium transition-colors"
        >
          {t("library.empty.createSong")}
        </button>
      </div>
    </div>
  );
};
