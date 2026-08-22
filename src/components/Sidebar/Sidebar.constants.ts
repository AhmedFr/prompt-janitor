import type { NavItem } from "./Sidebar.types";

/** Primary sidebar destinations. `detail` is intentionally excluded — it opens from Prompts. */
export const NAV_ITEMS: NavItem[] = [
  { route: "overview", label: "Overview", icon: "dashboard" },
  { route: "setup", label: "Setup", icon: "layers" },
  // The canonical list of projects; the recents underneath are a shortcut
  // into the six most recent, not the inventory (spec §4.2).
  { route: "projects", label: "Projects", icon: "folder" },
  { route: "prompts", label: "Prompts", icon: "prompts" },
  { route: "scans", label: "Scans", icon: "scans" },
  { route: "analytics", label: "Analytics", icon: "barChart" },
  { route: "rules", label: "Rules", icon: "rules" },
  { route: "settings", label: "Settings", icon: "settings" },
];

/** How many projects the "recent" list shows before it stops (newest first). */
export const RECENT_PROJECTS_LIMIT = 6;
