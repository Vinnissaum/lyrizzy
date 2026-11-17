import React, { createContext, useContext, useState, useEffect, useRef } from "react";

interface TransitionStageProps {
  children: React.ReactNode;
  /** Key that changes when content changes. Triggers a crossfade. */
  contentKey: string;
  /**
   * What the content belongs to (the wall passes the set item's id). A new
   * `contentKey` in the same group as what is on screen - the next strophe of
   * the same song - updates in place, so what keeps running across it (a
   * song's video background) is not remounted. Only a change of group
   * crossfades. Without it, every new key crossfades.
   */
  groupKey?: string;
  /** Duration of the crossfade in ms. 0 means instant cut. */
  durationMs?: number;
  /** When true, bypasses transition entirely (instant cut). */
  instant?: boolean;
}

interface Slot {
  key: string;
  group?: string;
  content: React.ReactNode;
}

const EMPTY: Slot = { key: "", content: null };

/**
 * Whether the content rendered here is what the wall shows. `false` inside a
 * layer that is fading out: its media must stop now, not when the layer is
 * unmounted at the end of the fade. `true` outside any stage.
 */
const LayerActiveContext = createContext(true);

export const useLayerActive = (): boolean => useContext(LayerActiveContext);

/**
 * Two-slot crossfade stage. When `contentKey` changes, the new content takes
 * the free slot and shows on top while the old content fades out underneath;
 * when the fade ends the old content is unmounted, so nothing of an item that
 * left the wall - a video, a camera, a background - keeps running behind the
 * one that replaced it. Content stays in its slot for as long as it is
 * mounted (it is never remounted to change layer), and learns it is leaving
 * through `useLayerActive`. A one-slot queue drops rapid intermediate states -
 * only the latest pending render is shown after the current transition
 * completes.
 */
export const TransitionStage: React.FC<TransitionStageProps> = ({
  children,
  contentKey,
  groupKey,
  durationMs = 200,
  instant = false,
}) => {
  const effectiveDuration = instant ? 0 : durationMs;

  const [stage, setStage] = useState<{ slots: [Slot, Slot]; front: 0 | 1 }>({
    slots: [{ key: contentKey, group: groupKey, content: children }, EMPTY],
    front: 0,
  });
  // Queue: next pending render (dropped if another arrives before transition ends)
  const pendingRef = useRef<Slot | null>(null);
  const transitioning = useRef(false);
  // Fallback timer: the front layer's opacity stays at 1 and never animates, so
  // its `transitionend` never fires. We must not depend on it to advance the
  // queue — otherwise `transitioning` stays true forever and every later slide
  // is dropped (the "stuck on second strophe" freeze). A timeout guarantees the
  // transition always completes; `onTransitionEnd` is only an early-out.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idempotent: finishes the current transition (if any), unmounts what faded
  // out and flushes the queue. Safe to call from both the timeout and a
  // bubbled `transitionend`.
  function handleComplete() {
    if (!transitioning.current) return;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    transitioning.current = false;
    const next = pendingRef.current;
    pendingRef.current = null;
    setStage((s) => {
      const slots: [Slot, Slot] = [s.slots[0], s.slots[1]];
      slots[s.front === 0 ? 1 : 0] = EMPTY;
      return { slots, front: s.front };
    });
    if (next) applyNext(next);
  }

  function applyNext(next: Slot) {
    transitioning.current = true;
    setStage((s) => {
      const free: 0 | 1 = s.front === 0 ? 1 : 0;
      const slots: [Slot, Slot] = [s.slots[0], s.slots[1]];
      // New content shows on top; the old stays in its slot, fading out.
      slots[free] = next;
      return { slots, front: free };
    });
    if (effectiveDuration === 0) {
      handleComplete();
    } else {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      // +30ms guard so we don't pre-empt a transition that's about to end.
      timerRef.current = setTimeout(handleComplete, effectiveDuration + 30);
    }
  }

  useEffect(() => {
    const shown = stage.slots[stage.front];
    // Same key (initial mount included), or the same group as what is on
    // screen: update in place without a transition. A pending change of group
    // is dropped - the latest state is back on the group on screen.
    if (
      contentKey === shown.key ||
      (groupKey !== undefined && groupKey === shown.group)
    ) {
      pendingRef.current = null;
      setStage((s) => {
        const slots: [Slot, Slot] = [s.slots[0], s.slots[1]];
        slots[s.front] = { key: contentKey, group: groupKey, content: children };
        return { slots, front: s.front };
      });
      return;
    }

    if (transitioning.current) {
      // Drop previous pending, keep only latest
      pendingRef.current = { key: contentKey, group: groupKey, content: children };
      return;
    }

    applyNext({ key: contentKey, group: groupKey, content: children });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, groupKey, children]);

  // Clear any pending fallback timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  // Early-out: the outgoing layer is the one whose opacity actually animates
  // (1 → 0). Complete as soon as its own opacity transition ends, rather than
  // waiting for the timeout. Guarded on target + property so inner-content
  // transitions bubbling up don't complete us prematurely.
  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== "opacity") return;
    handleComplete();
  };

  return (
    <div className="relative w-full h-full">
      {stage.slots.map((slot, i) => {
        const isFront = i === stage.front;
        return (
          // Keyed by slot, not by content: a layer changes role in place, so
          // its content is neither remounted nor moved in the DOM.
          <div
            key={i}
            data-layer={isFront ? "front" : "back"}
            className="absolute inset-0"
            style={{
              opacity: isFront ? 1 : 0,
              zIndex: isFront ? 1 : 0,
              // Only the outgoing layer animates; the incoming one shows at once.
              transition:
                !isFront && effectiveDuration > 0
                  ? `opacity ${effectiveDuration}ms ease-in-out`
                  : "none",
            }}
            onTransitionEnd={isFront ? undefined : handleTransitionEnd}
          >
            <LayerActiveContext.Provider value={isFront}>
              {slot.content}
            </LayerActiveContext.Provider>
          </div>
        );
      })}
    </div>
  );
};
