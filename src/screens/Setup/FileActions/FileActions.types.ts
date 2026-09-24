export interface FileActionsProps {
  /** The artifact whose file the actions act on — the backend resolves the path. */
  artifactId: number;
  /** The text on screen, which Copy puts on the clipboard; `null` until read. */
  content: string | null;
  /** Something the system refused, phrased for the user. */
  onError: (message: string) => void;
}
