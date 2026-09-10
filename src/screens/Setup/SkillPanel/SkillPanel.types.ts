import type { ArtifactView } from "@/lib/ipc";

/** A skill file's `---` header, split from its body for the read view. */
export interface Frontmatter {
  /** `key: value` pairs in file order; scalars only (see `splitFrontmatter`). */
  fields: [string, string][];
  /** Everything after the closing fence — the markdown the panel renders. */
  body: string;
}

/** What the panel is doing right now. */
export type PanelMode = "read" | "edit";

/** The load/save state of one skill's file, as `useSkillSource` maintains it. */
export interface SkillSource {
  /** The file as it currently is on disk, or `null` until the read lands. */
  content: string | null;
  /** Absolute path, for the header. */
  path: string | null;
  /**
   * The file's modification stamp as of this read, or `null` before one
   * lands. Sent back on save so a write over a file that changed underneath
   * the panel is refused rather than silently winning.
   */
  modified: string | null;
  /** The read is in flight. */
  loading: boolean;
  /** The save is in flight. */
  saving: boolean;
  /** Whatever went wrong with the last read or save, phrased for the user. */
  error: string | null;
  /**
   * Persists `next` to disk. Resolves to the file's new size in bytes when the
   * write landed, or `null` when it failed — in which case `error` says why.
   */
  save: (next: string) => Promise<number | null>;
}

export interface SkillPanelProps {
  /** The row that was clicked. Its `id` is what the IPC commands key on. */
  skill: ArtifactView;
  /** Closes the panel. The caller restores focus to the row. */
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
  /** The file, already loaded (or still loading, or failed) — see `useSkillSource`. */
  source: SkillSource;
  /**
   * Which mode to open in. Only stories pass this: the app always opens a
   * panel in `read`, because a click on a row is a request to look at it.
   */
  initialMode?: PanelMode;
}
