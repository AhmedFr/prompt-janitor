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
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined);
  const [promptsTarget, setPromptsTarget] = useState<string | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(
    () => isTauri && localStorage.getItem(ONBOARDED_KEY) !== "done",
  );

  const navigate = (next: Route, target?: string) => {
    setRoute(next);
    if (next === "detail" && target !== undefined) setDetailId(target);
    if (next === "settings") setSettingsTab(target);
    if (next === "prompts") setPromptsTarget(target);
  };

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDED_KEY, "done");
    setShowOnboarding(false);
    setRoute("overview");
  };

  return (
    <div className="app-window">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Sidebar active={route} onNavigate={navigate} onReplay={() => setShowOnboarding(true)} />
      <main id="main-content" className="app-content" tabIndex={-1}>
        {route === "overview" && <Overview navigate={navigate} />}
        {route === "prompts" && <Prompts navigate={navigate} target={promptsTarget} />}
        {route === "detail" && <Detail fileId={detailId} navigate={navigate} />}
        {route === "scans" && <Scans navigate={navigate} />}
        {route === "rules" && <Rules />}
        {route === "settings" && <Settings navigate={navigate} initialTab={settingsTab} />}
      </main>
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
    </div>
  );
}
