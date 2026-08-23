import { useCallback, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Onboarding } from "@/components/Onboarding";
import { Overview } from "@/screens/Overview";
import { Setup } from "@/screens/Setup";
import { Projects } from "@/screens/Projects";
import { Project } from "@/screens/Project";
import { Prompts } from "@/screens/Prompts";
import { Detail } from "@/screens/Detail";
import { Scans } from "@/screens/Scans";
import { Analytics } from "@/screens/Analytics";
import { Rules } from "@/screens/Rules";
import { Settings } from "@/screens/Settings";
import { isTauri } from "@/lib/ipc";
import type { Route } from "./App.types";

const ONBOARDED_KEY = "pj-onboarded";

/**
 * A route that exists but has no screen yet — `rules-new` (spec §4.3) is
 * wired end to end here (union member, `navigate` plumbing) so the screen
 * that lands next only has to be swapped in. Renders nothing visible.
 */
function RoutePending() {
  return <span hidden />;
}

export function App() {
  const [route, setRoute] = useState<Route>("overview");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined);
  const [promptsTarget, setPromptsTarget] = useState<string | undefined>(undefined);
  const [projectPath, setProjectPath] = useState<string | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(
    () => isTauri && localStorage.getItem(ONBOARDED_KEY) !== "done",
  );

  // Stable across renders: screens hand `navigate` to `useCallback`s of their
  // own, and Setup's column cache keys on the identity of the context those
  // close over — a fresh function every render defeats it.
  const navigate = useCallback((next: Route, target?: string) => {
    setRoute(next);
    if (next === "detail" && target !== undefined) setDetailId(target);
    if (next === "settings") setSettingsTab(target);
    if (next === "prompts") setPromptsTarget(target);
    // Unlike `detail`, an untargeted `project` clears rather than keeps: the
    // screen is addressed by path, and carrying the last one forward would
    // silently open the wrong project.
    if (next === "project") setProjectPath(target);
  }, []);

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
        {route === "setup" && <Setup navigate={navigate} />}
        {route === "projects" && <Projects navigate={navigate} />}
        {route === "project" && <Project path={projectPath} navigate={navigate} />}
        {route === "rules-new" && <RoutePending />}
        {route === "prompts" && <Prompts navigate={navigate} target={promptsTarget} />}
        {route === "detail" && <Detail fileId={detailId} navigate={navigate} />}
        {route === "scans" && <Scans navigate={navigate} />}
        {route === "analytics" && <Analytics navigate={navigate} />}
        {route === "rules" && <Rules />}
        {route === "settings" && <Settings navigate={navigate} initialTab={settingsTab} />}
      </main>
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
    </div>
  );
}
