import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, StickyNote, Eye } from "lucide-react";
import type { BackgroundInfo, RepeatMode, SectionType, TextCasing } from "../../types";
import { NotesField } from "../common/NotesField";
import { SlideChip, ChipAppearance } from "../presentation/SlideChip";
import { splitSectionBody } from "../../utils/slidePreview";

export interface SectionDraft {
  /** Stable client-side key for dnd-kit */
  dndId: string;
  label: string;
  type: SectionType;
  body: string;
  repeatCount: number;
  notes?: string;
}

const SECTION_TYPE_VALUES: SectionType[] = [
  "verse",
  "chorus",
  "bridge",
  "pre_chorus",
  "outro",
  "interlude",
  "tag",
];

interface Props {
  section: SectionDraft;
  onChange: (updated: SectionDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
  /** Global presentation appearance, for the on-screen preview. */
  appearance: ChipAppearance;
  /** Song-level text casing applied to preview lines. */
  casing: TextCasing;
  /** How repeat counts render in the preview. */
  repeatMode: RepeatMode;
  /** Optional per-song media background shown behind the preview. */
  background?: BackgroundInfo;
}

export const SectionCard: React.FC<Props> = ({
  section,
  onChange,
  onRemove,
  canRemove,
  appearance,
  casing,
  repeatMode,
  background,
}) => {
  const { t } = useTranslation();
  const [notesOpen, setNotesOpen] = useState(Boolean(section.notes));
  const [previewOpen, setPreviewOpen] = useState(false);

  const slides = useMemo(
    () =>
      splitSectionBody(section.body, {
        casing,
        repeatCount: section.repeatCount,
        repeatMode,
      }),
    [section.body, section.repeatCount, casing, repeatMode]
  );
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.dndId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const update = (patch: Partial<SectionDraft>) =>
    onChange({ ...section, ...patch });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-surface rounded-lg border border-border p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          aria-label={t("sectionCard.dragAriaLabel")}
          className="cursor-grab text-muted hover:text-inherit shrink-0"
        >
          <GripVertical size={16} />
        </button>

        <input
          value={section.label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder={t("sectionCard.labelPlaceholder")}
          className="flex-1 text-sm bg-surface-2 border border-border rounded px-2 py-1 focus:outline-none focus:border-primary"
        />

        <select
          value={section.type}
          onChange={(e) => update({ type: e.target.value as SectionType })}
          className="text-sm bg-surface-2 border border-border rounded px-2 py-1 focus:outline-none focus:border-primary"
        >
          {SECTION_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`sectionTypes.${v}`)}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={1}
          max={10}
          value={section.repeatCount}
          onChange={(e) =>
            update({ repeatCount: Math.max(1, parseInt(e.target.value) || 1) })
          }
          title="Repetições"
          className="w-14 text-sm text-center bg-surface-2 border border-border rounded px-1 py-1 focus:outline-none focus:border-primary"
        />

        <button
          onClick={() => setPreviewOpen((o) => !o)}
          aria-label={t("sectionCard.preview.toggle")}
          title={t("sectionCard.preview.toggle")}
          className={`shrink-0 ${previewOpen ? "text-primary" : "text-muted hover:text-inherit"}`}
        >
          <Eye size={16} />
        </button>

        <button
          onClick={() => setNotesOpen((o) => !o)}
          aria-label={t("sectionCard.notes.toggle")}
          title={t("sectionCard.notes.toggle")}
          className={`shrink-0 ${notesOpen || section.notes ? "text-primary" : "text-muted hover:text-inherit"}`}
        >
          <StickyNote size={16} />
        </button>

        {canRemove && (
          <button
            onClick={onRemove}
            aria-label={t("sectionCard.removeAriaLabel")}
            className="text-muted hover:text-danger shrink-0"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <textarea
        value={section.body}
        onChange={(e) => update({ body: e.target.value })}
        placeholder={t("sectionCard.bodyPlaceholder")}
        rows={4}
        className="w-full text-sm bg-surface-2 border border-border rounded px-2 py-1.5 resize-y focus:outline-none focus:border-primary font-mono"
      />

      {previewOpen && (
        slides.length === 0 ? (
          <p className="text-xs text-muted">{t("sectionCard.preview.empty")}</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {slides.map((lines, i) => (
              <div key={i} className="shrink-0 w-40 space-y-1">
                <SlideChip
                  lines={lines}
                  variant="lyric"
                  appearance={appearance}
                  background={background}
                />
                <p className="text-[10px] text-center text-muted">
                  {t("sectionCard.preview.slideCounter", { n: i + 1, total: slides.length })}
                </p>
              </div>
            ))}
          </div>
        )
      )}

      {notesOpen && (
        <NotesField
          value={section.notes ?? ""}
          onChange={(v) => update({ notes: v || undefined })}
        />
      )}
    </div>
  );
};
