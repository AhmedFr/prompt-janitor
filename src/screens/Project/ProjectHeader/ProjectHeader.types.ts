import type { ProjectRow } from "@/lib/ipc";

export interface ProjectHeaderProps {
  project: ProjectRow;
  /** When the harness that works here was last scanned; `null` if never. */
  lastScanAt: string | null;
}

/** One labelled number in the header's fact list. */
export interface FactProps {
  label: string;
  value: string;
}
