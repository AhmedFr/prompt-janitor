import type {
  EffectiveRule,
  FileRow,
  ProjectRow,
  ProjectSetup,
  ProjectUsage,
} from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";

export interface ProjectProps {
  /**
   * The project's root path — `ProjectRow.id`, which is what
   * `navigate("project", id)` carries. `undefined` when the route was
   * reached without one, which the screen says out loud rather than
   * guessing at a project.
   */
  path?: string;
  navigate: Navigate;
  /** Override the live data (Storybook only); the hook supplies it in the app. */
  data?: ProjectData | null;
}

/**
 * One project, assembled from the five reads the page needs. `project` is
 * `null` when every read succeeded and none of them knows this path — a
 * different answer from `data === null`, which means a read failed.
 */
export interface ProjectData {
  project: ProjectRow | null;
  /** This project's scanned files (already narrowed by `project_id`). */
  files: FileRow[];
  /** This project's slice of the setup inventory, when the harness has one. */
  setup: ProjectSetup | null;
  /** The rule stack the harness loads here, in load order. Empty without a harness. */
  effective: EffectiveRule[];
  /** Usage over the trailing window. `null` without a harness to attribute it to. */
  usage: ProjectUsage | null;
  /** When the harness that works here was last scanned. */
  lastScanAt: string | null;
  /** The harness that has worked here most, or `null` if none ever has. */
  harness: string | null;
  /** That harness as the product spells it, for the scan bar's status line. */
  harnessName: string | null;
}

/** What {@link useProject} hands the screen. */
export interface ProjectState {
  data: ProjectData | null;
  loading: boolean;
  refetch: () => Promise<void>;
}
