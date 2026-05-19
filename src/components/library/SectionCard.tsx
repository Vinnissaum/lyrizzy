import React from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { SectionType } from "../../types";

export interface SectionDraft {
  /** Stable client-side key for dnd-kit */
  dndId: string;
  label: string;
  type: SectionType;
  body: string;
  repeatCount: number;
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
}

export const SectionCard: React.FC<Props> = ({
  section,
  onChange,
  onRemove,
  canRemove,
}) => {
  const { t } = useTranslation();
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
      className="bg-gray-800 rounded-lg border border-gray-700 p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          aria-label={t("sectionCard.dragAriaLabel")}
          className="cursor-grab text-gray-500 hover:text-gray-300 shrink-0"
        >
          <GripVertical size={16} />
        </button>

        <input
          value={section.label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder={t("sectionCard.labelPlaceholder")}
          className="flex-1 text-sm bg-gray-700 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
        />

        <select
          value={section.type}
          onChange={(e) => update({ type: e.target.value as SectionType })}
          className="text-sm bg-gray-700 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
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
          className="w-14 text-sm text-center bg-gray-700 border border-gray-600 rounded px-1 py-1 focus:outline-none focus:border-blue-500"
        />

        {canRemove && (
          <button
            onClick={onRemove}
            aria-label={t("sectionCard.removeAriaLabel")}
            className="text-gray-500 hover:text-red-400 shrink-0"
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
        className="w-full text-sm bg-gray-700 border border-gray-600 rounded px-2 py-1.5 resize-y focus:outline-none focus:border-blue-500 font-mono"
      />
    </div>
  );
};
