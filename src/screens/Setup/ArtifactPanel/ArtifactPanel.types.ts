import type { ArtifactView } from "@/lib/ipc";
import type { ArtifactSourceState } from "../Setup.types";

export interface ArtifactPanelProps {
  /** The row that was clicked. Its `id` is what the source read keys on. */
  artifact: ArtifactView;
  /** The Scope column's label for this row. */
  scope: string;
  /** Closes the sheet. The sheet hands focus back to the row itself. */
  onClose: () => void;
}

export interface ArtifactPanelViewProps extends ArtifactPanelProps {
  /** The source, already loaded (or still loading, or failed) — see `useArtifactSource`. */
  source: ArtifactSourceState;
}
