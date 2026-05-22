import React, { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

const CHAR_WARN_LIMIT = 2000;

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const NotesField: React.FC<Props> = ({ value, onChange, placeholder }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20;
    const maxHeight = lineHeight * 10;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <div className="space-y-1">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t("sectionCard.notes.placeholder")}
        rows={2}
        className="w-full text-sm bg-surface-2 border border-border text-fg rounded px-2 py-1.5 resize-none focus:outline-none focus:border-primary whitespace-pre-wrap"
        style={{ overflowY: "hidden" }}
      />
      {value.length > CHAR_WARN_LIMIT && (
        <p className="text-xs text-yellow-500">
          {t("sectionCard.notes.charCountWarning")}
        </p>
      )}
    </div>
  );
};
