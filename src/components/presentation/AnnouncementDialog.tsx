import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import { SlideStage } from "./SlideStage";
import { WarningBody } from "./bodies";
import { FONT_SIZE_ORDER, PRESET_COLORS, stepSize } from "./layout";

/**
 * The Aviso dialog: text entry, text size and a preview of the wall (P19-05..P19-10).
 *
 * The preview is the same `SlideStage` + `WarningBody` composition the
 * presentation window renders, so what the operator sees here is what the wall
 * shows. Text size is the global `announcementFontSize` setting (user decision,
 * Phase 19): changing it persists immediately and resizes an aviso already on
 * screen; cancelling does not undo it.
 *
 * Mounted only while open, so the text starts empty each time.
 */
export const AnnouncementDialog: React.FC<{
  onCancel: () => void;
  /** Called with the trimmed, non-empty text. */
  onConfirm: (text: string) => void;
}> = ({ onCancel, onConfirm }) => {
  const { t } = useTranslation();
  const fontSize = useSettingsStore((s) => s.announcementFontSize);
  const setFontSize = useSettingsStore((s) => s.setAnnouncementFontSize);
  const preset = useSettingsStore((s) => s.announcementPreset);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const trimmed = text.trim();
  const confirm = () => {
    if (trimmed) onConfirm(trimmed);
  };

  const sizeIdx = FONT_SIZE_ORDER.indexOf(fontSize);
  const placeholder = t("home.overlay.announcementPlaceholder");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        data-testid="announcement-dialog"
        className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-full overflow-y-auto flex flex-col"
      >
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{t("home.overlay.announcementTitle")}</h3>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div
            data-testid="announcement-preview"
            aria-label={t("home.overlay.announcementPreview")}
            className="aspect-video w-full rounded border border-border overflow-hidden"
          >
            <SlideStage backgroundColor={PRESET_COLORS[preset].bg}>
              {/* Empty text previews the placeholder, dimmed, so the size can be
                  judged before typing (P19-06). */}
              <div className={trimmed ? undefined : "opacity-40"}>
                <WarningBody text={trimmed || placeholder} />
              </div>
            </SlideStage>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">{t("home.overlay.announcementSize")}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFontSize(stepSize(fontSize, -1))}
                disabled={sizeIdx <= 0}
                aria-label={t("home.overlay.announcementSizeDown")}
                className="p-1.5 rounded bg-surface-2 hover:bg-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus size={14} />
              </button>
              <span data-testid="announcement-size" className="w-20 text-center text-sm font-medium">
                {t(`settings.windows.fontSizes.${fontSize}`)}
              </span>
              <button
                type="button"
                onClick={() => setFontSize(stepSize(fontSize, 1))}
                disabled={sizeIdx >= FONT_SIZE_ORDER.length - 1}
                aria-label={t("home.overlay.announcementSizeUp")}
                className="p-1.5 rounded bg-surface-2 hover:bg-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                confirm();
              }
              if (e.key === "Escape") {
                onCancel();
              }
            }}
            placeholder={placeholder}
            className="w-full h-28 px-3 py-2 bg-surface-2 border border-border rounded text-sm resize-none focus:outline-none focus:border-primary placeholder-muted"
          />
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg bg-surface-2 hover:bg-border transition-colors"
          >
            {t("home.overlay.cancel")}
          </button>
          <button
            onClick={confirm}
            disabled={!trimmed}
            className="px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-fg-on-primary font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("home.overlay.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};
