import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "@/components/Sidebar";
import { Onboarding } from "@/components/Onboarding";
import { UpdateBanner } from "@/components/UpdateBanner";
import { Setup } from "@/screens/Setup";
import type { SetupProps } from "@/screens/Setup/Setup.types";
import { Projects } from "@/screens/Projects";
import { Settings } from "@/screens/Settings";
import { isTauri, type NavigateEvent } from "@/lib/ipc";
import { useUpdateCheck } from "@/lib/useUpdateCheck";
import { NavigationContext, useNavigation } from "./navigation";

const ONBOARDED_KEY = "pj-onboarded";

export function App() {
  // One navigation state with a back stack (spec §10): Setup's lens,
  // filters and open item, and the Settings tab, all live here, so Back
  // restores every one of them.
  const nav = useNavigation();
  const { navigate, push, replace } = nav;
  const [showOnboarding, setShowOnboarding] = useState(
    () => isTauri && localStorage.getItem(ONBOARDED_KEY) !== "done",
  );
  // A quiet probe a few seconds after launch. News, never a modal — see
  // `useUpdateCheck` for why the failure path says nothing at all.
  const update = useUpdateCheck();

  // Stable, like `navigate`: Setup's callbacks close over it.
  const onSetupChange = useCallback<NonNullable<SetupProps["onTargetChange"]>>(
    (target, mode) => (mode === "push" ? push : replace)({ route: "setup", target }),
    [push, replace],
  );

  // The menu-bar panel is a window of its own with no router: a row clicked
  // there raises this window and sends the destination over as an event.
  // Every route resolves (`resolveExternal`), so a stale link or a typo lands
  // somewhere real rather than blanking the shell. `navigate` asks the back
  // guard first, so a link from the panel never drops an unsaved draft in the
  // viewer: the viewer's discard confirmation decides. Deliberately not gated on
  // `isTauri` — this is the shell's own listener, and outside the desktop
  // runtime `listen` rejects, which the catch absorbs.
  useEffect(() => {
    const unlisten = listen<NavigateEvent>("navigate", ({ payload }) => {
      navigate(payload.route, payload.target ?? undefined);
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
    push({ route: "setup", target: {} });
  };

  const { state } = nav;
  return (
    <NavigationContext.Provider value={nav}>
      <div className="app-window">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Sidebar active={state.route} onNavigate={navigate} onReplay={() => setShowOnboarding(true)} />
        <main id="main-content" className="app-content" tabIndex={-1}>
          {update.version && (
            <UpdateBanner
              version={update.version}
              onOpen={() => {
                // Acting on the banner is the strongest possible acknowledgement
                // of it: leaving the bar up over the tab it just opened would be
                // the app repeating news the user is already reading.
                navigate("settings", "about");
                update.dismiss();
              }}
              onDismiss={update.dismiss}
            />
          )}
          {state.route === "setup" && (
            <Setup
              navigate={navigate}
              target={state.target}
              onTargetChange={onSetupChange}
              onCloseItem={nav.closeItem}
            />
          )}
          {state.route === "projects" && <Projects navigate={navigate} />}
          {state.route === "settings" && (
            <Settings navigate={navigate} initialTab={state.tab} checksTab={state.checksTab} />
          )}
        </main>
        {showOnboarding && <Onboarding onDone={finishOnboarding} />}
      </div>
    </NavigationContext.Provider>
  );
}
