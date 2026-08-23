import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/App";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/shell.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

// The menu-bar panel window loads the same bundle with `?window=panel`. Until
// the panel UI lands it renders nothing, so a second hidden App never fetches
// or listens in parallel with the main window.
const isPanel = new URLSearchParams(window.location.search).get("window") === "panel";

ReactDOM.createRoot(root).render(
  <React.StrictMode>{isPanel ? <div className="panel-placeholder" /> : <App />}</React.StrictMode>,
);
