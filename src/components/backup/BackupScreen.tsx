import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  ArchiveInspection,
  ExportProgress,
  ExportSummary,
  ImportSummary,
} from "../../api/commands";
import {
  exportLibrary,
  inspectArchive,
  onBackupProgress,
  restoreLibrary,
} from "../../api/commands";
import { formatBytes } from "../media/MediaCard";
import { formatDatetime } from "../../utils/format";

// ── Export card ───────────────────────────────────────────────────────────────

const ExportCard: React.FC = () => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const handleExport = async () => {
    setError(null);
    setSummary(null);

    const outPath = await save({
      filters: [{ name: "Trinity Lyrics Backup", extensions: ["tlz"] }],
      defaultPath: `backup-${new Date().toISOString().slice(0, 10)}.tlz`,
    });
    if (!outPath) return;

    setRunning(true);
    setProgress({ currentFile: "", filesDone: 0, filesTotal: 1 });

    const unlisten = await onBackupProgress((p) => setProgress(p));
    try {
      const result = await exportLibrary(outPath);
      setSummary(result);
      setProgress(null);
    } catch (err: unknown) {
      setError(String(err));
      setProgress(null);
    } finally {
      (await unlisten)();
      setRunning(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold">{t("backup.export.title")}</h3>
          <p className="text-xs text-muted">{t("backup.export.subtitle")}</p>
        </div>
      </div>

      {progress && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted">
            <span className="truncate max-w-xs">{progress.currentFile || t("backup.export.preparing")}</span>
            <span>{progress.filesDone}/{progress.filesTotal}</span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress.filesTotal > 0 ? Math.round((progress.filesDone / progress.filesTotal) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {summary && (
        <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-lg p-3 text-xs space-y-0.5">
          <p className="text-emerald-300 font-medium">{t("backup.export.success")}</p>
          <p className="text-muted">
            {t("backup.export.stats", {
              songs: summary.counts.songs,
              sets: summary.counts.sets,
              media: summary.counts.media,
            })}
          </p>
          <p className="text-muted">{formatBytes(summary.byteSize)} · {summary.outPath}</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={handleExport}
        disabled={running}
        className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors self-start"
      >
        {running ? t("backup.export.running") : t("backup.export.button")}
      </button>
    </div>
  );
};

// ── Import card ───────────────────────────────────────────────────────────────

type ImportStep = "idle" | "inspecting" | "confirm" | "importing" | "done";

const ImportCard: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<ImportStep>("idle");
  const [inspection, setInspection] = useState<ArchiveInspection | null>(null);
  const [archivePath, setArchivePath] = useState<string | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [confirmation, setConfirmation] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = async () => {
    setError(null);
    const filePath = await open({
      filters: [{ name: "Trinity Lyrics Backup", extensions: ["tlz"] }],
      multiple: false,
    });
    if (!filePath) return;

    const path = typeof filePath === "string" ? filePath : filePath[0];
    setStep("inspecting");
    setArchivePath(path);

    try {
      const info = await inspectArchive(path);
      setInspection(info);
      setStep("confirm");
    } catch (err: unknown) {
      setError(String(err));
      setStep("idle");
    }
  };

  const handleRestore = async () => {
    if (!archivePath) return;
    setStep("importing");
    setError(null);

    try {
      const result = await restoreLibrary(archivePath, mode);
      setSummary(result);
      setStep("done");
    } catch (err: unknown) {
      setError(String(err));
      setStep("confirm");
    }
  };

  const reset = () => {
    setStep("idle");
    setInspection(null);
    setArchivePath(null);
    setConfirmation("");
    setSummary(null);
    setError(null);
    setMode("replace");
  };

  const confirmWord = t("backup.import.confirmWord");
  const replaceConfirmed = mode === "merge" || confirmation.trim().toUpperCase() === confirmWord;

  return (
    <div className="bg-surface rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold">{t("backup.import.title")}</h3>
          <p className="text-xs text-muted">{t("backup.import.subtitle")}</p>
        </div>
      </div>

      {/* Idle */}
      {step === "idle" && (
        <button
          onClick={handleSelectFile}
          className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors self-start"
        >
          {t("backup.import.selectFile")}
        </button>
      )}

      {/* Inspecting */}
      {step === "inspecting" && (
        <p className="text-sm text-muted">{t("backup.import.reading")}</p>
      )}

      {/* Confirm */}
      {step === "confirm" && inspection && (
        <div className="space-y-4">
          {/* Inspection summary */}
          <div className="bg-surface-2 rounded-lg p-3 text-xs space-y-1">
            <p className="font-medium">{t("backup.import.fileContent")}</p>
            <p className="text-muted">{t("backup.import.exportedAt", { date: formatDatetime(inspection.exportedAt) })}</p>
            <p className="text-muted">{t("backup.import.appVersion", { version: inspection.appVersion })}</p>
            <p className="text-muted">
              {t("backup.import.stats", {
                songs: inspection.counts.songs,
                sets: inspection.counts.sets,
                media: inspection.counts.media,
              })}
            </p>
          </div>

          {/* Mode picker */}
          <div className="space-y-2">
            <p className="text-xs font-medium">{t("backup.import.restoreMode")}</p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="replace"
                checked={mode === "replace"}
                onChange={() => { setMode("replace"); setConfirmation(""); }}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-medium">{t("backup.import.modeReplace.title")}</span>
                <span className="text-muted ml-1">{t("backup.import.modeReplace.desc")}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="merge"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-medium">{t("backup.import.modeMerge.title")}</span>
                <span className="text-muted ml-1">{t("backup.import.modeMerge.desc")}</span>
              </span>
            </label>
          </div>

          {/* Typed confirmation for Replace */}
          {mode === "replace" && (
            <div className="space-y-1.5">
              <p className="text-xs text-amber-400">
                {t("backup.import.typedConfirmHint")}
              </p>
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={confirmWord}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm placeholder-muted focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleRestore}
              disabled={!replaceConfirmed}
              className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {t("backup.import.restoreButton")}
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 text-sm text-muted hover:text-inherit transition-colors"
            >
              {t("backup.import.cancelButton")}
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === "importing" && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {t("backup.import.restoring")}
        </div>
      )}

      {/* Done */}
      {step === "done" && summary && (
        <div className="space-y-3">
          <div className="bg-blue-900/30 border border-blue-700/40 rounded-lg p-3 text-xs space-y-0.5">
            <p className="text-blue-300 font-medium">{t("backup.import.success")}</p>
            <p className="text-muted">
              {t("backup.import.successStats", {
                songs: summary.songsImported,
                sets: summary.setsImported,
                media: summary.mediaImported,
              })}
            </p>
            {(summary.songsSkipped > 0 || summary.mediaSkipped > 0 || summary.mediaFailed > 0) && (
              <p className="text-muted">
                {t("backup.import.skippedStats", {
                  songs: summary.songsSkipped,
                  media: summary.mediaSkipped,
                  failures: summary.mediaFailed,
                })}
              </p>
            )}
          </div>
          <p className="text-xs text-muted">{t("backup.import.restartHint")}</p>
          <button onClick={reset} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            {t("backup.import.importAnother")}
          </button>
        </div>
      )}
    </div>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────

export const BackupScreen: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">{t("backup.title")}</h2>
          <p className="text-sm text-muted mt-1">{t("backup.subtitle")}</p>
        </div>
        <ExportCard />
        <ImportCard />
      </div>
    </div>
  );
};
