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

  const applyNext = (key: string, content: React.ReactNode) => {
    transitioning.current = true;
    setLayers(([front]) => [
      // New content fades in on top
      { key, content, opacity: 1 },
      // Old content fades out underneath
      { ...front, opacity: 0 },
    ]);
    if (effectiveDuration === 0) {
      transitioning.current = false;
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next) applyNext(next.key, next.content);
    }
  };

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

  const handleTransitionEnd = () => {
    transitioning.current = false;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next) {
      applyNext(next.key, next.content);
    }
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
        onTransitionEnd={handleTransitionEnd}
      >
        {front.content}
      </div>
    </div>
  );
};
