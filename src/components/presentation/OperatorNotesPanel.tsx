import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useSettingsStore } from "../../stores/settings";

function useCurrentNotes(): string | null {
  const { state } = usePresentationStore();
  const { songs } = useLibraryStore();

  if (!state) return null;

  const item = state.set?.items[state.currentItemIndex];
  if (!item) return null;

  if (item.itemType === "song" && item.songId) {
    const song = songs.find((s) => s.id === item.songId);
    const sectionId = state.currentSlide?.sectionId;
    if (song && sectionId) {
      const section = song.sections.find((sec) => sec.id === sectionId);
      return section?.notes ?? null;
    }
    return null;
  }

  return item.notes ?? null;
}

export const OperatorNotesPanel: React.FC = () => {
  const { t } = useTranslation();
  const notes = useCurrentNotes();
  const { notesPanelCollapsed, setNotesPanelCollapsed, loadNotesPanelCollapsed } =
    useSettingsStore();

  useEffect(() => {
    loadNotesPanelCollapsed();
  }, []);

  if (!notes) return null;

  return (
    <div
      className={`flex flex-col border-l border-gray-700 bg-gray-900 transition-all ${
        notesPanelCollapsed ? "w-8" : "w-72"
      }`}
    >
      <div className="flex items-center justify-between px-2 py-2 border-b border-gray-700 shrink-0">
        {!notesPanelCollapsed && (
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {t("presentation.notes.title")}
          </span>
        )}
        <button
          onClick={() => setNotesPanelCollapsed(!notesPanelCollapsed)}
          className="text-gray-500 hover:text-gray-300 p-0.5 rounded ml-auto"
          aria-label={notesPanelCollapsed ? t("presentation.notes.expand") : t("presentation.notes.collapse")}
        >
          {notesPanelCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {!notesPanelCollapsed && (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{notes}</p>
        </div>
      )}
    </div>
  );
};
