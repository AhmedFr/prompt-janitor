import type { ScanProgress } from "@/lib/useScanProgress";

export interface ScanBarProps {
  /** The running scan's `done`/`total` counter, or `null` before the first one arrives. */
  progress: ScanProgress | null;
  /** The line under the bar — build it with `scanStatusLine`. */
  status: string;
}
