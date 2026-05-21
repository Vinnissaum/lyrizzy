import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createSet, deleteSet, onSetChanged } from "../../api/commands";
import { useSetsStore } from "../../stores/sets";
import { useLibraryStore } from "../../stores/library";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { formatDate } from "../../utils/format";
import type { ServiceSet } from "../../types";

export const SetList: React.FC = () => {
  const { t } = useTranslation();
  const { sets, isLoading, refresh } = useSetsStore();
  const { openSetBuilder } = useLibraryStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [deletingSet, setDeletingSet] = useState<ServiceSet | null>(null);

  useEffect(() => {
    refresh();
    const unlistenPromise = onSetChanged(() => refresh());
    return () => {
      unlistenPromise.then((u) => u());
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      await createSet({ name });
      setNewName("");
      setIsCreating(false);
      refresh();
    } catch (err) {
      console.error("create set failed:", err);
    }
  };

  const handleDelete = async () => {
    if (!deletingSet) return;
    try {
      await deleteSet(deletingSet.id);
      setDeletingSet(null);
      refresh();
    } catch (err) {
      console.error("delete set failed:", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("sets.title")}</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
        >
          {t("sets.newButton")}
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="px-4 py-3 border-b border-border flex gap-2"
        >
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("sets.namePlaceholder")}
            className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm placeholder-muted focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors"
          >
            {t("sets.createButton")}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setNewName("");
            }}
            className="px-3 py-1.5 text-sm bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors"
          >
            {t("sets.cancelButton")}
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-muted text-sm text-center py-8">{t("loading")}</p>
        ) : sets.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p className="text-sm">{t("sets.empty.message")}</p>
            <p className="text-xs mt-1">{t("sets.empty.hint")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sets.map((s) => (
              <li key={s.id}>
                <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-surface hover:bg-surface-2 group">
                  <button
                    className="flex-1 text-left"
                    onClick={() => openSetBuilder(s.id)}
                  >
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {t("sets.item", { count: s.items.length })}
                      {s.serviceDate ? ` · ${formatDate(s.serviceDate)}` : ""}
                    </p>
                  </button>
                  <button
                    onClick={() => setDeletingSet(s)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-muted hover:text-red-400 hover:bg-surface-2 transition-all"
                    title={t("sets.delete.title")}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!deletingSet}
        title={t("sets.delete.title")}
        message={deletingSet ? t("sets.delete.message", { name: deletingSet.name }) : ""}
        confirmLabel={t("sets.delete.confirm")}
        onConfirm={handleDelete}
        onCancel={() => setDeletingSet(null)}
      />
    </div>
  );
};
