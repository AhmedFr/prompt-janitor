import type { NavItem } from "./Sidebar.types";

/** The sidebar's destinations, in order (spec §3.1): one per `Route`. */
export const NAV_ITEMS: NavItem[] = [
  { route: "setup", label: "Setup", icon: "layers" },
  // The canonical list of projects; the "Recent" section below the nav is a
  // shortcut into the most recent few, not the inventory (spec §3.1).
  { route: "projects", label: "Projects", icon: "folder" },
  { route: "settings", label: "Settings", icon: "settings" },
];

/** How many projects the "recent" list shows before it stops (newest first). */
export const RECENT_PROJECTS_LIMIT = 6;
