import type { ViewerTab } from "@/App/setupTarget";
import type { ArtifactUsage } from "@/lib/ipc";
import type { FindingsState } from "../Findings";
import type { ArtifactSourceState } from "../Setup.types";
import type { SetupRow } from "../setupRows.util";

/** What the viewer is doing right now. */
export type PanelMode = "read" | "edit";

export interface ItemViewerProps {
  /** The row that was clicked: an inventory item (keyed on `id`) or a graded-only file (on `file_id`). */
  item: SetupRow;
  /** The Scope column's label for this row. */
  scope: string;
  /** The tab on show; the caller owns it so a deep link can open on any tab. */
  tab: ViewerTab;
  onTab: (tab: ViewerTab) => void;
  /** Closes the viewer. The sheet hands focus back to the row itself. */
  onClose: () => void;
  /**
   * Moves to the row `delta` away in the table's on-screen order (⌘↑/⌘↓ and
   * the step buttons). Absent, there are no step buttons.
   */
  onStep?: (delta: -1 | 1) => void;
  /**
   * Called after a save or a fix lands, so the caller can refresh whatever
   * the write invalidated — the Size and Findings columns, most obviously.
   */
  onSaved?: () => void;
  /** Projects that load this instruction file every session. */
  loadedIn: { path: string; name: string }[];
  onSelectProject: (path: string) => void;
}

export interface ItemViewerViewProps extends ItemViewerProps {
  /** The file, already loaded (or still loading, or failed) — see `useArtifactSource`. */
  source: ArtifactSourceState;
  /**
   * Which mode to open in. Only stories pass this: the app always opens the
   * viewer in `read`, because a click on a row is a request to look at it.
   */
  initialMode?: PanelMode;
  /** Story override for the Findings tab's load; the app never passes it. */
  findings?: FindingsState;
  /** Story override for the Usage tab's load; the app never passes it. */
  usage?: ArtifactUsage | null;
}
