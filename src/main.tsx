import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/App";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/shell.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
