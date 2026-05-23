import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Upload } from "lucide-react";
import { useMediaStore } from "../../stores/media";
import { FfmpegBanner } from "./FfmpegBanner";
import { LibreOfficeBanner } from "./LibreOfficeBanner";
import { MediaCard } from "./MediaCard";
import { MediaUploadDropzone } from "./MediaUploadDropzone";
import { MediaDetailPanel } from "./MediaDetailPanel";
import type { Media, MediaKind } from "../../types";

interface ImportToast {
  imported: number;
  skipped: number;
}

export const MediaLibrary: React.FC = () => {
  const { t } = useTranslation();
  const { media, isLoading, filter, search, setFilter, setSearch, subscribe } =
    useMediaStore();

  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [showDropzone, setShowDropzone] = useState(false);
  const [toast, setToast] = useState<ImportToast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    const unsub = subscribe();
    return () => {
      unsub.then((u) => u());
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(value);
    }, 150);
  };

  const handleFilterClick = (kind: MediaKind | undefined) => {
    setFilter(kind);
  };

  const handleCardClick = (item: Media) => {
    setSelectedMedia((prev) => (prev?.id === item.id ? null : item));
  };

  const handleImportComplete = ({
    imported,
    skipped,
  }: {
    imported: number;
    skipped: number;
  }) => {
    setShowDropzone(false);
    setToast({ imported, skipped });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  const filterOptions: { labelKey: string; value: MediaKind | undefined }[] = [
    { labelKey: "media.filter.all", value: undefined },
    { labelKey: "media.filter.images", value: "image" },
    { labelKey: "media.filter.videos", value: "video" },
  ];

  const selectedMediaUpdated = selectedMedia
    ? (media.find((m) => m.id === selectedMedia.id) ?? null)
    : null;

  return (
    <div className="flex h-full min-h-0">
      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold flex-1">{t("media.title")}</h2>
            <button
              onClick={() => setShowDropzone((v) => !v)}
              data-testid="add-media-button"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-fg-on-primary rounded-lg font-medium transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {t("media.addButton")}
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 mb-3">
            {filterOptions.map((opt) => (
              <button
                key={opt.labelKey}
                onClick={() => handleFilterClick(opt.value)}
                data-testid={`filter-${opt.value ?? "all"}`}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  filter === opt.value
                    ? "bg-primary text-fg-on-primary"
                    : "bg-surface-2 text-muted hover:bg-border"
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              type="search"
              value={localSearch}
              onChange={handleSearchChange}
              placeholder={t("media.searchPlaceholder")}
              data-testid="search-input"
              className="w-full pl-8 pr-3 py-2 bg-surface border border-border rounded-lg text-sm placeholder-muted focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* tool availability warnings */}
        <FfmpegBanner />
        <LibreOfficeBanner />

        {/* Toast */}
        {toast && (
          <div
            data-testid="import-toast"
            className="mx-4 mt-3 px-4 py-2.5 bg-surface border border-border rounded-lg text-sm shrink-0"
          >
            {t("media.importToast", { count: toast.imported })}
            {toast.skipped > 0 && `, ${t("media.importToastSkipped", { count: toast.skipped })}`}
          </div>
        )}

        {/* Dropzone */}
        {showDropzone && (
          <div className="px-4 pt-3 shrink-0">
            <MediaUploadDropzone onImportComplete={handleImportComplete} />
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-muted text-sm text-center py-12">
              {t("loading")}
            </p>
          ) : media.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 gap-4"
              data-testid="empty-state"
            >
              <p className="text-muted text-sm">{t("media.empty")}</p>
              <button
                onClick={() => setShowDropzone(true)}
                data-testid="cta-add-media"
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-fg-on-primary rounded-lg text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4" />
                {t("media.addButton")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {media.map((item) => (
                <MediaCard
                  key={item.id}
                  media={item}
                  onClick={handleCardClick}
                  isSelected={selectedMedia?.id === item.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedMediaUpdated && (
        <MediaDetailPanel
          media={selectedMediaUpdated}
          onClose={() => setSelectedMedia(null)}
        />
      )}
    </div>
  );
};
