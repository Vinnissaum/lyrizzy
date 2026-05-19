import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  parseHolyricsFile,
  importHolyricsBatch,
  HolyricsSongPayload,
  ImportReport,
} from "../../api/commands";
import { ImportWizardFrame } from "./ImportWizardFrame";

type Step = "pick" | "preview" | "summary";

interface SongRow {
  song: HolyricsSongPayload;
  checked: boolean;
  isDuplicate: boolean;
}

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

export const HolyricsImport: React.FC<Props> = ({ onDone, onCancel }) => {
  const [step, setStep] = useState<Step>("pick");
  const [rows, setRows] = useState<SongRow[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePickFile = async () => {
    setError("");
    setIsLoading(true);
    try {
      const selected = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (!selected) {
        setIsLoading(false);
        return;
      }
      const path = typeof selected === "string" ? selected : selected[0];
      const result = await parseHolyricsFile(path);

      if (result.songs.length === 0) {
        setError("Nenhuma música encontrada no arquivo");
        setIsLoading(false);
        return;
      }

      setRows(
        result.songs.map((song, i) => ({
          song,
          isDuplicate: result.duplicateIndices.includes(i),
          checked: !result.duplicateIndices.includes(i),
        }))
      );
      setStep("preview");
    } catch (err) {
      setError(`Falha ao processar arquivo: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setIsLoading(true);
    setError("");
    try {
      const selected = rows.filter((r) => r.checked).map((r) => r.song);
      const result = await importHolyricsBatch(selected);
      setReport(result);
      setStep("summary");
    } catch (err) {
      setError(`Falha ao importar: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRow = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r))
    );
  };

  const checkedCount = rows.filter((r) => r.checked).length;

  if (step === "pick") {
    return (
      <ImportWizardFrame
        title="Importar do Holyrics"
        step={1}
        totalSteps={2}
        onCancel={onCancel}
      >
        <div className="flex flex-col items-center justify-center h-40 gap-4">
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <p className="text-gray-400 text-sm text-center">
            Selecione um arquivo de exportação do Holyrics (.json)
          </p>
          <button
            onClick={handlePickFile}
            disabled={isLoading}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 rounded-lg font-medium transition-colors"
          >
            {isLoading ? "Carregando…" : "Escolher arquivo…"}
          </button>
        </div>
      </ImportWizardFrame>
    );
  }

  if (step === "preview") {
    return (
      <ImportWizardFrame
        title="Selecionar músicas"
        step={2}
        totalSteps={2}
        onBack={() => setStep("pick")}
        onNext={handleImport}
        onCancel={onCancel}
        nextLabel={
          isLoading
            ? "Importando…"
            : `Importar selecionadas (${checkedCount})`
        }
        nextDisabled={isLoading || checkedCount === 0}
      >
        <div className="space-y-2">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {rows.map((row, idx) => (
            <label
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                row.checked ? "bg-gray-800" : "bg-gray-850 opacity-60"
              }`}
            >
              <input
                type="checkbox"
                checked={row.checked}
                onChange={() => toggleRow(idx)}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-medium truncate">{row.song.title}</p>
                {row.song.artist && (
                  <p className="text-sm text-gray-400 truncate">
                    {row.song.artist}
                  </p>
                )}
                {row.isDuplicate && (
                  <p className="text-xs text-yellow-500 mt-0.5">
                    (duplicada — desmarcada por padrão)
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
      </ImportWizardFrame>
    );
  }

  // Summary step
  return (
    <ImportWizardFrame
      title="Importação concluída"
      step={2}
      totalSteps={2}
      onCancel={onCancel}
    >
      <div className="flex flex-col items-center justify-center gap-6 py-8 text-center">
        {report && (
          <div className="space-y-1">
            <p className="text-lg font-semibold">
              {report.imported} músicas importadas
            </p>
            {report.skipped > 0 && (
              <p className="text-gray-400 text-sm">
                {report.skipped} ignoradas (duplicadas)
              </p>
            )}
            {report.failed.length > 0 && (
              <div className="text-left mt-3 space-y-1">
                <p className="text-red-400 text-sm font-medium">
                  {report.failed.length} falhas:
                </p>
                {report.failed.map((f, i) => (
                  <p key={i} className="text-xs text-gray-400">
                    {f.title}: {f.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          onClick={onDone}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
        >
          Ver biblioteca
        </button>
      </div>
    </ImportWizardFrame>
  );
};
