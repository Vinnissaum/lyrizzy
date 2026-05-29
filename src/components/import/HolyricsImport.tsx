import React, { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
        setError(t("import.holyrics.errors.noSongs"));
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
      setError(t("import.holyrics.errors.parseFailed", { err: String(err) }));
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
      setError(t("import.holyrics.errors.importFailed", { err: String(err) }));
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
        title={t("import.holyrics.step1.title")}
        step={1}
        totalSteps={2}
        onCancel={onCancel}
      >
        <div className="flex flex-col items-center justify-center h-40 gap-4">
          {error && <p className="text-danger text-sm text-center">{error}</p>}
          <p className="text-muted text-sm text-center">
            {t("import.holyrics.step1.hint")}
          </p>
          <button
            onClick={handlePickFile}
            disabled={isLoading}
            className="px-5 py-2.5 bg-primary hover:bg-primary-hover disabled:bg-surface-2 disabled:text-muted rounded-lg font-medium transition-colors text-fg-on-primary"
          >
            {isLoading ? t("import.holyrics.step1.loading") : t("import.holyrics.step1.chooseFile")}
          </button>
        </div>
      </ImportWizardFrame>
    );
  }

  if (step === "preview") {
    return (
      <ImportWizardFrame
        title={t("import.holyrics.step2.title")}
        step={2}
        totalSteps={2}
        onBack={() => setStep("pick")}
        onNext={handleImport}
        onCancel={onCancel}
        nextLabel={
          isLoading
            ? t("import.holyrics.step2.importing")
            : t("import.holyrics.step2.nextLabel", { count: checkedCount })
        }
        nextDisabled={isLoading || checkedCount === 0}
      >
        <div className="space-y-2">
          {error && <p className="text-danger text-sm">{error}</p>}
          {rows.map((row, idx) => (
            <label
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                row.checked ? "bg-surface-2" : "bg-surface opacity-60"
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
                  <p className="text-sm text-muted truncate">
                    {row.song.artist}
                  </p>
                )}
                {row.isDuplicate && (
                  <p className="text-xs text-warning mt-0.5">
                    {t("import.holyrics.step2.duplicate")}
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
      title={t("import.holyrics.step3.title")}
      step={2}
      totalSteps={2}
      onCancel={onCancel}
    >
      <div className="flex flex-col items-center justify-center gap-6 py-8 text-center">
        {report && (
          <div className="space-y-1">
            <p className="text-lg font-semibold">
              {t("import.holyrics.step3.imported", { count: report.imported })}
            </p>
            {report.skipped > 0 && (
              <p className="text-muted text-sm">
                {t("import.holyrics.step3.skipped", { count: report.skipped })}
              </p>
            )}
            {report.failed.length > 0 && (
              <div className="text-left mt-3 space-y-1">
                <p className="text-danger text-sm font-medium">
                  {t("import.holyrics.step3.failures", { count: report.failed.length })}
                </p>
                {report.failed.map((f, i) => (
                  <p key={i} className="text-xs text-muted">
                    {f.title}: {f.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          onClick={onDone}
          className="px-5 py-2.5 bg-primary hover:bg-primary-hover rounded-lg font-medium transition-colors text-fg-on-primary"
        >
          {t("import.holyrics.step3.viewLibrary")}
        </button>
      </div>
    </ImportWizardFrame>
  );
};
