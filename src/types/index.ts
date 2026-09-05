// Domain types mirroring src-tauri/src/domain/*.rs
// Field names match the camelCase wire format (serde rename_all = "camelCase").

export interface ErrorPayload {
  code: string;
  params: Record<string, string>;
}

export type SectionType =
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'pre_chorus'
  | 'outro'
  | 'interlude'
  | 'tag';

export type TextCasing = 'normal' | 'upper' | 'lower' | 'title';

export interface SongSection {
  id: string;
  songId: string;
  label: string;
  type: SectionType;
  body: string;
  sortOrder: number;
  repeatCount: number;
  notes?: string;
  backgroundId?: string;
  backgroundMode?: string;
  backgroundPreset?: string;
  fontFamily?: string;
  fontSize?: string;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  author?: string;
  copyright?: string;
  ccliNumber?: string;
  keySignature?: string;
  language: string;
  notes?: string;
  backgroundId?: string;
  scrimOpacity: number;
  slideConfig?: string;
  source?: string;
  backgroundMode?: string;
  backgroundPreset?: string;
  fontFamily?: string;
  fontSize?: string;
  textCasing?: TextCasing;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  sections: SongSection[];
}

// ── Media ────────────────────────────────────────────────────────────────────

export type MediaKind = 'image' | 'video' | 'presentation';

export interface Media {
  id: string;
  fileName: string;
  displayName: string;
  kind: MediaKind;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  thumbnailFile?: string;
  byteSize: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  /** Number of converted PNG slides. Set only for kind === 'presentation'. */
  slideCount?: number;
}

export interface MediaSongRef {
  id: string;
  title: string;
}

export interface MediaSetItemRef {
  setId: string;
  setName: string;
  itemId: string;
}

export interface MediaSectionRef {
  songId: string;
  songTitle: string;
  sectionId: string;
  sectionLabel: string;
}

export interface MediaReferences {
  songs: MediaSongRef[];
  setItems: MediaSetItemRef[];
  sections: MediaSectionRef[];
}

/** Per-set-item playback overrides for media items. */
export interface MediaItemOptions {
  loop: boolean;
  mute: boolean;
  autoAdvanceOnEnd: boolean;
}

// ── Sets ─────────────────────────────────────────────────────────────────────

export type SetItemType = 'song' | 'media' | 'countdown' | 'web_view' | 'blank' | 'slide_show';

export type WebViewMode = 'iframe' | 'mjpeg' | 'rtsp';

/** No-longer-configurable modes retained only so old saved data still type-checks. */
export type LegacyWebViewMode = 'rtmp' | 'srt' | 'multicast';

/** RTSP lower-transport, matching MediaMTX's `rtspTransport` path option. */
export type RtspTransport = 'automatic' | 'udp' | 'tcp';

/**
 * Visual crop for iframe mode — scales/shifts the iframe so a region (e.g. the
 * camera page's `<video>`) fills the screen. `zoom` is a multiplier (1 = none);
 * `offsetX`/`offsetY` are percentages of the viewport (negative moves up/left).
 */
