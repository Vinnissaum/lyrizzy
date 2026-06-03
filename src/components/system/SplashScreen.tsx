import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const HOLD_MS = 1400;
const FADE_MS = 350;
const REDUCED_HOLD_MS = 600;

/**
 * Brief branded launch splash shown on operator startup. Black backdrop with an
 * animated "Lyrizzy" wordmark in the bundled display face. Auto-dismisses; any
 * key/click skips ahead. Honors reduced-motion (static, shorter hold). Operator
 * window only — mounted in OperatorApp, never the projector.
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
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black select-none ${
        fading ? "splash-fade-out pointer-events-none" : ""
      }`}
    >
      <h1
        className={`font-brand text-6xl sm:text-7xl md:text-8xl font-bold tracking-wide bg-gradient-to-r from-primary to-[#a78bfa] bg-clip-text text-transparent ${
          reduceMotion ? "" : "splash-wordmark-in"
        }`}
      >
        Lyrizzy
      </h1>
      <p className="mt-4 text-xs sm:text-sm tracking-[0.35em] uppercase text-muted">
        {t("splash.tagline")}
      </p>
    </div>
  );
};
