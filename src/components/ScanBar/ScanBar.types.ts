import type { ScanProgress } from "@/lib/useScanProgress";

export interface ScanBarProps {
  /** The running scan's `done`/`total` counter, or `null` before the first one arrives. */
  progress: ScanProgress | null;
  /** The line under the bar — build it with `scanStatusLine`. */
  status: string;
  /**
   * Accessible name of the bar. Defaults to "Scan progress"; a caller running
   * something that is not a scan (Settings → App downloading an update) passes
   * its own, so screen-reader users are not told a scan is under way.
   */
  label?: string;
}
