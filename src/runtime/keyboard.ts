import type { ActionId, KeyBindings, Shortcut, PresentationState } from "../types";
import { emitForwardKeydown, onForwardKeydown } from "../api/commands";

/**
 * "Active presentation surface" predicate (P10-02). True whenever the
 * presentation window has a live surface that Esc/F10 should act on: a
 * presenting mode (live/blank/frozen) OR an active overlay. Unlike the old
 * `getIsPresenting` (mode ∈ {live,blank,frozen}), this includes idle-with-overlay
 * so Esc can dismiss an overlay triggered while idle, and idle (with a window
 * open) so Esc can always close the presentation window.
 */
export function isPresentationActive(state: PresentationState | null | undefined): boolean {
  if (state == null) return false;
  const m = state.mode;
  return m === "live" || m === "blank" || m === "frozen" || state.overlay != null;
}

export function eventSignature(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

export function rawSignature(sig: string): Shortcut {
  const parts = sig.split("+");
  const key = parts[parts.length - 1];
  return {
    key,
    ctrl: parts.includes("ctrl"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
  };
}

function shortcutSig(s: Shortcut): string {
  const parts: string[] = [];
  if (s.ctrl) parts.push("ctrl");
  if (s.shift) parts.push("shift");
  if (s.alt) parts.push("alt");
  parts.push(s.key.toLowerCase());
  return parts.join("+");
}

function matchAction(sig: string, bindings: KeyBindings): ActionId | null {
  for (const [action, shortcuts] of Object.entries(bindings.bindings)) {
    for (const sc of shortcuts) {
      if (shortcutSig(sc) === sig) return action as ActionId;
    }
  }
  return null;
}

export type ActionCallbacks = Partial<Record<ActionId, () => void>>;

export interface HardcodedKeyHandlers {
  getIsPresenting: () => boolean;
  onEscape: () => void;
  onF10: () => void;
}

export function installKeyboardDispatcher(
  getBindings: () => KeyBindings | null,
  callbacks: ActionCallbacks,
  hardcoded?: HardcodedKeyHandlers
): () => void {
  const handler = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      (e.target as HTMLElement).isContentEditable
    ) {
      return;
    }
    // Hardcoded keys take priority over user bindings (PowerPoint parity — not rebindable)
    if (hardcoded && hardcoded.getIsPresenting()) {
      if (e.key === "Escape") {
        e.preventDefault();
        hardcoded.onEscape();
        return;
      }
      if (e.key === "F10") {
        e.preventDefault();
        hardcoded.onF10();
        return;
      }
    }
    const bindings = getBindings();
    if (!bindings) return;
    const sig = eventSignature(e);
    const action = matchAction(sig, bindings);
    if (action && callbacks[action]) {
      e.preventDefault();
      callbacks[action]!();
    }
  };

  window.addEventListener("keydown", handler);

  const unlistenForwarded = onForwardKeydown((sig) => {
    // Hardcoded Esc/F10 forwarded from the presentation window must reach the
    // same handlers as locally-pressed keys — otherwise pressing Esc with the
    // presentation window focused would do nothing (these keys aren't user
    // bindings). This makes the operator the single owner of presentation exit.
    if (hardcoded && hardcoded.getIsPresenting()) {
      if (sig === "escape") {
        hardcoded.onEscape();
        return;
      }
      if (sig === "f10") {
        hardcoded.onF10();
        return;
      }
    }
    const bindings = getBindings();
    if (!bindings) return;
    const action = matchAction(sig, bindings);
    if (action && callbacks[action]) {
      callbacks[action]!();
    }
  });

  return () => {
    window.removeEventListener("keydown", handler);
    unlistenForwarded.then((u) => u());
  };
}

export function forwardKeydown(e: KeyboardEvent): void {
  emitForwardKeydown(eventSignature(e)).catch(() => {});
}
