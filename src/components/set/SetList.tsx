import React, { useEffect, useState } from "react";
import { createSet, deleteSet, onSetChanged } from "../../api/commands";
import { useSetsStore } from "../../stores/sets";
import { useLibraryStore } from "../../stores/library";
import { ConfirmDialog } from "../common/ConfirmDialog";
import type { ServiceSet } from "../../types";

export const SetList: React.FC = () => {
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
      console.error("Falha ao criar conjunto:", err);
    }
  };

  const handleDelete = async () => {
    if (!deletingSet) return;
    try {
      await deleteSet(deletingSet.id);
      setDeletingSet(null);
      refresh();
    } catch (err) {
      console.error("Falha ao excluir conjunto:", err);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("pt-BR");
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Conjuntos de Culto</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
        >
          + Novo
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="px-4 py-3 border-b border-gray-700 flex gap-2"
        >
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do conjunto…"
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
          >
            Criar
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setNewName("");
            }}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-gray-500 text-sm text-center py-8">Carregando…</p>
        ) : sets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">Nenhum conjunto criado.</p>
            <p className="text-xs mt-1">Clique em "Novo" para começar.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sets.map((s) => (
              <li key={s.id}>
                <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-gray-800 hover:bg-gray-750 group">
                  <button
                    className="flex-1 text-left"
                    onClick={() => openSetBuilder(s.id)}
                  >
                    <p className="text-sm font-medium text-white">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.items.length} {s.items.length === 1 ? "item" : "itens"}
                      {s.serviceDate ? ` · ${formatDate(s.serviceDate)}` : ""}
                    </p>
                  </button>
                  <button
                    onClick={() => setDeletingSet(s)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-all"
                    title="Excluir"
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
        title="Excluir conjunto"
        message={deletingSet ? `Deseja excluir "${deletingSet.name}"? Esta ação não pode ser desfeita.` : ""}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeletingSet(null)}
      />
    </div>
  );
};
