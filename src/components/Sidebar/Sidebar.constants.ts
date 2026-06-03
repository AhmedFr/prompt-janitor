import type { NavItem } from "./Sidebar.types";

/** Primary sidebar destinations. `detail` is intentionally excluded — it opens from Prompts. */
export const NAV_ITEMS: NavItem[] = [
  { route: "overview", label: "Overview" },
  { route: "prompts", label: "Prompts" },
  { route: "scans", label: "Scans" },
  { route: "rules", label: "Rules" },
  { route: "settings", label: "Settings" },
];
