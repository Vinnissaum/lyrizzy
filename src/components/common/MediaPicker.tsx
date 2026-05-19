import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMediaStore } from "../../stores/media";
import type { Media, MediaKind } from "../../types";

interface Props {
  value?: string;
  kind?: MediaKind;
  onSelect: (media: Media | null) => void;
  label?: string;
}

function buildThumbUrl(m: Media): string {
  if (m.kind === "video" && m.thumbnailFile) {
    return `asset://localhost/media/${m.thumbnailFile}`;
  }
  return `asset://localhost/media/${m.fileName}`;
}

export const MediaPicker: React.FC<Props> = ({
  value,
  kind,
  onSelect,
  label,
}) => {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t("media.picker.defaultLabel");
  const { media, refresh } = useMediaStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const filtered = kind ? media.filter((m) => m.kind === kind) : media;
  const selected = value ? media.find((m) => m.id === value) : undefined;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors w-full text-left"
      >
        {selected ? (
          <>
            <img
              src={buildThumbUrl(selected)}
              alt=""
              className="w-8 h-5 object-cover rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="flex-1 truncate text-white">{selected.displayName}</span>
            <button
              type="button"
              className="text-gray-400 hover:text-red-400 ml-1"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              title={t("editor.bg.remove")}
            >
              ✕
            </button>
          </>
        ) : (
          <span className="text-gray-400">{resolvedLabel}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 rounded-xl shadow-2xl w-[520px] max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-white">{resolvedLabel}</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2">
              {filtered.length === 0 ? (
                <p className="col-span-3 text-center text-gray-500 py-8 text-sm">
                  {t("media.picker.noMedia")}
                </p>
              ) : (
                filtered.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onSelect(m);
                      setOpen(false);
                    }}
                    className={`flex flex-col rounded-lg overflow-hidden border-2 transition-colors ${
                      m.id === value
                        ? "border-blue-500"
                        : "border-transparent hover:border-gray-600"
                    }`}
                  >
                    <div className="aspect-video bg-gray-800 relative">
                      <img
                        src={buildThumbUrl(m)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      {m.kind === "video" && (
                        <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1 rounded">
                          VIDEO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-300 truncate px-1 py-1">
                      {m.displayName}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
