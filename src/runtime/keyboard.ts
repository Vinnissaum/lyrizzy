import type { ActionId, KeyBindings, Shortcut } from "../types";
import { emitForwardKeydown, onForwardKeydown } from "../api/commands";

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
