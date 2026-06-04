import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Overview } from "@/screens/Overview";
import { Prompts } from "@/screens/Prompts";
import { Detail } from "@/screens/Detail";
import { Scans } from "@/screens/Scans";
import { Rules } from "@/screens/Rules";
import { Settings } from "@/screens/Settings";
import type { Route } from "./App.types";

export function App() {
  const [route, setRoute] = useState<Route>("overview");
  const [detailId, setDetailId] = useState<string | null>(null);

  const navigate = (next: Route, fileId?: string) => {
    setRoute(next);
    if (fileId !== undefined) setDetailId(fileId);
  };

  return (
    <div className="app-window">
      <Sidebar active={route} onNavigate={(r) => navigate(r)} />
      <main className="app-content">
        {route === "overview" && <Overview navigate={navigate} />}
        {route === "prompts" && <Prompts navigate={navigate} />}
        {route === "detail" && <Detail fileId={detailId} navigate={navigate} />}
        {route === "scans" && <Scans navigate={navigate} />}
        {route === "rules" && <Rules />}
        {route === "settings" && <Settings />}
      </main>
    </div>
  );
}
