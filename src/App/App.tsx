import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Onboarding } from "@/components/Onboarding";
import { Overview } from "@/screens/Overview";
import { Prompts } from "@/screens/Prompts";
import { Detail } from "@/screens/Detail";
import { Scans } from "@/screens/Scans";
import { Rules } from "@/screens/Rules";
import { Settings } from "@/screens/Settings";
import { isTauri } from "@/lib/ipc";
import type { Route } from "./App.types";

const ONBOARDED_KEY = "pj-onboarded";

export function App() {
  const [route, setRoute] = useState<Route>("overview");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(
    () => isTauri && localStorage.getItem(ONBOARDED_KEY) !== "done",
  );

  const navigate = (next: Route, fileId?: string) => {
    setRoute(next);
    if (fileId !== undefined) setDetailId(fileId);
  };

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDED_KEY, "done");
    setShowOnboarding(false);
    setRoute("overview");
  };

  return (
    <div className="app-window">
      <Sidebar active={route} onNavigate={(r) => navigate(r)} onReplay={() => setShowOnboarding(true)} />
      <main className="app-content">
        {route === "overview" && <Overview navigate={navigate} />}
        {route === "prompts" && <Prompts navigate={navigate} />}
        {route === "detail" && <Detail fileId={detailId} navigate={navigate} />}
        {route === "scans" && <Scans navigate={navigate} />}
        {route === "rules" && <Rules />}
        {route === "settings" && <Settings navigate={navigate} />}
      </main>
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
    </div>
  );
}
