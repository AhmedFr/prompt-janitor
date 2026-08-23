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
  /**
   * The rule stack the harness loads here, in load order. `null` means the
   * read failed — an empty array means the harness genuinely loads nothing
   * here, and the two must not render alike. Also `null` when there is no
   * harness, which the tabs distinguish by checking {@link ProjectData.harness}
   * first.
   */
  effective: EffectiveRule[] | null;
  /** Usage over the trailing window. `null` on a failed read, or with no harness — see {@link ProjectData.effective}. */
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
  /**
   * The last snapshot that loaded, kept across a failed refetch — see
   * {@link ProjectState.error}. `null` only before the first one lands.
   */
  data: ProjectData | null;
  loading: boolean;
  /**
   * The most recent read failed. With `data` still set this means the page on
   * screen is the previous scan's and says so; with `data` null it means
   * nothing ever loaded, and the screen shows the failure panel instead.
   */
  error: boolean;
  refetch: () => Promise<void>;
}
