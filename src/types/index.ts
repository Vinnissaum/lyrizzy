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

export interface SongSection {
  id: string;
  songId: string;
  label: string;
  type: SectionType;
  body: string;
  sortOrder: number;
  repeatCount: number;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  ccliNumber?: string;
  keySignature?: string;
  language: string;
  notes?: string;
  backgroundId?: string;
  scrimOpacity: number;
  slideConfig?: string;
  source?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  sections: SongSection[];
}

// ── Media ────────────────────────────────────────────────────────────────────

export type MediaKind = 'image' | 'video';

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

export interface MediaReferences {
  songs: MediaSongRef[];
  setItems: MediaSetItemRef[];
}

/** Per-set-item playback overrides for media items. */
export interface MediaItemOptions {
  loop: boolean;
  mute: boolean;
  autoAdvanceOnEnd: boolean;
}

// ── Sets ─────────────────────────────────────────────────────────────────────

export type SetItemType = 'song' | 'media' | 'countdown' | 'web_view' | 'blank';

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

export interface BackgroundInfo {
  mediaKind: MediaKind;
  assetUrl: string;
  scrimOpacity: number;
}

export interface PresentationState {
  set?: ServiceSet;
  currentItemIndex: number;
  currentSlideIndex: number;
  mode: PresentationMode;
  frozenAt?: [number, number];
  currentSlide?: Slide;
  itemSlideCounts: number[];
  background?: BackgroundInfo;
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

export interface CountdownConfig {
  durationMs: number;
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
