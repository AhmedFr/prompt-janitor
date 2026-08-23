import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/App";
import { Panel } from "@/screens/Panel";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/shell.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

// The menu-bar panel window loads the same bundle with `?window=panel`: the
// popover instead of the app shell, so a second hidden App never fetches or
// listens in parallel with the main window. Query-string detection keeps
// Storybook and the tests free of Tauri window APIs.
const isPanel = new URLSearchParams(window.location.search).get("window") === "panel";

// The panel window is transparent so the card's corners show the desktop
// through them; the main window must keep its background. A class on the root
// element is what lets one stylesheet say both (see `Panel.css`).
if (isPanel) document.documentElement.classList.add("panel-window");

ReactDOM.createRoot(root).render(
  <React.StrictMode>{isPanel ? <Panel /> : <App />}</React.StrictMode>,
);
