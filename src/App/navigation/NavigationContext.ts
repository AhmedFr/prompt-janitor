import { createContext, useContext } from "react";
import type { Navigation } from "./navigation.types";

/** The shell's navigation, for anything below it that needs Back. */
export const NavigationContext = createContext<Navigation | null>(null);

/** Back, for any toolbar; inert outside the shell (stories, tests). */
export function useBack(): { canGoBack: boolean; back: () => void } {
  const nav = useContext(NavigationContext);
  return nav ?? { canGoBack: false, back: () => {} };
}
