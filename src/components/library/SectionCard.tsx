import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, StickyNote, Image as ImageIcon, X, Play } from "lucide-react";
import type { SectionType, BackgroundPreset, FontFamily, FontSize } from "../../types";
import { NotesField } from "../common/NotesField";
import { useMediaStore } from "../../stores/media";
import { mediaUrl } from "../../api/assets";

export interface SectionDraft {
  /** Stable client-side key for dnd-kit */
  dndId: string;
  label: string;
  type: SectionType;
  body: string;
  repeatCount: number;
  notes?: string;
  backgroundId?: string;
  backgroundMode?: string;
  backgroundPreset?: string;
  fontFamily?: string;
  fontSize?: string;
}

// ── Section-level background editor (Inherit | Preset | Media) ───────────────

type SectionBgMode = "inherit" | "preset" | "media";

const PRESET_OPTIONS: { value: BackgroundPreset; label: string; bg: string; fg: string }[] = [
  { value: "preto-branco", label: "Preto/Branco", bg: "#000", fg: "#fff" },
  { value: "branco-preto", label: "Branco/Preto", bg: "#fff", fg: "#000" },
];

const FONT_FAMILY_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: "sm", label: "Sm" },
  { value: "md", label: "Md" },
  { value: "lg", label: "Lg" },
  { value: "xl", label: "Xl" },
];

interface SectionBgEditorProps {
  section: SectionDraft;
  onUpdate: (patch: Partial<SectionDraft>) => void;
  onClose: () => void;
}

