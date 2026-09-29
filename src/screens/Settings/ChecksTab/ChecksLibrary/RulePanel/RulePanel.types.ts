import type { RuleInfo } from "@/lib/ipc";

export interface RulePanelProps {
  /** The row that was clicked. */
  rule: RuleInfo;
  /** Closes the sheet. The sheet hands focus back to the row itself. */
  onClose: () => void;
}

/** One `label: value` line in the sheet's facts list. */
export type RuleFact = [label: string, value: string];
