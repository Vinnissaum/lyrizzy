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
  slideConfig?: string;
  source?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  sections: SongSection[];
}

// TODO Phase 2: add 'media' | 'countdown' | 'webview' variants
export type SetItemType = 'song' | 'blank';

export interface SetItem {
  id: string;
  setId: string;
  itemType: SetItemType;
  songId?: string;
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

export type PresentationMode = 'idle' | 'live' | 'blank' | 'frozen';

export interface PresentationState {
  set?: ServiceSet;
  currentItemIndex: number;
  currentSlideIndex: number;
  mode: PresentationMode;
  frozenAt?: [number, number];
  currentSlide?: Slide;
  itemSlideCounts: number[];
  backgroundPath?: string;
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

export interface CountdownState {
  durationMs: number;
  remainingMs: number;
  isRunning: boolean;
}

export interface MonitorInfo {
  name?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scaleFactor: number;
}
