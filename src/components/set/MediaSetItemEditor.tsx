import React, { useEffect, useState } from "react";
import { updateSetItem } from "../../api/commands";
import { useMediaStore } from "../../stores/media";
import type { MediaItemOptions, SetItem } from "../../types";

const DEFAULT_OPTS: MediaItemOptions = { loop: false, mute: false, autoAdvanceOnEnd: true };

interface Props {
  item: SetItem;
}

export const MediaSetItemEditor: React.FC<Props> = ({ item }) => {
  const { media } = useMediaStore();
  const [opts, setOpts] = useState<MediaItemOptions>(item.mediaOptions ?? DEFAULT_OPTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOpts(item.mediaOptions ?? DEFAULT_OPTS);
  }, [item.id]);

  const selectedMedia = item.mediaId ? media.find((m) => m.id === item.mediaId) : undefined;

  const saveOpts = async (newOpts: MediaItemOptions) => {
    setOpts(newOpts);
    setSaving(true);
    try {
      await updateSetItem({ id: item.id, mediaOptions: newOpts });
    } catch (err) {
      console.error("Falha ao salvar opções de mídia:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 space-y-3">
      {selectedMedia && (
        <div className="flex items-center gap-2">
          {selectedMedia.thumbnailFile || selectedMedia.kind === "image" ? (
            <img
              src={`asset://localhost/media/${selectedMedia.thumbnailFile ?? selectedMedia.fileName}`}
              alt=""
              className="w-12 h-8 object-cover rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs text-white truncate">{selectedMedia.displayName}</p>
            <p className="text-xs text-gray-500">
              {selectedMedia.kind === "video" ? "Vídeo" : "Imagem"}
              {selectedMedia.durationMs
                ? ` · ${Math.round(selectedMedia.durationMs / 1000)}s`
                : ""}
            </p>
          </div>
        </div>
      )}

      {item.mediaKind === "video" && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.loop}
              onChange={(e) => saveOpts({ ...opts, loop: e.target.checked })}
              className="accent-blue-500"
            />
            <span className="text-sm text-gray-300">Repetir (loop)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.mute}
              onChange={(e) => saveOpts({ ...opts, mute: e.target.checked })}
              className="accent-blue-500"
            />
            <span className="text-sm text-gray-300">Silenciar</span>
          </label>

          {!opts.loop && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={opts.autoAdvanceOnEnd}
                onChange={(e) =>
                  saveOpts({ ...opts, autoAdvanceOnEnd: e.target.checked })
                }
                className="accent-blue-500"
              />
              <span className="text-sm text-gray-300">Avançar ao terminar</span>
            </label>
          )}
        </div>
      )}

      {item.mediaKind === "image" && (
        <p className="text-xs text-gray-500">
          Imagem — avança ao pressionar Próximo.
        </p>
      )}

      {saving && <p className="text-xs text-gray-500">Salvando…</p>}
    </div>
  );
};
