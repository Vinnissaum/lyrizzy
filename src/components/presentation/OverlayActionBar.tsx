import React from "react";
import { useTranslation } from "react-i18next";
import { Play, X, Image as ImageIcon, Camera, Megaphone, FileText, MonitorOff, Square } from "lucide-react";

interface Props {
  showApresentarButton: boolean;
  onApresentar?: () => void;
  onOferta: () => void;
  onCamera: () => void;
  onAviso: () => void;
  onPdf: () => void;
  onClearOverlay: () => void;
  onBlackout?: () => void;
  onStop?: () => void;
  isBlackoutActive?: boolean;
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
  onBlackout,
  onStop,
  isBlackoutActive,
  isOverlayActive,
  isImportingPresentation,
}) => {
  const { t } = useTranslation();

  return (
    <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-wrap shrink-0">
      {showApresentarButton && (
        <button
          onClick={onApresentar}
          className="px-3 py-1 text-xs bg-primary hover:bg-primary-hover text-fg-on-primary rounded-lg font-medium transition-colors inline-flex items-center gap-1"
          data-testid="apresentar-button"
        >
          <Play size={12} className="fill-current" /> {t("presentation.action.present")}
        </button>
      )}
      {onStop && (
        <button
          onClick={onStop}
          data-testid="stop-button"
          className="px-3 py-1 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors inline-flex items-center gap-1"
        >
          <Square size={12} className="fill-current" /> {t("presentation.action.stop")}
        </button>
      )}
      {onBlackout && (
        <button
          onClick={onBlackout}
          data-testid="blackout-button"
          aria-pressed={isBlackoutActive}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors inline-flex items-center gap-1 ${
            isBlackoutActive
              ? "bg-primary text-fg-on-primary"
              : "bg-surface-2 hover:bg-border"
          }`}
        >
          <MonitorOff size={12} /> {t("home.overlay.blackout")}
        </button>
      )}
      {isOverlayActive && (
        <button
          onClick={onClearOverlay}
          className="px-3 py-1 text-xs bg-warning-bg text-warning border border-warning rounded-lg font-medium hover:bg-warning-bg transition-colors inline-flex items-center gap-1"
        >
          <X size={12} /> {t("home.overlay.closeOverlay")}
        </button>
      )}
      <button
        onClick={onOferta}
        className="px-3 py-1 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors inline-flex items-center gap-1"
      >
        <ImageIcon size={12} /> {t("home.overlay.oferta")}
      </button>
      <button
        onClick={onCamera}
        className="px-3 py-1 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors inline-flex items-center gap-1"
      >
        <Camera size={12} /> {t("home.overlay.camera")}
      </button>
      <button
        onClick={onAviso}
        className="px-3 py-1 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors inline-flex items-center gap-1"
      >
        <Megaphone size={12} /> {t("home.overlay.aviso")}
      </button>
      <button
        onClick={onPdf}
        disabled={isImportingPresentation}
        title={t("home.overlay.pdfTooltip")}
        className="px-3 py-1 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1"
      >
        <FileText size={12} /> {isImportingPresentation ? t("media.slideshow.importing") : t("home.overlay.pdf")}
      </button>
    </div>
  );
};
