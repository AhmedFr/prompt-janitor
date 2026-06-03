import { useState, type ComponentType } from "react";
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

  return (
    <div className="app-window">
      <Sidebar active={route} onNavigate={setRoute} />
      <main className="app-content">
        <Screen />
      </main>
    </div>
  );
}
