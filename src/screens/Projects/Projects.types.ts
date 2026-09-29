import type { FileRow, ProjectRow, ProjectUsage, SetupView } from "@/lib/ipc";
import type { SetupRow } from "@/screens/Setup/setupRows.util";
import type { Navigate } from "@/App/App.types";

export interface ProjectsProps {
  navigate: Navigate;
  /** Override the live data (Storybook only); the hook supplies it in the app. */
  data?: ProjectRow[] | null;
  /** Override the setup inventory (tests, Storybook). */
  setup?: SetupView | null;
  /** Override each project's usage, keyed by its trimmed path (tests, Storybook). */
  usage?: Map<string, ProjectUsage | null> | null;
  /** Override the 90-day session counts (tests, Storybook). */
  sessions90?: Map<string, number> | null;
}

/** What {@link useProjects} hands the screen. */
export interface ProjectsState {
  data: ProjectRow[] | null;
  /** For "items available"; `null` until loaded or if it failed. */
  setup: SetupView | null;
  /** Graded files, so the lens's rows are Setup's rows. */
  files: FileRow[];
  /** Each project's own usage (what its lens counts against); `null` where it failed or is not loaded. */
  usage: Map<string, ProjectUsage | null> | null;
  /** Sessions per project in the last 90 days; `null` until loaded or if it failed. */
  sessions90: Map<string, number> | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

/** What the Projects columns read besides the row. */
export interface ProjectsColumnsCtx {
  /** Setup's rows for the whole machine; `null` until the inventory loads. */
  rows: SetupRow[] | null;
  usage: Map<string, ProjectUsage | null> | null;
  sessions90: Map<string, number> | null;
  /** The harness a project with none of its own is read under. */
  fallbackHarness: string;
}
