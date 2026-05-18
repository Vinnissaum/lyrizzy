import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./index.css";

async function init() {
  const label = (await getCurrentWindow()).label;
  let App: React.FC;

  if (label === "presentation") {
    const { PresentationApp } = await import("./windows/presentation/PresentationApp");
    App = PresentationApp;
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
