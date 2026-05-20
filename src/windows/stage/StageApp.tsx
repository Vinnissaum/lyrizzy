import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { onLocaleChanged, onSongsChanged } from "../../api/commands";
import { forwardKeydown } from "../../runtime/keyboard";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import { useMediaStore } from "../../stores/media";
import { useLibraryStore } from "../../stores/library";
import { useSettingsStore } from "../../stores/settings";
import { StageRenderer } from "../../components/stage/StageRenderer";

export const StageApp: React.FC = () => {
  const { i18n } = useTranslation();
  const { subscribe: subscribePresentation } = usePresentationStore();
  const { subscribe: subscribeCountdown } = useCountdownStore();
  const { refresh: refreshMedia } = useMediaStore();
  const { refresh: refreshSongs } = useLibraryStore();
  const { setLocale } = useSettingsStore();

  useEffect(() => {
    const unsubPresentation = subscribePresentation();
    const unsubCountdown = subscribeCountdown();
    const unlistenLocale = onLocaleChanged((locale) => {
      i18n.changeLanguage(locale);
      setLocale(locale);
    });
    const unlistenSongs = onSongsChanged(() => refreshSongs());
    refreshMedia();
    refreshSongs();

    window.addEventListener("keydown", forwardKeydown);
    return () => {
      unsubPresentation.then((u) => u());
      unsubCountdown.then((u) => u());
      unlistenLocale.then((u) => u());
      unlistenSongs.then((u) => u());
      window.removeEventListener("keydown", forwardKeydown);
    };
  }, []);

  return <StageRenderer />;
};
