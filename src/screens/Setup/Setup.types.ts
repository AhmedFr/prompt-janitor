import type { EffectiveRule, FileRow, HarnessInfo, ProjectSetup, ProjectUsage, SetupView, SourceFormat } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";
import type { SetupTarget } from "@/App/setupTarget";

export interface SetupProps {
  navigate: Navigate;
  /** Override the live data (Storybook and tests); the hook supplies it in the app. */
  data?: SetupView | null;
  /** Override the graded files (Storybook and tests). */
  files?: FileRow[];
  /**
   * Where Setup is: kind, filter, lens, open item, tab. With `onTargetChange`
   * it is the whole state (the shell's navigation holds it); without, it is
   * where a deep link lands and Setup holds the rest itself (stories, tests).
   */
  target?: SetupTarget;
  /**
   * Makes Setup controlled: every change is reported here and never held.
   * `push` for a new place (kind, filter, lens, open item), `replace` for a
   * refinement of this one (the viewer's tab).
   */
  onTargetChange?: (next: SetupTarget, mode: SetupChangeMode) => void;
  /** Closes the viewer as a history step (the shell's `closeItem`); else closing reports a push. */
  onCloseItem?: () => void;
  /** Override the load state (tests). */
  loading?: boolean;
  /** Override the lens's backend reads (Storybook), which only the desktop app can make. */
  lensData?: LensData;
}

/** Whether a Setup change is a new history entry or refines the current one. */
export type SetupChangeMode = "push" | "replace";

/** Setup's one piece of navigation state and the one way to change it ({@link useSetupTarget}). */
export interface SetupTargetControl {
  value: SetupTarget;
  change: (next: SetupTarget, mode: SetupChangeMode) => void;
}

/** The lensed project's load order and usage; both `null` until read, or when it has none. */
export interface LensData {
  effective: EffectiveRule[] | null;
  usage: ProjectUsage | null;
}

/** What {@link useSetup} hands the screen. */
export interface SetupState {
  data: SetupView | null;
  /** Every graded file, so one the inventory never saw still gets a row; empty when the query fails. */
  files: FileRow[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export interface InventoryProps {
  data: SetupView;
  files: FileRow[];
  /** The harnesses the scan found, for the header line. */
  detected: HarnessInfo[];
  navigate: Navigate;
  /** Setup's state and how to change it: the chip, the status filter, the open item and its tab. */
  control: SetupTargetControl;
  /** Closes the viewer through the shell, when there is one. */
  onCloseItem?: () => void;
  /** A load or refresh is in flight: a deep link to an item not in the rows yet waits for it. */
  loading: boolean;
  /** Reloads the inventory — how a saved skill's new size reaches the table. */
  onRefetch: () => Promise<void>;
  /** Path of the project the lens is on, or `null` for the whole setup. `Setup` owns it. */
  lens: string | null;
  /** The lensed project, or `null` without a lens or for a path only the grader knows. */
  lensProject: ProjectSetup | null;
  lensData: LensData;
  /** Turns the lens on a project, or off with `null` (the viewer's Usage tab links here). */
  onLens: (path: string | null) => void;
}

/** The load/save state of one artifact's source, as `useArtifactSource` maintains it. */
export interface ArtifactSourceState {
  /** The file (or its redacted excerpt) as it is on disk, or `null` until the read lands. */
  content: string | null;
  /** Absolute path, for the header. */
  path: string | null;
  /** How to draw `content`; `null` until the read lands. */
  format: SourceFormat | null;
  /** Whether a save will be accepted. `false` until a read says otherwise. */
  editable: boolean;
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
  /** Reads the file again — the retry beside a failed read. */
  reload: () => void;
}
