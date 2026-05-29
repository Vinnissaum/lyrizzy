import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  parsePlainTextImport,
  createSong,
  ParsedTextSection,
} from "../../api/commands";
import { ImportWizardFrame } from "./ImportWizardFrame";
import type { SectionType } from "../../types";

const SECTION_TYPE_VALUES = [
  "verse",
  "chorus",
  "bridge",
  "pre_chorus",
  "outro",
  "interlude",
  "tag",
] as const;

interface EditableSection extends ParsedTextSection {
  key: string;
}

interface Props {
  onImported: (songId: string) => void;
  onCancel: () => void;
}

export const PlainTextImport: React.FC<Props> = ({ onImported, onCancel }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleNext = async () => {
    if (!songTitle.trim()) {
      setError(t("import.plain.errors.titleRequired"));
      return;
    }
    if (!lyrics.trim()) {
      setError(t("import.plain.errors.lyricsRequired"));
      return;
    }
    setError("");
    setIsParsing(true);
    try {
      const parsed = await parsePlainTextImport(lyrics);
      setSections(
        parsed.map((s, i) => ({ ...s, key: `sec-${i}` }))
      );
      setStep(2);
    } catch (err) {
      setError(t("import.plain.errors.parseFailed", { err: String(err) }));
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    setIsSaving(true);
    try {
      const song = await createSong({
        title: songTitle.trim(),
        artist: artist.trim() || undefined,
        sections: sections.map((s, i) => ({
          label: s.label,
          type: s.sectionType as SectionType,
          body: s.body,
          sortOrder: i,
          repeatCount: 1,
        })),
      });
      onImported(song.id);
    } catch (err) {
      setError(t("import.plain.errors.importFailed", { err: String(err) }));
    } finally {
      setIsSaving(false);
    }
  };

  const updateSection = (key: string, patch: Partial<EditableSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s))
    );
  };

  if (step === 1) {
    return (
      <ImportWizardFrame
        title={t("import.plain.step1.title")}
        step={1}
        totalSteps={2}
        onNext={handleNext}
        onCancel={onCancel}
        nextLabel={isParsing ? t("import.plain.step1.processing") : t("import.plain.step1.nextLabel")}
        nextDisabled={isParsing || !songTitle.trim() || !lyrics.trim()}
      >
        <div className="space-y-4">
          {error && <p className="text-danger text-sm">{error}</p>}

          <div>
            <label className="block text-sm text-muted mb-1">
              {t("import.plain.step1.titleLabel")}
            </label>
            <input
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder={t("import.plain.step1.titlePlaceholder")}
              className="w-full bg-surface-2 border border-border text-fg rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">
              {t("import.plain.step1.artistLabel")}
            </label>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder={t("import.plain.step1.artistPlaceholder")}
              className="w-full bg-surface-2 border border-border text-fg rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">
              {t("import.plain.step1.lyricsLabel")}
            </label>
            <p className="text-xs text-muted mb-2">
              {t("import.plain.step1.lyricsHint")}
            </p>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder={t("import.plain.step1.lyricsPlaceholder")}
              rows={14}
              className="w-full bg-surface-2 border border-border text-fg rounded-lg px-3 py-2 font-mono text-sm resize-y focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </ImportWizardFrame>
    );
  }

  return (
    <ImportWizardFrame
      title={t("import.plain.step2.title")}
      step={2}
      totalSteps={2}
      onBack={() => setStep(1)}
      onNext={handleImport}
      onCancel={onCancel}
      nextLabel={isSaving ? t("import.plain.step2.importing") : t("import.plain.step2.nextLabel")}
      nextDisabled={isSaving}
    >
      <div className="space-y-3">
        {error && <p className="text-danger text-sm">{error}</p>}
        {sections.map((section) => (
          <div
            key={section.key}
            className="bg-surface-2 rounded-lg p-3 space-y-2"
          >
            <div className="flex gap-2">
              <input
                value={section.label}
                onChange={(e) =>
                  updateSection(section.key, { label: e.target.value })
                }
                className="flex-1 text-sm bg-surface border border-border text-fg rounded px-2 py-1 focus:outline-none focus:border-primary"
              />
              <select
                value={section.sectionType}
                onChange={(e) =>
                  updateSection(section.key, { sectionType: e.target.value })
                }
                className="text-sm bg-surface border border-border text-fg rounded px-2 py-1"
              >
                {SECTION_TYPE_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {t(`sectionTypes.${v}`)}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={section.body}
              onChange={(e) =>
                updateSection(section.key, { body: e.target.value })
              }
              rows={3}
              className="w-full text-sm bg-surface border border-border text-fg rounded px-2 py-1.5 font-mono resize-y focus:outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>
    </ImportWizardFrame>
  );
};
