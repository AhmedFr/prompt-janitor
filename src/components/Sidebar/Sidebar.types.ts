import type { Navigate, Route } from "@/App/App.types";
import type { Grade } from "@/lib/ipc";
import type { IconName } from "@/components/Icon";

export interface SidebarProps {
  /** Currently active route. */
  active: Route;
  /** Navigate to a route, optionally with a target (e.g. a project id). */
  onNavigate: Navigate;
  /** Replay the onboarding wizard. */
  onReplay?: () => void;
}

export interface NavItem {
  route: Route;
  label: string;
  /** Leading glyph, drawn from the shared {@link IconName} set. */
  icon: IconName;
}

/** A scanned project, rolled up for the sidebar's Projects list. */
export interface SidebarProject {
  /**
   * The project's root path, which is also its id everywhere else in the app
   * — what a recent opens its project page by, and the same value the
   * Projects table navigates with.
   */
  id: string;
  /** Project name (the on-disk folder). */
  name: string;
  /** Health grade, averaged across the project's files. */
  grade: Grade;
  /** Detected logo data URI, if any. */
  logo: string | null;
  /** Most recent file mtime in the project (epoch seconds string), for ordering. */
  modified: string | null;
}

/** Optional per-route badge counts shown on the right of a nav item. */
export type NavCounts = Partial<Record<Route, number>>;
