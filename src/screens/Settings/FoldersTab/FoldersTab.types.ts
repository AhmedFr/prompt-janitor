import type { HarnessInfo } from "@/lib/ipc";
import type { ScanProgressState } from "@/lib/useScanProgress";

/** An extra folder armed for removal, with the backend's own count of what it would delete. */
export interface ArmedRemoval {
  path: string;
  /**
   * How many projects removing `path` would delete — from `previewFolderRemoval`;
   * null when the preview failed and the count is unknown.
   */
  count: number | null;
}

/**
 * Presentational half of the tab — rendered from state `useFoldersTab` already
 * loaded. Kept separate so a story can hand it fixed data without a Tauri
 * runtime behind it.
 */
export interface FoldersTabBodyProps {
  harnesses: HarnessInfo[];
  extraFolders: string[];
  /** A scan (rescan, or the one an added folder triggers) is in flight. */
  scanning: boolean;
  scanProgress: ScanProgressState;
  /** The extra folder currently armed for removal, with its count, or null. */
  armed: ArmedRemoval | null;
  /** Prompt for a folder, add it to the extra scan list, and scan. */
  addFolder: () => Promise<void>;
  /** Ask to remove `path`: removes at once if nothing would be deleted, otherwise arms the confirmation. */
  askRemove: (path: string) => Promise<void>;
  /** Disarm without removing anything. */
  cancelRemove: () => void;
  /** Remove the armed folder and rescan. */
  confirmRemove: () => Promise<void>;
  /** Re-scan every detected harness plus the extra folders. */
  rescan: () => Promise<void>;
}

/** What `useFoldersTab` returns: the body's props, plus the initial load state. */
export interface UseFoldersTab extends FoldersTabBodyProps {
  /** True until the first `listHarnesses`/`getExtraScanFolders` round trip lands. */
  loading: boolean;
}
