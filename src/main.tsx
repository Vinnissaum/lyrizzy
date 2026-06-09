import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./index.css";
import "./i18n/index";
import i18next from "./i18n/index";
import { invoke } from "@tauri-apps/api/core";
import { outputFromWindowLabel } from "./api/commands";

// Operator UI supports a light/dark theme via data-theme on <html>; the
// presentation window is always dark. The theme is applied before first render
// (below) so there's no flash of the wrong palette.

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
  const output = outputFromWindowLabel(label);
  let element: React.ReactElement;

  if (output) {
    // Presentation output is always dark, independent of the operator's theme.
    document.documentElement.dataset.theme = "dark";
    const { PresentationApp } = await import("./windows/presentation/PresentationApp");
    element = <PresentationApp output={output} />;
  } else {
    // Apply the persisted operator theme before render to avoid a flash.
    try {
      const theme = await invoke<string>("get_setting", { key: "ui.theme" });
      document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
    } catch {
      document.documentElement.dataset.theme = "dark"; // setting missing → default
    }
    const { OperatorApp } = await import("./windows/operator/OperatorApp");
    element = <OperatorApp />;
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>{element}</React.StrictMode>
  );
}

init();
