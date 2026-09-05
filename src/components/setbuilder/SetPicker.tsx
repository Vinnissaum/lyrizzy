import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createSet,
  deleteSet,
  getSetPlayCount,
  onSetChanged,
  updateSet,
} from "../../api/commands";
import { useSetsStore } from "../../stores/sets";
import { useLibraryStore } from "../../stores/library";
import { ConfirmDialog } from "../common/ConfirmDialog";
import type { ServiceSet } from "../../types";

interface SetPickerProps {
  /** Suppresses every mutating control (select/create/rename/delete). */
  disabled?: boolean;
}

/**
 * Home header control for the active worship set: switch between sets,
 * create a new one, rename, or delete an existing one.
 */
export const SetPicker: React.FC<SetPickerProps> = ({ disabled = false }) => {
  const { t } = useTranslation();
  const { sets, refresh } = useSetsStore();
  const { activeSetId, setActiveSet } = useLibraryStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deletingSet, setDeletingSet] = useState<ServiceSet | null>(null);
  const [deletePlayCount, setDeletePlayCount] = useState<number | null>(null);

  useEffect(() => {
    refresh();
    const unlistenPromise = onSetChanged(() => refresh());
    return () => {
      unlistenPromise.then((u) => u());
    };
  }, []);

  const activeSet = sets.find((s) => s.id === activeSetId) ?? null;
  const canDelete = sets.length > 1;

  const handleSelect = (id: string) => {
    if (disabled || id === activeSetId) return;
    setActiveSet(id);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
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
    if (disabled) return;
    setRenamingId(s.id);
    setRenameValue(s.name);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const submitRename = async (e: React.FormEvent, s: ServiceSet) => {
    e.preventDefault();
    if (disabled) return;
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
    if (disabled || !canDelete) return;
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
    try {
      await deleteSet(deletingSet.id);
      cancelDelete();
      await refresh();
    } catch (err) {
      console.error("delete set failed:", err);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-xs uppercase text-muted">{t("sets.picker.label")}</span>
        <span className="text-sm font-semibold" data-testid="set-picker-active-name">
          {activeSet?.name ?? ""}
        </span>
      </div>

      <div className="text-xs font-medium text-muted">{t("sets.picker.switch")}</div>

      <ul className="flex flex-col gap-1">
        {sets.map((s) => {
          const isActive = s.id === activeSetId;
          return (
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
                  <button
                    type="button"
                    onClick={() => handleSelect(s.id)}
                    aria-current={isActive}
                    className="flex-1 text-left px-2 py-1 text-sm rounded hover:bg-surface-2"
                  >
                    {s.name}{" "}
                    <span className="text-xs text-muted">
                      {t("sets.item", { count: s.items.length })}
                    </span>
                  </button>
                  {!disabled && (
                    <>
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
                </>
              )}
            </li>
          );
        })}
      </ul>

      {!disabled &&
        (isCreating ? (
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
        ))}

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
