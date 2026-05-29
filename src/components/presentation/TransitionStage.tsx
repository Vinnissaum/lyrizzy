import React, { useState, useEffect, useRef } from "react";

interface TransitionStageProps {
  children: React.ReactNode;
  /** Key that changes when content changes. Triggers a crossfade. */
  contentKey: string;
  /** Duration of the crossfade in ms. 0 means instant cut. */
  durationMs?: number;
  /** When true, bypasses transition entirely (instant cut). */
  instant?: boolean;
}

interface Layer {
  key: string;
  content: React.ReactNode;
  opacity: number;
}

/**
 * Two-layer crossfade stage. When `contentKey` changes, the new content
 * fades in while the old content fades out. A one-slot queue drops rapid
 * intermediate states — only the latest pending render is shown after the
 * current transition completes.
 */
export const TransitionStage: React.FC<TransitionStageProps> = ({
  children,
  contentKey,
  durationMs = 200,
  instant = false,
}) => {
  const effectiveDuration = instant ? 0 : durationMs;

  const [layers, setLayers] = useState<[Layer, Layer]>([
    { key: contentKey, content: children, opacity: 1 },
    { key: "", content: null, opacity: 0 },
  ]);
  // Queue: next pending render (dropped if another arrives before transition ends)
  const pendingRef = useRef<{ key: string; content: React.ReactNode } | null>(null);
  const transitioning = useRef(false);
  // Fallback timer: the front layer's opacity stays at 1 and never animates, so
  // its `transitionend` never fires. We must not depend on it to advance the
  // queue — otherwise `transitioning` stays true forever and every later slide
  // is dropped (the "stuck on second strophe" freeze). A timeout guarantees the
  // transition always completes; `onTransitionEnd` is only an early-out.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idempotent: finishes the current transition (if any) and flushes the queue.
  // Safe to call from both the timeout and a bubbled `transitionend`.
  function handleComplete() {
    if (!transitioning.current) return;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    transitioning.current = false;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next) applyNext(next.key, next.content);
  }

  function applyNext(key: string, content: React.ReactNode) {
    transitioning.current = true;
    setLayers(([front]) => [
      // New content fades in on top
      { key, content, opacity: 1 },
      // Old content fades out underneath
      { ...front, opacity: 0 },
    ]);
    if (effectiveDuration === 0) {
      handleComplete();
    } else {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      // +30ms guard so we don't pre-empt a transition that's about to end.
      timerRef.current = setTimeout(handleComplete, effectiveDuration + 30);
    }
  }

  useEffect(() => {
    // Skip on initial mount (same key)
    if (contentKey === layers[0].key) {
      // Content changed but key same — update in place without transition
      setLayers(([front, back]) => [
        { ...front, content: children },
        back,
      ]);
      return;
    }

    if (transitioning.current) {
      // Drop previous pending, keep only latest
      pendingRef.current = { key: contentKey, content: children };
      return;
    }

    applyNext(contentKey, children);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, children]);

  // Clear any pending fallback timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  // Early-out: the BACK layer is the one whose opacity actually animates
  // (1 → 0). Complete as soon as its own opacity transition ends, rather than
  // waiting for the timeout. Guarded on target + property so inner-content
  // transitions bubbling up don't complete us prematurely.
  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== "opacity") return;
    handleComplete();
  };

  const [front, back] = layers;

  return (
    <div className="relative w-full h-full">
      {/* Back layer (fading out) */}
      <div
        className="absolute inset-0"
        style={{
          opacity: back.opacity,
          transition: effectiveDuration > 0 ? `opacity ${effectiveDuration}ms ease-in-out` : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {back.content}
      </div>
      {/* Front layer (fading in) */}
      <div
        className="absolute inset-0"
        style={{
          opacity: front.opacity,
          transition: effectiveDuration > 0 ? `opacity ${effectiveDuration}ms ease-in-out` : "none",
        }}
      >
        {front.content}
      </div>
    </div>
  );
};
