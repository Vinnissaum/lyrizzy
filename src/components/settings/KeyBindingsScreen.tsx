import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keycap } from "../common/Keycap";
import { useKeyBindingsStore } from "../../stores/keyBindings";
import { setKeyBindings, resetKeyBindings } from "../../api/commands";
import { eventSignature, rawSignature } from "../../runtime/keyboard";
import type { ActionId, KeyBindings } from "../../types";

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

export const KeyBindingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { bindings, load } = useKeyBindingsStore();
  const [recording, setRecording] = useState<ActionId | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if (!recording || !bindings) return;
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      e.preventDefault();
      e.stopPropagation();

      const sig = eventSignature(e);
      const newShortcut = rawSignature(sig);
      setRecording(null);

      const updated: KeyBindings = {
        bindings: { ...bindings.bindings, [recording]: [newShortcut] },
      };

      setSaving(true);
      setError(null);
      try {
        await setKeyBindings(updated);
        await load();
      } catch (err: unknown) {
        setError(String(err));
      } finally {
        setSaving(false);
      }
    },
    [recording, bindings, load]
  );

  useEffect(() => {
    if (!recording) return;
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recording, handleKeyDown]);

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      await resetKeyBindings();
      await load();
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!bindings) {
    return <p className="text-gray-500 text-sm py-4">{t("loading")}</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="space-y-0.5">
        {ACTION_IDS.map((action) => {
          const shortcuts = bindings.bindings?.[action] ?? [];
          const isRecording = recording === action;

          return (
            <div
              key={action}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-200/70 dark:hover:bg-gray-700/50 group"
            >
              <span className="text-sm text-gray-700 dark:text-gray-200 flex-1 min-w-0 truncate">
                {t(`keyBindings.actions.${action}`)}
              </span>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                {isRecording ? (
                  <span className="text-xs text-amber-500 dark:text-amber-400 animate-pulse">
                    {t("keyBindings.pressKey")}
                  </span>
                ) : shortcuts.length > 0 ? (
                  <Keycap shortcut={shortcuts[0]} />
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-600">
                    {t("keyBindings.noBinding")}
                  </span>
                )}
                <button
                  onClick={() =>
                    isRecording ? setRecording(null) : setRecording(action)
                  }
                  disabled={saving}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  {isRecording ? t("keyBindings.cancel") : t("keyBindings.edit")}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleReset}
          disabled={saving}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? t("saving") : t("keyBindings.resetAll")}
        </button>
      </div>
    </div>
  );
};
