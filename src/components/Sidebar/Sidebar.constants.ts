import type { Route } from "@/App/App.types";
import type { NavItem } from "./Sidebar.types";

/** Primary sidebar destinations. `detail` is intentionally excluded — it opens from Setup. */
export const NAV_ITEMS: NavItem[] = [
  { route: "setup", label: "Setup", icon: "layers" },
  // The canonical list of projects; the recents underneath are a shortcut
  // into the six most recent, not the inventory (spec §4.2).
  { route: "projects", label: "Projects", icon: "folder" },
  { route: "settings", label: "Settings", icon: "settings" },
];

/** How many projects the "recent" list shows before it stops (newest first). */
export const RECENT_PROJECTS_LIMIT = 6;

/**
 * Routes that are reached *from* a nav destination rather than being one, and
 * the item that should stay lit while they are open. Without this the whole
 * nav goes dark the moment a project page or a new-rule form opens, which
 * reads as "you have left the app" rather than "you are one level down".
 * Routes absent from this map own themselves.
 */
export const NAV_OWNER: Partial<Record<Route, Route>> = {
  project: "projects",
  // Reachable from Overview and a project page as well as from Setup, but
  // Setup is the graded-file list a file belongs to now — and a nav with
  // nothing lit is worse than one lit a level up from where the reader came in.
  detail: "setup",
  // Retired destinations: their content lives in Setup now. The routes still
  // render if reached (the menu-bar panel, old links) until Part 5 removes
  // them, and Setup stays lit so the nav never goes dark.
  overview: "setup",
  analytics: "setup",
  scans: "setup",
};
