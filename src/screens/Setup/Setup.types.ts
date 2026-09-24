import type { ArtifactKind, SetupView, SourceFormat } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";

export interface SetupProps {
  navigate: Navigate;
  /** Override the live data (Storybook only); the hook supplies it in the app. */
  data?: SetupView | null;
  /** The kind tab to open on. Defaults to the remembered one, then to Rules. */
  initialTab?: ArtifactKind;
}

/** What {@link useSetup} hands the screen. */
export interface SetupState {
  data: SetupView | null;
  loading: boolean;
  refetch: () => Promise<void>;
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
