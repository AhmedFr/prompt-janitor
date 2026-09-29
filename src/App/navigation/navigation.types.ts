import type { Navigate } from "../App.types";
import type { SetupTarget } from "../setupTarget";
import type { SettingsTabId } from "@/screens/Settings/Settings.constants";
import type { RuleTabId } from "@/screens/Settings/ChecksTab/ChecksLibrary/ChecksLibrary.types";

/** Where the main window is — one serialisable value (spec §10). */
export type NavState =
  | { route: "setup"; target: SetupTarget }
  | { route: "projects" }
  /** `checksTab`: the rule table Settings → Checks opens on (Built-in / Custom / AI checks). */
  | { route: "settings"; tab: SettingsTabId; checksTab?: RuleTabId };

export interface NavHistory {
  entries: NavState[];
  index: number;
}

export type NavAction =
  | { type: "push"; state: NavState }
  | { type: "replace"; state: NavState }
  | { type: "back" }
  | { type: "closeItem" };

/** What {@link useNavigation} hands the shell, and what `NavigationContext` carries. */
export interface Navigation {
  state: NavState;
  canGoBack: boolean;
  /** A (route, target) pair of any vintage, resolved through `resolveExternal` and pushed. */
  navigate: Navigate;
  push: (state: NavState) => void;
  replace: (state: NavState) => void;
  back: () => void;
  /** Closes the open item: Back when opening it pushed the entry, else a replace. */
  closeItem: () => void;
  /**
   * While registered, Back (⌘[ and the toolbar arrow) calls `onBack` instead
   * of popping — how the viewer asks before dropping an unsaved draft. A
   * `navigate` (a sidebar or panel link) asks it too, handing it `proceed`:
   * the guard calls that once the user lets the work go. The return value
   * unregisters it. Components use `useBackGuard`.
   */
  registerBackGuard: (onBack: BackGuard) => () => void;
}

/** A screen's Back guard. `proceed`, when given, is the navigation to carry on with after it lets go. */
export type BackGuard = (proceed?: () => void) => void;
