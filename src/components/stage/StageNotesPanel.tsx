import React, { useEffect, useRef } from "react";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";

function useStageNotes(): string | null {
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

export const StageNotesPanel: React.FC = () => {
  const notes = useStageNotes();
  const panelRef = useRef<HTMLDivElement>(null);
  const prevNotesRef = useRef<string | null>(null);

  useEffect(() => {
    if (notes !== prevNotesRef.current && panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
    prevNotesRef.current = notes;
  }, [notes]);

  if (!notes) return null;

  return (
    <div
      ref={panelRef}
      className="col-span-2 bg-gray-900 rounded overflow-y-auto px-4 py-3 scroll-smooth"
    >
      <p
        className="text-gray-100 whitespace-pre-wrap leading-[1.4]"
        style={{ fontSize: "clamp(20px, 2.5vmin, 36px)" }}
      >
        {notes}
      </p>
    </div>
  );
};