const SectionBgEditor: React.FC<SectionBgEditorProps> = ({ section, onUpdate, onClose }) => {
  const { t } = useTranslation();
  const { media } = useMediaStore();
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const activeMode: SectionBgMode =
    section.backgroundMode === "preset" ? "preset"
    : section.backgroundMode === "media" ? "media"
    : "inherit";

  const setMode = (m: SectionBgMode) => {
    if (m === "inherit") {
      onUpdate({ backgroundMode: undefined, backgroundId: undefined, backgroundPreset: undefined });
    } else if (m === "media") {
      onUpdate({ backgroundMode: "media", backgroundPreset: undefined });
    } else {
      onUpdate({ backgroundMode: "preset", backgroundId: undefined, backgroundPreset: section.backgroundPreset ?? "preto-branco" });
    }
  };

  const currentBg = section.backgroundId ? media.find((m) => m.id === section.backgroundId) : undefined;
  const thumbUrl = currentBg?.thumbnailFile ? mediaUrl(currentBg.thumbnailFile) : currentBg ? mediaUrl(currentBg.fileName) : undefined;

  return (
    <div className="rounded bg-bg border border-border p-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted font-medium">{t("sectionCard.background.pick")}</span>
        <button onClick={onClose} className="text-muted hover:text-inherit p-0.5 rounded">
          <X size={14} />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-0.5 bg-surface-2 rounded p-0.5">
        {(["inherit", "preset", "media"] as SectionBgMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-0.5 text-[10px] rounded transition-colors ${
              activeMode === m
                ? "bg-surface border border-border text-fg font-medium"
                : "text-muted hover:text-inherit"
            }`}
          >
            {t(`editor.bg.mode.${m}`)}
          </button>
        ))}
      </div>

      {activeMode === "inherit" && (
        <p className="text-xs text-muted">{t("editor.bg.mode.inheritHint")}</p>
      )}

      {activeMode === "preset" && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            {PRESET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onUpdate({ backgroundPreset: opt.value })}
                className={`flex-1 py-1.5 px-2 rounded border-2 text-xs font-medium transition-colors ${
                  (section.backgroundPreset ?? "preto-branco") === opt.value
                    ? "border-primary"
                    : "border-border hover:border-muted"
                }`}
                style={{ backgroundColor: opt.bg, color: opt.fg }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Font family */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted shrink-0 w-12">{t("editor.bg.font.family")}</span>
            <div className="flex gap-0.5 flex-1">
              {FONT_FAMILY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onUpdate({ fontFamily: opt.value })}
                  className={`flex-1 py-0.5 text-[10px] rounded border transition-colors ${
                    (section.fontFamily ?? "sans") === opt.value
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted hover:text-inherit"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {/* Font size */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted shrink-0 w-12">{t("editor.bg.font.size")}</span>
            <div className="flex gap-0.5 flex-1">
              {FONT_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onUpdate({ fontSize: opt.value })}
                  className={`flex-1 py-0.5 text-[10px] rounded border transition-colors ${
                    (section.fontSize ?? "lg") === opt.value
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted hover:text-inherit"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeMode === "media" && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {thumbUrl ? (
              <img src={thumbUrl} alt="" className="w-12 h-7 object-cover rounded border border-border" />
            ) : (
              <div className="w-12 h-7 rounded border border-border bg-surface-2 flex items-center justify-center text-muted text-[10px]">-</div>
            )}
            <button
              onClick={() => setShowMediaPicker(true)}
              className="flex-1 py-1 text-xs bg-surface-2 hover:bg-border text-muted hover:text-inherit rounded transition-colors"
            >
              {currentBg ? t("editor.bg.change") : t("editor.bg.choose")}
            </button>
            {currentBg && (
              <button
                onClick={() => onUpdate({ backgroundId: undefined })}
                className="text-xs text-danger hover:text-danger px-1"
              >
                {t("editor.bg.remove")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Media picker modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl w-[480px] max-h-[70vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">{t("editor.bg.modalTitle")}</h3>
              <button onClick={() => setShowMediaPicker(false)} className="text-muted hover:text-inherit leading-none"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-4 gap-1.5">
              {media.length === 0 ? (
                <p className="col-span-4 text-xs text-muted text-center py-4">{t("builder.noMedia")}</p>
              ) : (
                media.map((m) => {
                  const url = m.thumbnailFile ? mediaUrl(m.thumbnailFile) : mediaUrl(m.fileName);
                  return (
                    <button
                      key={m.id}
                      onClick={() => { onUpdate({ backgroundId: m.id }); setShowMediaPicker(false); }}
                      className={`relative rounded overflow-hidden border-2 ${m.id === section.backgroundId ? "border-primary" : "border-transparent hover:border-border"}`}
                    >
                      <img src={url} alt={m.displayName} className="w-full h-12 object-cover" />
                      {m.kind === "video" && <span className="absolute top-0.5 right-0.5 bg-black/70 rounded px-0.5 text-white"><Play size={10} className="fill-current" /></span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [bgEditorOpen, setBgEditorOpen] = useState(false);
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
    ? mediaUrl(currentBg.thumbnailFile)
    : currentBg
    ? mediaUrl(currentBg.fileName)
    : undefined;

  const hasBgOverride = !!(section.backgroundMode && section.backgroundMode !== "inherit");

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

        {/* Section background thumbnail badge (media mode) */}
        {thumbUrl && (
          <img
            src={thumbUrl}
            alt=""
            className="w-6 h-3.5 object-cover rounded border border-border shrink-0"
            title={currentBg?.displayName}
          />
        )}

        {/* Preset badge */}
        {section.backgroundMode === "preset" && section.backgroundPreset && (
          <span
            className="w-6 h-3.5 rounded border border-border shrink-0 inline-block"
            style={{
              backgroundColor: section.backgroundPreset === "branco-preto" ? "#fff" : "#000",
            }}
            title={section.backgroundPreset}
          />
        )}

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
          onClick={() => setBgEditorOpen((o) => !o)}
          aria-label={t("sectionCard.background.pick")}
          title={t("sectionCard.background.pick")}
          className={`shrink-0 ${hasBgOverride ? "text-success" : "text-muted hover:text-inherit"}`}
        >
          <ImageIcon size={16} />
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

      {bgEditorOpen && (
        <SectionBgEditor
          section={section}
          onUpdate={(patch) => update(patch)}
          onClose={() => setBgEditorOpen(false)}
        />
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
