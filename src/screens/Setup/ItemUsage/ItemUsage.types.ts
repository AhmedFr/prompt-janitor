import type { ArtifactUsage } from "@/lib/ipc";
import type { SetupRow } from "../setupRows.util";

export interface ItemUsageProps {
  item: SetupRow;
  /** Projects that load this instruction file every session. */
  loadedIn: { path: string; name: string }[];
  onSelectProject: (path: string) => void;
  /** Story override: skips the load and renders this usage. */
  usage?: ArtifactUsage | null;
}
