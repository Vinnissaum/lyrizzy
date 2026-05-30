import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Play, ChevronRight } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { createSong, updateSong, deleteSong, getSong, parsePlainTextImport } from "../../api/commands";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { useSettingsStore } from "../../stores/settings";
import { mediaUrl } from "../../api/assets";
import { SectionCard, SectionDraft } from "./SectionCard";
import { ChipAppearance } from "../presentation/SlideChip";
import { ConfirmDialog } from "../common/ConfirmDialog";
import type { BackgroundInfo, Media, SectionType, TextCasing } from "../../types";

let dndCounter = 0;
const nextDndId = () => `sec-${++dndCounter}`;

// ── BackgroundEditor (None | Media) for the song level ───────────────────────
// Fonts, theme/preset, size, position and margin are configured globally in
// Settings; songs only optionally pick a per-song background media.

type BgMode = "none" | "media";

interface BackgroundEditorProps {
  backgroundMode?: string;
  backgroundId?: string;
  scrimOpacity: number;
  media: Media[];
  onChange: (patch: {
    backgroundMode?: string;
    backgroundId?: string;
    scrimOpacity?: number;
  }) => void;
}

const BackgroundEditor: React.FC<BackgroundEditorProps> = ({
  backgroundMode,
  backgroundId,
  scrimOpacity,
  media,
  onChange,
}) => {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  const activeMode: BgMode = backgroundMode === "media" ? "media" : "none";

  const current = backgroundId ? media.find((m) => m.id === backgroundId) : undefined;
  const thumbUrl = current?.thumbnailFile
    ? mediaUrl(current.thumbnailFile)
    : current
    ? mediaUrl(current.fileName)
    : undefined;

  const setMode = (m: BgMode) => {
    if (m === "none") onChange({ backgroundMode: undefined, backgroundId: undefined });
    else onChange({ backgroundMode: "media" });
  };

  return (
    <div className="space-y-2">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
        {(["none", "media"] as BgMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1 text-xs rounded-md transition-colors ${
              activeMode === m
                ? "bg-surface border border-border text-fg font-medium"
                : "text-muted hover:text-inherit"
            }`}
          >
            {t(`editor.bg.mode.${m}`)}
          </button>
        ))}
      </div>

      {/* Media tab */}
      {activeMode === "media" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {thumbUrl ? (
              <img src={thumbUrl} alt="" className="w-16 h-10 object-cover rounded border border-border" />
            ) : (
              <div className="w-16 h-10 rounded border border-border bg-surface-2 flex items-center justify-center text-muted text-xs">
                {t("editor.bg.none")}
              </div>
            )}
            <div className="flex gap-1.5 flex-1">
              <button
                onClick={() => setShowPicker(true)}
                className="flex-1 py-1.5 text-xs bg-surface-2 hover:bg-border text-muted hover:text-inherit rounded-lg transition-colors"
              >
                {current ? t("editor.bg.change") : t("editor.bg.choose")}
              </button>
              {current && (
                <button
                  onClick={() => onChange({ backgroundId: undefined })}
                  className="px-2 py-1.5 text-xs bg-surface-2 hover:bg-danger-bg text-muted hover:text-danger rounded-lg transition-colors"
                >
                  {t("editor.bg.remove")}
                </button>
              )}
            </div>
          </div>
          {current && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{t("editor.bg.scrimLabel")}</span>
                <span>{scrimOpacity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={scrimOpacity}
                onChange={(e) => onChange({ scrimOpacity: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
          )}
        </div>
      )}

      {/* Media picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl w-[480px] max-h-[70vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">{t("editor.bg.modalTitle")}</h3>
              <button onClick={() => setShowPicker(false)} className="text-muted hover:text-inherit leading-none"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2">
              {media.length === 0 && (
                <p className="col-span-3 text-center text-muted text-sm py-8">{t("editor.bg.noMedia")}</p>
              )}
              {media.map((m) => {
                const url = m.thumbnailFile ? mediaUrl(m.thumbnailFile) : mediaUrl(m.fileName);
                return (
                  <button
                    key={m.id}
                    onClick={() => { onChange({ backgroundId: m.id }); setShowPicker(false); }}
                    className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
                      m.id === backgroundId ? "border-primary" : "border-transparent hover:border-muted"
                    }`}
                  >
                    <img src={url} alt={m.displayName} className="w-full h-20 object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5 text-xs text-muted truncate">{m.displayName}</div>
                    {m.kind === "video" && <div className="absolute top-1 right-1 bg-black/70 rounded px-1 text-white"><Play size={10} className="fill-current" /></div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function newSection(type: SectionType = "verse", _sections?: SectionDraft[]): SectionDraft {
  return {
    dndId: nextDndId(),
    label: "",
    type,
    body: "",
    repeatCount: 1,
  };
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

let toastCounter = 0;

export const SongEditor: React.FC = () => {
  const { t } = useTranslation();
  const { editingSongId, closeEditor, refresh } = useLibraryStore();
  const { media, refresh: refreshMedia } = useMediaStore();
  const {
    presentationFontFamily,
    presentationFontSize,
    presentationPreset,
    presentationPosition,
    presentationMargin,
    presentationRepeatMode,
  } = useSettingsStore();

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [author, setAuthor] = useState("");
  const [copyright, setCopyright] = useState("");
  const [ccliNumber, setCcliNumber] = useState("");
  const [language, setLanguage] = useState("pt");
  const [notes, setNotes] = useState("");
  const [backgroundId, setBackgroundId] = useState<string | undefined>();
  const [scrimOpacity, setScrimOpacity] = useState(35);
  const [backgroundMode, setBackgroundMode] = useState<string | undefined>();
  const [textCasing, setTextCasing] = useState<TextCasing | undefined>();
  const [rightsOpen, setRightsOpen] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [sections, setSections] = useState<SectionDraft[]>([
    newSection("verse", []),
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [bodyError, setBodyError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    refreshMedia();
  }, []);

  useEffect(() => {
    if (!editingSongId) return;
    setIsLoading(true);
    getSong(editingSongId)
      .then((song) => {
        setTitle(song.title);
        setArtist(song.artist ?? "");
        setAuthor(song.author ?? "");
        setCopyright(song.copyright ?? "");
        setCcliNumber(song.ccliNumber ?? "");
        setLanguage(song.language);
        setNotes(song.notes ?? "");
        setBackgroundId(song.backgroundId);
        setScrimOpacity(song.scrimOpacity ?? 35);
        setBackgroundMode(song.backgroundMode === "media" ? "media" : undefined);
        setTextCasing(song.textCasing);
        const hasRights = !!(song.author || song.copyright || song.ccliNumber);
        setRightsOpen(hasRights);
        setSections(
          song.sections.map((s) => ({
            dndId: nextDndId(),
            label: s.label,
            type: s.type,
            body: s.body,
            repeatCount: s.repeatCount,
            notes: s.notes,
          }))
        );
      })
      .catch((err) => addToast(`${err}`, "error"))
      .finally(() => setIsLoading(false));
  }, [editingSongId]);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const validate = (): boolean => {
    let ok = true;
    if (!title.trim()) {
      setTitleError(t("editor.validation.titleRequired"));
      ok = false;
    } else {
      setTitleError("");
    }
    if (!sections.some((s) => s.body.trim())) {
      setBodyError(t("editor.validation.bodyRequired"));
      ok = false;
    } else {
      setBodyError("");
    }
    return ok;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        artist: artist.trim() || undefined,
        author: author.trim() || undefined,
        copyright: copyright.trim() || undefined,
        ccliNumber: ccliNumber.trim() || undefined,
        language,
        notes: notes.trim() || undefined,
        backgroundId: backgroundId || undefined,
        scrimOpacity,
        backgroundMode: backgroundMode || undefined,
        textCasing: textCasing && textCasing !== "normal" ? textCasing : undefined,
        sections: sections.map((s, i) => ({
          label: s.label,
          type: s.type,
          body: s.body,
          sortOrder: i,
          repeatCount: s.repeatCount,
          notes: s.notes || undefined,
        })),
      };

      if (editingSongId) {
        await updateSong({ ...payload, id: editingSongId });
      } else {
        await createSong(payload);
      }

      addToast(t("editor.toast.saved"), "success");
      await refresh();
      closeEditor();
    } catch (err) {
      addToast(String(err), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingSongId) return;
    try {
      await deleteSong(editingSongId);
      addToast(t("editor.toast.deleted"), "success");
      await refresh();
      closeEditor();
    } catch (err) {
      addToast(String(err), "error");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.dndId === active.id);
      const newIndex = prev.findIndex((s) => s.dndId === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const addSection = () => {
    setSections((prev) => [...prev, newSection("verse", prev)]);
  };

  // Parse pasted full lyrics (blank line = new strophe) and REPLACE all sections.
  const applyPaste = async () => {
    const text = pasteText.trim();
    if (!text) return;
    setPasteBusy(true);
    try {
      const parsed = await parsePlainTextImport(text);
      if (parsed.length === 0) {
        addToast(t("editor.paste.empty"), "error");
        return;
      }
      setSections(
        parsed.map((p) => ({
          dndId: nextDndId(),
          label: p.label,
          type: p.sectionType as SectionType,
          body: p.body,
          repeatCount: 1,
        }))
      );
      setShowPaste(false);
      setPasteText("");
      addToast(t("editor.paste.applied", { count: parsed.length }), "success");
    } catch (err) {
      addToast(String(err), "error");
    } finally {
      setPasteBusy(false);
    }
  };

  const updateSection = (idx: number, updated: SectionDraft) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? updated : s)));
  };

  const removeSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const appearance: ChipAppearance = {
    fontFamily: presentationFontFamily,
    fontSize: presentationFontSize,
    preset: presentationPreset,
    position: presentationPosition,
    margin: presentationMargin,
  };

  // Per-song media background mirrored into the section previews.
  const previewBackground: BackgroundInfo | undefined = React.useMemo(() => {
    if (backgroundMode !== "media" || !backgroundId) return undefined;
    const m = media.find((x) => x.id === backgroundId);
    if (!m) return undefined;
    return {
      mediaKind: m.kind,
      assetUrl: mediaUrl(m.thumbnailFile ?? m.fileName),
      scrimOpacity,
      restartOnSectionBoundary: false,
    };
  }, [backgroundMode, backgroundId, scrimOpacity, media]);

  const isValid = title.trim() && sections.some((s) => s.body.trim());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded-lg text-sm shadow-lg text-fg-on-primary ${
              toast.type === "success" ? "bg-success" : "bg-danger"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <button
          onClick={closeEditor}
          className="text-sm text-muted hover:text-inherit transition-colors"
        >
          {t("editor.back")}
        </button>
        <div className="flex gap-2">
          {editingSongId && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm bg-danger hover:bg-danger text-fg-on-primary rounded-lg transition-colors"
            >
              {t("editor.delete")}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className="px-4 py-1.5 text-sm bg-primary hover:bg-primary-hover disabled:bg-surface-2 disabled:text-muted disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-fg-on-primary"
          >
            {isSaving ? t("saving") : t("editor.save")}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-3">
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("editor.titlePlaceholder")}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-lg font-medium text-fg focus:outline-none focus:border-primary"
            />
            {titleError && (
              <p className="text-danger text-xs mt-1">{titleError}</p>
            )}
          </div>

          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder={t("editor.artistPlaceholder")}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-primary"
          />

          <div className="flex gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-primary"
            >
              <option value="pt">{t("editor.lang.pt")}</option>
              <option value="en">{t("editor.lang.en")}</option>
              <option value="es">{t("editor.lang.es")}</option>
            </select>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("editor.notesPlaceholder")}
            rows={2}
            className="w-full bg-surface-2 border border-border text-fg rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-primary"
          />
        </div>

        {/* Background */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
            {t("editor.background")}
          </h3>
          <BackgroundEditor
            backgroundMode={backgroundMode}
            backgroundId={backgroundId}
            scrimOpacity={scrimOpacity}
            media={media}
            onChange={(patch) => {
              if ("backgroundMode" in patch) setBackgroundMode(patch.backgroundMode);
              if ("backgroundId" in patch) setBackgroundId(patch.backgroundId);
              if ("scrimOpacity" in patch && patch.scrimOpacity !== undefined) setScrimOpacity(patch.scrimOpacity);
            }}
          />
        </div>

        {/* Text casing */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
            {t("editor.casing.title")}
          </h3>
          <select
            value={textCasing ?? "normal"}
            onChange={(e) => setTextCasing(e.target.value as TextCasing)}
            className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-primary"
          >
            <option value="normal">{t("editor.casing.normal")}</option>
            <option value="upper">{t("editor.casing.upper")}</option>
            <option value="lower">{t("editor.casing.lower")}</option>
            <option value="title">{t("editor.casing.titleCase")}</option>
          </select>
        </div>

        {/* Sections */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
              {t("editor.sections")}
            </h3>
            <button
              type="button"
              onClick={() => { setPasteText(""); setShowPaste(true); }}
              className="text-xs text-muted hover:text-inherit border border-border hover:border-muted rounded-lg px-2.5 py-1 transition-colors"
            >
              {t("editor.paste.button")}
            </button>
          </div>
          {bodyError && (
            <p className="text-danger text-xs">{bodyError}</p>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sections.map((s) => s.dndId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {sections.map((section, idx) => (
                  <SectionCard
                    key={section.dndId}
                    section={section}
                    onChange={(updated) => updateSection(idx, updated)}
                    onRemove={() => removeSection(idx)}
                    canRemove={sections.length > 1}
                    appearance={appearance}
                    casing={textCasing ?? "normal"}
                    repeatMode={presentationRepeatMode}
                    background={previewBackground}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <button
            onClick={addSection}
            className="w-full py-2 text-sm text-muted hover:text-inherit border border-dashed border-border hover:border-muted rounded-lg transition-colors"
          >
            {t("editor.addSection")}
          </button>
        </div>

        {/* Rights / License panel */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setRightsOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-medium text-muted uppercase tracking-wider hover:text-inherit transition-colors w-full text-left"
          >
            <ChevronRight size={14} className={`transition-transform ${rightsOpen ? "rotate-90" : ""}`} />
            {t("editor.rights.title")}
          </button>
          {rightsOpen && (
            <div className="space-y-2 pl-4">
              <input
                value={ccliNumber}
                onChange={(e) => setCcliNumber(e.target.value)}
                placeholder={t("editor.rights.ccliNumber")}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-primary"
              />
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={t("editor.rights.author")}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-primary"
              />
              <input
                value={copyright}
                onChange={(e) => setCopyright(e.target.value)}
                placeholder={t("editor.rights.copyright")}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-primary"
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t("editor.deleteConfirm.title")}
        message={t("editor.deleteConfirm.message")}
        confirmLabel={t("editor.deleteConfirm.confirm")}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDelete();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Paste full lyrics — blank line separates strophes; replaces all sections */}
      {showPaste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-xl p-4 space-y-3">
            <h3 className="text-sm font-medium text-fg">{t("editor.paste.dialogTitle")}</h3>
            <p className="text-xs text-muted">{t("editor.paste.hint")}</p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t("editor.paste.placeholder")}
              rows={12}
              autoFocus
              className="w-full bg-surface-2 border border-border text-fg rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPaste(false)}
                className="px-3 py-1.5 text-sm text-muted hover:text-inherit rounded-lg transition-colors"
              >
                {t("editor.paste.cancel")}
              </button>
              <button
                type="button"
                onClick={applyPaste}
                disabled={!pasteText.trim() || pasteBusy}
                className="px-4 py-1.5 text-sm bg-primary hover:bg-primary-hover disabled:bg-surface-2 disabled:text-muted disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-fg-on-primary"
              >
                {t("editor.paste.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
