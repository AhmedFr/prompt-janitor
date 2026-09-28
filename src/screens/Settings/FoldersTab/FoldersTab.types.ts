import type { HarnessInfo, ProjectRow } from "@/lib/ipc";
import type { ScanProgressState } from "@/lib/useScanProgress";

/**
 * Presentational half of the tab — rendered from state `useFoldersTab` already
 * loaded. Kept separate so a story can hand it fixed data without a Tauri
 * runtime behind it.
 */
export interface FoldersTabBodyProps {
  harnesses: HarnessInfo[];
  extraFolders: string[];
  /** Every project on record, for counting what a folder's removal would delete. */
  projects: ProjectRow[];
  /** A scan (rescan, or the one an added folder triggers) is in flight. */
  scanning: boolean;
  scanProgress: ScanProgressState;
  /** The extra folder path currently armed for removal, or null. */
  armed: string | null;
  /** Prompt for a folder, add it to the extra scan list, and scan. */
  addFolder: () => Promise<void>;
  /** Ask to remove `path`: removes at once if nothing would be deleted, otherwise arms the confirmation. */
  askRemove: (path: string) => void;
  /** Disarm without removing anything. */
  cancelRemove: () => void;
  /** Remove the armed folder and rescan. */
  confirmRemove: () => Promise<void>;
  /** Re-scan every detected harness plus the extra folders. */
  rescan: () => Promise<void>;
}

/** What `useFoldersTab` returns: the body's props, plus the initial load state. */
export interface UseFoldersTab extends FoldersTabBodyProps {
  /** True until the first `listHarnesses`/`getExtraScanFolders`/`listProjects` round trip lands. */
  loading: boolean;
}
