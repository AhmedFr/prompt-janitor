import type { FileDetailState } from "@/lib/useFileDetail";

/** Everything the Findings tab reads: one graded file, and whether AI rewrites may run. */
export type FindingsState = FileDetailState;

export interface FindingsProps {
  /** The graded file's id; `null` for an item the grader never grades. */
  fileId: string | null;
  /** Show this 1-based line in the Content tab's Source view (the line link). */
  onJumpToLine: (line: number) => void;
  /** A fix landed; the table's Findings count should refresh. */
  onChanged?: () => void;
  /** Story override for the loaded state (the same pattern `Setup`'s `data` override uses); the app never passes it. */
  findings?: FindingsState;
}
