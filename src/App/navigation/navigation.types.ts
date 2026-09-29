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
