import type { ArtifactView, EffectiveRule } from "@/lib/ipc";

/**
 * Which stack a graded file loads in. The IPC `Layer` also has `plugin`, but a
 * *file* the grader scanned is either one of the global rule files or it sits
 * inside a project — a plugin never owns the file being viewed.
 */
export type MergeLayer = "global" | "project";

/** The project a file's rule stack belongs to. */
export interface MergeProject {
  name: string;
  path: string;
}

/** Where one graded file sits in the harness's merge order, and what it names. */
export interface MergePositionData {
  layer: MergeLayer;
  /** The project whose stack this file loads into; `null` for a global file. */
  project: MergeProject | null;
  /** The viewed file's own path, so its row in the stack can say "this file". */
  filePath: string;
  /** Every rule file that applies here, in load order. */
  effective: EffectiveRule[];
  /** Artifacts this file names in its text, with their usage evidence. */
  referenced: ArtifactView[];
}

/**
 * `null` while the setup inventory is still loading and `"error"` when it could
 * not be read. An empty {@link MergePositionData} is a real answer — "nothing
 * applies here" — so it cannot share a representation with either.
 */
export type MergePositionState = MergePositionData | "error" | null;

export interface MergePositionProps {
  state: MergePositionState;
  /** Reference instant for the usage chips. Defaults to `new Date()`. */
  now?: Date;
}
