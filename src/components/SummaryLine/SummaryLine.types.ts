import type { ReactNode } from "react";
import type { Grade } from "@/lib/ipc";
import type { SetupFilter } from "@/lib/setupFilter";

export interface SummaryLineProps {
  grade: Grade | null;
  items: number;
  counts: Record<Exclude<SetupFilter, "all">, number>;
  active: SetupFilter;
  onFilter: (filter: SetupFilter) => void;
  /** Replaces the static grade chip (the popover trigger, Part 3). */
  badge?: ReactNode;
}
