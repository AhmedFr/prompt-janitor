export interface AiChecksProps {
  /** The graded file to check. */
  fileId: string;
  /** The file's current content — only a change signal that clears stale verdicts. */
  content: string;
  /** The checks ran and the score moved; re-read the file. */
  onApplied?: () => void;
}
