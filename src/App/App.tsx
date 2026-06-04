import { useEffect, useState, type ComponentType } from "react";
import { commands, isTauri } from "@/lib/ipc";
import { Sidebar } from "@/components/Sidebar";
import { Overview } from "@/screens/Overview";
import { Prompts } from "@/screens/Prompts";
import { Detail } from "@/screens/Detail";
import { Scans } from "@/screens/Scans";
import { Rules } from "@/screens/Rules";
import { Settings } from "@/screens/Settings";
import type { Route } from "./App.types";

const SCREENS: Record<Route, ComponentType> = {
  overview: Overview,
  prompts: Prompts,
  detail: Detail,
  scans: Scans,
  rules: Rules,
  settings: Settings,
};

export function App() {
  const [route, setRoute] = useState<Route>("overview");
  const Screen = SCREENS[route];

  // Phase 0 typed-IPC round-trip: confirm the store is reachable when running
  // inside Tauri. (Skipped in a plain browser dev server, where invoke is absent.)
  useEffect(() => {
    if (!isTauri) return;
    void commands.getAppStatus().then((res) => {
      if (res.status === "ok") {
        console.info("[prompt-janitor] db status", res.data);
      } else {
        console.error("[prompt-janitor] get_app_status failed:", res.error);
      }
    });
  }, []);

  return (
    <div className="app-window">
      <Sidebar active={route} onNavigate={setRoute} />
      <main className="app-content">
        <Screen />
      </main>
    </div>
  );
}
