import type { ArtifactView } from "@/lib/ipc";

/** One `label: value` line in the sheet's facts list. */
export type Fact = [label: string, value: string];

export interface FactsOptions {
  /**
   * Off for a skill, whose frontmatter already shows its description — the
   * same sentence twice, and a stale one whenever the file changed since the
   * last scan.
   */
  showDescription?: boolean;
}

export interface ArtifactFactsProps extends FactsOptions {
  artifact: ArtifactView;
  /** The Scope column's label for this row ("Global", a project, a plugin). */
  scope: string;
}
