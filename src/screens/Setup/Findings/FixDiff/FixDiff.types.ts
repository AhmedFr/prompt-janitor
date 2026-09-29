export interface FixDiffProps {
  /** The text the fix removes; empty for a pure insertion. */
  from: string;
  /** The text the fix puts in its place. */
  to: string;
  /** The AI provider's explanation of its rewrite. */
  note?: string;
  /** The fix is an AI rewrite rather than the check's deterministic fix. */
  ai?: boolean;
}
