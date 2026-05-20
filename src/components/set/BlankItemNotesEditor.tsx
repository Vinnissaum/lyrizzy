import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { updateSetItem } from "../../api/commands";
import { NotesField } from "../common/NotesField";
import type { SetItem } from "../../types";

interface Props {
  item: SetItem;
}

export const BlankItemNotesEditor: React.FC<Props> = ({ item }) => {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(item.notes ?? "");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotes(item.notes ?? "");
  }, [item.id]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      updateSetItem({ id: item.id, notes: value || undefined }).catch(console.error);
    }, 300);
  };

  return (
    <div className="p-3">
      <p className="text-xs text-gray-400 mb-1">{t("builder.itemNotes.label")}</p>
      <NotesField value={notes} onChange={handleNotesChange} placeholder={t("builder.itemNotes.placeholder")} />
    </div>
  );
};
