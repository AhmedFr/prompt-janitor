import type { ReactNode } from "react";
import type { SourceFormat } from "@/lib/ipc";

/** Rendered markdown, or the file exactly as written. */
export type ViewMode = "rendered" | "source";

export interface FileViewerProps {
  /** What the file is called, for labels ("code-reviewer.md source"). */
  name: string;
  /** The file as read, or `null` while loading or after a failed read. */
  content: string | null;
  /** How the backend classified it; `null` until the read lands. */
  format: SourceFormat | null;
  /** Absolute path, for picking the grammar by extension. */
  path: string | null;
  loading: boolean;
  /** Why the read failed, phrased for the user. */
  error: string | null;
  /** Reads the file again, offered next to the error. */
  onRetry?: () => void;
  /** Buttons at the right end of the viewer's bar (Edit, for a skill). */
  actions?: ReactNode;
  /**
   * Replaces the body while present — the skill editor. The mode toggle and
   * find step aside: neither means anything over a textarea.
   */
  editor?: ReactNode;
  /** What a markdown file with a header and no body reads as. */
  emptyBody?: string;
  /** Which mode to open in; stories only, the app goes by the format. */
  initialMode?: ViewMode;
}

/** What {@link useFileViewer} hands the view. */
export interface FileViewerState {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  findOpen: boolean;
  openFind: () => void;
  closeFind: () => void;
  query: string;
  setQuery: (query: string) => void;
  /** Bumped by every ⌘F, so an open find bar takes focus again. */
  findFocus: number;
}
