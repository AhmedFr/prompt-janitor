import { createContext, useContext, useEffect, useRef } from "react";
import type { BackGuard, Navigation } from "./navigation.types";

/** The shell's navigation, for anything below it that needs Back. */
export const NavigationContext = createContext<Navigation | null>(null);

/** Back, for any toolbar; inert outside the shell (stories, tests). */
export function useBack(): { canGoBack: boolean; back: () => void } {
  const nav = useContext(NavigationContext);
  return nav ?? { canGoBack: false, back: () => {} };
}

/**
 * While `active`, Back (⌘[ and the toolbar arrow) calls `onBack` instead of
 * leaving — for a screen holding work Back would throw away. A `navigate`
 * asks it too, passing `proceed` to call once the work is let go. The latest
 * `onBack` is the one called; outside the shell this does nothing.
 */
export function useBackGuard(active: boolean, onBack: BackGuard): void {
  const register = useContext(NavigationContext)?.registerBackGuard;
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  useEffect(() => {
    if (!active || !register) return;
    return register((proceed) => latest.current(proceed));
  }, [active, register]);
}
