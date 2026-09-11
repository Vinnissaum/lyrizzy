import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import {
  createSet,
  deleteSet,
  getSetPlayCount,
  updateSet,
} from "../../api/commands";
import { useSetsStore } from "../../stores/sets";
import { useLibraryStore } from "../../stores/library";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { nextActiveSetId } from "../../utils/setSelection";
import type { ServiceSet } from "../../types";

/**
 * "Gerenciar conjuntos" modal: list of sets with item counts, rename,
 * delete (with the play-count confirmation and last-set guard), and create.
 */
export const SetManagerDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const { sets, refresh } = useSetsStore();
  const { activeSetId, setActiveSet } = useLibraryStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deletingSet, setDeletingSet] = useState<ServiceSet | null>(null);
  const [deletePlayCount, setDeletePlayCount] = useState<number | null>(null);

  const canDelete = sets.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (renamingId && sets.every((s) => s.id !== renamingId)) {
      setRenamingId(null);
      setRenameValue("");
    }
  }, [sets, renamingId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      const created = await createSet({ name });
      setNewName("");
      setIsCreating(false);
      await refresh();
      await setActiveSet(created.id);
    } catch (err) {
      console.error("create set failed:", err);
    }
  };

  const startRename = (s: ServiceSet) => {
    setRenamingId(s.id);
    setRenameValue(s.name);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const submitRename = async (e: React.FormEvent, s: ServiceSet) => {
    e.preventDefault();
    const name = renameValue.trim();
    if (!name) return;
    try {
      await updateSet({
        id: s.id,
        name,
        serviceDate: s.serviceDate,
        notes: s.notes,
      });
      setRenamingId(null);
      refresh();
    } catch (err) {
      console.error("rename set failed:", err);
    }
  };

  const openDeleteConfirm = async (s: ServiceSet) => {
    if (!canDelete) return;
    try {
      const count = await getSetPlayCount(s.id);
      setDeletePlayCount(count);
      setDeletingSet(s);
    } catch (err) {
      console.error("get set play count failed:", err);
      setDeletePlayCount(0);
      setDeletingSet(s);
    }
  };

  const cancelDelete = () => {
    setDeletingSet(null);
    setDeletePlayCount(null);
  };

  const handleDelete = async () => {
    if (!deletingSet) return;
    const id = deletingSet.id;
    const wasActive = id === activeSetId;
    const successor = nextActiveSetId(sets, id);
    try {
      await deleteSet(id);
      cancelDelete();
      await refresh();
      if (wasActive && successor) {
        await setActiveSet(successor);
      }
    } catch (err) {
      console.error("delete set failed:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      data-testid="set-manager-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl shadow-2xl w-[460px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{t("sets.manage.title")}</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-inherit"
            aria-label={t("sets.manage.close")}
          >
            <X size={16} />
          </button>
        </div>

        <ul className="max-h-[60vh] overflow-y-auto flex flex-col gap-1 px-4 py-3">
          {sets.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              {renamingId === s.id ? (
                <form
                  onSubmit={(e) => submitRename(e, s)}
                  className="flex flex-1 items-center gap-1"
                >
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm bg-surface border border-border rounded"
                  />
                  <button type="submit" className="text-xs px-2 py-1">
                    {t("sets.picker.rename")}
                  </button>
                  <button type="button" onClick={cancelRename} className="text-xs px-2 py-1">
                    {t("sets.cancelButton")}
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-left px-2 py-1 text-sm">
                    {s.name}{" "}
                    <span className="text-xs text-muted">
                      {t("sets.item", { count: s.items.length })}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => startRename(s)}
                    className="text-xs px-2 py-1"
                  >
                    {t("sets.picker.rename")}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteConfirm(s)}
                    disabled={!canDelete}
                    title={!canDelete ? t("sets.picker.lastSetHint") : undefined}
                    className="text-xs px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("sets.picker.delete")}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="px-4 pb-4">
          {isCreating ? (
            <form onSubmit={handleCreate} className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("sets.namePlaceholder")}
                className="flex-1 px-2 py-1 text-sm bg-surface border border-border rounded"
              />
              <button type="submit" className="text-xs px-2 py-1">
                {t("sets.picker.create")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewName("");
                }}
                className="text-xs px-2 py-1"
              >
                {t("sets.cancelButton")}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="text-xs px-2 py-1 self-start"
            >
              {t("sets.picker.create")}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deletingSet}
        title={t("sets.picker.delete")}
        message={
          deletingSet
            ? t("sets.picker.deleteWithPlays", {
                name: deletingSet.name,
                count: deletePlayCount ?? 0,
              })
            : ""
        }
        confirmLabel={t("sets.delete.confirm")}
        onConfirm={handleDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};
