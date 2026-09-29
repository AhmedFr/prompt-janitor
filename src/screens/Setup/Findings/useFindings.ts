import { useFileDetail } from "@/lib/useFileDetail";
import type { FindingsState } from "./Findings.types";

/** The Findings tab's data: the story override when one is given, else the live file (one loader, shared with Detail). */
export function useFindings(fileId: string | null, override?: FindingsState): FindingsState {
  const live = useFileDetail(override ? null : fileId);
  return override ?? live;
}
