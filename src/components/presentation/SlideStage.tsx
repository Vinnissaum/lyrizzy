import React, { useLayoutEffect, useRef, useState } from "react";

// Virtual stage dimensions — 16:9 coordinate space used by all slide renderers.
const STAGE_W = 1280;
const STAGE_H = 720;

export interface SlideStageProps {
  children: React.ReactNode;
  /** Fills the container + letterbox bars. Defaults to "#000000". */
  backgroundColor?: string;
  className?: string;
}

/**
 * A scaling shell that maps a fixed 1280×720 virtual coordinate space into
 * whatever container size it is placed in, using contain (letterbox) scaling.
 * Children receive the full 1280×720 coordinate space and can use fixed px
 * values from layout.ts's PREVIEW_SIZE_PX — the CSS transform scales everything.
 */
export const SlideStage: React.FC<SlideStageProps> = ({
  children,
  backgroundColor = "#000000",
  className,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Default scale matches SlideChip's initial value so first paint is consistent.
  const [scale, setScale] = useState(0.125);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const s = Math.min(cw / STAGE_W, ch / STAGE_H);
      setScale(s);
      setOffset({
        x: (cw - STAGE_W * s) / 2,
        y: (ch - STAGE_H * s) / 2,
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full h-full overflow-hidden${className ? ` ${className}` : ""}`}
      style={{ backgroundColor }}
    >
      <div
        data-testid="slide-stage"
        style={{
          position: "absolute",
          width: STAGE_W,
          height: STAGE_H,
          transformOrigin: "top left",
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