export interface WebViewCrop {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

/**
 * A saved stream configuration a camera item can switch between without
 * losing its other settings. `mode` stays item-level on `WebViewConfig` —
 * a profile only carries the connection details for that mode.
 */
export interface StreamProfile {
  id: string;
  label: string;
  url: string;
  rtspTransport?: RtspTransport;
}

export interface WebViewConfig {
  mode: WebViewMode | LegacyWebViewMode;
  url: string;
  basicAuthUser?: string;
  basicAuthPass?: string;
  crop?: WebViewCrop;
  /** RTSP lower-transport (rtsp mode reuses `url` for the rtsp:// address). */
  rtspTransport?: RtspTransport;
  profiles?: StreamProfile[];
  activeProfileId?: string;
}

/** Discriminated stream source sent to the `start_stream_proxy` command. */
export type StreamSource = { kind: 'rtsp'; url: string; transport: RtspTransport };

export interface SetItem {
  id: string;
  setId: string;
  itemType: SetItemType;
  songId?: string;
  mediaId?: string;
  mediaKind?: MediaKind;
  mediaOptions?: MediaItemOptions;
  countdownConfig?: CountdownConfig;
  webviewConfig?: WebViewConfig;
  sortOrder: number;
  notes?: string;
}

export interface ServiceSet {
  id: string;
  name: string;
  serviceDate?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  items: SetItem[];
}

// ── Presentation ─────────────────────────────────────────────────────────────

export type PresentationMode = 'idle' | 'live' | 'blank' | 'frozen';

/** Identifies one of the two independent presentation outputs (screens / TVs). */
export type OutputId = 'one' | 'two';

export type BackgroundPreset = 'preto-branco' | 'branco-preto';
export type FontFamily = 'sans' | 'serif' | 'mono';
export type FontSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

/** A 9-point on-screen anchor (shared by lyrics, countdown, and announcements). */
export type ScreenPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

/** Edge padding stage applied around presentation content. */
export type Margin = 'none' | 'sm' | 'md' | 'lg' | 'xl';

/** Vertical spacing between lyric/announcement lines. */
export type LineSpacing = 'tight' | 'normal' | 'relaxed' | 'loose';

/** Font weight of lyric/announcement text (never the title — see titleWeight). */
export type BoldLevel = 'normal' | 'medium' | 'semibold' | 'bold';

/**
 * How a section's repeat count is reflected on stage.
 * `duplicate` repeats the slides; `annotate` shows an `(Nx)` marker instead.
 */
export type RepeatMode = 'duplicate' | 'annotate';

export interface Typography {
  fontFamily: FontFamily;
  fontSize: FontSize;
}

export interface BackgroundInfo {
  mediaKind?: MediaKind;
  assetUrl?: string;
  scrimOpacity: number;
  restartOnSectionBoundary: boolean;
  preset?: BackgroundPreset;
  typography?: Typography;
}

export type OverlayState =
  | { type: 'announcement'; text: string }
  | { type: 'media'; mediaId: string }
  | { type: 'webView'; url: string };

export interface PresentationState {
  set?: ServiceSet;
  currentItemIndex: number;
  currentSlideIndex: number;
  mode: PresentationMode;
  frozenAt?: [number, number];
  currentSlide?: Slide;
  /** Next slide from the current navigation position. */
  nextSlide?: Slide;
  itemSlideCounts: number[];
  background?: BackgroundInfo;
  overlay?: OverlayState;
  /** All slides for every set item, parallel to set.items. Absent in legacy payloads. */
  allSlidesPerItem?: Slide[][];
}

export interface Slide {
  lines: string[];
  sectionLabel: string;
  sectionId: string;
}

export interface SlideConfig {
  maxLines: number;
  maxCharsPerLine: number;
}

// ── Countdown ────────────────────────────────────────────────────────────────

export type CountdownMode = 'idle' | 'scheduled' | 'running' | 'paused' | 'finished';
export type CountdownEndBehavior = 'holdZero' | 'blackout' | 'advanceSet';

export type CountdownTarget =
  | { kind: 'duration'; durationMs: number }
  | { kind: 'fixedTime'; hour: number; minute: number };

export type CountdownPosition = ScreenPosition;

/** Wall-clock HH:MM used as a scheduled-start trigger. */
export interface ScheduledStart {
  hour: number;
  minute: number;
}

export interface CountdownConfig {
  target: CountdownTarget;
  name?: string;
  message?: string;
  endBehavior: CountdownEndBehavior;
  backgroundMediaId?: string;
  position?: CountdownPosition;
  /** When set, the countdown is armed: waits until HH:MM then auto-starts. */
  scheduledStart?: ScheduledStart;
  messageScale?: number;
  digitsScale?: number;
}

export interface CountdownState {
  mode: CountdownMode;
  durationMs: number;
  remainingMs: number;
  targetEpochMs?: number;
  /** When in `scheduled` mode, the wall-clock epoch-ms the timer auto-starts at. */
  scheduledStartEpochMs?: number;
  message?: string;
  endBehavior: CountdownEndBehavior;
  /** When true, the countdown overlays the presentation regardless of mode. */
  takeover?: boolean;
  /** On-screen anchor for the digits, mirrored from the source item config. */
  position?: CountdownPosition;
  /** Looped-video background id, mirrored from the source item config. */
  backgroundMediaId?: string;
  messageScale: number;
  digitsScale: number;
}

/** Emitted when a scheduled countdown reaches its wall-clock start time. */
export interface CountdownTriggeredPayload {
  setId?: string;
  itemIndex?: number;
  output: OutputId;
}

// ── Window / monitor ─────────────────────────────────────────────────────────

export interface MonitorInfo {
  name?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scaleFactor: number;
  /** OS primary screen — usually the operator's own (laptop) display. */
  isPrimary?: boolean;
}

// ── Phase 3 — Key bindings ────────────────────────────────────────────────────

export type ActionId =
  | 'advanceSlide'
  | 'previousSlide'
  | 'blank'
  | 'freeze'
  | 'exitPresentation'
  | 'jumpToItem1'
  | 'jumpToItem2'
  | 'jumpToItem3'
  | 'jumpToItem4'
  | 'jumpToItem5'
  | 'jumpToItem6'
  | 'jumpToItem7'
  | 'jumpToItem8'
  | 'jumpToItem9'
  | 'countdownPause'
  | 'openPresentationWindow'
  | 'focusSearch';

export interface Shortcut {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export interface KeyBindings {
  bindings: Record<ActionId, Shortcut[]>;
}

// ── Phase 3 — CCLI / plays ────────────────────────────────────────────────────

export interface SongPlay {
  id: string;
  songId: string;
  setId: string;
  playedOn: string;
  createdAt: number;
}

// ── Phase 3 — Auto-update ─────────────────────────────────────────────────────

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes?: string;
  pubDate?: string;
}

export type UpdateCheckResult =
  | { status: 'updateAvailable'; info: UpdateInfo }
  | { status: 'upToDate' }
  | { status: 'skipped' };

export interface UpdateProgress {
  downloaded: number;
  total: number | null;
}
