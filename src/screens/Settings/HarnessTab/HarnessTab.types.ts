import type { HarnessInfo } from "@/lib/ipc";
import type { ScanProgressState } from "@/lib/useScanProgress";

/**
 * Presentational half of the tab — rendered from state `useHarnessTab` already
 * loaded. Kept separate so a story can hand it fixed data without a Tauri
 * runtime behind it.
 */
export interface HarnessTabBodyProps {
  harnesses: HarnessInfo[];
  extraFolders: string[];
  /** A scan (rescan, or the one an added folder triggers) is in flight. */
  scanning: boolean;
  scanProgress: ScanProgressState;
  /** Prompt for a folder, add it to the extra scan list, and scan. */
  addFolder: () => Promise<void>;
  /** Drop `path` from the extra scan list and rescan. */
  removeFolder: (path: string) => Promise<void>;
  /** Re-scan every detected harness plus the extra folders. */
  rescan: () => Promise<void>;
}

/** What `useHarnessTab` returns: the body's props, plus the initial load state. */
export interface UseHarnessTab extends HarnessTabBodyProps {
  /** True until the first `listHarnesses`/`getExtraScanFolders` round trip lands. */
  loading: boolean;
}
