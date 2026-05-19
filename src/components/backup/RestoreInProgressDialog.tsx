import React, { useState } from "react";
import { abortRestore } from "../../api/commands";

interface Props {
  onDismissed: () => void;
}

/// Modal shown when the app detects a `.restore_in_progress` flag on startup,
/// indicating a previous restore was interrupted (crash, disk full, etc.).
export const RestoreInProgressDialog: React.FC<Props> = ({ onDismissed }) => {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAbort = async () => {
    setWorking(true);
    setError(null);
    try {
      await abortRestore();
      onDismissed();
    } catch (err: unknown) {
      setError(String(err));
      setWorking(false);
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-white">Restauração interrompida</h2>
            <p className="text-xs text-gray-400">Uma restauração anterior não foi concluída</p>
          </div>
        </div>

        <p className="text-sm text-gray-300 mb-4">
          O Trinity Lyrics detectou que uma restauração anterior foi interrompida antes de concluir.
          A biblioteca pode estar em um estado incompleto.
        </p>

        <p className="text-sm text-gray-300 mb-6">
          Clique em <strong className="text-amber-300">Cancelar restauração</strong> para limpar o estado parcial
          e volcar ao estado de instalação limpa. Você poderá restaurar novamente a partir do arquivo de backup.
        </p>

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 rounded-lg font-medium transition-colors"
          >
            Cancelar restauração
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-red-400">
              ⚠ Isso apagará todos os dados da biblioteca atual. Esta ação é irreversível.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAbort}
                disabled={working}
                className="flex-1 px-4 py-2 text-sm bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {working ? "Limpando…" : "Confirmar e limpar"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={working}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
