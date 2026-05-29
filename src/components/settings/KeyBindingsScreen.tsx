import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, X } from "lucide-react";
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

// Hardcoded keys — shown for reference but not rebindable
const READONLY_ACTIONS = new Set<ActionId>(["exitPresentation"]);

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
    return <p className="text-muted text-sm py-4">{t("loading")}</p>;
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
            const isReadonly = READONLY_ACTIONS.has(action);

            return (
              <div
                key={action}
                className="py-2 px-3 rounded-lg hover:bg-surface-2 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-fg flex-1 min-w-0 truncate">
                    {t(`keyBindings.actions.${action}`)}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {shortcuts.map((sc, i) => (
                      <span key={i} className="flex items-center gap-0.5">
                        <Keycap shortcut={sc} />
                        {!isReadonly && (
                          <button
                            onClick={() => removeShortcut(action, i)}
                            disabled={saving}
                            title={t("keyBindings.removeShortcut")}
                            className="text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 px-0.5 inline-flex items-center"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ))}

                    {shortcuts.length === 0 && !isRecordingThis && (
                      <span className="text-xs text-muted">
                        {t("keyBindings.noBinding")}
                      </span>
                    )}

                    {isReadonly ? (
                      <span
                        className="text-muted cursor-default inline-flex items-center"
                        title={t("keyBindings.hardcodedTooltip")}
                      >
                        <Lock size={12} />
                      </span>
                    ) : isRecordingThis ? (
                      <>
                        <span className="text-xs text-warning animate-pulse">
                          {t("keyBindings.pressKey")}
                        </span>
                        <button
                          onClick={() => setRecording(null)}
                          className="text-xs text-muted hover:text-inherit px-1 py-0.5 rounded"
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
                        className="text-xs text-muted hover:text-primary transition-colors px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        {t("keyBindings.addShortcut")}
                      </button>
                    )}
                  </div>
                </div>

                {isRecordingThis && modifierError && (
                  <p className="text-xs text-danger mt-1 pl-0">
                    {t("keyBindings.modifierOnly")}
                  </p>
                )}
                {rowError && (
                  <p className="text-xs text-danger mt-1">{rowError}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            onClick={() => setConfirmReset(true)}
            disabled={saving}
            className="text-xs text-muted hover:text-inherit border border-border hover:border-muted px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? t("saving") : t("keyBindings.resetAll")}
          </button>
        </div>
      </div>
    </>
  );
};
