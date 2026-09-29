import type { DayCount, ProjectSetup } from "@/lib/ipc";

export interface ProjectStripProps {
  project: ProjectSetup;
  /** Sessions per day over the lens window; null when no harness has worked here or the read failed. */
  sessionsPerDay: DayCount[] | null;
  onReveal: () => void;
}
