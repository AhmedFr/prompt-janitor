import type { FileDetail } from "@/lib/ipc";

export interface IssueActionsProps {
  /** The finding being acted on. */
  issue: FileDetail["issues"][number];
  /** The graded file the finding belongs to. */
  fileId: string;
  /** The finding's position in the file's issue list (what `suggest_fix` takes). */
  index: number;
  /** An AI provider with a key is set up, so a rewrite can be asked for. */
  aiReady: boolean;
  /** AI rewrites may run (always true while payments are off). */
  entitled: boolean;
  /** Re-read the file after a fix lands or is undone. */
  onReload: () => Promise<void>;
}
