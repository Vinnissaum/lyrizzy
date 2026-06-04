import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  ArchiveInspection,
  ExportProgress,
  ExportSummary,
  ImportPlan,
  ImportSummary,
  Resolution,
} from "../../api/commands";
import {
  exportLibrary,
  importArtifact,
  inspectArchive,
  onBackupProgress,
  planArtifactImport,
  restoreLibrary,
} from "../../api/commands";
import { ImportReviewModal } from "./ImportReviewModal";
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
      filters: [{ name: "Lyrizzy Backup", extensions: ["tlz"] }],
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
          <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="bg-success-bg border border-success rounded-lg p-3 text-xs space-y-0.5">
          <p className="text-success font-medium">{t("backup.export.success")}</p>
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
        <p className="text-xs text-danger bg-danger-bg border border-danger rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={handleExport}
        disabled={running}
        className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-fg-on-primary disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors self-start"
      >
        {running ? t("backup.export.running") : t("backup.export.button")}
      </button>
    </div>
  );
};

// ── Import card (unified: inspects any .tlz, routes by kind) ─────────────────────
//
// One entry point for every `.tlz`. It plans the import to learn the archive
// `kind`: a selective artifact (songs / set / settings) opens the conflict-review
// modal; a full-library backup falls through to the destructive Replace/Merge
// restore UI (SHARE-09). The selective importer is never invoked for a library file.

type ImportStep = "idle" | "inspecting" | "review" | "confirm" | "importing" | "done";

export const ImportCard: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<ImportStep>("idle");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [inspection, setInspection] = useState<ArchiveInspection | null>(null);
  const [archivePath, setArchivePath] = useState<string | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [confirmation, setConfirmation] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isLibrary, setIsLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("idle");
    setPlan(null);
    setInspection(null);
    setArchivePath(null);
    setConfirmation("");
    setSummary(null);
    setIsLibrary(false);
    setError(null);
    setMode("replace");
  };

  const handleSelectFile = async () => {
    setError(null);
    setSummary(null);
    const filePath = await open({
      filters: [{ name: "Lyrizzy (.tlz)", extensions: ["tlz"] }],
      multiple: false,
    });
    if (!filePath) return; // cancelled — silent no-op

    const path = typeof filePath === "string" ? filePath : filePath[0];
    setArchivePath(path);
    setStep("inspecting");
    try {
      const result = await planArtifactImport(path);
      if (result.kind === "library") {
        // Full-library backup → destructive restore flow. Enrich with the
        // manifest's exported-at / app-version for the confirmation summary.
        const info = await inspectArchive(path);
        setInspection(info);
        setIsLibrary(true);
        setStep("confirm");
      } else {
        setPlan(result);
        setIsLibrary(false);
        setStep("review");
      }
    } catch (err: unknown) {
      setError(String(err));
      setStep("idle");
    }
  };

  // Selective artifact: apply the operator's per-conflict resolutions.
  const handleApplyArtifact = async (resolutions: Resolution[]) => {
    if (!archivePath) return;
    setStep("importing");
    setError(null);
    const unlisten = await onBackupProgress(() => {});
    try {
      const result = await importArtifact(archivePath, resolutions);
      setSummary(result);
      setStep("done");
    } catch (err: unknown) {
      setError(String(err));
      setStep("review");
    } finally {
      (await unlisten)();
    }
  };

  // Full library: destructive restore.
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

  const confirmWord = t("backup.import.confirmWord");
  const replaceConfirmed = mode === "merge" || confirmation.trim().toUpperCase() === confirmWord;

  return (
    <div className="bg-surface rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          data-testid="cta-import"
          onClick={handleSelectFile}
          className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-fg-on-primary rounded-lg font-medium transition-colors self-start"
        >
          {t("backup.import.selectFile")}
        </button>
      )}

      {/* Inspecting */}
      {step === "inspecting" && (
        <p className="text-sm text-muted">{t("backup.import.reading")}</p>
      )}

      {/* Library restore confirm */}
      {step === "confirm" && inspection && (
        <div className="space-y-4">
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

          {mode === "replace" && (
            <div className="space-y-1.5">
              <p className="text-xs text-warning">{t("backup.import.typedConfirmHint")}</p>
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={confirmWord}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm placeholder-muted focus:outline-none focus:border-warning"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-danger bg-danger-bg border border-danger rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleRestore}
              disabled={!replaceConfirmed}
              className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-fg-on-primary disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
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
          {isLibrary ? t("backup.import.restoring") : t("artifact.import.running")}
        </div>
      )}

      {/* Done */}
      {step === "done" && summary && (
        <div className="space-y-3">
          <div className="bg-info-bg border border-info rounded-lg p-3 text-xs space-y-0.5">
            <p className="text-info font-medium">{t("backup.import.success")}</p>
            <p className="text-muted">
              {t("backup.import.successStats", {
                songs: summary.songsImported + summary.songsCopied + summary.songsOverwritten,
                sets: summary.setsImported + summary.setsCopied + summary.setsOverwritten,
                media: summary.mediaImported + summary.mediaCopied + summary.mediaOverwritten,
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
          {/* Selective import refreshes live via events; only a full restore needs a restart. */}
          {isLibrary && <p className="text-xs text-muted">{t("backup.import.restartHint")}</p>}
          <button onClick={reset} className="text-sm text-info hover:text-info transition-colors">
            {t("backup.import.importAnother")}
          </button>
        </div>
      )}

      {error && step !== "confirm" && step !== "review" && (
        <p className="text-xs text-danger bg-danger-bg border border-danger rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Selective conflict-review modal */}
      {(step === "review" || (step === "importing" && plan)) && plan && (
        <ImportReviewModal
          plan={plan}
          busy={step === "importing"}
          onConfirm={handleApplyArtifact}
          onCancel={reset}
        />
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
