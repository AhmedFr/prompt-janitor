import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/App";
import { Panel } from "@/screens/Panel";
import { isPanelWindow } from "@/lib/window-kind";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/shell.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

// The menu-bar panel window loads the same bundle with `?window=panel`: the
// popover instead of the app shell, so a second hidden App never fetches or
// listens in parallel with the main window. The same test gates the launch-time
// update probe, so it lives in one place (`@/lib/window-kind`).
const isPanel = isPanelWindow();

// The panel window is transparent so the card's corners show the desktop
// through them; the main window must keep its background. A class on the root
// element is what lets one stylesheet say both (see `Panel.css`).
if (isPanel) document.documentElement.classList.add("panel-window");

ReactDOM.createRoot(root).render(
  <React.StrictMode>{isPanel ? <Panel /> : <App />}</React.StrictMode>,
);
