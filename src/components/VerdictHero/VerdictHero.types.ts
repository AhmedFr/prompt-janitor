import type { Grade, Overview, Severity } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";

/** One step on the "fastest path to an A": a single fixable issue. */
export interface FixPathRow {
  fileId: string;
  fileName: string;
  title: string;
  severity: Severity;
  /** Points the file's score regains when this issue is fixed. */
  points: number;
}

/** Everything the hero derives beyond the Overview payload. */
export interface VerdictData {
  /** Top open issues (≤ 3), ranked Hi > Mid > Lo then by points. */
  fixPath: FixPathRow[];
  /** Overall grade if every fix-path issue were fixed (null without rows). */
  projectedGrade: Grade | null;
  /** Issues to fix before the overall score reaches ≥ 90 (the B sentence's n). */
  fixesToA: number;
  /** Deterministically fixable issues across all files (Auto-fix's n). */
  autofixCount: number;
  /** Enabled deterministic rules. */
  detStandards: number;
  /** All enabled standards (deterministic + NL catalog). */
  totalStandards: number;
  /** Paid tier unlocked. */
  entitled: boolean;
  /** An AI provider is configured (gates the NL standards catalog). */
  aiReady: boolean;
  loading: boolean;
}

export interface VerdictHeroProps {
  data: Overview;
  verdict: VerdictData;
  scanning: boolean;
  autoFixBusy: boolean;
  onScanNow: () => void;
  /** Run every deterministic fix across all files (entitled users only). */
  onAutoFix: () => void;
  navigate: Navigate;
}
