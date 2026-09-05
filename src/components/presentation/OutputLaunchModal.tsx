import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Play } from "lucide-react";
import {
  getPresentationState,
  getSetting,
  loadSetForPresentation,
  setSetting,
  OUTPUT2_LAST_SET_KEY,
} from "../../api/commands";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useMediaStore } from "../../stores/media";
import { useSetsStore } from "../../stores/sets";
import { launchOutputAt } from "../../utils/outputDispatch";
import { ItemTypeIcon, itemLabel, songArtist } from "./itemMeta";
import type { OutputId } from "../../types";

/**
 * Launch modal for a presentation output (Screen 2). Opened from the
 * `OutputSwitcher` tab when the target output is not presenting yet. It confirms
 * the set currently pointed at the output — defaulted by
 * `OperatorPresentationLayout`'s auto-load effect to Tela 1's set (or the last
 * presented one) — and lets the operator pick which item to start on.
 *
 * Picking an item routes through {@link launchOutputAt}, which loads the set,
 * opens the window, and jumps to the chosen item in one go (so the screen never
 * needs an overlay nudge to actually open, and an already-open window re-syncs).
 *
 * The modal reads the store's `state` directly: it only opens once the tab has
 * focused this output, so `state` already reflects it.
 */
export const OutputLaunchModal: React.FC<{
  output: OutputId;
  /** `launched` is true only when the modal closed because a presentation was
   *  started; cancel/X/Esc pass it falsy so the host can return focus to Tela 1. */
  onClose: (launched?: boolean) => void;
}> = ({ output, onClose }) => {
  const { t } = useTranslation();
  const state = usePresentationStore((s) => s.state);
  const songs = useLibraryStore((s) => s.songs);
  const media = useMediaStore((s) => s.media);
  const sets = useSetsStore((s) => s.sets);
  const refreshSets = useSetsStore((s) => s.refresh);

  // Sub-view: pick a different set before choosing the start item.
  const [changingSet, setChangingSet] = useState(false);
  const [busy, setBusy] = useState(false);
  // Re-syncing the screen-2 set to the current source on open (see effect).
  const [syncing, setSyncing] = useState(output === "two");

  const setName = state?.set?.name;
  const items = state?.set?.items ?? [];
  const n = output === "one" ? 1 : 2;

  useEffect(() => {
    refreshSets();
    // Close on Esc (cancel — host returns focus to Tela 1).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
    };
    window.addEventListener("keydown", onKey);

    // Re-sync the target screen to the *current* source set each time the modal
    // opens. The backend keeps whatever set was loaded for this output during
    // the previous presentation, so after stopping and changing the set the
    // modal would otherwise list the stale items until launch reloaded them.
    // Source = Tela 1's current set, falling back to this screen's last-used set
    // (same resolution as the operator's auto-load), so the operator can still
    // override it via "Trocar conjunto".
    let cancelled = false;
    if (output === "two") {
      (async () => {
        try {
          const one = await getPresentationState("one");
          let sourceSetId = one?.set?.id;
          if (!sourceSetId) {
            sourceSetId = (await getSetting(OUTPUT2_LAST_SET_KEY)) ?? undefined;
          }
          if (sourceSetId && !cancelled) {
            await loadSetForPresentation(sourceSetId, "two");
          }
        } catch (err) {
          console.error("resync screen 2 set failed:", err);
        } finally {
          if (!cancelled) setSyncing(false);
        }
      })();
    }

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickItem = async (itemIndex: number) => {
    const setId = state?.set?.id;
    if (!setId || busy) return;
    setBusy(true);
    try {
      await launchOutputAt(setId, itemIndex, output);
      if (output === "two") {
        setSetting(OUTPUT2_LAST_SET_KEY, setId).catch(() => {});
      }
      onClose(true);
    } catch (err) {
      console.error("launch output failed:", err);
      setBusy(false);
    }
  };

  // Swap the set the output points at WITHOUT opening the window, then return to
  // the item list so the operator picks a start item from the new set.
  const handleSwapSet = async (setId: string) => {
    try {
      await loadSetForPresentation(setId, output);
      if (output === "two") {
        setSetting(OUTPUT2_LAST_SET_KEY, setId).catch(() => {});
      }
    } catch (err) {
      console.error("swap set for output failed:", err);
    }
    setChangingSet(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      data-testid="output-launch-modal"
    >
      <div className="bg-surface rounded-xl shadow-2xl w-[520px] max-h-[75vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">
            {t("presentation.output.launchTitle", { n })}
          </h3>
          <button
            onClick={() => onClose(false)}
            className="text-muted hover:text-inherit"
            aria-label={t("home.overlay.cancel")}
          >
            <X size={16} />
          </button>
        </div>

        {changingSet ? (
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-xs text-muted mb-2">
              {t("presentation.output.choosePrompt", { n })}
            </p>
            {sets.length === 0 ? (
              <p className="text-center text-muted py-8 text-sm">
                {t("presentation.empty")}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {sets.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => handleSwapSet(st.id)}
                    className="px-3 py-2 text-sm text-left rounded-lg bg-surface-2 hover:bg-border transition-colors truncate"
                  >
                    {st.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-xs text-muted truncate">
                {t("presentation.output.launchPrompt")}
                {setName ? ` — ${setName}` : ""}
              </p>
              <button
                type="button"
                onClick={() => {
                  refreshSets();
                  setChangingSet(true);
                }}
                className="text-xs text-primary hover:underline shrink-0 ml-2"
              >
                {t("presentation.output.changeSet")}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {syncing ? (
                <p className="text-center text-muted py-8 text-sm">…</p>
              ) : items.length === 0 ? (
                <p className="text-center text-muted py-8 text-sm">
                  {t("presentation.empty")}
                </p>
              ) : (
                items.map((item, idx) => {
                  const artist = songArtist(item, songs);
                  return (
                    <button
                      key={idx}
                      disabled={busy}
                      onClick={() => handlePickItem(idx)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm w-full text-fg hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ItemTypeIcon item={item} size={16} className="shrink-0" />
                      <span className="min-w-0 flex-1 flex flex-col">
                        <span className="truncate">{itemLabel(item, songs, media, t)}</span>
                        {artist && (
                          <span className="truncate text-xs text-muted">{artist}</span>
                        )}
                      </span>
                      <Play size={12} className="shrink-0 text-muted" />
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        <div className="px-4 py-3 border-t border-border flex justify-end">
          <button
            onClick={() => onClose(false)}
            className="px-4 py-2 text-sm rounded-lg bg-surface-2 hover:bg-border transition-colors"
          >
            {t("home.overlay.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};
