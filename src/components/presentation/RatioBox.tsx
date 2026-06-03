import React from "react";

export interface RatioBoxProps {
  /** Aspect ratio as height/width percent. Defaults to 16:9 (56.25%). */
  ratioPercent?: number;
  /** Classes applied to the outer ratio element (sizing, ring, border, rounding). */
  className?: string;
  /** Classes applied to the absolute content layer (defaults to overflow-hidden). */
  contentClassName?: string;
  children?: React.ReactNode;
}

/**
 * A bulletproof fixed-aspect box. Unlike Tailwind's `aspect-video`, the height is
 * derived from a padding-ratio spacer rather than the `aspect-ratio` property, so
 * it never depends on CSS-grid row resolution or fractional DPI rounding — the
 * cause of the 16:10 strophe-grid overlap (see plans/…-countdown-takeover.md §2).
 *
 * Content renders in an `absolute inset-0` layer, so it can never push the box's
 * own height around.
 */
export const RatioBox = React.forwardRef<HTMLDivElement, RatioBoxProps>(
  function RatioBox(
    { ratioPercent = 56.25, className, contentClassName, children },
    ref,
  ) {
    return (
      <div ref={ref} className={`relative w-full${className ? ` ${className}` : ""}`}>
        {/* Ratio spacer: defines height purely from width, no grid dependency. */}
        <div style={{ paddingTop: `${ratioPercent}%` }} aria-hidden />
        <div
          className={`absolute inset-0${
            contentClassName ? ` ${contentClassName}` : " overflow-hidden"
          }`}
        >
          {children}
        </div>
      </div>
    );
  },
);
