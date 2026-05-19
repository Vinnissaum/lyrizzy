import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./locales/pt-BR.json";
import enUS from "./locales/en-US.json";

// Initialised synchronously so that t() is available before first render.
// Locale is loaded from the DB in main.tsx after i18n is ready.
i18next
  .use(initReactI18next)
  .init({
    lng: "pt-BR",
    fallbackLng: "pt-BR",
    resources: {
      "pt-BR": { translation: ptBR },
      "en-US": { translation: enUS },
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;
