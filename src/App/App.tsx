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
import { RulesNew } from "@/screens/RulesNew";
import { Settings } from "@/screens/Settings";
import { isTauri, type ArtifactKind } from "@/lib/ipc";
// Deep import, not the screen barrel: this is the tab strip's own id list,
// and the barrel would pull the whole Setup screen in behind it.
import { KIND_TABS } from "@/screens/Setup/setup.columns";
import type { Route } from "./App.types";

const ONBOARDED_KEY = "pj-onboarded";

/** A `setup` target only counts when it names a kind the tab strip actually has. */
const isKindTab = (value: string | undefined): value is ArtifactKind =>
  KIND_TABS.some((tab) => tab.id === value);

export function App() {
  const [route, setRoute] = useState<Route>("overview");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined);
  const [setupTab, setSetupTab] = useState<ArtifactKind | undefined>(undefined);
  const [promptsTarget, setPromptsTarget] = useState<string | undefined>(undefined);
  const [projectPath, setProjectPath] = useState<string | undefined>(undefined);
  const [rulesTab, setRulesTab] = useState<string | undefined>(undefined);
  const [rulesNewTarget, setRulesNewTarget] = useState<string | undefined>(undefined);
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
    // Which kind tab Setup opens on — a ranked usage row links to the tab
    // that holds it. Validated rather than cast: the target is a bare string
    // from anywhere in the app, and a typo stored as a tab id would open a
    // kind that does not exist. Cleared by an untargeted visit (the sidebar),
    // so a deep link cannot keep reopening a kind the user asked for once.
    if (next === "setup") setSetupTab(isKindTab(target) ? target : undefined);
    if (next === "prompts") setPromptsTarget(target);
    // Unlike `detail`, an untargeted `project` clears rather than keeps: the
    // screen is addressed by path, and carrying the last one forward would
    // silently open the wrong project.
    if (next === "project") setProjectPath(target);
    // Which of the three rule tables to open on — `/rules/new` sends the user
    // back to the tab their new rule landed in.
    if (next === "rules") setRulesTab(target);
    // The tab `/rules/new` was opened from: where Cancel returns to, and
    // which kind of rule the form starts on.
    if (next === "rules-new") setRulesNewTarget(target);
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
        {route === "setup" && <Setup navigate={navigate} initialTab={setupTab} />}
        {route === "projects" && <Projects navigate={navigate} />}
        {route === "project" && <Project path={projectPath} navigate={navigate} />}
        {route === "rules-new" && <RulesNew initialType={rulesNewTarget} navigate={navigate} />}
        {route === "prompts" && <Prompts navigate={navigate} target={promptsTarget} />}
        {route === "detail" && <Detail fileId={detailId} navigate={navigate} />}
        {route === "scans" && <Scans navigate={navigate} />}
        {route === "analytics" && <Analytics navigate={navigate} />}
        {route === "rules" && <Rules navigate={navigate} initialTab={rulesTab} />}
        {route === "settings" && <Settings navigate={navigate} initialTab={settingsTab} />}
      </main>
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
    </div>
  );
}
