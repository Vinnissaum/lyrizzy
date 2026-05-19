import React from "react";
import { Film, Image } from "lucide-react";
import type { Media } from "../../types";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

interface Props {
  media: Media;
  onClick: (media: Media) => void;
  isSelected?: boolean;
}

export const MediaCard: React.FC<Props> = ({ media, onClick, isSelected }) => {
  const thumbUrl = media.thumbnailFile
    ? `http://asset.localhost/media/${media.thumbnailFile}`
    : media.kind === "image"
    ? `http://asset.localhost/media/${media.fileName}`
    : null;

  return (
    <button
      onClick={() => onClick(media)}
      data-testid={`media-card-${media.id}`}
      className={`group relative aspect-video rounded-lg overflow-hidden border-2 transition-all bg-gray-800 w-full ${
        isSelected
          ? "border-blue-500"
          : "border-transparent hover:border-gray-600"
      }`}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={media.displayName}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-gray-600">
          <Film className="w-10 h-10" />
        </div>
      )}

      {/* Bottom label */}
      <div className="absolute bottom-0 inset-x-0 bg-black/70 px-2 py-1.5 text-left">
        <p className="text-xs text-white truncate leading-tight">
          {media.displayName}
        </p>
        <p className="text-xs text-gray-400">{formatBytes(media.byteSize)}</p>
      </div>

      {/* Kind badge */}
      <div className="absolute top-1.5 left-1.5">
        <span
          className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-medium ${
            media.kind === "video"
              ? "bg-purple-700 text-white"
              : "bg-blue-700 text-white"
          }`}
        >
          {media.kind === "video" ? (
            <Film className="w-3 h-3" />
          ) : (
            <Image className="w-3 h-3" />
          )}
          {media.kind === "video" ? "Vídeo" : "Imagem"}
        </span>
      </div>
    </button>
  );
};
