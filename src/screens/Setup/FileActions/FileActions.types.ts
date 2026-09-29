import type { ItemRef } from "@/App/setupTarget";

export interface FileActionsProps {
  /**
   * The file the actions act on, by id — the backend resolves the path. An
   * inventory item goes by its artifact id, a graded-only file by its file id.
   */
  target: ItemRef;
  /** The text on screen, which Copy puts on the clipboard; `null` until read. */
  content: string | null;
  /** Something the system refused, phrased for the user. */
  onError: (message: string) => void;
}
