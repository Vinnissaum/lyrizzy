import React, { useState } from "react";
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
        console.warn("Mídia ignorada:", e.code, paths[i]);
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

  // Drop opens the file dialog since WebView doesn't expose native file paths
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
          ? "border-gray-700 cursor-default"
          : isDragging
          ? "border-blue-500 bg-blue-500/10 cursor-copy"
          : "border-gray-600 hover:border-gray-500 hover:bg-gray-800 cursor-pointer"
      }`}
    >
      {progress ? (
        <div className="space-y-2">
          <p className="text-gray-400 text-sm">
            Importando {progress.current}/{progress.total}…
          </p>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <>
          <Upload className="w-7 h-7 text-gray-500 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">
            Arraste arquivos ou{" "}
            <span className="text-blue-400">clique para selecionar</span>
          </p>
          <p className="text-gray-600 text-xs mt-1">
            PNG, JPG, WebP, GIF, MP4, WebM
          </p>
        </>
      )}
    </div>
  );
};
