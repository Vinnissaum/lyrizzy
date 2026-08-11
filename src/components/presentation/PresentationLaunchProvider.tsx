import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settings";
import { resolveLaunchPlan, startPresentationPlan } from "../../utils/outputDispatch";
import { MultiScreenLaunchModal } from "./MultiScreenLaunchModal";
import {
  OUTPUT2_MONITOR_KEY,
  PRESENTATION_MONITOR_KEY,
  getSetting,
  listMonitors,
} from "../../api/commands";
import { loadMonitorNames, resolveMonitorName } from "../../utils/monitorNames";
import type { MonitorInfo } from "../../types";

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
  const { t } = useTranslation();
  const [pendingSetId, setPendingSetId] = useState<string | null>(null);
  const [screenNames, setScreenNames] = useState<[string, string] | undefined>(
    undefined,
  );
  const resolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const parseIndex = (v: string | null) => {
      if (!v || v === "auto") return null;
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? null : n;
    };
    Promise.all([
      listMonitors().catch(() => [] as MonitorInfo[]),
      loadMonitorNames().catch(() => ({})),
      getSetting(PRESENTATION_MONITOR_KEY).catch(() => null),
      getSetting(OUTPUT2_MONITOR_KEY).catch(() => null),
    ]).then(([monitors, names, one, two]) => {
      if (cancelled) return;
      const idxOne = parseIndex(one);
      const idxTwo = parseIndex(two);
      const mOne = idxOne != null ? monitors[idxOne] : undefined;
      const mTwo = idxTwo != null ? monitors[idxTwo] : undefined;
      const nameOne = mOne
        ? resolveMonitorName(mOne, idxOne as number, names)
        : t("presentation.output.tela", { n: 1 });
      const nameTwo = mTwo
        ? resolveMonitorName(mTwo, idxTwo as number, names)
        : t("presentation.output.tela", { n: 2 });
      setScreenNames([nameOne, nameTwo]);
    });
    return () => {
      cancelled = true;
    };
  }, [t]);

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
