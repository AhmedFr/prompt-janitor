import type { Grade, TrendPoint } from "@/lib/ipc";

export interface FixResult {
  files: number;
  edits: number;
}

export interface GradePopoverState {
  trend: TrendPoint[];
  openFindings: number;
  fixable: number;
  loading: boolean;
}

export interface GradePopoverProps {
  grade: Grade | null;
  /** Story/test override: renders from this and never calls the hook. */
  state?: GradePopoverState;
  onFix?: () => Promise<FixResult>;
}

export interface GradePopoverViewProps {
  grade: Grade | null;
  state: GradePopoverState;
  onFix: () => Promise<FixResult>;
  /** Live path only: told when the popover opens or closes so the hook can load lazily. */
  onOpenChange?: (open: boolean) => void;
}
