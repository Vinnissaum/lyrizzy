import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keycap } from "../common/Keycap";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { useKeyBindingsStore } from "../../stores/keyBindings";
import { setKeyBindings, resetKeyBindings } from "../../api/commands";
import { eventSignature, rawSignature } from "../../runtime/keyboard";
import type { ActionId, ErrorPayload, KeyBindings } from "../../types";

const ACTION_IDS: ActionId[] = [
  "advanceSlide",
  "previousSlide",
  "blank",
  "freeze",
  "exitPresentation",
  "jumpToItem1",
  "jumpToItem2",
  "jumpToItem3",
  "jumpToItem4",
  "jumpToItem5",
  "jumpToItem6",
  "jumpToItem7",
  "jumpToItem8",
  "jumpToItem9",
  "countdownPause",
  "openPresentationWindow",
  "focusSearch",
];

type RecordingTarget = { action: ActionId; replaceIndex: number | null };

export const KeyBindingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { bindings, load } = useKeyBindingsStore();
  const [recording, setRecording] = useState<RecordingTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowErrors, setRowErrors] = useState<Partial<Record<ActionId, string>>>({});
  const [modifierError, setModifierError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const resolveConflictMessage = useCallback(
    (err: ErrorPayload, currentAction: ActionId): string => {
      if (err.code !== "key_bindings.conflict") return String(err);
      const other =
        err.params.actionA === currentAction ? err.params.actionB : err.params.actionA;
      return t("errors.keyBindings.conflict", {
        action: t(`keyBindings.actions.${other}`),
      });
    },
    [t]
  );

  const commitShortcutUpdate = useCallback(
    async (action: ActionId, newBindings: KeyBindings) => {
      setSaving(true);
      setRowErrors({});
      try {
        await setKeyBindings(newBindings);
        await load();
      } catch (err: unknown) {
        const payload = err as ErrorPayload;
        const msg =
          payload?.code?.startsWith("key_bindings")
            ? resolveConflictMessage(payload, action)
            : String(err);
        setRowErrors((prev) => ({ ...prev, [action]: msg }));
      } finally {
        setSaving(false);
      }
    },
    [load, resolveConflictMessage]
  );

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if (!recording || !bindings) return;
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        setModifierError(true);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setModifierError(false);

      const { action, replaceIndex } = recording;
      setRecording(null);

      const current = bindings.bindings?.[action] ?? [];
      const newShortcut = rawSignature(eventSignature(e));
      const updated =
        replaceIndex !== null
          ? current.map((s, i) => (i === replaceIndex ? newShortcut : s))
          : [...current, newShortcut];

      await commitShortcutUpdate(action, {
        bindings: { ...bindings.bindings, [action]: updated },
      });
    },
    [recording, bindings, commitShortcutUpdate]
  );

  useEffect(() => {
    if (!recording) {
      setModifierError(false);
      return;
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recording, handleKeyDown]);

  const removeShortcut = async (action: ActionId, index: number) => {
    if (!bindings) return;
    const current = bindings.bindings?.[action] ?? [];
    await commitShortcutUpdate(action, {
      bindings: {
        ...bindings.bindings,
        [action]: current.filter((_, i) => i !== index),
      },
    });
  };

  const handleReset = async () => {
    setConfirmReset(false);
    setSaving(true);
    setRowErrors({});
    try {
      await resetKeyBindings();
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (!bindings) {
    return <p className="text-gray-500 text-sm py-4">{t("loading")}</p>;
  }

  return (
    <>
      <ConfirmDialog
        open={confirmReset}
        title={t("keyBindings.resetConfirmTitle")}
        message={t("keyBindings.resetConfirmMessage")}
        confirmLabel={t("keyBindings.resetAll")}
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />

      <div className="space-y-2">
        <div className="space-y-0.5">
          {ACTION_IDS.map((action) => {
            const shortcuts = bindings.bindings?.[action] ?? [];
            const isRecordingThis = recording?.action === action;
            const rowError = rowErrors[action];

            return (
              <div
                key={action}
                className="py-2 px-3 rounded-lg hover:bg-gray-200/70 dark:hover:bg-gray-700/50 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-200 flex-1 min-w-0 truncate">
                    {t(`keyBindings.actions.${action}`)}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {shortcuts.map((sc, i) => (
                      <span key={i} className="flex items-center gap-0.5">
                        <Keycap shortcut={sc} />
                        <button
                          onClick={() => removeShortcut(action, i)}
                          disabled={saving}
                          title={t("keyBindings.removeShortcut")}
                          className="text-xs text-gray-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 px-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}

                    {shortcuts.length === 0 && !isRecordingThis && (
                      <span className="text-xs text-gray-400 dark:text-gray-600">
                        {t("keyBindings.noBinding")}
                      </span>
                    )}

                    {isRecordingThis ? (
                      <>
                        <span className="text-xs text-amber-500 dark:text-amber-400 animate-pulse">
                          {t("keyBindings.pressKey")}
                        </span>
                        <button
                          onClick={() => setRecording(null)}
                          className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-1 py-0.5 rounded"
                        >
                          {t("keyBindings.cancel")}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() =>
                          setRecording({ action, replaceIndex: null })
                        }
                        disabled={saving}
                        className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        {t("keyBindings.addShortcut")}
                      </button>
                    )}
                  </div>
                </div>

                {isRecordingThis && modifierError && (
                  <p className="text-xs text-red-400 mt-1 pl-0">
                    {t("keyBindings.modifierOnly")}
                  </p>
                )}
                {rowError && (
                  <p className="text-xs text-red-400 mt-1">{rowError}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setConfirmReset(true)}
            disabled={saving}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? t("saving") : t("keyBindings.resetAll")}
          </button>
        </div>
      </div>
    </>
  );
};
