import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePresentationStore } from "../../stores/presentation";
import { updateSetItem } from "../../api/commands";
import { PROFILE_MODES } from "../../utils/streamProfile";

/**
 * Operator-facing switcher for mid-presentation camera stream profile changes.
 * Shown ONLY for a "web_view" item with ≥2 saved profiles — with 0 or 1
 * profile there is nothing to switch between. Selection is optimistic and
 * persists `activeProfileId` on the item via `updateSetItem`; a rejected
 * write reverts to the previously active profile and surfaces the error.
 * The re-render this causes flows into `WebViewRenderer`, which re-resolves
 * the active source and respawns `start_stream_proxy` on its existing
 * config-changed path — no new Rust command is needed here.
 */
export const StreamProfileSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const state = usePresentationStore((s) => s.state);
  const items = state?.set?.items ?? [];
  const currentItemIndex = state?.currentItemIndex ?? 0;
  const item = items[currentItemIndex];

  const cfg = item?.webviewConfig;
  const profiles = cfg?.profiles ?? [];
  const persistedId = cfg?.activeProfileId ?? profiles[0]?.id;

  const [selectedId, setSelectedId] = useState(persistedId);
  const [error, setError] = useState<string | null>(null);

  // Read the persisted choice back whenever the current item (or its saved
  // selection) changes, so switching away and back reflects the real state.
  useEffect(() => {
    setSelectedId(persistedId);
    setError(null);
  }, [item?.id, persistedId]);

  if (
    !item ||
    item.itemType !== "web_view" ||
    !cfg ||
    profiles.length < 2 ||
    !(PROFILE_MODES as readonly string[]).includes(cfg.mode)
  ) {
    return null;
  }

  const handleSelect = async (profileId: string) => {
    if (profileId === selectedId) return;
    const previous = selectedId;
    setSelectedId(profileId);
    setError(null);
    try {
      await updateSetItem({
        id: item.id,
        webviewConfig: { ...cfg, activeProfileId: profileId },
      });
    } catch (err) {
      setSelectedId(previous);
      setError(t("presentation.streamProfile.switchFailed"));
      console.error("switch stream profile failed:", err);
    }
  };

  return (
    <div
      data-testid="stream-profile-switcher"
      className="flex items-center gap-2 px-2 py-1 border-b border-border"
    >
      <span className="text-xs text-muted">
        {t("presentation.streamProfile.label")}
      </span>
      {profiles.map((profile) => (
        <button
          key={profile.id}
          type="button"
          aria-pressed={profile.id === selectedId}
          onClick={() => handleSelect(profile.id)}
          className={`px-2 py-1 text-xs rounded-lg transition-colors ${
            profile.id === selectedId
              ? "bg-primary text-fg-on-primary font-medium"
              : "bg-surface-2 text-muted hover:bg-border"
          }`}
        >
          {profile.label}
        </button>
      ))}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
};
