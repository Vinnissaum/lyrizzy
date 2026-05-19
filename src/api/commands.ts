import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Song } from "../types";

// ─── Window management ──────────────────────────────────────────────────────

export const openPresentationWindow = () =>
  invoke<void>("open_presentation_window");

// ─── Phase 0: counter demo ──────────────────────────────────────────────────

export const incrementCounter = () => invoke<number>("increment_counter");

// ─── Song CRUD ──────────────────────────────────────────────────────────────

export interface SectionPayload {
  label: string;
  type: Song["sections"][number]["type"];
  body: string;
  sortOrder: number;
  repeatCount?: number;
}

export interface CreateSongPayload {
  title: string;
  artist?: string;
  ccliNumber?: string;
  keySignature?: string;
  language?: string;
  notes?: string;
  backgroundId?: string;
  slideConfig?: string;
  source?: string;
  sections: SectionPayload[];
}

export interface UpdateSongPayload extends CreateSongPayload {
  id: string;
}

export interface ListSongsParams {
  search?: string;
  limit?: number;
  offset?: number;
}

export const createSong = (payload: CreateSongPayload) =>
  invoke<Song>("create_song", { payload });

export const updateSong = (payload: UpdateSongPayload) =>
  invoke<Song>("update_song", { payload });

export const deleteSong = (id: string) =>
  invoke<void>("delete_song", { id });

export const listSongs = (params?: ListSongsParams) =>
  invoke<Song[]>("list_songs", { params });

export const getSong = (id: string) =>
  invoke<Song>("get_song", { id });

// ─── Holyrics import ────────────────────────────────────────────────────────

export interface HolyricsSectionPayload {
  number: number;
  description: string;
  text: string;
}

export interface HolyricsSongPayload {
  title: string;
  artist: string;
  sections: HolyricsSectionPayload[];
}

export interface ParsedFileResult {
  songs: HolyricsSongPayload[];
  duplicateIndices: number[];
}

export interface FailedImport {
  title: string;
  reason: string;
}

export interface ImportReport {
  imported: number;
  skipped: number;
  failed: FailedImport[];
}

export const parseHolyricsFile = (path: string) =>
  invoke<ParsedFileResult>("parse_holyrics_file", { path });

export const importHolyricsBatch = (payload: HolyricsSongPayload[]) =>
  invoke<ImportReport>("import_holyrics_batch", { payload });

// ─── Text import ────────────────────────────────────────────────────────────

export interface ParsedTextSection {
  label: string;
  sectionType: string;
  body: string;
}

export const parsePlainTextImport = (input: string) =>
  invoke<ParsedTextSection[]>("parse_plain_text_import", { input });

// ─── Events ─────────────────────────────────────────────────────────────────

export const onSongsChanged = (cb: () => void) =>
  listen<void>("songs_changed", () => cb());

export const onCountdownTick = (cb: (remaining_ms: number) => void) =>
  listen<{ remaining_ms: number }>("countdown_tick", (e) =>
    cb(e.payload.remaining_ms)
  );
