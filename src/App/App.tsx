import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "@/components/Sidebar";
import { Onboarding } from "@/components/Onboarding";
import { UpdateBanner } from "@/components/UpdateBanner";
import { Overview } from "@/screens/Overview";
import { Setup } from "@/screens/Setup";
import { Projects } from "@/screens/Projects";
import { Project } from "@/screens/Project";
import { Prompts } from "@/screens/Prompts";
import { Detail } from "@/screens/Detail";
import { Scans } from "@/screens/Scans";
import { Analytics } from "@/screens/Analytics";
import { Settings } from "@/screens/Settings";
import { isTauri, type NavigateEvent } from "@/lib/ipc";
import { useUpdateCheck } from "@/lib/useUpdateCheck";
import { isRuleTab } from "@/screens/Settings/ChecksTab/ChecksLibrary/checksLibrary.columns";
import type { RuleTabId } from "@/screens/Settings/ChecksTab/ChecksLibrary/ChecksLibrary.types";
import { isRoute } from "./App.constants";
import type { Route } from "./App.types";
import { parseSetupTarget } from "./setupTarget";

const ONBOARDED_KEY = "pj-onboarded";

export function App() {
  const [route, setRoute] = useState<Route>("overview");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined);
  // The raw deep link, parsed below: it arrives as a plain string (the panel's
  // `navigate` event carries nothing richer).
  const [setupTarget, setSetupTarget] = useState<string | undefined>(undefined);
  const [promptsTarget, setPromptsTarget] = useState<string | undefined>(undefined);
  const [projectPath, setProjectPath] = useState<string | undefined>(undefined);
  const [checksTab, setChecksTab] = useState<RuleTabId | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(
    () => isTauri && localStorage.getItem(ONBOARDED_KEY) !== "done",
  );
  // A quiet probe a few seconds after launch. News, never a modal — see
  // `useUpdateCheck` for why the failure path says nothing at all.
  const update = useUpdateCheck();
  // Parsed once per link, so Setup's target-syncing effects see a stable object.
  const parsedSetupTarget = useMemo(() => parseSetupTarget(setupTarget), [setupTarget]);

  // Stable across renders: screens hand `navigate` to `useCallback`s of their
  // own, and Setup's column cache keys on the identity of the context those
  // close over — a fresh function every render defeats it.
  const navigate = useCallback((next: Route, target?: string) => {
    // The two old Rules routes are settings visits now — Rules moved into
    // Settings → Checks (spec §8) — so this is decided before anything else
    // sets `route` to something that no longer renders.
    if (next === "rules" || next === "rules-new") {
      setRoute("settings");
      setSettingsTab("checks");
      setChecksTab(isRuleTab(target) ? target : undefined);
      return;
    }
    setRoute(next);
    if (next === "detail" && target !== undefined) setDetailId(target);
    if (next === "settings") setSettingsTab(target);
    // An ordinary settings visit forgets the rule table: only an old Rules
    // deep link (above) means to open on one.
    if (next === "settings") setChecksTab(undefined);
    // Where Setup lands — a kind, a filter, an item. `parseSetupTarget`
    // validates it, so a typo cannot open a kind that does not exist.
    // Cleared by an untargeted visit (the sidebar), so a deep link cannot
    // keep reopening a slice the user asked for once.
    if (next === "setup") setSetupTarget(target);
    if (next === "prompts") setPromptsTarget(target);
    // Unlike `detail`, an untargeted `project` clears rather than keeps: the
    // screen is addressed by path, and carrying the last one forward would
    // silently open the wrong project.
    if (next === "project") setProjectPath(target);
  }, []);

  // The menu-bar panel is a window of its own with no router: a row clicked
  // there raises this window and sends the destination over as an event.
  // Deliberately not gated on `isTauri` — this is the shell's own listener,
  // and outside the desktop runtime `listen` rejects, which the catch absorbs.
  useEffect(() => {
    const unlisten = listen<NavigateEvent>("navigate", ({ payload }) => {
      // The route crossed a window boundary as a bare string: a stale link or
      // a typo would otherwise blank the shell by matching no screen at all.
      if (isRoute(payload.route)) navigate(payload.route, payload.target ?? undefined);
    }).catch((error) => {
      // Inside the runtime this is a real failure — the panel's rows would
      // silently do nothing — so say so rather than swallowing it. Outside it
      // (a plain dev server) the rejection is expected.
      if (isTauri) console.error("navigate listener failed", error);
      return () => {};
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [navigate]);

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
        {update.version && (
          <UpdateBanner
            version={update.version}
            onOpen={() => {
              // Acting on the banner is the strongest possible acknowledgement
              // of it: leaving the bar up over the tab it just opened would be
              // the app repeating news the user is already reading.
              navigate("settings", "app");
              update.dismiss();
            }}
            onDismiss={update.dismiss}
          />
        )}
        {route === "overview" && <Overview navigate={navigate} />}
        {route === "setup" && <Setup navigate={navigate} target={parsedSetupTarget} />}
        {route === "projects" && <Projects navigate={navigate} />}
        {route === "project" && <Project path={projectPath} navigate={navigate} />}
        {route === "prompts" && <Prompts navigate={navigate} target={promptsTarget} />}
        {route === "detail" && <Detail fileId={detailId} navigate={navigate} />}
        {route === "scans" && <Scans navigate={navigate} />}
        {route === "analytics" && <Analytics navigate={navigate} />}
        {route === "settings" && (
          <Settings navigate={navigate} initialTab={settingsTab} checksTab={checksTab} />
        )}
      </main>
      {showOnboarding && <Onboarding onDone={finishOnboarding} />}
    </div>
  );
}
