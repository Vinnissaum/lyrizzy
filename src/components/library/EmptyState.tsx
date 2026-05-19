import React from "react";

interface Props {
  onImportHolyrics: () => void;
  onCreateSong: () => void;
}

export const EmptyState: React.FC<Props> = ({
  onImportHolyrics,
  onCreateSong,
}) => (
  <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center py-16">
    <div className="space-y-2">
      <p className="text-2xl font-semibold text-gray-300">Nenhuma música</p>
      <p className="text-gray-500">
        Comece importando músicas ou criando uma nova.
      </p>
    </div>
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        data-testid="cta-import-holyrics"
        onClick={onImportHolyrics}
        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors"
      >
        Importar do Holyrics
      </button>
      <button
        data-testid="cta-create-song"
        onClick={onCreateSong}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
      >
        Criar música manualmente
      </button>
    </div>
  </div>
);
