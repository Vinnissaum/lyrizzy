import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { checkLibreOffice } from "../../api/commands";

export const LibreOfficeBanner: React.FC = () => {
  const { t } = useTranslation();
  const [missing, setMissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkLibreOffice()
      .then((ok) => { if (!ok) setMissing(true); })
      .catch(() => {});
  }, []);

  if (!missing || dismissed) return null;

  return (
    <div
      data-testid="libreoffice-banner"
      className="mx-4 mt-3 px-4 py-2.5 bg-warning-bg border border-warning rounded-lg text-sm shrink-0 flex items-start gap-3"
    >
      <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-warning">{t("media.libreofficeBanner.title")}</p>
        <p className="text-warning mt-0.5">{t("media.libreofficeBanner.body")}</p>
        <p className="text-warning/80 mt-1 text-xs">{t("media.libreofficeBanner.hint")}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        data-testid="libreoffice-banner-dismiss"
        className="text-warning hover:text-warning text-xs shrink-0 mt-0.5"
      >
        {t("media.libreofficeBanner.dismiss")}
      </button>
    </div>
  );
};
