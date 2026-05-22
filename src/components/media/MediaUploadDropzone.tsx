import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload } from "lucide-react";
import { importMedia, normalizeError } from "../../api/commands";

interface ImportResult {
  imported: number;
  skipped: number;
}

interface Props {
  onImportComplete: (result: ImportResult) => void;
}

const MEDIA_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "mp4", "webm"];

export const MediaUploadDropzone: React.FC<Props> = ({ onImportComplete }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const importFiles = async (paths: string[]) => {
    let imported = 0;
    let skipped = 0;
    setProgress({ current: 0, total: paths.length });
    for (let i = 0; i < paths.length; i++) {
      try {
        await importMedia(paths[i]);
        imported++;
      } catch (err) {
        const e = normalizeError(err);
        console.warn("media skipped:", e.code, paths[i]);
        skipped++;
      }
      setProgress({ current: i + 1, total: paths.length });
    }
    setProgress(null);
    onImportComplete({ imported, skipped });
  };

  const handlePickFiles = async () => {
    if (progress) return;
    const selected = await open({
      filters: [{ name: "Mídia", extensions: MEDIA_EXTENSIONS }],
      multiple: true,
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await importFiles(paths);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handlePickFiles();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={progress ? undefined : handlePickFiles}
      data-testid="upload-dropzone"
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
        progress
          ? "border-border cursor-default"
          : isDragging
          ? "border-primary bg-primary/10 cursor-copy"
          : "border-border hover:border-muted hover:bg-surface-2 cursor-pointer"
      }`}
    >
      {progress ? (
        <div className="space-y-2">
          <p className="text-muted text-sm">
            {t("media.dropzone.uploading", { current: progress.current, total: progress.total })}
          </p>
          <div className="w-full bg-surface-2 rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <>
          <Upload className="w-7 h-7 text-muted mx-auto mb-2" />
          <p className="text-muted text-sm">
            {t("media.dropzone.drop")}{" "}
            <span className="text-primary">{t("media.dropzone.clickToSelect")}</span>
          </p>
          <p className="text-muted text-xs mt-1">
            PNG, JPG, WebP, GIF, MP4, WebM
          </p>
        </>
      )}
    </div>
  );
};
