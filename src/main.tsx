import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./index.css";
import "./i18n/index";
import i18next from "./i18n/index";
import { invoke } from "@tauri-apps/api/core";

async function init() {
  // Load persisted locale before first render to avoid a flash of wrong language.
  try {
    const locale = await invoke<string>("get_setting", { key: "app.locale" });
    if (locale && locale !== i18next.language) {
      await i18next.changeLanguage(locale);
    }
  } catch {
    // DB not ready yet or setting missing — stay on default pt-BR.
  }

  const label = (await getCurrentWindow()).label;
  let App: React.FC;

  if (label === "presentation") {
    const { PresentationApp } = await import("./windows/presentation/PresentationApp");
    App = PresentationApp;
  } else if (label === "stage") {
    const { StageApp } = await import("./windows/stage/StageApp");
    App = StageApp;
  } else {
    const { OperatorApp } = await import("./windows/operator/OperatorApp");
    App = OperatorApp;
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

init();
