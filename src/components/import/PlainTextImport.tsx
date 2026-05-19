import React, { useState } from "react";
import {
  parsePlainTextImport,
  createSong,
  ParsedTextSection,
} from "../../api/commands";
import { ImportWizardFrame } from "./ImportWizardFrame";
import type { SectionType } from "../../types";

const SECTION_TYPE_LABELS: Record<string, string> = {
  verse: "Estrofe",
  chorus: "Refrão",
  bridge: "Ponte",
  pre_chorus: "Pré-refrão",
  outro: "Final",
  interlude: "Interlúdio",
  tag: "Tag",
};

interface EditableSection extends ParsedTextSection {
  key: string;
}

interface Props {
  onImported: (songId: string) => void;
  onCancel: () => void;
}

export const PlainTextImport: React.FC<Props> = ({ onImported, onCancel }) => {
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
      setError("Título é obrigatório");
      return;
    }
    if (!lyrics.trim()) {
      setError("Cole a letra da música");
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
      setError(`Falha ao processar letra: ${err}`);
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
      setError(`Falha ao importar: ${err}`);
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
        title="Importar letra"
        step={1}
        totalSteps={2}
        onNext={handleNext}
        onCancel={onCancel}
        nextLabel={isParsing ? "Processando…" : "Pré-visualizar"}
        nextDisabled={isParsing || !songTitle.trim() || !lyrics.trim()}
      >
        <div className="space-y-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Título *
            </label>
            <input
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              placeholder="Nome da música"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Artista (opcional)
            </label>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Nome do artista ou banda"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Letra
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Cole a letra aqui. Use linhas em branco para separar seções.
              Use colchetes para nomear seções: [Refrão], [Ponte], etc.
            </p>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Cole a letra aqui…"
              rows={14}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 font-mono text-sm resize-y focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </ImportWizardFrame>
    );
  }

  return (
    <ImportWizardFrame
      title="Pré-visualizar seções"
      step={2}
      totalSteps={2}
      onBack={() => setStep(1)}
      onNext={handleImport}
      onCancel={onCancel}
      nextLabel={isSaving ? "Importando…" : "Importar"}
      nextDisabled={isSaving}
    >
      <div className="space-y-3">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {sections.map((section) => (
          <div
            key={section.key}
            className="bg-gray-800 rounded-lg p-3 space-y-2"
          >
            <div className="flex gap-2">
              <input
                value={section.label}
                onChange={(e) =>
                  updateSection(section.key, { label: e.target.value })
                }
                className="flex-1 text-sm bg-gray-700 border border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              />
              <select
                value={section.sectionType}
                onChange={(e) =>
                  updateSection(section.key, { sectionType: e.target.value })
                }
                className="text-sm bg-gray-700 border border-gray-600 rounded px-2 py-1"
              >
                {Object.entries(SECTION_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
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
              className="w-full text-sm bg-gray-700 border border-gray-600 rounded px-2 py-1.5 font-mono resize-y focus:outline-none focus:border-blue-500"
            />
          </div>
        ))}
      </div>
    </ImportWizardFrame>
  );
};
