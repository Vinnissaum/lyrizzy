import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, StickyNote, Image as ImageIcon, X } from "lucide-react";
import type { SectionType } from "../../types";
import { NotesField } from "../common/NotesField";
import { useMediaStore } from "../../stores/media";

export interface SectionDraft {
  /** Stable client-side key for dnd-kit */
  dndId: string;
  label: string;
  type: SectionType;
  body: string;
  repeatCount: number;
  notes?: string;
  backgroundId?: string;
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
  const [notesOpen, setNotesOpen] = useState(Boolean(section.notes));
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const { media } = useMediaStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.dndId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const update = (patch: Partial<SectionDraft>) =>
    onChange({ ...section, ...patch });

  const currentBg = section.backgroundId ? media.find((m) => m.id === section.backgroundId) : undefined;
  const thumbUrl = currentBg?.thumbnailFile
    ? `asset://localhost/media/${currentBg.thumbnailFile}`
    : currentBg
    ? `asset://localhost/media/${currentBg.fileName}`
    : undefined;

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

        {/* Section background thumbnail badge */}
        {thumbUrl && (
          <img
            src={thumbUrl}
            alt=""
            className="w-6 h-3.5 object-cover rounded border border-gray-600 shrink-0"
            title={currentBg?.displayName}
          />
        )}

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

        <button
          onClick={() => setBgPickerOpen((o) => !o)}
          aria-label={t("sectionCard.background.pick")}
          title={t("sectionCard.background.pick")}
          className={`shrink-0 ${section.backgroundId ? "text-emerald-400" : "text-gray-500 hover:text-gray-300"}`}
        >
          <ImageIcon size={16} />
        </button>

        <button
          onClick={() => setNotesOpen((o) => !o)}
          aria-label={t("sectionCard.notes.toggle")}
          title={t("sectionCard.notes.toggle")}
          className={`shrink-0 ${notesOpen || section.notes ? "text-blue-400" : "text-gray-500 hover:text-gray-300"}`}
        >
          <StickyNote size={16} />
        </button>

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

      {bgPickerOpen && (
        <div className="rounded bg-gray-900 border border-gray-700 p-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{t("sectionCard.background.pick")}</span>
            <div className="flex gap-1">
              {section.backgroundId && (
                <button
                  onClick={() => { update({ backgroundId: undefined }); setBgPickerOpen(false); }}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-gray-800"
                >
                  {t("sectionCard.background.clear")}
                </button>
              )}
              <button
                onClick={() => setBgPickerOpen(false)}
                className="text-gray-500 hover:text-gray-300 p-0.5 rounded"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {media.length === 0 ? (
            <p className="text-xs text-gray-600">{t("builder.noMedia")}</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
              {media.map((m) => {
                const url = m.thumbnailFile
                  ? `asset://localhost/media/${m.thumbnailFile}`
                  : `asset://localhost/media/${m.fileName}`;
                return (
                  <button
                    key={m.id}
                    onClick={() => { update({ backgroundId: m.id }); setBgPickerOpen(false); }}
                    className={`relative rounded overflow-hidden border-2 ${
                      m.id === section.backgroundId ? "border-emerald-500" : "border-transparent hover:border-gray-500"
                    }`}
                  >
                    <img src={url} alt={m.displayName} className="w-full h-12 object-cover" />
                    {m.kind === "video" && (
                      <span className="absolute top-0.5 right-0.5 text-xs bg-black/70 rounded px-0.5 text-gray-300">▶</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
