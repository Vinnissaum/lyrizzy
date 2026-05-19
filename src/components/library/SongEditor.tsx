import React, { useEffect, useState, useCallback } from "react";
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
import { createSong, updateSong, deleteSong, getSong } from "../../api/commands";
import { useLibraryStore } from "../../stores/library";
import { SectionCard, SectionDraft } from "./SectionCard";
import { ConfirmDialog } from "../common/ConfirmDialog";
import type { SectionType } from "../../types";

let dndCounter = 0;
const nextDndId = () => `sec-${++dndCounter}`;

function defaultLabel(type: SectionType, sections: SectionDraft[]): string {
  const count = sections.filter((s) => s.type === type).length + 1;
  const labels: Record<SectionType, string> = {
    verse: `Estrofe ${count}`,
    chorus: `Refrão ${count}`,
    bridge: `Ponte ${count}`,
    pre_chorus: `Pré-refrão ${count}`,
    outro: `Final ${count}`,
    interlude: `Interlúdio ${count}`,
    tag: `Tag ${count}`,
  };
  return labels[type];
}

function newSection(type: SectionType = "verse", sections: SectionDraft[]): SectionDraft {
  return {
    dndId: nextDndId(),
    label: defaultLabel(type, sections),
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
  const { editingSongId, closeEditor, refresh } = useLibraryStore();

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [language, setLanguage] = useState("pt");
  const [notes, setNotes] = useState("");
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
    if (!editingSongId) return;
    setIsLoading(true);
    getSong(editingSongId)
      .then((song) => {
        setTitle(song.title);
        setArtist(song.artist ?? "");
        setLanguage(song.language);
        setNotes(song.notes ?? "");
        setSections(
          song.sections.map((s) => ({
            dndId: nextDndId(),
            label: s.label,
            type: s.type,
            body: s.body,
            repeatCount: s.repeatCount,
          }))
        );
      })
      .catch((err) => addToast(`Falha ao carregar música: ${err}`, "error"))
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
      setTitleError("Título é obrigatório");
      ok = false;
    } else {
      setTitleError("");
    }
    if (!sections.some((s) => s.body.trim())) {
      setBodyError("Pelo menos uma seção deve ter letra");
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
        language,
        notes: notes.trim() || undefined,
        sections: sections.map((s, i) => ({
          label: s.label,
          type: s.type,
          body: s.body,
          sortOrder: i,
          repeatCount: s.repeatCount,
        })),
      };

      if (editingSongId) {
        await updateSong({ ...payload, id: editingSongId });
      } else {
        await createSong(payload);
      }

      addToast("Música salva com sucesso", "success");
      await refresh();
      closeEditor();
    } catch (err) {
      addToast(`Falha ao salvar música: ${err}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingSongId) return;
    try {
      await deleteSong(editingSongId);
      addToast("Música excluída", "success");
      await refresh();
      closeEditor();
    } catch (err) {
      addToast(`Falha ao excluir: ${err}`, "error");
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

  const updateSection = (idx: number, updated: SectionDraft) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? updated : s)));
  };

  const removeSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const isValid = title.trim() && sections.some((s) => s.body.trim());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-lg text-sm shadow-lg ${
              t.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
        <button
          onClick={closeEditor}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Biblioteca
        </button>
        <div className="flex gap-2">
          {editingSongId && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm bg-red-700 hover:bg-red-600 rounded-lg transition-colors"
            >
              Excluir
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {isSaving ? "Salvando…" : "Salvar"}
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
              placeholder="Título da música *"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-lg font-medium focus:outline-none focus:border-blue-500"
            />
            {titleError && (
              <p className="text-red-400 text-xs mt-1">{titleError}</p>
            )}
          </div>

          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artista / Banda"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />

          <div className="flex gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="pt">Português</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações (opcional)"
            rows={2}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Sections */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Seções
          </h3>
          {bodyError && (
            <p className="text-red-400 text-xs">{bodyError}</p>
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
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <button
            onClick={addSection}
            className="w-full py-2 text-sm text-gray-400 hover:text-white border border-dashed border-gray-600 hover:border-gray-400 rounded-lg transition-colors"
          >
            + Adicionar seção
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Excluir música"
        message="Excluir esta música? Esta ação pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDelete();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};
