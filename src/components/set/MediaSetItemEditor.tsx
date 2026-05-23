import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { updateSetItem } from "../../api/commands";
import { useMediaStore } from "../../stores/media";
import { mediaUrl } from "../../api/assets";
import { NotesField } from "../common/NotesField";
import type { MediaItemOptions, SetItem } from "../../types";

const DEFAULT_OPTS: MediaItemOptions = { loop: false, mute: false, autoAdvanceOnEnd: true };

interface Props {
  item: SetItem;
}

export const MediaSetItemEditor: React.FC<Props> = ({ item }) => {
  const { t } = useTranslation();
  const { media } = useMediaStore();
  const [opts, setOpts] = useState<MediaItemOptions>(item.mediaOptions ?? DEFAULT_OPTS);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOpts(item.mediaOptions ?? DEFAULT_OPTS);
    setNotes(item.notes ?? "");
  }, [item.id]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      updateSetItem({ id: item.id, notes: value || undefined }).catch(console.error);
    }, 300);
  };

  const selectedMedia = item.mediaId ? media.find((m) => m.id === item.mediaId) : undefined;

  const saveOpts = async (newOpts: MediaItemOptions) => {
    setOpts(newOpts);
    setSaving(true);
    try {
      await updateSetItem({ id: item.id, mediaOptions: newOpts });
    } catch (err) {
      console.error("save media opts failed:", err);
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
              src={mediaUrl(selectedMedia.thumbnailFile ?? selectedMedia.fileName)}
              alt=""
              className="w-12 h-8 object-cover rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs truncate">{selectedMedia.displayName}</p>
            <p className="text-xs text-muted">
              {t(`media.type.${selectedMedia.kind}`)}
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
              className="accent-primary"
            />
            <span className="text-sm">{t("media.editor.loop")}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={opts.mute}
              onChange={(e) => saveOpts({ ...opts, mute: e.target.checked })}
              className="accent-primary"
            />
            <span className="text-sm">{t("media.editor.mute")}</span>
          </label>

          {!opts.loop && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={opts.autoAdvanceOnEnd}
                onChange={(e) =>
                  saveOpts({ ...opts, autoAdvanceOnEnd: e.target.checked })
                }
                className="accent-primary"
              />
              <span className="text-sm">{t("media.editor.autoAdvance")}</span>
            </label>
          )}
        </div>
      )}

      {item.mediaKind === "image" && (
        <p className="text-xs text-muted">
          {t("media.editor.imageNote")}
        </p>
      )}

      {saving && <p className="text-xs text-muted">{t("media.editor.saving")}</p>}

      <div>
        <p className="text-xs text-muted mb-1">{t("builder.itemNotes.label")}</p>
        <NotesField value={notes} onChange={handleNotesChange} placeholder={t("builder.itemNotes.placeholder")} />
      </div>
    </div>
  );
};
