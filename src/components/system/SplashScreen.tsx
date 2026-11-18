import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { shieldSvg } from "../../brand/shield";

export const HOLD_MS = 3400;
export const FADE_MS = 400;
export const REDUCED_HOLD_MS = 900;

// The inscribed brand window, built once. Our own static markup (no user data),
// with ids prefixed so its gradients cannot clash with anything in the app.
const WINDOW_SVG = shieldSvg({ labels: true, idPrefix: "lz-splash" });

/**
 * Branded launch splash shown on operator startup: the Shield of the Trinity
 * stained-glass window is leaded and lit piece by piece (CSS in index.css, under
 * .splash-animate), then the "Lyrizzy" wordmark rises below it. Auto-dismisses;
 * any key/click skips ahead. Honors reduced motion (the window shows whole and
 * still, with a shorter hold). Operator window only — mounted in OperatorApp,
 * never the projector.
 */
export const SplashScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { t } = useTranslation();
  const [fading, setFading] = useState(false);

  // Keep latest onDone without re-running the timer effect (OperatorApp passes a
  // fresh closure each render).
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    let done = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const finish = () => {
      if (done) return;
      done = true;
      onDoneRef.current();
    };
    const startFade = () => {
      if (done) return;
      setFading(true);
      timers.push(setTimeout(finish, FADE_MS));
    };

    timers.push(setTimeout(startFade, reduceMotion ? REDUCED_HOLD_MS : HOLD_MS));

    window.addEventListener("keydown", startFade);
    window.addEventListener("pointerdown", startFade);
    return () => {
      window.removeEventListener("keydown", startFade);
      window.removeEventListener("pointerdown", startFade);
      timers.forEach(clearTimeout);
    };
  }, [reduceMotion]);

  return (
    <div
      data-testid="splash-screen"
      className={`splash-screen fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none ${
        reduceMotion ? "" : "splash-animate"
      } ${fading ? "splash-fade-out pointer-events-none" : ""}`}
    >
      <div className="relative">
        <div className="splash-halo pointer-events-none absolute -inset-[45%]" aria-hidden="true" />
        <div
          data-testid="splash-window"
          className="splash-shield relative"
          dangerouslySetInnerHTML={{ __html: WINDOW_SVG }}
        />
      </div>
      <h1 className="splash-wordmark font-brand relative mt-[5vh] text-5xl sm:text-6xl font-bold">
        Lyrizzy
      </h1>
      <p className="splash-tagline relative mt-3 text-xs sm:text-sm tracking-[0.35em] uppercase">
        {t("splash.tagline")}
      </p>
    </div>
  );
};
