import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import type {
  CountdownConfig,
  CountdownEndBehavior,
  CountdownPosition,
  CountdownState,
  CountdownTarget,
  CountdownTriggeredPayload,
  ErrorPayload,
  KeyBindings,
  Media,
  MediaItemOptions,
  MediaKind,
  MediaReferences,
  MonitorInfo,
  OutputId,
  PresentationMode,
  PresentationState,
  ScheduledStart,
  ServiceSet,
  SetItem,
  Song,
  StreamSource,
  TextCasing,
  UpdateInfo,
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

/** Settings key for the operator's saved presentation-monitor choice (output One). */
export const PRESENTATION_MONITOR_KEY = "presentation.monitor_index";
/** Settings key for output Two's saved monitor choice. */
export const OUTPUT2_MONITOR_KEY = "output2.monitor_index";

/** Map a window label to its output id, or null for non-presentation windows. */
export const outputFromWindowLabel = (label: string): OutputId | null =>
  label === "presentation" ? "one" : label === "presentation-2" ? "two" : null;

/**
 * Enter presentation mode. Pass `monitorIndex` to force a specific monitor.
 * When omitted, the saved operator preference (`presentation.monitor_index`)
 * is used; if that's unset/"auto", the backend auto-detects the secondary
 * monitor. This means every existing call site honours the monitor picker.
 */
export const enterPresentation = async (
  output: OutputId = "one",
  monitorIndex?: number,
): Promise<void> => {
  let idx = monitorIndex;
  if (idx === undefined) {
    try {
      const key = output === "two" ? OUTPUT2_MONITOR_KEY : PRESENTATION_MONITOR_KEY;
      const stored = await getSetting(key);
      if (stored && stored !== "auto") {
        const n = parseInt(stored, 10);
        if (!Number.isNaN(n)) idx = n;
      }
    } catch {
      // Setting missing → auto-detect.
    }
  }
  return invoke<void>("enter_presentation", { output, monitorIndex: idx ?? null });
};

/** Kept for any ActionId bindings that still reference the old name. */
export const openPresentationWindow = () => enterPresentation();

const exitInflight: Partial<Record<OutputId, Promise<void>>> = {};
export const exitPresentation = (output: OutputId = "one"): Promise<void> => {
  const pending = exitInflight[output];
  if (pending) return pending;
  const p = invoke<void>("exit_presentation", { output }).finally(() => {
    exitInflight[output] = undefined;
  });
  exitInflight[output] = p;
  return p;
};

export const onPresentationLifecycle = (
  cb: (phase: "entered" | "exited", output: OutputId) => void
) =>
  listen<{ phase: "entered" | "exited"; output: OutputId }>(
    "presentation_lifecycle",
    (e) => cb(e.payload.phase, e.payload.output)
  );

export const listMonitors = () =>
  invoke<MonitorInfo[]>("list_monitors");

// ─── Song CRUD ──────────────────────────────────────────────────────────────

export interface SectionPayload {
  label: string;
  type: Song["sections"][number]["type"];
  body: string;
  sortOrder: number;
  repeatCount?: number;
  notes?: string;
  backgroundId?: string;
  backgroundMode?: string;
  backgroundPreset?: string;
  fontFamily?: string;
  fontSize?: string;
}

export interface CreateSongPayload {
  title: string;
  artist?: string;
  author?: string;
  copyright?: string;
  ccliNumber?: string;
  keySignature?: string;
  language?: string;
  notes?: string;
  backgroundId?: string;
  scrimOpacity?: number;
  slideConfig?: string;
  source?: string;
  backgroundMode?: string;
  backgroundPreset?: string;
  fontFamily?: string;
  fontSize?: string;
  textCasing?: TextCasing;
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
  itemType: 'song' | 'media' | 'countdown' | 'web_view' | 'blank' | 'slide_show';
  songId?: string;
  mediaId?: string;
  mediaOptions?: MediaItemOptions;
  countdownConfig?: CountdownConfig;
  webviewConfig?: WebViewConfig;
}

export interface UpdateSetItemPayload {
  id: string;
  countdownConfig?: CountdownConfig;
  webviewConfig?: WebViewConfig;
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

export const getOrCreateDefaultSet = () =>
  invoke<ServiceSet>("get_or_create_default_set");

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

export const loadSetForPresentation = (setId: string, output?: OutputId) =>
  invoke<PresentationState>("load_set_for_presentation", { setId, output: output ?? null });

export const nextSlide = (output?: OutputId) =>
  invoke<PresentationState>("next_slide", { output: output ?? null });

export const prevSlide = (output?: OutputId) =>
  invoke<PresentationState>("prev_slide", { output: output ?? null });

export const goToItem = (itemIndex: number, slideIndex?: number, output?: OutputId) =>
  invoke<PresentationState>("go_to_item", { itemIndex, slideIndex, output: output ?? null });

export const setPresentationMode = (mode: PresentationMode, output?: OutputId) =>
  invoke<PresentationState>("set_presentation_mode", { mode, output: output ?? null });

export const getPresentationState = (output?: OutputId) =>
  invoke<PresentationState>("get_presentation_state", { output: output ?? null });

// ─── Media library ───────────────────────────────────────────────────────────

export interface ListMediaParams {
  kind?: MediaKind;
  search?: string;
  limit?: number;
  offset?: number;
}

export const checkFfprobe = () =>
  invoke<boolean>("check_ffprobe");

export const checkLibreOffice = () =>
  invoke<boolean>("check_libreoffice");

export const checkMediaMtx = () =>
  invoke<boolean>("check_mediamtx");

/** Start (or reuse) the MediaMTX proxy for a camera stream; returns its WHEP URL. */
export const startStreamProxy = (source: StreamSource) =>
  invoke<{ whepUrl: string }>("start_stream_proxy", { source });

export const stopStreamProxy = () =>
  invoke<void>("stop_stream_proxy");

export const importMedia = (sourcePath: string) =>
  invoke<Media>("import_media", { sourcePath });

export const importPresentation = (sourcePath: string) =>
  invoke<Media>("import_presentation", { sourcePath });

export interface ConversionProgress {
  mediaId: string;
  status: "converting" | "done" | "error";
  message?: string;
}

export const onConversionProgress = (cb: (p: ConversionProgress) => void) =>
  listen<ConversionProgress>("conversion_progress", (e) => cb(e.payload));

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
  target?: CountdownTarget;
  durationMs?: number;
  message?: string;
  endBehavior?: CountdownEndBehavior;
  /** When true, the running countdown overlays the presentation regardless of mode. */
  takeover?: boolean;
  /** On-screen anchor for the digits (mirrored into runtime state for takeover). */
  position?: CountdownPosition;
  /** Looped-video background id (mirrored into runtime state for takeover). */
  backgroundMediaId?: string;
  [key: string]: unknown;
}

export const startCountdown = (params?: StartCountdownParams) =>
  invoke<CountdownState>("start_countdown", params ?? {});

export interface ArmCountdownParams {
  scheduledStart: ScheduledStart;
  durationMs: number;
  message?: string;
  endBehavior?: CountdownEndBehavior;
  setId?: string;
  itemIndex?: number;
  /** When true, the scheduled→running countdown overlays the presentation. */
  takeover?: boolean;
  /** On-screen anchor for the digits (mirrored into runtime state for takeover). */
  position?: CountdownPosition;
  /** Looped-video background id (mirrored into runtime state for takeover). */
  backgroundMediaId?: string;
  [key: string]: unknown;
}

export const armCountdown = (params: ArmCountdownParams) =>
  invoke<CountdownState>("arm_countdown", params);

export const pauseCountdown = () =>
  invoke<CountdownState>("pause_countdown");

export const resetCountdown = () =>
  invoke<CountdownState>("reset_countdown");

export const getCountdownState = (output?: OutputId) =>
  invoke<CountdownState>("get_countdown_state", { output: output ?? null });

// ─── Backup / restore ────────────────────────────────────────────────────────

export interface ManifestCounts {
  songs: number;
  sections: number;
  sets: number;
  setItems: number;
  media: number;
  settings: number;
}

export interface ExportSummary {
  outPath: string;
  byteSize: number;
  counts: ManifestCounts;
  warnings?: string[];
}

export interface ArchiveInspection {
  schemaVersion: number;
  exportedAt: number;
  appVersion: string;
  counts: ManifestCounts;
}

export interface ImportSummary {
  songsImported: number;
  songsSkipped: number;
  songsOverwritten: number;
  songsCopied: number;
  sectionsImported: number;
  setsImported: number;
  setsSkipped: number;
  setsOverwritten: number;
  setsCopied: number;
  setItemsImported: number;
  mediaImported: number;
  mediaSkipped: number;
  mediaOverwritten: number;
  mediaCopied: number;
  mediaFailed: number;
  settingsImported: number;
}

export type ImportMode = "replace" | "merge";

export interface ExportProgress {
  currentFile: string;
  filesDone: number;
  filesTotal: number;
}

export const exportLibrary = (outPath: string) =>
  invoke<ExportSummary>("export_library", { outPath });

export const inspectArchive = (path: string) =>
  invoke<ArchiveInspection>("inspect_archive", { path });

export const restoreLibrary = (path: string, mode: ImportMode) =>
  invoke<ImportSummary>("restore_library", { path, mode });

export const checkRestoreInProgress = () =>
  invoke<boolean>("check_restore_in_progress");

export const abortRestore = () =>
  invoke<void>("abort_restore");

export const onBackupProgress = (cb: (p: ExportProgress) => void) =>
  listen<ExportProgress>("backup_progress", (e) => cb(e.payload));

// ─── Artifact share (selective export/import — Phase 12) ──────────────────────

export type ArchiveKind = "library" | "songs" | "set" | "settings";
export type ConflictKind = "sameId" | "sameTitleArtist" | null;
export type ResolutionAction = "skip" | "overwrite" | "copy";

export interface ImportPlanItem {
  artifactType: "song" | "set" | "media";
  id: string;
  title: string;
  conflict: ConflictKind;
  defaultAction: ResolutionAction;
}

export interface ImportPlan {
  kind: ArchiveKind;
  schemaVersion: number;
  counts: ManifestCounts;
  items: ImportPlanItem[];
}

export interface Resolution {
  id: string;
  action: ResolutionAction;
}

export const exportSongs = (songIds: string[], outPath: string) =>
  invoke<ExportSummary>("export_songs", { songIds, outPath });

export const exportSet = (setId: string, outPath: string) =>
  invoke<ExportSummary>("export_set", { setId, outPath });

export const exportSettingsProfile = (outPath: string) =>
  invoke<ExportSummary>("export_settings_profile", { outPath });

export const planArtifactImport = (path: string) =>
  invoke<ImportPlan>("plan_artifact_import", { path });

export const importArtifact = (path: string, resolutions: Resolution[]) =>
  invoke<ImportSummary>("import_artifact", { path, resolutions });

// ─── Settings ────────────────────────────────────────────────────────────────

export const getSetting = (key: string) =>
  invoke<string>("get_setting", { key });

export const setSetting = (key: string, value: string) =>
  invoke<void>("set_setting", { key, value });

export const onLocaleChanged = (cb: (locale: string) => void) =>
  listen<string>("locale_changed", (e) => cb(e.payload));

export const onSettingChanged = (
  cb: (key: string, value: string) => void,
) =>
  listen<{ key: string; value: string }>("setting_changed", (e) =>
    cb(e.payload.key, e.payload.value),
  );

// ─── Events ─────────────────────────────────────────────────────────────────

export const onSongsChanged = (cb: () => void) =>
  listen<void>("songs_changed", () => cb());

export const onSetChanged = (cb: () => void) =>
  listen<void>("set_changed", () => cb());

export const onStateChanged = (
  cb: (state: PresentationState) => void,
  output: OutputId = "one",
) =>
  listen<{ output: OutputId; state: PresentationState }>("state_changed", (e) => {
    if (e.payload.output === output) cb(e.payload.state);
  });

export const onCountdownTick = (
  cb: (state: CountdownState) => void,
  output: OutputId = "one",
) =>
  listen<{ output: OutputId; state: CountdownState }>("countdown_tick", (e) => {
    if (e.payload.output === output) cb(e.payload.state);
  });

export const onCountdownTriggered = (cb: (payload: CountdownTriggeredPayload) => void) =>
  listen<CountdownTriggeredPayload>("countdown_triggered", (e) => cb(e.payload));

// ─── CCLI reports ────────────────────────────────────────────────────────────

export interface CcliRow {
  playedOn: string;
  title: string;
  author?: string;
  ccliNumber?: string;
  copyright?: string;
}

export const previewCcliExport = (from: string, to: string) =>
  invoke<CcliRow[]>("preview_ccli_export", { from, to });

export const exportCcliCsv = (from: string, to: string, outPath: string) =>
  invoke<number>("export_ccli_csv", { from, to, outPath });

// ─── Key bindings ─────────────────────────────────────────────────────────────

export const getKeyBindings = () =>
  invoke<KeyBindings>("get_key_bindings");

export const setKeyBindings = (bindings: KeyBindings) =>
  invoke<KeyBindings>("set_key_bindings", { bindings });

export const resetKeyBindings = () =>
  invoke<KeyBindings>("reset_key_bindings");

export const onKeyBindingsChanged = (cb: (kb: KeyBindings) => void) =>
  listen<KeyBindings>("key_bindings_changed", (e) => cb(e.payload));

export const emitForwardKeydown = (signature: string) =>
  emit("forward_keydown", { signature });

export const onForwardKeydown = (cb: (sig: string) => void) =>
  listen<{ signature: string }>("forward_keydown", (e) => cb(e.payload.signature));

// ─── Updates ──────────────────────────────────────────────────────────────────

export const checkForUpdates = (force: boolean) =>
  invoke<UpdateInfo | null>("check_for_updates", { force });

export const applyUpdateAndRestart = () =>
  invoke<void>("apply_update_and_restart");

// ─── Overlay ─────────────────────────────────────────────────────────────────

export const setAnnouncementOverlay = (text: string) =>
  invoke<void>("set_announcement_overlay", { text });

export const setMediaOverlay = (mediaId: string) =>
  invoke<void>("set_media_overlay", { mediaId });

export const setWebviewOverlay = (url: string) =>
  invoke<void>("set_webview_overlay", { url });

export const clearOverlay = () =>
  invoke<void>("clear_overlay");
