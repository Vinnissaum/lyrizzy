import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  CountdownConfig,
  CountdownEndBehavior,
  CountdownState,
  ErrorPayload,
  Media,
  MediaItemOptions,
  MediaKind,
  MediaReferences,
  MonitorInfo,
  PresentationMode,
  PresentationState,
  ServiceSet,
  SetItem,
  Song,
  WebViewConfig,
} from "../types";

export function normalizeError(err: unknown): ErrorPayload {
  if (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    "params" in err &&
    typeof (err as ErrorPayload).code === "string"
  ) {
    return err as ErrorPayload;
  }
  return { code: "legacy", params: { message: String(err) } };
}

// ─── Window management ──────────────────────────────────────────────────────

export const openPresentationWindow = (monitorIndex?: number) =>
  invoke<void>("open_presentation_window", { monitorIndex });

export const listMonitors = () =>
  invoke<MonitorInfo[]>("list_monitors");

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
  scrimOpacity?: number;
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

// ─── Service Set CRUD ────────────────────────────────────────────────────────

export interface CreateSetPayload {
  name: string;
  serviceDate?: string;
  notes?: string;
}

export interface UpdateSetPayload {
  id: string;
  name: string;
  serviceDate?: string;
  notes?: string;
}

export interface AddSetItemPayload {
  setId: string;
  itemType: 'song' | 'media' | 'countdown' | 'web_view' | 'blank';
  songId?: string;
  mediaId?: string;
  mediaOptions?: MediaItemOptions;
  countdownConfig?: CountdownConfig;
  webViewConfig?: WebViewConfig;
}

export interface UpdateSetItemPayload {
  id: string;
  countdownConfig?: CountdownConfig;
  webViewConfig?: WebViewConfig;
  mediaOptions?: MediaItemOptions;
  notes?: string;
}

export const createSet = (payload: CreateSetPayload) =>
  invoke<ServiceSet>("create_set", { payload });

export const updateSet = (payload: UpdateSetPayload) =>
  invoke<ServiceSet>("update_set", { payload });

export const deleteSet = (id: string) =>
  invoke<void>("delete_set", { id });

export const listSets = () =>
  invoke<ServiceSet[]>("list_sets");

export const getSet = (id: string) =>
  invoke<ServiceSet>("get_set", { id });

export const addSetItem = (payload: AddSetItemPayload) =>
  invoke<SetItem>("add_set_item", { payload });

export const removeSetItem = (itemId: string) =>
  invoke<void>("remove_set_item", { itemId });

export const reorderSetItems = (setId: string, itemIds: string[]) =>
  invoke<ServiceSet>("reorder_set_items", { setId, itemIds });

export const updateSetItem = (payload: UpdateSetItemPayload) =>
  invoke<SetItem>("update_set_item", { payload });

export const duplicateSetItem = (itemId: string) =>
  invoke<SetItem>("duplicate_set_item", { itemId });

// ─── Presentation control ────────────────────────────────────────────────────

export const loadSetForPresentation = (setId: string) =>
  invoke<PresentationState>("load_set_for_presentation", { setId });

export const nextSlide = () =>
  invoke<PresentationState>("next_slide");

export const prevSlide = () =>
  invoke<PresentationState>("prev_slide");

export const goToItem = (itemIndex: number, slideIndex?: number) =>
  invoke<PresentationState>("go_to_item", { itemIndex, slideIndex });

export const setPresentationMode = (mode: PresentationMode) =>
  invoke<PresentationState>("set_presentation_mode", { mode });

export const getPresentationState = () =>
  invoke<PresentationState>("get_presentation_state");

// ─── Media library ───────────────────────────────────────────────────────────

export interface ListMediaParams {
  kind?: MediaKind;
  search?: string;
  limit?: number;
  offset?: number;
}

export const importMedia = (sourcePath: string) =>
  invoke<Media>("import_media", { sourcePath });

export const listMedia = (params?: ListMediaParams) =>
  invoke<Media[]>("list_media", { params });

export const renameMedia = (id: string, displayName: string) =>
  invoke<Media>("rename_media", { id, displayName });

export const deleteMedia = (id: string) =>
  invoke<void>("delete_media", { id });

export const getMediaReferences = (id: string) =>
  invoke<MediaReferences>("get_media_references", { id });

export const onMediaLibraryChanged = (cb: () => void) =>
  listen<void>("media_library_changed", () => cb());

// ─── Countdown timer ─────────────────────────────────────────────────────────

export const setCountdownDuration = (durationMs: number) =>
  invoke<CountdownState>("set_countdown_duration", { durationMs });

export interface StartCountdownParams {
  durationMs?: number;
  message?: string;
  endBehavior?: CountdownEndBehavior;
  [key: string]: unknown;
}

export const startCountdown = (params?: StartCountdownParams) =>
  invoke<CountdownState>("start_countdown", params ?? {});

export const pauseCountdown = () =>
  invoke<CountdownState>("pause_countdown");

export const resetCountdown = () =>
  invoke<CountdownState>("reset_countdown");

export const getCountdownState = () =>
  invoke<CountdownState>("get_countdown_state");

// ─── Events ─────────────────────────────────────────────────────────────────

export const onSongsChanged = (cb: () => void) =>
  listen<void>("songs_changed", () => cb());

export const onSetChanged = (cb: () => void) =>
  listen<void>("set_changed", () => cb());

export const onStateChanged = (cb: (state: PresentationState) => void) =>
  listen<PresentationState>("state_changed", (e) => cb(e.payload));

export const onCountdownTick = (cb: (state: CountdownState) => void) =>
  listen<CountdownState>("countdown_tick", (e) => cb(e.payload));
