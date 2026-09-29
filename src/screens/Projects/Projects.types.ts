import type { ProjectRow, SetupView } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";

export interface ProjectsProps {
  navigate: Navigate;
  /** Override the live data (Storybook only); the hook supplies it in the app. */
  data?: ProjectRow[] | null;
  /** Override the setup inventory (tests, Storybook). */
  setup?: SetupView | null;
  /** Override the 90-day session counts (tests, Storybook). */
  sessions90?: Map<string, number> | null;
}

/** What {@link useProjects} hands the screen. */
export interface ProjectsState {
  data: ProjectRow[] | null;
  /** For "items available"; `null` until loaded or if it failed. */
  setup: SetupView | null;
  /** Sessions per project in the last 90 days; `null` until loaded or if it failed. */
  sessions90: Map<string, number> | null;
  loading: boolean;
  refetch: () => Promise<void>;
}
