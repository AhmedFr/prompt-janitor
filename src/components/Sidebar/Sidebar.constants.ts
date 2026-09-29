import type { NavItem } from "./Sidebar.types";

/** Primary sidebar destinations. `detail` is intentionally excluded — it opens from Setup. */
export const NAV_ITEMS: NavItem[] = [
  { route: "setup", label: "Setup", icon: "layers" },
  // The canonical list of projects; the "Recent" section below the nav is a
  // shortcut into the most recent few, not the inventory (spec §4.2).
  { route: "projects", label: "Projects", icon: "folder" },
  { route: "settings", label: "Settings", icon: "settings" },
];

/** How many projects the "recent" list shows before it stops (newest first). */
export const RECENT_PROJECTS_LIMIT = 6;
