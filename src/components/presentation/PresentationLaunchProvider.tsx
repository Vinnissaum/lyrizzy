import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settings";
import { exitPresentation } from "../../api/commands";
import { resolveLaunchPlan, startPresentationPlan } from "../../utils/outputDispatch";
import { MultiScreenLaunchModal } from "./MultiScreenLaunchModal";
import { outputScreenName } from "../../utils/monitorNames";

type RequestPresentation = (setId: string) => Promise<void>;

const PresentationLaunchContext = createContext<RequestPresentation | null>(null);

/**
 * Single mounted entry point for every "Apresentar" call site: resolves the
 * saved launch policy against multi-screen availability, then either runs the
 * plan directly ("mirrorAll"/"mainOnly") or asks the operator once via
 * `MultiScreenLaunchModal` ("ask") before running the plan they picked.
 *
 * Mount ONCE (a later task wires this into `OperatorApp`); every call site
 * reaches it through `useRequestPresentation`.
 *
 * Screen names are derived from `useSettingsStore` (`monitors`,
 * `monitorNames`, `outputMonitorIndex`) on every render rather than fetched
 * once into local state — this provider mounts once for the app's lifetime,
 * so a boot-once cache would never reflect a monitor rename made later in
 * the session.
 */
export const PresentationLaunchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const [pendingSetId, setPendingSetId] = useState<string | null>(null);
  const resolveRef = useRef<(() => void) | null>(null);

  const monitors = useSettingsStore((s) => s.monitors);
  const monitorNames = useSettingsStore((s) => s.monitorNames);
  const outputMonitorIndex = useSettingsStore((s) => s.outputMonitorIndex);

  const screenNames: [string, string] = [
    outputScreenName(
      monitors,
      monitorNames,
      outputMonitorIndex.one,
      t("presentation.output.tela", { n: 1 }),
    ),
    outputScreenName(
      monitors,
      monitorNames,
      outputMonitorIndex.two,
      t("presentation.output.tela", { n: 2 }),
    ),
  ];

  const requestPresentation = useCallback<RequestPresentation>((setId: string) => {
    const { launchPolicy, multiScreenEnabled } = useSettingsStore.getState();
    const plan = resolveLaunchPlan(launchPolicy, multiScreenEnabled);

    if (plan !== "ask") {
      return startPresentationPlan(plan, setId);
    }

    return new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      setPendingSetId(setId);
    });
  }, []);

  const finish = useCallback(() => {
    setPendingSetId(null);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.();
  }, []);

  const handleAnswer = useCallback(
    async (mirrorAll: boolean) => {
      const setId = pendingSetId;
      if (setId == null) {
        finish();
        return;
      }
      try {
        await startPresentationPlan(mirrorAll ? "mirrorAll" : "mainOnly", setId);
      } finally {
        finish();
      }
    },
    [pendingSetId, finish],
  );

  /**
   * Dismissing the modal (X / Esc) must abort the whole launch, not just hide
   * the question. Every "Apresentar" call site loads the set into the navigator
   * BEFORE asking, and `load_set_for_presentation` already puts the output in
   * `Live` — which is what flips the operator into the presentation layout. So
   * a plain close would strand the operator "presenting" with no projector
   * window and the home view locked behind the nav guard.
   *
   * Only output "one" is torn down: the pre-load targets it alone, and the
   * mirror plan hasn't run yet at cancel time, so "two" was never touched.
   * `exit_presentation` is idempotent — an already-idle output with no window
   * short-circuits in Rust, so this is a no-op when nothing was staged.
   *
   * Safe to do unconditionally: every call site is unreachable while a
   * presentation is actually running (the operator swaps to
   * `OperatorPresentationLayout`, and the countdown auto-launch returns early
   * when already presenting), so this can never stop a live service.
   */
  const handleCancel = useCallback(() => {
    exitPresentation("one").catch(() => {});
    finish();
  }, [finish]);

  return (
    <PresentationLaunchContext.Provider value={requestPresentation}>
      {children}
      {pendingSetId != null && (
        <MultiScreenLaunchModal
          onAnswer={handleAnswer}
          onCancel={handleCancel}
          screenNames={screenNames}
        />
      )}
    </PresentationLaunchContext.Provider>
  );
};

/**
 * Returns the single "Apresentar" entry point. Must be called from within
 * `PresentationLaunchProvider`'s subtree.
 */
export function useRequestPresentation(): RequestPresentation {
  const ctx = useContext(PresentationLaunchContext);
  if (!ctx) {
    throw new Error("useRequestPresentation must be used within a PresentationLaunchProvider");
  }
  return ctx;
}
