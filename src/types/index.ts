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

export type WebViewMode = 'iframe' | 'mjpeg';

export interface WebViewConfig {
  mode: WebViewMode;
  url: string;
  basicAuthUser?: string;
  basicAuthPass?: string;
}

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

export type BackgroundPreset = 'preto-branco' | 'branco-preto';
export type FontFamily = 'sans' | 'serif' | 'mono';
export type FontSize = 'sm' | 'md' | 'lg' | 'xl';

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

export type CountdownMode = 'idle' | 'running' | 'paused' | 'finished';
export type CountdownEndBehavior = 'holdZero' | 'blackout' | 'advanceSet';

export type CountdownTarget =
  | { kind: 'duration'; durationMs: number }
  | { kind: 'fixedTime'; hour: number; minute: number };

export interface CountdownConfig {
  target: CountdownTarget;
  message?: string;
  endBehavior: CountdownEndBehavior;
  backgroundMediaId?: string;
}

export interface CountdownState {
  mode: CountdownMode;
  durationMs: number;
  remainingMs: number;
  targetEpochMs?: number;
  message?: string;
  endBehavior: CountdownEndBehavior;
}

// ── Window / monitor ─────────────────────────────────────────────────────────

export interface MonitorInfo {
  name?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scaleFactor: number;
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
