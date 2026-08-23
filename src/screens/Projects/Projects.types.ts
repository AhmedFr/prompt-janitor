import type { ProjectRow } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";

export interface ProjectsProps {
  navigate: Navigate;
  /** Override the live data (Storybook only); the hook supplies it in the app. */
  data?: ProjectRow[] | null;
}

/** What {@link useProjects} hands the screen. */
export interface ProjectsState {
  data: ProjectRow[] | null;
  loading: boolean;
  refetch: () => Promise<void>;
}
