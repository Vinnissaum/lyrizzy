import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { onSetChanged } from "../../api/commands";
import { useSetsStore } from "../../stores/sets";
import { useLibraryStore } from "../../stores/library";
import { SetManagerDialog } from "./SetManagerDialog";

/**
 * Home header control for the active worship set: a compact select to
 * switch between sets, and a gear button that opens the set manager dialog
 * for create/rename/delete.
 */
export const SetPicker: React.FC = () => {
  const { t } = useTranslation();
  const { sets, refresh } = useSetsStore();
  const { activeSetId, setActiveSet } = useLibraryStore();

  const [isManagerOpen, setIsManagerOpen] = useState(false);

  useEffect(() => {
    refresh();
    const unlistenPromise = onSetChanged(() => refresh());
    return () => {
      unlistenPromise.then((u) => u());
    };
  }, []);

  const activeSet = sets.find((s) => s.id === activeSetId) ?? null;

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeSetId ?? ""}
        onChange={(e) => setActiveSet(e.target.value)}
        aria-label={t("sets.picker.switch")}
        className="text-xs px-2 py-1.5 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary"
      >
        {sets.length === 0 ? (
          <option value={activeSetId ?? ""} disabled>
            {activeSet?.name ?? activeSetId ?? t("loading")}
          </option>
        ) : (
          sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))
        )}
      </select>
      <button
        type="button"
        onClick={() => setIsManagerOpen(true)}
        aria-label={t("sets.manage.open")}
        className="p-1.5 text-muted hover:text-inherit rounded"
      >
        <Settings size={14} />
      </button>
      {isManagerOpen && <SetManagerDialog onClose={() => setIsManagerOpen(false)} />}
    </div>
  );
};
