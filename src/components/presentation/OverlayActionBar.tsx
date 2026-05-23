import React from "react";
import { useTranslation } from "react-i18next";

interface Props {
  showApresentarButton: boolean;
  onApresentar?: () => void;
  onOferta: () => void;
  onCamera: () => void;
  onAviso: () => void;
  onPdf: () => void;
  onClearOverlay: () => void;
  isOverlayActive: boolean;
  isImportingPresentation: boolean;
}

export const OverlayActionBar: React.FC<Props> = ({
  showApresentarButton,
  onApresentar,
  onOferta,
  onCamera,
  onAviso,
  onPdf,
  onClearOverlay,
  isOverlayActive,
  isImportingPresentation,
}) => {
  const { t } = useTranslation();

  return (
    <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-wrap shrink-0">
      {showApresentarButton && (
        <button
          onClick={onApresentar}
          className="px-3 py-1 text-xs bg-primary hover:bg-primary-hover text-fg-on-primary rounded-lg font-medium transition-colors"
          data-testid="apresentar-button"
        >
          ▶ {t("presentation.action.present")}
        </button>
      )}
      {isOverlayActive && (
        <button
          onClick={onClearOverlay}
          className="px-3 py-1 text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg font-medium hover:bg-amber-500/30 transition-colors"
        >
          ✕ {t("home.overlay.closeOverlay")}
        </button>
      )}
      <button
        onClick={onOferta}
        className="px-3 py-1 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors"
      >
        🖼 {t("home.overlay.oferta")}
      </button>
      <button
        onClick={onCamera}
        className="px-3 py-1 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors"
      >
        📷 {t("home.overlay.camera")}
      </button>
      <button
        onClick={onAviso}
        className="px-3 py-1 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors"
      >
        📢 {t("home.overlay.aviso")}
      </button>
      <button
        onClick={onPdf}
        disabled={isImportingPresentation}
        title={t("home.overlay.pdfTooltip")}
        className="px-3 py-1 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors disabled:opacity-50"
      >
        📄 {isImportingPresentation ? t("media.slideshow.importing") : t("home.overlay.pdf")}
      </button>
    </div>
  );
};
