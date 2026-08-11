import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { useSettingsStore } from "../../stores/settings";
import { resolveLaunchPlan, startPresentationPlan } from "../../utils/outputDispatch";
import { MultiScreenLaunchModal } from "./MultiScreenLaunchModal";

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
 */
export const PresentationLaunchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [pendingSetId, setPendingSetId] = useState<string | null>(null);
  const resolveRef = useRef<(() => void) | null>(null);

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

  const handleCancel = useCallback(() => {
    finish();
  }, [finish]);

  return (
    <PresentationLaunchContext.Provider value={requestPresentation}>
      {children}
      {pendingSetId != null && (
        <MultiScreenLaunchModal onAnswer={handleAnswer} onCancel={handleCancel} />
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
