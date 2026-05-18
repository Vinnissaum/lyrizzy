import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Phase 0 state payload.
 * Will be replaced by the full PresentationState union in Phase 1.
 */
export interface CounterState {
  counter: number;
}

// ─── Presentation commands ──────────────────────────────────────────────────

export const advanceSlide = () => invoke<void>("advance_slide");
export const previousSlide = () => invoke<void>("previous_slide");
export const toggleBlank = () => invoke<void>("toggle_blank");
export const toggleFreeze = () => invoke<void>("toggle_freeze");
export const stopPresentation = () => invoke<void>("stop_presentation");

// ─── Phase 0: counter demo ──────────────────────────────────────────────────

/**
 * Increment the shared counter in Rust state.
 * Returns the new counter value.
 * Also triggers a "state_changed" event broadcast to all windows.
 */
export const incrementCounter = () => invoke<number>("increment_counter");

// ─── Events ─────────────────────────────────────────────────────────────────

/**
 * Listen for state changes broadcast by the Rust backend.
 * Phase 0: payload is CounterState { counter: number }
 * Phase 1+: payload will be the full PresentationState union.
 */
export const onStateChanged = (cb: (state: CounterState) => void) =>
  listen<CounterState>("state_changed", (e) => cb(e.payload));

export const onCountdownTick = (cb: (remaining_ms: number) => void) =>
  listen<{ remaining_ms: number }>("countdown_tick", (e) =>
    cb(e.payload.remaining_ms)
  );
