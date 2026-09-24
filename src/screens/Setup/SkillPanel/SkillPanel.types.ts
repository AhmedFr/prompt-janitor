import type { ArtifactView } from "@/lib/ipc";
import type { ArtifactSourceState } from "../Setup.types";

/** What the panel is doing right now. */
export type PanelMode = "read" | "edit";

export interface SkillPanelProps {
  /** The row that was clicked. Its `id` is what the IPC commands key on. */
  skill: ArtifactView;
  /** The Scope column's label for this row. */
  scope: string;
  /** Closes the panel. The sheet hands focus back to the row itself. */
  onClose: () => void;
  /**
   * Called after a save lands, so the caller can refresh whatever the write
   * invalidated — the Size column, most obviously.
   *
   * Deliberately carries no byte count. `save` returns one, but the screen
   * refetches the whole inventory rather than patching a single cell: one
   * source of truth beats two, and the query is local.
   */
  onSaved?: () => void;
}

export interface SkillPanelViewProps extends SkillPanelProps {
  /** The file, already loaded (or still loading, or failed) — see `useArtifactSource`. */
  source: ArtifactSourceState;
  /**
   * Which mode to open in. Only stories pass this: the app always opens a
   * panel in `read`, because a click on a row is a request to look at it.
   */
  initialMode?: PanelMode;
}
