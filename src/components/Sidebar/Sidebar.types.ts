import type { Route } from "@/App/App.types";

export interface SidebarProps {
  /** Currently active route. */
  active: Route;
  /** Navigate to a different route. */
  onNavigate: (route: Route) => void;
  /** Replay the onboarding wizard. */
  onReplay?: () => void;
}

export interface NavItem {
  route: Route;
  label: string;
}
