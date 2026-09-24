import type { RateTone } from "@/components/DataTable";
import type { ArtifactView } from "@/lib/ipc";

/** One `·`-separated piece of the meta line. */
export interface MetaSegment {
  text: string;
  /** Set on the error rate only, banded the way the table's Error % column is. */
  tone?: RateTone;
}

export interface ArtifactMetaProps {
  artifact: ArtifactView;
  /** The Scope column's label for this row. */
  scope: string;
  /**
   * Off for a skill, whose frontmatter — the first thing in the viewer — already
   * carries its description.
   */
  showDescription?: boolean;
}
